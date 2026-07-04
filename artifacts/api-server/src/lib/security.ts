import { ipKeyGenerator } from "express-rate-limit";

type SecurityEnv = Partial<Record<string, string>>;
type RateLimitKeyRequest = {
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
  user?: { id?: string } | undefined;
};
type CspDirectives = {
  defaultSrc?: string[];
  scriptSrc?: string[];
  connectSrc?: string[];
  styleSrc?: string[];
  fontSrc?: string[];
  imgSrc?: string[];
  frameSrc?: string[];
  workerSrc?: string[];
};
type HelmetOptions = {
  contentSecurityPolicy?: {
    directives?: CspDirectives;
  };
};
type UploadGuardRequest = { method?: string; path: string };
type UploadGuardResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: { error: string }): void };
};
type UploadGuardNext = () => void;

const DEV_ORIGINS = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
// Private, per-user upload dirs (wiki archive, DM attachments, voice notes) are
// intentionally NOT listed here: the public static handler performs no
// ownership check, so they are served through authenticated routes that verify
// the requester owns / participates in the resource instead. "wiki" is served
// by routes/wiki.ts with a wikiSourcesTable.userId check.
const ALLOWED_UPLOAD_DIRS = new Set([
  "post-images",
  "voice",
  "chat-files",
  "community-files",
  "community-assets",
  "milestone-files",
  "avatars",
]);
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".gif",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".txt",
  ".wav",
  ".webm",
  ".webp",
  ".xls",
  ".xlsx",
  ".zip",
]);

function parseOrigins(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function isLoopbackOrigin(origin: string): boolean {
  return DEV_ORIGINS.some((pattern) => pattern.test(origin));
}

function originMatchesHost(origin: string, host: string | undefined): boolean {
  if (!host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === host;
  } catch {
    return false;
  }
}

export function createCorsOptions(env: SecurityEnv = process.env) {
  const configuredOrigins = parseOrigins(env.API_CORS_ORIGINS);
  const isProduction = env.NODE_ENV === "production";
  const isAllowedOrigin = (origin: string | undefined): boolean => {
    if (!origin) return true;
    if (configuredOrigins.has(origin)) return true;
    if (!isProduction && isLoopbackOrigin(origin)) return true;
    return false;
  };

  return {
    credentials: true,
    origin(
      origin: string | undefined,
      callback?: (err: Error | null, allowed?: boolean) => void,
    ): boolean {
      const allowed = isAllowedOrigin(origin);
      if (callback) callback(null, allowed);
      return allowed;
    },
  };
}

export function isAllowedWebSocketOrigin(
  origin: string | undefined,
  host: string | undefined,
  env: SecurityEnv = process.env,
): boolean {
  if (!origin) return true;
  if (originMatchesHost(origin, host)) return true;
  const configuredOrigins = parseOrigins(env.API_CORS_ORIGINS);
  if (configuredOrigins.has(origin)) return true;
  if (env.NODE_ENV !== "production" && isLoopbackOrigin(origin)) return true;
  return false;
}

/**
 * A Clerk publishable key is `pk_(live|test)_` followed by the base64 of the
 * instance's Frontend API host plus a trailing "$". Decoding it lets us add the
 * exact host (e.g. clerk.traderloading.com) to the CSP so Clerk works on custom
 * domains without a wildcard, regardless of whether the FAPI proxy is used.
 */
export function decodeClerkFrontendApi(
  publishableKey: string | undefined,
): string | null {
  const key = publishableKey?.trim();
  if (!key) return null;
  const prefix = key.startsWith("pk_live_")
    ? "pk_live_"
    : key.startsWith("pk_test_")
      ? "pk_test_"
      : null;
  if (!prefix) return null;
  try {
    const decoded = Buffer.from(key.slice(prefix.length), "base64").toString(
      "utf8",
    );
    const host = decoded.replace(/\$+$/, "").trim();
    return /^[a-z0-9.-]+$/i.test(host) ? host : null;
  } catch {
    return null;
  }
}

function originFromUrl(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function createHelmetOptions(
  env: SecurityEnv = process.env,
): HelmetOptions {
  // Helmet merges these with its secure defaults per-directive, so anything we
  // don't list (default-src, object-src 'none', frame-ancestors, base-uri, …)
  // keeps its hardened default. Each directive we DO set must therefore be
  // complete. We only ever widen what the app actually needs: its own origin,
  // Clerk (auth), Stripe (billing) and Google Fonts.
  const clerkFrontendApi = decodeClerkFrontendApi(env.CLERK_PUBLISHABLE_KEY);
  const clerkScriptHosts = ["https://*.clerk.accounts.dev", "https://*.clerk.com"];
  const clerkConnectHosts = [
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://clerk-telemetry.com",
  ];
  if (clerkFrontendApi) {
    clerkScriptHosts.push(`https://${clerkFrontendApi}`);
    clerkConnectHosts.push(`https://${clerkFrontendApi}`);
  }

  const extraConnect = [env.APP_BASE_URL, env.VITE_API_BASE]
    .map(originFromUrl)
    .filter((origin): origin is string => Boolean(origin));

  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://challenges.cloudflare.com",
          "https://s3.tradingview.com",
          ...clerkScriptHosts,
        ],
        connectSrc: [
          "'self'",
          "https://api.stripe.com",
          "https://s3.tradingview.com",
          "https://*.tradingview.com",
          "wss://*.tradingview.com",
          ...clerkConnectHosts,
          ...extraConnect,
        ],
        // Radix, framer-motion and Clerk inject inline styles at runtime.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        frameSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://hooks.stripe.com",
          "https://challenges.cloudflare.com",
          "https://www.tradingview-widget.com",
          "https://s.tradingview.com",
          ...clerkScriptHosts,
        ],
        // Clerk spawns workers from blob URLs; the PWA service worker is 'self'.
        workerSrc: ["'self'", "blob:"],
      },
    },
  };
}

export function parseTrustProxy(
  env: SecurityEnv = process.env,
): false | number | string {
  const raw = env.TRUST_PROXY?.trim();
  if (raw) {
    const asNumber = Number(raw);
    return Number.isInteger(asNumber) && asNumber >= 0 ? asNumber : raw;
  }
  return env.NODE_ENV === "production" ? 1 : false;
}

export function getRateLimitConfig(env: SecurityEnv = process.env): {
  windowMs: number;
  limit: number;
} {
  const windowMs = Number(env.RATE_LIMIT_WINDOW_MS);
  const limit = Number(env.RATE_LIMIT_MAX);
  // Il polling della dashboard/chat genera ~1000 richieste per utente ogni
  // 15 minuti: il default deve coprire un utente attivo (anche dietro NAT
  // condiviso) senza produrre 429. Override con RATE_LIMIT_MAX.
  const defaultLimit = env.NODE_ENV === "development" ? 5000 : 2000;
  return {
    windowMs:
      Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 15 * 60 * 1000,
    limit: Number.isFinite(limit) && limit > 0 ? limit : defaultLimit,
  };
}

export function getRateLimitKey(req: RateLimitKeyRequest): string {
  // Key authenticated traffic by user so clients behind a shared NAT/corporate
  // proxy each get their own budget; fall back to IP for anonymous requests.
  // Namespaced so a user id can never collide with an IP bucket.
  const userId = req.user?.id;
  if (userId) return `user:${userId}`;
  const address = req.ip ?? req.socket?.remoteAddress;
  return address ? `ip:${ipKeyGenerator(address)}` : "ip:unknown";
}

export function isAllowedUploadPath(rawPath: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return false;
  }

  if (
    !decoded.startsWith("/") ||
    decoded.includes("..") ||
    decoded.includes("\\")
  )
    return false;
  const parts = decoded.split("/").filter(Boolean);
  if (parts.length === 0) return false;
  if (parts.length > 1 && !ALLOWED_UPLOAD_DIRS.has(parts[0])) return false;
  const filename = parts.at(-1) ?? "";
  if (!filename || filename.startsWith(".")) return false;
  const extension = filename.includes(".")
    ? filename.slice(filename.lastIndexOf(".")).toLowerCase()
    : "";
  return ALLOWED_UPLOAD_EXTENSIONS.has(extension);
}

export function publicUploadGuard(
  req: UploadGuardRequest,
  res: UploadGuardResponse,
  next: UploadGuardNext,
): void {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (isAllowedUploadPath(req.path)) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
    return;
  }
  res.status(404).json({ error: "Not found" });
}
