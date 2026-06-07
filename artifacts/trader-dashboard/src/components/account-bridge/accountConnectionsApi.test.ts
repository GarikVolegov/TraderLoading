import assert from "node:assert/strict";
import {
  activateAccountConnection,
  createAccountConnection,
  createAccountConnectionUrl,
  deleteAccountConnection,
  listAccountConnections,
  testAccountConnection,
} from "./accountConnectionsApi.js";

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
      createAccountConnectionUrl("/account/connections", { baseUrl: "https://api.example.test" }),
      "https://api.example.test/api/account/connections",
    );
  }

  {
    const calls = mockFetch(() => Response.json({ activeProfileId: null, profiles: [] }));

    const result = await listAccountConnections({ baseUrl: "https://api.example.test" });

    assert.deepEqual(result, { activeProfileId: null, profiles: [] });
    assert.equal(calls[0]?.url, "https://api.example.test/api/account/connections");
    assert.equal(calls[0]?.init?.credentials, "include");
  }

  {
    const calls = mockFetch(() =>
      Response.json({ profile: { id: "p1", label: "Demo" }, activeProfileId: null }, { status: 201 }),
    );

    const result = await createAccountConnection({ label: "Demo", port: 8765 }, { baseUrl: "https://api.example.test" });

    assert.equal(result.profile.id, "p1");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.deepEqual(calls[0]?.init?.headers, { "Content-Type": "application/json" });
    assert.equal(calls[0]?.init?.body, JSON.stringify({ label: "Demo", port: 8765 }));
  }

  {
    const calls = mockFetch(() => Response.json({ activeProfileId: "p1", profile: { id: "p1" }, snapshot: {} }));

    await activateAccountConnection("p1", { baseUrl: "https://api.example.test" });

    assert.equal(calls[0]?.url, "https://api.example.test/api/account/connections/p1/activate");
    assert.equal(calls[0]?.init?.method, "POST");
  }

  {
    const calls = mockFetch(() => Response.json({ reachable: false, message: "No response" }));

    const result = await testAccountConnection("p1", { baseUrl: "https://api.example.test" });

    assert.deepEqual(result, { reachable: false, message: "No response" });
    assert.equal(calls[0]?.url, "https://api.example.test/api/account/connections/p1/test");
  }

  {
    const calls = mockFetch(() => new Response(null, { status: 204 }));

    await deleteAccountConnection("p1", { baseUrl: "https://api.example.test" });

    assert.equal(calls[0]?.url, "https://api.example.test/api/account/connections/p1");
    assert.equal(calls[0]?.init?.method, "DELETE");
  }

  {
    mockFetch(() => Response.json({ error: "Account profile not found" }, { status: 404 }));

    await assert.rejects(activateAccountConnection("missing", { baseUrl: "https://api.example.test" }), /Account profile not found/);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("account connections api checks passed");
