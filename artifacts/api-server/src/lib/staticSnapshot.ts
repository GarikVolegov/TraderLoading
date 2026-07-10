import fs from "node:fs";
import path from "node:path";

/**
 * Resolves an extension-less request path (e.g. "/about") to a prerendered
 * `<frontendDir>/about/index.html` snapshot if one exists, so it can be sent
 * directly (200) instead of falling through to express.static's default
 * directory-redirect-then-serve behavior (301 to "/about/", then 200).
 */
export function resolveSnapshotIndexPath(
  frontendDir: string,
  requestPath: string,
): string | null {
  if (path.extname(requestPath)) return null;

  const resolvedFrontendDir = path.resolve(frontendDir);
  const candidate = path.resolve(resolvedFrontendDir, `.${requestPath}`, "index.html");

  if (
    candidate !== path.join(resolvedFrontendDir, "index.html") &&
    !candidate.startsWith(resolvedFrontendDir + path.sep)
  ) {
    return null;
  }

  return fs.existsSync(candidate) ? candidate : null;
}
