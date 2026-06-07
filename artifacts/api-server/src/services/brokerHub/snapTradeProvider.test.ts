import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createSnapTradeProvider, canonicalJson } from "./snapTradeProvider.js";

const requests: Array<{ url: string; init?: RequestInit }> = [];

const provider = createSnapTradeProvider({
  clientId: "client-id",
  consumerKey: "consumer-key",
  baseUrl: "https://snaptrade.test/api/v1",
  timestamp: () => 1700000000,
  fetch: async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).includes("/snapTrade/registerUser")) {
      return new Response(JSON.stringify({ userId: "snap-user-1", userSecret: "snap-secret-1" }), { status: 200 });
    }
    if (String(url).includes("/snapTrade/login")) {
      return new Response(JSON.stringify({ redirectURI: "https://portal.snaptrade.test/session", sessionId: "session-1" }), {
        status: 200,
      });
    }
    if (String(url).includes("/accounts?")) {
      return new Response(
        JSON.stringify([{ id: "snap-account-1", name: "Brokerage Margin", number: "****1234", brokerage_authorization: "auth-1" }]),
        { status: 200 },
      );
    }
    if (String(url).includes("/accounts/snap-account-1/balances")) {
      return new Response(JSON.stringify([{ currency: { code: "USD" }, cash: 1250, buying_power: 2400 }]), { status: 200 });
    }
    if (String(url).includes("/accounts/snap-account-1/positions")) {
      return new Response(
        JSON.stringify([
          { symbol: { symbol: "AAPL" }, units: 3, price: 210, average_purchase_price: 180, market_value: 630, unrealized_pnl: 90 },
        ]),
        { status: 200 },
      );
    }
    if (String(url).includes("/accounts/snap-account-1/orders")) return new Response(JSON.stringify([]), { status: 200 });
    throw new Error(`Unexpected request ${String(url)}`);
  },
});

const portal = await provider.createConnectionPortal({
  userId: "snap-user-1",
  connectionType: "trade-if-available",
  customRedirect: "http://localhost:5173/broker-hub",
});
assert.equal(portal.redirectURI, "https://portal.snaptrade.test/session");
assert.equal(portal.sessionId, "session-1");
const loginRequest = requests.find((request) => request.url.includes("/snapTrade/login"));
assert.ok(loginRequest);
const loginUrl = new URL(loginRequest.url);
assert.equal(loginUrl.searchParams.get("userId"), "snap-user-1");
assert.equal(loginUrl.searchParams.get("userSecret"), "snap-secret-1");
assert.equal(JSON.parse(String(loginRequest.init?.body)).connectionType, "trade-if-available");
assert.equal(loginRequest.init?.headers && typeof (loginRequest.init.headers as Record<string, string>).Signature, "string");

const expectedSignaturePayload = canonicalJson({
  content: { connectionPortalVersion: "v4", connectionType: "trade-if-available", customRedirect: "http://localhost:5173/broker-hub", showCloseButton: true },
  path: "/api/v1/snapTrade/login",
  query: "userId=snap-user-1&userSecret=snap-secret-1&clientId=client-id&timestamp=1700000000",
});
const expectedSignature = createHmac("sha256", "consumer-key").update(expectedSignaturePayload).digest("base64");
assert.equal((loginRequest.init?.headers as Record<string, string>).Signature, expectedSignature);

const snapshot = await provider.getSnapshot({
  userId: "snap-user-1",
  userSecret: "snap-secret-1",
  accountId: "snap-account-1",
  brokerName: "Broker azioni/crypto supportati",
  profileId: "profile-1",
  tradingEnabled: true,
});
assert.equal(snapshot.status, "connected");
assert.equal(snapshot.providerKind, "snaptrade-brokerage");
assert.equal(snapshot.accounts[0]?.id, "snap-account-1");
assert.equal(snapshot.metrics.balance, 1250);
assert.equal(snapshot.metrics.freeMargin, 2400);
assert.equal(snapshot.positions[0]?.symbol, "AAPL");
assert.equal(snapshot.positions[0]?.profit, 90);

console.log("snaptrade provider checks passed");
