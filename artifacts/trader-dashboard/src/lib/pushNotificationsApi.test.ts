import assert from "node:assert/strict";
import {
  fetchPushPreferences,
  fetchVapidPublicKey,
  registerPushSubscription,
  unregisterPushSubscription,
  updatePushPreferences,
} from "./pushNotificationsApi.js";

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
    const calls = mockFetch(() => Response.json({ sessions: false, messages: true }));

    const prefs = await fetchPushPreferences({ basePath: "/" });

    assert.equal(calls[0]?.url, "/api/push/preferences");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.deepEqual(prefs, { sessions: false, messages: true });
  }

  {
    const calls = mockFetch(() => Response.json({ publicKey: "public-key" }));

    const publicKey = await fetchVapidPublicKey({ basePath: "/trader/" });

    assert.equal(calls[0]?.url, "/trader/api/push/vapid-public-key");
    assert.equal(publicKey, "public-key");
  }

  {
    const payload = { endpoint: "https://push.example/sub", keys: { p256dh: "p", auth: "a" } };
    const calls = mockFetch(() => Response.json({ ok: true }));

    await registerPushSubscription(payload, { basePath: "/" });

    assert.equal(calls[0]?.url, "/api/push/subscribe");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.deepEqual(calls[0]?.init?.headers, { "Content-Type": "application/json" });
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.body, JSON.stringify(payload));
  }

  {
    const calls = mockFetch(() => Response.json({ ok: true }));

    await unregisterPushSubscription("https://push.example/sub", { basePath: "/" });

    assert.equal(calls[0]?.url, "/api/push/unsubscribe");
    assert.equal(calls[0]?.init?.method, "DELETE");
    assert.equal(calls[0]?.init?.body, JSON.stringify({ endpoint: "https://push.example/sub" }));
  }

  {
    const calls = mockFetch(() => Response.json({ sessions: false, messages: true }));

    const prefs = await updatePushPreferences({ sessions: false }, { basePath: "/" });

    assert.equal(calls[0]?.url, "/api/push/preferences");
    assert.equal(calls[0]?.init?.method, "PUT");
    assert.equal(calls[0]?.init?.body, JSON.stringify({ sessions: false }));
    assert.deepEqual(prefs, { sessions: false, messages: true });
  }

  {
    mockFetch(() => new Response("", { status: 500 }));

    await assert.rejects(fetchPushPreferences({ basePath: "/" }), /500/);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("push notifications api checks passed");
