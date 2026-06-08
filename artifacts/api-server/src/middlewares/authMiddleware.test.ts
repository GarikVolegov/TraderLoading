import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { createAuthMiddleware } = await import("./authMiddleware.js");

const sessionUser = {
  id: "user-from-session",
  email: "session@example.com",
  firstName: "Session",
  lastName: "User",
  profileImageUrl: null,
};

const middleware = createAuthMiddleware({
  getClerkUserId: () => null,
  getStoredSession: async (sid: string) =>
    sid === "persisted-session"
      ? {
          user: sessionUser,
          access_token: "access-token",
        }
      : null,
  recordAccess: async () => {},
});

const req: any = {
  headers: { "user-agent": "auth-middleware-test" },
  cookies: { sid: "persisted-session" },
  socket: { remoteAddress: "127.0.0.1" },
};

await middleware(req, {} as any, () => {});

assert.equal(req.isAuthenticated(), true);
assert.deepEqual(req.user, sessionUser);

{
  let recordedIp = "";
  const ipMiddleware = createAuthMiddleware({
    getClerkUserId: () => "clerk-user",
    recordAccess: async (_userId, ip) => {
      recordedIp = ip;
    },
  });
  const ipReq: any = {
    headers: {
      "x-forwarded-for": "198.51.100.99",
      "user-agent": "auth-middleware-test",
    },
    ip: "203.0.113.10",
    socket: { remoteAddress: "127.0.0.1" },
  };

  await ipMiddleware(ipReq, {} as any, () => {});

  assert.equal(recordedIp, "203.0.113.10");
}

{
  const warnings: Array<{ message: string; error: unknown }> = [];
  const accessFailureMiddleware = createAuthMiddleware({
    getClerkUserId: () => "clerk-user",
    recordAccess: async () => {
      throw new Error("db logging failed");
    },
    warn: (error, message) => {
      warnings.push({ error, message });
    },
  });

  await accessFailureMiddleware(
    {
      headers: { "user-agent": "auth-middleware-test" },
      ip: "203.0.113.11",
      socket: { remoteAddress: "127.0.0.1" },
    } as any,
    {} as any,
    () => {},
  );
  await Promise.resolve();

  const warning = warnings[0];
  assert.equal(warning?.message, "Login access logging failed");
  assert.match(String((warning?.error as Error).message), /db logging failed/);
}

{
  const warnings: Array<{ message: string; error: unknown }> = [];
  const fallbackMiddleware = createAuthMiddleware({
    getClerkUserId: () => {
      throw new Error("clerk unavailable");
    },
    getStoredSession: async () => ({
      user: sessionUser,
      access_token: "access-token",
    }),
    recordAccess: async () => {},
    warn: (error, message) => {
      warnings.push({ error, message });
    },
  });
  const fallbackReq: any = {
    headers: { authorization: "Bearer persisted-session" },
    socket: { remoteAddress: "127.0.0.1" },
  };

  await fallbackMiddleware(fallbackReq, {} as any, () => {});

  assert.equal(fallbackReq.isAuthenticated(), true);
  assert.deepEqual(fallbackReq.user, sessionUser);
  const warning = warnings[0];
  assert.equal(warning?.message, "Clerk auth lookup failed");
}

{
  let nextCalled = false;
  const warnings: Array<{ message: string; error: unknown }> = [];
  const sessionFailureMiddleware = createAuthMiddleware({
    getClerkUserId: () => null,
    getStoredSession: async () => {
      throw new Error("session database failed");
    },
    recordAccess: async () => {},
    warn: (error, message) => {
      warnings.push({ error, message });
    },
  });
  const sessionFailureReq: any = {
    headers: { authorization: "Bearer persisted-session" },
    socket: { remoteAddress: "127.0.0.1" },
  };

  await sessionFailureMiddleware(sessionFailureReq, {} as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(sessionFailureReq.isAuthenticated(), false);
  const warning = warnings[0];
  assert.equal(warning?.message, "Stored session lookup failed");
}

console.log("auth middleware persisted sid checks passed");
