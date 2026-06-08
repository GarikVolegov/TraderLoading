import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const originalNodeEnv = process.env.NODE_ENV;
const {
  createOidcCookieOptions,
  createSessionCookieOptions,
  getOrigin,
  getSafeReturnTo,
  getValidatedOidcSettings,
  isAllowedMobileRedirectUri,
} = await import("./auth.js");

try {
  process.env.NODE_ENV = "development";
  assert.equal(
    createSessionCookieOptions({
      headers: { host: "localhost:3001" },
      secure: false,
    } as any).secure,
    false,
  );
  assert.equal(
    createOidcCookieOptions({
      headers: { host: "localhost:3001" },
      secure: false,
    } as any).secure,
    false,
  );
  assert.equal(
    getOrigin({
      headers: { host: "localhost:3001" },
      secure: false,
    } as any),
    "http://localhost:3001",
  );

  assert.equal(
    createSessionCookieOptions({
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "app.example.com",
      },
      secure: false,
      protocol: "https",
      host: "app.example.com",
    } as any).secure,
    true,
  );
  assert.equal(
    createOidcCookieOptions({
      headers: { "x-forwarded-proto": "https" },
      secure: false,
    } as any).secure,
    true,
  );
  assert.equal(
    getOrigin({
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "app.example.com",
      },
      secure: false,
      protocol: "https",
      host: "app.example.com",
    } as any),
    "https://app.example.com",
  );

  assert.equal(getSafeReturnTo("/dashboard?tab=1"), "/dashboard?tab=1");
  assert.equal(getSafeReturnTo("https://evil.example/phish"), "/");
  assert.equal(getSafeReturnTo("//evil.example/phish"), "/");

  assert.deepEqual(
    getValidatedOidcSettings({
      OIDC_CLIENT_ID: "client-123",
      ISSUER_URL: "https://replit.com/oidc",
    }),
    {
      clientId: "client-123",
      issuerUrl: "https://replit.com/oidc",
    },
  );
  assert.throws(
    () => getValidatedOidcSettings({ ISSUER_URL: "not-a-url" }),
    /ISSUER_URL must be a valid URL/,
  );
  assert.throws(
    () => getValidatedOidcSettings({ ISSUER_URL: "https://replit.com/oidc" }),
    /OIDC_CLIENT_ID or REPL_ID/,
  );

  assert.equal(
    isAllowedMobileRedirectUri("traderloadings://auth/callback"),
    true,
  );
  assert.equal(
    isAllowedMobileRedirectUri("http://localhost:5173/auth/callback"),
    true,
  );
  assert.equal(
    isAllowedMobileRedirectUri("https://evil.example/auth/callback"),
    false,
  );

  process.env.NODE_ENV = "production";
  assert.equal(
    createSessionCookieOptions({
      headers: { host: "traderloadings.com" },
      secure: false,
    } as any).secure,
    true,
  );
  assert.equal(
    getOrigin({
      headers: { host: "traderloadings.com" },
      secure: false,
    } as any),
    "https://traderloadings.com",
  );
  assert.equal(
    createOidcCookieOptions({
      headers: { host: "traderloadings.com" },
      secure: false,
    } as any).secure,
    true,
  );
} finally {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
}

console.log("auth route cookie option checks passed");
