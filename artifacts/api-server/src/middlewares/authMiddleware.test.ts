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

console.log("auth middleware persisted sid checks passed");
