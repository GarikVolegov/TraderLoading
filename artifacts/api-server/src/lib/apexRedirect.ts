const APEX_HOST = "traderloading.com";
const WWW_ORIGIN = "https://www.traderloading.com";

/**
 * Returns the canonical www URL to 301-redirect to when a request hits the bare apex
 * (traderloading.com), or null for www / the Railway host / localhost / any other host.
 *
 * Pure and env-agnostic: the production gate lives in the middleware that calls this.
 * Replaces the apex->www redirect Vercel used to perform now that Railway is the single
 * origin serving the frontend + API.
 */
export function apexRedirectTarget(
  host: string | undefined,
  originalUrl: string,
): string | null {
  if (!host) return null;
  const hostname = host.toLowerCase().split(":")[0];
  if (hostname !== APEX_HOST) return null;
  return `${WWW_ORIGIN}${originalUrl || "/"}`;
}
