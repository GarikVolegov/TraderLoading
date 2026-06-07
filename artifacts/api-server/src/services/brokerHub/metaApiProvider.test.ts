import assert from "node:assert/strict";
import { createMetaApiProvider, mapMetaApiError } from "./metaApiProvider.js";

const requests: Array<{ url: string; init?: RequestInit }> = [];

const provider = createMetaApiProvider({
  token: "metaapi-token",
  provisioningBaseUrl: "https://provisioning.test",
  clientBaseUrl: "https://client.test",
  fetch: async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url) === "https://provisioning.test/users/current/accounts" && init?.method === "POST") {
      return new Response(JSON.stringify({ id: "meta-account-1", state: "DEPLOYED" }), { status: 201 });
    }
    if (String(url).endsWith("/account-information?refreshTerminalState=true")) {
      return new Response(
        JSON.stringify({
          broker: "FP Trading",
          currency: "USD",
          balance: 1000,
          equity: 990,
          margin: 25,
          freeMargin: 965,
          tradeAllowed: true,
          login: 12345678,
          type: "ACCOUNT_TRADE_MODE_REAL",
        }),
        { status: 200 },
      );
    }
    if (String(url).endsWith("/positions")) return new Response(JSON.stringify([]), { status: 200 });
    if (String(url).endsWith("/orders")) return new Response(JSON.stringify([]), { status: 200 });
    if (String(url).endsWith("/trade") && init?.method === "POST") {
      return new Response(JSON.stringify({ stringCode: "TRADE_RETCODE_DONE", orderId: "close-order-1" }), { status: 200 });
    }
    throw new Error(`Unexpected request ${String(url)}`);
  },
});

const verification = await provider.verifyAccount({
  brokerName: "FP Trading",
  accountNumber: "12345678",
  accountPassword: "broker-password",
  server: "FPMarkets-Live",
  tradingEnabled: true,
});

assert.equal(verification.providerKind, "metaapi-metatrader");
assert.equal(verification.providerAccountId, "meta-account-1");
assert.equal(verification.accountId, "12345678");
assert.equal(verification.connectionStatus, "connected");
assert.equal(verification.capabilities.placeOrders, true);
assert.equal(verification.snapshot.status, "connected");
assert.equal(verification.snapshot.metrics.balance, 1000);

const createRequest = requests.find((request) => request.url === "https://provisioning.test/users/current/accounts");
assert.ok(createRequest);
assert.equal(createRequest.init?.headers instanceof Headers, false);
const body = JSON.parse(String(createRequest.init?.body)) as Record<string, unknown>;
assert.equal(body.login, "12345678");
assert.equal(body.password, "broker-password");
assert.equal(body.server, "FPMarkets-Live");
assert.equal(body.platform, "mt5");
assert.equal(JSON.stringify(verification).includes("broker-password"), false);

assert.equal(mapMetaApiError({ details: "E_AUTH" }), "Credenziali conto non valide. Controlla numero conto, password e server.");
assert.equal(mapMetaApiError({ details: { code: "E_SRV_NOT_FOUND" } }), "Server broker non trovato. Controlla il nome server indicato dal broker.");
assert.equal(mapMetaApiError({ details: "ERR_OTP_REQUIRED" }), "Questo conto richiede una verifica OTP non supportata dal collegamento automatico.");

const unauthorizedProvider = createMetaApiProvider({
  token: "invalid-token",
  provisioningBaseUrl: "https://provisioning.test",
  clientBaseUrl: "https://client.test",
  fetch: async () => new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }),
});

await assert.rejects(
  () =>
    unauthorizedProvider.verifyAccount({
      brokerName: "FP Trading",
      accountNumber: "12345678",
      accountPassword: "broker-password",
      server: "FPMarkets-Live",
      tradingEnabled: true,
    }),
  /METAAPI_PROVISIONING_BASE_URL/,
);

const regionalRequests: string[] = [];
const regionalProvider = createMetaApiProvider({
  token: "regional-token",
  apiUrl: "https://mt-provisioning-api-v1.eu-test.agiliumtrade.ai/users/current/accounts",
  fetch: async (url, init) => {
    regionalRequests.push(String(url));
    if (String(url) === "https://mt-provisioning-api-v1.eu-test.agiliumtrade.ai/users/current/accounts" && init?.method === "POST") {
      return new Response(JSON.stringify({ id: "regional-account-1", state: "DEPLOYED" }), { status: 201 });
    }
    if (String(url).startsWith("https://mt-client-api-v1.eu-test.agiliumtrade.ai/users/current/accounts/regional-account-1/")) {
      if (String(url).endsWith("/positions")) return new Response(JSON.stringify([]), { status: 200 });
      if (String(url).endsWith("/orders")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify({ login: "regional-login", currency: "USD", balance: 1, equity: 1, margin: 0, freeMargin: 1 }), {
        status: 200,
      });
    }
    throw new Error(`Unexpected regional request ${String(url)}`);
  },
});

await regionalProvider.verifyAccount({
  brokerName: "FP Trading",
  accountNumber: "regional-login",
  accountPassword: "broker-password",
  server: "FPMarkets-Live",
  tradingEnabled: false,
});

assert.ok(regionalRequests.some((url) => url.startsWith("https://mt-provisioning-api-v1.eu-test.agiliumtrade.ai/")));
assert.ok(regionalRequests.some((url) => url.startsWith("https://mt-client-api-v1.eu-test.agiliumtrade.ai/")));

const privateClientRegionalRequests: string[] = [];
const privateClientRegionalProvider = createMetaApiProvider({
  token: "private-regional-token",
  apiUrl: "https://mt-client-api-b6d5y5y16czszqxd.london.agiliumtrade.ai",
  fetch: async (url, init) => {
    privateClientRegionalRequests.push(String(url));
    if (String(url) === "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts" && init?.method === "POST") {
      return new Response(JSON.stringify({ id: "private-regional-account-1", state: "DEPLOYED" }), { status: 201 });
    }
    if (String(url).startsWith("https://mt-client-api-b6d5y5y16czszqxd.london.agiliumtrade.ai/users/current/accounts/private-regional-account-1/")) {
      if (String(url).endsWith("/positions")) return new Response(JSON.stringify([]), { status: 200 });
      if (String(url).endsWith("/orders")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify({ login: "private-login", currency: "USD", balance: 1, equity: 1, margin: 0, freeMargin: 1 }), {
        status: 200,
      });
    }
    throw new Error(`Unexpected private regional request ${String(url)}`);
  },
});

await privateClientRegionalProvider.verifyAccount({
  brokerName: "FP Trading",
  accountNumber: "private-login",
  accountPassword: "broker-password",
  server: "FPMarkets-Live",
  tradingEnabled: false,
});

assert.ok(privateClientRegionalRequests.some((url) => url.startsWith("https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/")));
assert.ok(privateClientRegionalRequests.some((url) => url.startsWith("https://mt-client-api-b6d5y5y16czszqxd.london.agiliumtrade.ai/")));
assert.equal(
  privateClientRegionalRequests.some((url) => url.startsWith("https://mt-provisioning-api-b6d5y5y16czszqxd.london.agiliumtrade.ai/")),
  false,
);

const retryRequests: Array<{ url: string; transactionId?: string }> = [];
const retryingProvider = createMetaApiProvider({
  token: "retry-token",
  provisioningBaseUrl: "https://provisioning-retry.test",
  clientBaseUrl: "https://client-retry.test",
  provisioningRetryDelayMs: 0,
  fetch: async (url, init) => {
    retryRequests.push({
      url: String(url),
      transactionId:
        init?.headers && !(init.headers instanceof Headers)
          ? String((init.headers as Record<string, string>)["transaction-id"] ?? "")
          : undefined,
    });
    const createAttempts = retryRequests.filter((request) => request.url === "https://provisioning-retry.test/users/current/accounts").length;
    if (String(url) === "https://provisioning-retry.test/users/current/accounts" && createAttempts === 1) {
      return new Response(JSON.stringify({ message: "Automatic broker settings detection is in progress" }), {
        status: 202,
        headers: { "Retry-After": "1" },
      });
    }
    if (String(url) === "https://provisioning-retry.test/users/current/accounts" && createAttempts === 2) {
      return new Response(JSON.stringify({ id: "retry-account-1", state: "DEPLOYED" }), { status: 201 });
    }
    if (String(url).startsWith("https://client-retry.test/users/current/accounts/retry-account-1/")) {
      if (String(url).endsWith("/positions")) return new Response(JSON.stringify([]), { status: 200 });
      if (String(url).endsWith("/orders")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify({ login: "retry-login", currency: "USD", balance: 25, equity: 25, margin: 0, freeMargin: 25 }), {
        status: 200,
      });
    }
    throw new Error(`Unexpected retry request ${String(url)}`);
  },
});

const retryVerification = await retryingProvider.verifyAccount({
  brokerName: "FP Trading",
  accountNumber: "retry-login",
  accountPassword: "broker-password",
  server: "FPMarkets-Live",
  tradingEnabled: false,
});

const retryCreateRequests = retryRequests.filter((request) => request.url === "https://provisioning-retry.test/users/current/accounts");
assert.equal(retryCreateRequests.length, 2);
assert.ok(retryCreateRequests[0]?.transactionId);
assert.equal(retryCreateRequests[0]?.transactionId, retryCreateRequests[1]?.transactionId);
assert.equal(retryVerification.providerAccountId, "retry-account-1");
assert.equal(retryVerification.snapshot.status, "connected");

const closeResult = await provider.closePosition("meta-account-1", "46648037");
assert.equal(closeResult.accepted, true);
assert.equal(closeResult.orderId, "close-order-1");
const closeRequest = requests.find((request) => {
  if (!request.url.endsWith("/users/current/accounts/meta-account-1/trade")) return false;
  const requestBody = JSON.parse(String(request.init?.body)) as Record<string, unknown>;
  return requestBody.actionType === "POSITION_CLOSE_ID";
});
assert.ok(closeRequest);
const closeBody = JSON.parse(String(closeRequest.init?.body)) as Record<string, unknown>;
assert.deepEqual(closeBody, { actionType: "POSITION_CLOSE_ID", positionId: "46648037" });

console.log("metaapi provider checks passed");
