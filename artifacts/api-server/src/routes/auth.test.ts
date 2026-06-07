import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const originalNodeEnv = process.env.NODE_ENV;
const { createOidcCookieOptions, createSessionCookieOptions, getOrigin } = await import("./auth.js");

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
      headers: { "x-forwarded-proto": "https" },
      secure: false,
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
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "app.example.com" },
      secure: false,
    } as any),
    "https://app.example.com",
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
