import express, { type Express } from "express";
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
import {
  createCorsOptions,
  getRateLimitConfig,
  parseTrustProxy,
  publicUploadGuard,
} from "./lib/security";
import router from "./routes";

const app: Express = express();
app.set("trust proxy", parseTrustProxy());

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ── Logging distribuito: deve stare PRIMA di cors/json per catturare tutto ──
app.use(loggingMiddleware);

app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

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

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err }, "Unhandled API error");
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
