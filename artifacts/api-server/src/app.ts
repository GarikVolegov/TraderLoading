import express, { type Express } from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { clerkMiddleware } from "@clerk/express";
import { authMiddleware } from "./middlewares/authMiddleware";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import { loggingMiddleware } from "./middlewares/loggingMiddleware";
import logger from "./lib/logger";
import { captureError } from "./lib/observability";
import { getUploadsDir } from "./lib/uploads";
import {
  createCorsOptions,
  createHelmetOptions,
  getRateLimitKey,
  getRateLimitConfig,
  parseTrustProxy,
  publicUploadGuard,
} from "./lib/security";
import { apexRedirectTarget } from "./lib/apexRedirect";
import { createRedisRateLimitStore, type RateLimitRedis } from "./lib/rateLimitStore";
import { getSharedRedisClient } from "./lib/redisClient";
import healthRouter from "./routes/health";
import { createStripeWebhookRouter } from "./routes/billing";
import router from "./routes";

const app: Express = express();
app.set("trust proxy", parseTrustProxy());

const UPLOADS_DIR = getUploadsDir();
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ── Logging distribuito: deve stare PRIMA di cors/json per catturare tutto ──
app.use(loggingMiddleware);

// ── Apex → www: 301 canonico (sostituisce il redirect 308 che faceva Vercel ora che
// Railway è l'unica origin). Solo in produzione; il resolver puro è testato in
// lib/apexRedirect.test.ts. ──
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    const target = apexRedirectTarget(req.hostname, req.originalUrl);
    if (target) {
      res.redirect(301, target);
      return;
    }
  }
  next();
});

app.use(helmet(createHelmetOptions()));
app.use(cors(createCorsOptions()));
app.use(compression({ threshold: 1024 }));
app.use(cookieParser());
app.use("/api/billing/webhook", express.raw({ type: "application/json" }), createStripeWebhookRouter());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api", healthRouter);

serveFrontendApp(app);

const clerkSecretKey = process.env.CLERK_SECRET_KEY?.trim();
const shouldUseClerkMiddleware =
  process.env.NODE_ENV === "production" || Boolean(clerkSecretKey);

if (shouldUseClerkMiddleware) {
  // Custom-domain Clerk instance (clerk.traderloading.com): use the fixed publishable
  // key from env directly. Do NOT derive it from the request host —
  // publishableKeyFromHost() builds `clerk.<host>` (e.g. clerk.www.traderloading.com),
  // i.e. the WRONG instance for a custom-domain deploy, so Clerk fails to verify the
  // session and every authenticated route 401s. clerkMiddleware() reads
  // CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY from env. (Host-derived keys are only for
  // non-custom-domain proxy deploys, which this project no longer uses.)
  app.use(clerkMiddleware());
} else {
  logger.warn("Clerk disabled for local development because CLERK_SECRET_KEY is not configured");
}

app.use(authMiddleware);

// Distributed rate limiting: share the counter across Fargate tasks via Redis.
// Without REDIS_URL we fall back to the default per-process MemoryStore (correct
// for single-instance local dev) and warn so it is never silently relied on in
// a horizontally-scaled deployment.
const rateLimitStore = process.env.REDIS_URL
  ? createRedisRateLimitStore({
      getClient: async () => {
        const pending = getSharedRedisClient();
        return pending ? ((await pending) as unknown as RateLimitRedis) : null;
      },
    })
  : undefined;
if (!rateLimitStore) {
  logger.warn(
    "Rate limiter is using an in-memory store (REDIS_URL unset); the limit is per-process and not shared across instances",
  );
}

app.use(
  "/api",
  rateLimit({
    ...getRateLimitConfig(),
    keyGenerator: getRateLimitKey,
    legacyHeaders: false,
    standardHeaders: true,
    ...(rateLimitStore ? { store: rateLimitStore } : {}),
  }),
  router,
);

app.use(
  "/api/uploads",
  publicUploadGuard,
  express.static(UPLOADS_DIR, {
    dotfiles: "deny",
    fallthrough: false,
    immutable: true,
    maxAge: "1d",
  }),
);

function serveFrontendApp(expressApp: Express) {
  const frontendDir = path.resolve(
    process.cwd(),
    process.env.FRONTEND_DIST_DIR ?? "../trader-dashboard/dist/public",
  );
  const indexFile = path.join(frontendDir, "index.html");

  if (!fs.existsSync(indexFile)) {
    logger.warn({ frontendDir }, "Frontend build not found; API-only mode enabled");
    return;
  }

  expressApp.use(
    express.static(frontendDir, {
      immutable: true,
      maxAge: "1y",
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    }),
  );

  expressApp.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(indexFile);
  });
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    captureError(err, { surface: "express" });
    logger.error({ err }, "Unhandled API error");
    // Vercel tronca i log pino-JSON: lo stack raw su console resta leggibile.
    console.error("[api] unhandled error:", err instanceof Error ? err.stack ?? err.message : err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
