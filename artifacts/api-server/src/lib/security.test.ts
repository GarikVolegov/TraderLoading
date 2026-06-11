import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createCorsOptions,
  createHelmetOptions,
  getRateLimitKey,
  getRateLimitConfig,
  isAllowedWebSocketOrigin,
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

assert.equal(
  isAllowedWebSocketOrigin("https://app.example.com", "api.example.com", {
    NODE_ENV: "production",
    API_CORS_ORIGINS: "https://app.example.com",
  }),
  true,
);
assert.equal(
  isAllowedWebSocketOrigin("https://api.example.com", "api.example.com", {
    NODE_ENV: "production",
    API_CORS_ORIGINS: "",
  }),
  true,
);
assert.equal(
  isAllowedWebSocketOrigin("https://evil.example", "api.example.com", {
    NODE_ENV: "production",
    API_CORS_ORIGINS: "https://app.example.com",
  }),
  false,
);
assert.equal(
  isAllowedWebSocketOrigin("http://localhost:5173", "127.0.0.1:3001", {
    NODE_ENV: "development",
  }),
  true,
);

const helmetOptions = createHelmetOptions();
assert.deepEqual(helmetOptions.contentSecurityPolicy?.directives?.imgSrc, [
  "'self'",
  "data:",
  "blob:",
  "https:",
]);

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
    limit: 2000,
  },
);
assert.deepEqual(getRateLimitConfig({ NODE_ENV: "development" }), {
  windowMs: 15 * 60 * 1000,
  limit: 5000,
});
assert.equal(
  getRateLimitKey({ socket: { remoteAddress: "127.0.0.1" } }),
  "127.0.0.1",
);
assert.equal(getRateLimitKey({}), "unknown");

const appSource = readFileSync(new URL("../app.ts", import.meta.url), "utf8");
assert.match(appSource, /keyGenerator:\s*getRateLimitKey/);

assert.equal(isAllowedUploadPath("/post-images/post-1.png"), true);
assert.equal(isAllowedUploadPath("/bg-1.png"), true);
assert.equal(isAllowedUploadPath("/voice/voice-1.webm"), true);
assert.equal(isAllowedUploadPath("/community-files/cfile-1.pdf"), true);
assert.equal(isAllowedUploadPath("/chat-files/chat-1.pdf"), true);
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
