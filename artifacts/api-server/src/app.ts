import express, { type Express } from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { authMiddleware } from "./middlewares/authMiddleware";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { loggingMiddleware } from "./middlewares/loggingMiddleware";
import logger from "./lib/logger";
import { captureError } from "./lib/observability";
import { getUploadsDir } from "./lib/uploads";
import {
  createCorsOptions,
  createHelmetOptions,
  getRateLimitConfig,
  parseTrustProxy,
  publicUploadGuard,
} from "./lib/security";
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

app.use(helmet(createHelmetOptions()));
app.use(cors(createCorsOptions()));
app.use(compression({ threshold: 1024 }));
app.use(cookieParser());
app.use("/api", express.raw({ type: "application/json" }), createStripeWebhookRouter());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api", healthRouter);

serveFrontendApp(app);

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use(authMiddleware);

app.use(
  "/api",
  rateLimit({
    ...getRateLimitConfig(),
    legacyHeaders: false,
    standardHeaders: true,
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
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
