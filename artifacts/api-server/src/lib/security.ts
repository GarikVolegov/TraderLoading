type SecurityEnv = Partial<Record<string, string>>;
type UploadGuardRequest = { method?: string; path: string };
type UploadGuardResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: { error: string }): void };
};
type UploadGuardNext = () => void;

const DEV_ORIGINS = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
const ALLOWED_UPLOAD_DIRS = new Set([
  "post-images",
  "voice",
  "chat-files",
  "community-files",
  "milestone-files",
  "avatars",
  "brain",
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

export function createCorsOptions(env: SecurityEnv = process.env) {
  const configuredOrigins = parseOrigins(env.API_CORS_ORIGINS);
  const isProduction = env.NODE_ENV === "production";
  const isAllowedOrigin = (origin: string | undefined): boolean => {
    if (!origin) return true;
    if (configuredOrigins.has(origin)) return true;
    if (!isProduction && DEV_ORIGINS.some((pattern) => pattern.test(origin)))
      return true;
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
  const defaultLimit = env.NODE_ENV === "development" ? 5000 : 300;
  return {
    windowMs:
      Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 15 * 60 * 1000,
    limit: Number.isFinite(limit) && limit > 0 ? limit : defaultLimit,
  };
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
