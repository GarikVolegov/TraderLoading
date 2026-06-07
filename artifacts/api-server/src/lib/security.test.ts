import assert from "node:assert/strict";

import {
  createCorsOptions,
  getRateLimitConfig,
  isAllowedUploadPath,
  parseTrustProxy,
  publicUploadGuard,
} from "./security.js";

const devCors = createCorsOptions({
  NODE_ENV: "development",
  API_CORS_ORIGINS: "https://app.example.com, http://localhost:5173",
});
assert.equal(devCors.credentials, true);
assert.equal(devCors.origin("http://localhost:5173"), true);
assert.equal(devCors.origin("http://127.0.0.1:3000"), true);
assert.equal(devCors.origin(undefined), true);
assert.equal(devCors.origin("https://evil.example"), false);
{
  let callbackAllowed: boolean | undefined;
  devCors.origin("http://localhost:5173", (_error, allowed) => {
    callbackAllowed = allowed;
  });
  assert.equal(callbackAllowed, true);
}

const productionCors = createCorsOptions({
  NODE_ENV: "production",
  API_CORS_ORIGINS: "https://app.example.com",
});
assert.equal(productionCors.origin("https://app.example.com"), true);
assert.equal(productionCors.origin("http://localhost:5173"), false);
assert.equal(productionCors.origin(undefined), true);

assert.equal(parseTrustProxy({ TRUST_PROXY: "1" }), 1);
assert.equal(parseTrustProxy({ TRUST_PROXY: "loopback" }), "loopback");
assert.equal(parseTrustProxy({ NODE_ENV: "production" }), 1);
assert.equal(parseTrustProxy({ NODE_ENV: "development" }), false);

assert.deepEqual(
  getRateLimitConfig({ RATE_LIMIT_WINDOW_MS: "60000", RATE_LIMIT_MAX: "25" }),
  {
    windowMs: 60_000,
    limit: 25,
  },
);
assert.deepEqual(
  getRateLimitConfig({ RATE_LIMIT_WINDOW_MS: "-1", RATE_LIMIT_MAX: "nope" }),
  {
    windowMs: 15 * 60 * 1000,
    limit: 300,
  },
);

assert.equal(isAllowedUploadPath("/post-images/post-1.png"), true);
assert.equal(isAllowedUploadPath("/bg-1.png"), true);
assert.equal(isAllowedUploadPath("/voice/voice-1.webm"), true);
assert.equal(isAllowedUploadPath("/community-files/cfile-1.pdf"), true);
assert.equal(isAllowedUploadPath("/../.env"), false);
assert.equal(isAllowedUploadPath("/post-images/.secret"), false);
assert.equal(isAllowedUploadPath("/post-images/malware.exe"), false);

{
  let nextCalled = false;
  publicUploadGuard(
    { path: "/post-images/post-1.png" },
    { setHeader: () => undefined, status: () => ({ json: () => undefined }) },
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, true);
}

{
  let statusCode = 0;
  publicUploadGuard(
    { path: "/../.env" },
    {
      setHeader: () => undefined,
      status: (code) => {
        statusCode = code;
        return { json: () => undefined };
      },
    },
    () => undefined,
  );
  assert.equal(statusCode, 404);
}

console.log("security helper checks passed");
