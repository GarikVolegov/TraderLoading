import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveUploadPath } from "../lib/uploads.js";

export interface WikiStoragePutInput {
  userId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface WikiStoredObject {
  provider: "local" | "s3";
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface WikiStorage {
  put(input: WikiStoragePutInput): Promise<WikiStoredObject>;
  get?(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export interface S3ReadyConfig {
  bucket?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  publicBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export type WikiStorageConfig =
  | { kind: "local"; rootDir?: string; publicBaseUrl?: string }
  | ({ kind: "s3" } & S3ReadyConfig);

export function isS3ReadyConfig(config: S3ReadyConfig): boolean {
  return Boolean(config.bucket && config.endpoint && config.accessKeyId && config.secretAccessKey);
}

function slugFileName(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const stem = path.basename(filename, ext)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80) || "file";
  return `${Date.now()}-${stem}${ext}`;
}

function safeUserSegment(userId: string): string {
  return userId.replace(/[^\w-]/g, "_").slice(0, 120) || "anonymous";
}

function resolveStorageKey(rootDir: string, key: string): string {
  const normalizedKey = key.replace(/\\/g, "/");
  if (!normalizedKey || normalizedKey.startsWith("/") || normalizedKey.includes("../") || normalizedKey.includes("..\\")) {
    throw new Error("Invalid wiki storage key");
  }
  const root = path.resolve(rootDir);
  const fullPath = path.resolve(root, normalizedKey);
  const relative = path.relative(root, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid wiki storage key");
  return fullPath;
}

export function sha256Hex(input: Buffer | string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeObjectKey(key: string): string {
  return key.split("/").map(encodePathSegment).join("/");
}

function amzTimestamp(date = new Date()): { amzDate: string; shortDate: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, shortDate: iso.slice(0, 8) };
}

function buildS3ObjectUrl(config: { bucket: string; endpoint: string }, key: string): URL {
  const endpoint = new URL(config.endpoint.replace(/\/$/, ""));
  const basePath = endpoint.pathname.replace(/\/$/, "");
  endpoint.pathname = `${basePath}/${encodePathSegment(config.bucket)}/${encodeObjectKey(key)}`;
  endpoint.search = "";
  return endpoint;
}

function publicS3Url(config: { bucket: string; endpoint: string; publicBaseUrl?: string }, key: string): string {
  if (config.publicBaseUrl) return `${config.publicBaseUrl.replace(/\/$/, "")}/${encodeObjectKey(key)}`;
  return buildS3ObjectUrl(config, key).toString();
}

function signedS3Headers(input: {
  method: "PUT" | "DELETE";
  url: URL;
  body: Buffer;
  mimeType?: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  now?: Date;
}): Headers {
  const payloadHash = sha256Hex(input.body);
  const { amzDate, shortDate } = amzTimestamp(input.now);
  const headers = new Headers();
  headers.set("host", input.url.host);
  headers.set("x-amz-content-sha256", payloadHash);
  headers.set("x-amz-date", amzDate);
  if (input.mimeType) headers.set("content-type", input.mimeType);

  const sortedHeaderEntries = [...headers.entries()]
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = sortedHeaderEntries.map(([name, value]) => `${name}:${value}\n`).join("");
  const signedHeaders = sortedHeaderEntries.map(([name]) => name).join(";");
  const canonicalRequest = [
    input.method,
    input.url.pathname,
    input.url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${shortDate}/${input.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${input.secretAccessKey}`, shortDate);
  const dateRegionKey = hmac(dateKey, input.region);
  const dateRegionServiceKey = hmac(dateRegionKey, "s3");
  const signingKey = hmac(dateRegionServiceKey, "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  headers.set(
    "authorization",
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  );
  return headers;
}

export function createWikiStorage(config?: WikiStorageConfig): WikiStorage {
  if (config?.kind === "s3") {
    if (!isS3ReadyConfig(config)) {
      throw new Error("Wiki S3/R2 storage non configurato: bucket, endpoint e credenziali sono obbligatori.");
    }
    const bucket = config.bucket;
    const endpoint = config.endpoint;
    const accessKeyId = config.accessKeyId;
    const secretAccessKey = config.secretAccessKey;
    if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error("Wiki S3/R2 storage non configurato: bucket, endpoint e credenziali sono obbligatori.");
    }
    const fetchImpl = config.fetchImpl ?? fetch;
    const region = config.region || "auto";
    return {
      async put(input) {
        const userSegment = safeUserSegment(input.userId);
        const filename = slugFileName(input.filename);
        const key = `${userSegment}/${filename}`;
        const url = buildS3ObjectUrl({ bucket, endpoint }, key);
        const headers = signedS3Headers({
          method: "PUT",
          url,
          body: input.buffer,
          mimeType: input.mimeType,
          accessKeyId,
          secretAccessKey,
          region,
        });
        const response = await fetchImpl(url, { method: "PUT", headers, body: input.buffer });
        if (!response.ok) throw new Error(`Wiki S3/R2 upload fallito (${response.status})`);
        return {
          provider: "s3",
          key,
          url: publicS3Url({ bucket, endpoint, publicBaseUrl: config.publicBaseUrl }, key),
          size: input.buffer.length,
          mimeType: input.mimeType,
        };
      },
      async delete(key) {
        const url = buildS3ObjectUrl({ bucket, endpoint }, key);
        const headers = signedS3Headers({
          method: "DELETE",
          url,
          body: Buffer.alloc(0),
          accessKeyId,
          secretAccessKey,
          region,
        });
        const response = await fetchImpl(url, { method: "DELETE", headers });
        if (!response.ok && response.status !== 404) throw new Error(`Wiki S3/R2 delete fallito (${response.status})`);
      },
    };
    return {
      async put() {
        throw new Error("Wiki S3/R2 storage pronto a livello di configurazione, ma l'adapter firmato non è abilitato in questo runtime.");
      },
      async delete() {},
    };
  }

  const rootDir = config?.kind === "local" && config.rootDir
    ? config.rootDir
    : resolveUploadPath("wiki");
  const publicBaseUrl = config?.kind === "local" && config.publicBaseUrl
    ? config.publicBaseUrl.replace(/\/$/, "")
    : "/api/uploads/wiki";

  return {
    async put(input) {
      const userSegment = safeUserSegment(input.userId);
      const filename = slugFileName(input.filename);
      const key = `${userSegment}/${filename}`;
      const fullPath = path.join(rootDir, userSegment, filename);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, input.buffer);
      return {
        provider: "local",
        key,
        url: `${publicBaseUrl}/${key.replace(/\\/g, "/")}`,
        size: input.buffer.length,
        mimeType: input.mimeType,
      };
    },
    async get(key) {
      return fs.readFile(resolveStorageKey(rootDir, key));
    },
    async delete(key) {
      await fs.rm(resolveStorageKey(rootDir, key), { force: true });
    },
  };
}

export function createWikiStorageFromEnv(env: NodeJS.ProcessEnv = process.env): WikiStorage {
  if (env.WIKI_STORAGE_PROVIDER === "s3" || env.WIKI_STORAGE_PROVIDER === "r2") {
    return createWikiStorage({
      kind: "s3",
      bucket: env.WIKI_STORAGE_BUCKET,
      endpoint: env.WIKI_STORAGE_ENDPOINT,
      accessKeyId: env.WIKI_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.WIKI_STORAGE_SECRET_ACCESS_KEY,
      region: env.WIKI_STORAGE_REGION,
      publicBaseUrl: env.WIKI_STORAGE_PUBLIC_BASE_URL,
    });
  }
  return createWikiStorage({ kind: "local" });
}
