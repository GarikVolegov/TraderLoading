import path from "node:path";

/**
 * Boot-time warning when uploads land on ephemeral disk. With UPLOADS_DIR unset,
 * getUploadsDir() falls back to cwd/uploads, which Railway wipes on every redeploy —
 * so avatars, journal images and community/chat files silently disappear. Returns a
 * warning string in production when no explicit UPLOADS_DIR is configured, else null.
 */
export function uploadsPersistenceWarning(
  env: { NODE_ENV?: string | undefined; UPLOADS_DIR?: string | undefined } = process.env,
): string | null {
  if (env.NODE_ENV !== "production") return null;
  if (env.UPLOADS_DIR && env.UPLOADS_DIR.trim()) return null;
  return (
    "UPLOADS_DIR is unset in production: uploads (avatars, journal images, " +
    "community/chat files) go to an ephemeral local path and are LOST on every " +
    "redeploy. Mount a persistent Volume and set UPLOADS_DIR (e.g. /data/uploads), " +
    "or configure object storage."
  );
}

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim()
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(process.cwd(), "uploads");
}

export function resolveUploadPath(...parts: string[]): string {
  return path.join(getUploadsDir(), ...parts);
}
