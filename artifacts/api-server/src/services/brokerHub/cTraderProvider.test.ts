import assert from "node:assert/strict";
import {
  CTRADER_PAYLOAD_TYPES,
  createCTraderProvider,
  type CTraderMessage,
  type CTraderTransport,
} from "./cTraderProvider.js";

class FakeTransport implements CTraderTransport {
  requests: CTraderMessage[] = [];

  async request(payloadType: number, payload: Record<string, unknown>): Promise<CTraderMessage> {
    this.requests.push({ clientMsgId: `req-${this.requests.length + 1}`, payloadType, payload });
    if (payloadType === CTRADER_PAYLOAD_TYPES.APPLICATION_AUTH_REQ) {
      return { payloadType: CTRADER_PAYLOAD_TYPES.APPLICATION_AUTH_RES, payload: {} };
    }
    if (payloadType === CTRADER_PAYLOAD_TYPES.GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ) {
      return {
        payloadType: CTRADER_PAYLOAD_TYPES.GET_ACCOUNTS_BY_ACCESS_TOKEN_RES,
        payload: { ctidTraderAccount: [{ ctidTraderAccountId: 777, brokerName: "FP Trading", accountType: 0 }] },
      };
    }
    if (payloadType === CTRADER_PAYLOAD_TYPES.ACCOUNT_AUTH_REQ) {
      return { payloadType: CTRADER_PAYLOAD_TYPES.ACCOUNT_AUTH_RES, payload: { ctidTraderAccountId: 777 } };
    }
    if (payloadType === CTRADER_PAYLOAD_TYPES.TRADER_REQ) {
      return {
        payloadType: CTRADER_PAYLOAD_TYPES.TRADER_RES,
        payload: {
          trader: {
            ctidTraderAccountId: 777,
            balance: 125000,
            equity: 124500,
            usedMargin: 1000,
            freeMargin: 123500,
            moneyDigits: 2,
            depositAssetId: 1,
            accessRights: 0,
          },
        },
      };
    }
    if (payloadType === CTRADER_PAYLOAD_TYPES.SYMBOLS_LIST_REQ) {
      return {
        payloadType: CTRADER_PAYLOAD_TYPES.SYMBOLS_LIST_RES,
        payload: { symbol: [{ symbolId: 1, symbolName: "EURUSD" }] },
      };
    }
    if (payloadType === CTRADER_PAYLOAD_TYPES.RECONCILE_REQ) {
      return {
        payloadType: CTRADER_PAYLOAD_TYPES.RECONCILE_RES,
        payload: {
          position: [
            {
              positionId: 9001,
              tradeData: { symbolId: 1, volume: 1000, tradeSide: 2, openTimestamp: 1710000000000 },
              price: 1.08,
              unrealizedPnL: 250,
            },
          ],
          order: [{ orderId: 81, tradeData: { symbolId: 1, volume: 1000, tradeSide: 1 }, orderType: 2, orderStatus: 1 }],
        },
      };
    }
    if (payloadType === CTRADER_PAYLOAD_TYPES.NEW_ORDER_REQ) {
      return {
        payloadType: CTRADER_PAYLOAD_TYPES.EXECUTION_EVENT,
        payload: { order: { orderId: 7001 }, executionType: 2 },
      };
    }
    if (payloadType === CTRADER_PAYLOAD_TYPES.CLOSE_POSITION_REQ) {
      return {
        payloadType: CTRADER_PAYLOAD_TYPES.EXECUTION_EVENT,
        payload: { position: { positionId: 9001 }, executionType: 2 },
      };
    }
    if (payloadType === CTRADER_PAYLOAD_TYPES.DEAL_LIST_REQ) {
      return {
        payloadType: CTRADER_PAYLOAD_TYPES.DEAL_LIST_RES,
        payload: {
          deal: [
            {
              dealId: 44,
              tradeData: { symbolId: 1, volume: 1000, tradeSide: 1, openTimestamp: 1710000000000 },
              executionPrice: 1.11,
              executionTimestamp: 1710003600000,
              pnl: 350,
            },
          ],
        },
      };
    }
    throw new Error(`Unexpected payload ${payloadType}`);
  }

  close(): void {}
}

const transport = new FakeTransport();
const provider = createCTraderProvider({ transportFactory: () => transport });

const snapshot = await provider.snapshot({
  profileId: "profile-ctrader",
  brokerName: "FP Trading",
  accountId: "777",
  environment: "live",
  tradingEnabled: true,
  accessToken: "access-token",
  clientId: "client-id",
  clientSecret: "client-secret",
});

assert.equal(snapshot.status, "connected");
assert.equal(snapshot.providerKind, "ctrader-open-api");
assert.equal(snapshot.accounts[0]?.id, "777");
assert.equal(snapshot.metrics.balance, 1250);
assert.equal(snapshot.metrics.equity, 1245);
assert.equal(snapshot.metrics.freeMargin, 1235);
assert.equal(snapshot.positions[0]?.brokerPositionId, "9001");
assert.equal(snapshot.positions[0]?.symbol, "EURUSD");
assert.equal(snapshot.positions[0]?.side, "sell");
assert.equal(snapshot.positions[0]?.volume, 10);
assert.equal(snapshot.positions[0]?.profit, 2.5);

const sequence = transport.requests.map((request) => request.payloadType);
assert.deepEqual(sequence.slice(0, 6), [
  CTRADER_PAYLOAD_TYPES.APPLICATION_AUTH_REQ,
  CTRADER_PAYLOAD_TYPES.GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,
  CTRADER_PAYLOAD_TYPES.ACCOUNT_AUTH_REQ,
  CTRADER_PAYLOAD_TYPES.TRADER_REQ,
  CTRADER_PAYLOAD_TYPES.SYMBOLS_LIST_REQ,
  CTRADER_PAYLOAD_TYPES.RECONCILE_REQ,
]);

const orderResult = await provider.placeOrder({
  accountId: "777",
  order: {
    symbol: "EURUSD",
    side: "buy",
    type: "market",
    volume: 10,
    stopLoss: 1.07,
    takeProfit: 1.12,
    timeInForce: "gtc",
    clientRequestId: "client-order-1",
  },
});
assert.equal(orderResult.accepted, true);
assert.equal(orderResult.brokerOrderId, "7001");
const newOrder = transport.requests.find((request) => request.payloadType === CTRADER_PAYLOAD_TYPES.NEW_ORDER_REQ);
assert.deepEqual(newOrder?.payload, {
  ctidTraderAccountId: 777,
  symbolId: 1,
  orderType: 1,
  tradeSide: 1,
  volume: 1000,
  stopLoss: 1.07,
  takeProfit: 1.12,
});

const closeResult = await provider.closePosition({ accountId: "777", positionId: "9001" });
assert.equal(closeResult.accepted, true);
const closeRequest = transport.requests.find((request) => request.payloadType === CTRADER_PAYLOAD_TYPES.CLOSE_POSITION_REQ);
assert.deepEqual(closeRequest?.payload, { ctidTraderAccountId: 777, positionId: 9001, volume: 1000 });

const history = await provider.history({
  profileId: "profile-ctrader",
  brokerName: "FP Trading",
  accountId: "777",
  environment: "live",
  tradingEnabled: true,
  accessToken: "access-token",
  clientId: "client-id",
  clientSecret: "client-secret",
});
assert.equal(history[0]?.id, "ctrader-deal-44");
assert.equal(history[0]?.symbol, "EURUSD");
assert.equal(history[0]?.side, "buy");
assert.equal(history[0]?.volume, 10);
assert.equal(history[0]?.profit, 3.5);

await assert.rejects(
  () =>
    provider.snapshot({
      profileId: "missing-secret",
      brokerName: "FP Trading",
      accountId: "777",
      environment: "live",
      tradingEnabled: true,
      accessToken: "",
      clientId: "client-id",
      clientSecret: "",
    }),
  /Configurazione cTrader incompleta/,
);

console.log("ctrader provider checks passed");
