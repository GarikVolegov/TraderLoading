import path from "node:path";

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim()
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(process.cwd(), "uploads");
}

export function resolveUploadPath(...parts: string[]): string {
  return path.join(getUploadsDir(), ...parts);
}
