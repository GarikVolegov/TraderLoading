/** Explicit internal marker, never an arbitrary return URL. */
export function processToolHref(
  href: string,
  context: { pair?: string | null; methodVersionId?: string | null; fromProcess?: boolean } = {},
): string {
  const url = new URL(href, "https://workspace.invalid");
  if (url.origin !== "https://workspace.invalid")
    throw new Error("Internal tool destination required");
  if (context.fromProcess) url.searchParams.set("processReturn", "1");
  if (context.pair && (url.pathname === "/" || url.pathname === "/resources"))
    url.searchParams.set("pair", context.pair);
  if (context.methodVersionId && ["/backtest", "/resources"].includes(url.pathname))
    url.searchParams.set("methodVersionId", context.methodVersionId);
  return url.pathname + url.search + url.hash;
}
