import assert from "node:assert/strict";
import {
  completeBrokerConnectionIntent,
  closeBrokerPosition,
  connectBrokerProfile,
  createCompanionPairing,
  createBrokerHubUrl,
  createBrokerConnectionIntent,
  deleteBrokerProfile,
  getCompanionStatus,
  getBrokerHistory,
  getBrokerSnapshot,
  getMt5SmartLinkDiagnostics,
  getMt5SmartLinkStatus,
  importBrokerHistory,
  listBrokerProfiles,
  loginMt5SmartLink,
  placeBrokerOrder,
  saveBrokerProfile,
  startMt5SmartLink,
  stopMt5SmartLink,
  verifyBrokerConnectionIntent,
  verifyBrokerConnectionIntentSoft,
} from "./brokerHubApi.js";

const originalFetch = globalThis.fetch;

type FetchCall = {
  url: RequestInfo | URL;
  init: RequestInit | undefined;
};

function mockFetch(handler: (url: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}

try {
  {
    assert.equal(
      createBrokerHubUrl("/brokers/profiles", { baseUrl: "https://api.example.test" }),
      "https://api.example.test/api/brokers/profiles",
    );
  }

  {
    const calls = mockFetch(() => Response.json({ activeProfileId: "p1", profiles: [] }));

    const list = await listBrokerProfiles({ baseUrl: "https://api.example.test" });

    assert.deepEqual(list, { activeProfileId: "p1", profiles: [] });
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/profiles");
    assert.equal(calls[0]?.init?.credentials, "include");
  }

  {
    const calls = mockFetch(() => Response.json({ profileId: "p1", status: "connected" }));

    const snapshot = await getBrokerSnapshot("p1", { baseUrl: "https://api.example.test" });

    assert.equal(snapshot.profileId, "p1");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/profiles/p1/snapshot");
  }

  {
    const draft = { brokerName: "FP Trading", tradingEnabled: true };
    const calls = mockFetch(() => Response.json({ profile: { id: "p1", brokerName: "FP Trading" } }));

    const result = await saveBrokerProfile(draft, { baseUrl: "https://api.example.test" });

    assert.equal(result.profile.id, "p1");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.deepEqual(calls[0]?.init?.headers, { "Content-Type": "application/json" });
    assert.equal(calls[0]?.init?.body, JSON.stringify(draft));
  }

  {
    const calls = mockFetch(() => new Response(null, { status: 204 }));

    await deleteBrokerProfile("p1", { baseUrl: "https://api.example.test" });

    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/profiles/p1");
    assert.equal(calls[0]?.init?.method, "DELETE");
  }

  {
    mockFetch(() => Response.json({ error: "Broker profile not found" }, { status: 404 }));

    await assert.rejects(getBrokerSnapshot("missing", { baseUrl: "https://api.example.test" }), /Broker profile not found/);
  }

  {
    const calls = mockFetch(() => Response.json({ intent: { id: "i1", displayStatus: "Ready" } }));

    const result = await createBrokerConnectionIntent("FP Trading", { baseUrl: "https://api.example.test" });

    assert.equal(result.intent.id, "i1");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/connect-intents");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.body, JSON.stringify({ brokerName: "FP Trading" }));
  }

  {
    const calls = mockFetch(() => Response.json({ intent: { id: "i1", displayStatus: "Checking" } }));

    await verifyBrokerConnectionIntent("i1", undefined, { baseUrl: "https://api.example.test" });

    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/connect-intents/i1/verify");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.body, JSON.stringify({}));
  }

  {
    mockFetch(() =>
      Response.json(
        { error: "Invalid credentials", intent: { id: "i1", displayStatus: "Fix credentials" } },
        { status: 400 },
      ),
    );

    const result = await verifyBrokerConnectionIntentSoft(
      "i1",
      { accountNumber: "123", accountPassword: "secret" },
      { baseUrl: "https://api.example.test" },
    );

    assert.equal(result.ok, false);
    assert.equal(result.data.error, "Invalid credentials");
    assert.equal(result.data.intent?.displayStatus, "Fix credentials");
  }

  {
    const calls = mockFetch(() => Response.json({ profile: { id: "p1" }, intent: { id: "i1" } }));

    const result = await completeBrokerConnectionIntent("i1", { mode: "credentials" }, { baseUrl: "https://api.example.test" });

    assert.equal(result.ok, true);
    assert.equal(result.data.profile?.id, "p1");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/connect-intents/i1/complete");
    assert.equal(calls[0]?.init?.body, JSON.stringify({ mode: "credentials" }));
  }

  {
    const payload = { brokerName: "FP Trading", tradingEnabled: true };
    const calls = mockFetch(() =>
      Response.json({ profile: { id: "p1" }, pairing: { token: "pair-token", expiresAt: "2026-06-07T10:00:00.000Z", instructions: [] } }),
    );

    const result = await createCompanionPairing(payload, { baseUrl: "https://api.example.test" });

    assert.equal(result.profile.id, "p1");
    assert.equal(result.pairing.token, "pair-token");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/companion/pairing");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.body, JSON.stringify(payload));
  }

  {
    const payload = { brokerName: "FP Trading", profileId: "p1", tradingEnabled: false };
    const calls = mockFetch(() =>
      Response.json({ profile: { id: "p1" }, status: { profileId: "p1", message: "Started" }, snapshot: { profileId: "p1" } }),
    );

    const result = await startMt5SmartLink(payload, { baseUrl: "https://api.example.test" });

    assert.equal(result.status.message, "Started");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/smartlink/mt5/start");
    assert.equal(calls[0]?.init?.body, JSON.stringify(payload));
  }

  {
    const calls = mockFetch(() => Response.json({ profileId: "p/1", status: "connected" }));

    const status = await getMt5SmartLinkStatus("p/1", { baseUrl: "https://api.example.test" });

    assert.equal(status.profileId, "p/1");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/smartlink/mt5/status?profileId=p%2F1");
    assert.equal(calls[0]?.init?.credentials, "include");
  }

  {
    const payload = { profileId: "p1", accountNumber: "123", password: "secret", server: "Demo" };
    const calls = mockFetch(() => Response.json({ profile: { id: "p1" }, status: { profileId: "p1", message: "Logged in" } }));

    const result = await loginMt5SmartLink(payload, { baseUrl: "https://api.example.test" });

    assert.equal(result.status.message, "Logged in");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/smartlink/mt5/login");
    assert.equal(calls[0]?.init?.body, JSON.stringify(payload));
  }

  {
    const calls = mockFetch(() => Response.json({ profile: { id: "p1" }, status: { profileId: "p1", message: "Stopped" } }));

    await stopMt5SmartLink("p1", { baseUrl: "https://api.example.test" });

    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/smartlink/mt5/stop");
    assert.equal(calls[0]?.init?.body, JSON.stringify({ profileId: "p1" }));
  }

  {
    const calls = mockFetch(() => Response.json({ profileId: "p1", checks: [{ id: "terminal", ok: true }] }));

    const diagnostics = await getMt5SmartLinkDiagnostics("p1", { baseUrl: "https://api.example.test" });

    assert.equal(diagnostics.checks.length, 1);
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/smartlink/mt5/diagnostics?profileId=p1");
  }

  {
    const calls = mockFetch(() => Response.json({ profileId: "p1", health: "ok", connected: true, hasSnapshot: true, message: "Online" }));

    const status = await getCompanionStatus("p1", { baseUrl: "https://api.example.test" });

    assert.equal(status.message, "Online");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/companion/status/p1");
  }

  {
    const payload = {
      brokerName: "FP Trading",
      accountId: "acc-1",
      deals: [{ id: "d1", symbol: "EURUSD", side: "buy" as const, volume: 0.1, profit: 12 }],
    };
    const calls = mockFetch(() => Response.json({ profile: { id: "p1" }, snapshot: { profileId: "p1" }, imported: 1 }));

    const result = await importBrokerHistory(payload, { baseUrl: "https://api.example.test" });

    assert.equal(result.imported, 1);
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/import/history");
    assert.equal(calls[0]?.init?.body, JSON.stringify(payload));
  }

  {
    const calls = mockFetch(() => Response.json({ profile: { id: "p1" }, snapshot: { profileId: "p1", status: "connected" } }));

    const result = await connectBrokerProfile("p1", { baseUrl: "https://api.example.test" });

    assert.equal(result.ok, true);
    assert.equal(result.data.snapshot?.profileId, "p1");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/profiles/p1/connect");
    assert.equal(calls[0]?.init?.method, "POST");
  }

  {
    mockFetch(() => Response.json({ reason: "Trading disabled" }, { status: 403 }));

    const result = await placeBrokerOrder(
      "p1",
      { symbol: "EURUSD", side: "buy", type: "market", volume: 0.1 },
      { baseUrl: "https://api.example.test" },
    );

    assert.equal(result.ok, false);
    assert.equal(result.data.reason, "Trading disabled");
  }

  {
    const calls = mockFetch(() => Response.json({ accepted: true, orderId: "o1" }));

    await closeBrokerPosition("p/1", "pos/1", { baseUrl: "https://api.example.test" });

    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/profiles/p%2F1/positions/pos%2F1/close");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.credentials, "include");
  }

  {
    const calls = mockFetch(() => Response.json([{ id: "d1", symbol: "EURUSD", side: "buy", volume: 0.1, source: "demo" }]));

    const history = await getBrokerHistory("p1", { baseUrl: "https://api.example.test" });

    assert.equal(history.length, 1);
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/profiles/p1/history");
    assert.equal(calls[0]?.init?.credentials, "include");
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("broker hub api checks passed");
