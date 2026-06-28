/**
 * Prerender the public marketing surface to static HTML so non-JS crawlers
 * (GPTBot, PerplexityBot, ClaudeBot, Bingbot, …) and search engines see fully
 * rendered, per-language content + head tags.
 *
 * Approach: serve the freshly built dist/public with a tiny static server, drive
 * a headless Chromium over every public route × language, and snapshot the
 * settled DOM to <route>/index.html.
 *
 * Best-effort by design: if a build is missing, or puppeteer/sirv aren't
 * installed, or the browser can't launch, it logs a warning and exits 0 so it
 * NEVER breaks a deploy. The SPA still ships its static head meta + JS-rendered
 * content; prerendering is a progressive enhancement for crawlers.
 *
 * Run via tsx as part of `pnpm build` (after `vite build` + sitemap).
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { allMarketingPaths } from "../src/lib/seo.ts";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, "../dist/public");

function warn(message: string) {
  console.warn(`prerender: skipped — ${message}`);
}

async function main() {
  if (!existsSync(resolve(distDir, "index.html"))) {
    warn(`no build at ${distDir} (run vite build first)`);
    return;
  }

  let sirv: typeof import("sirv").default;
  let puppeteer: typeof import("puppeteer").default;
  try {
    sirv = (await import("sirv")).default;
    puppeteer = (await import("puppeteer")).default;
  } catch {
    warn("puppeteer/sirv not installed");
    return;
  }

  const serveStatic = sirv(distDir, { single: true, dev: false });
  const server = createServer((req, res) =>
    serveStatic(req, res, () => {
      res.statusCode = 404;
      res.end("not found");
    }),
  );
  await new Promise<void>((ok) => server.listen(0, ok));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // allMarketingPaths() already includes "/" (English x-default) + every
    // /{lang} landing and localized keyword page.
    const paths = Array.from(new Set(allMarketingPaths()));
    let done = 0;

    for (const path of paths) {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
      // Abort cross-origin requests (Google Fonts, etc.) so rendering is fast and
      // deterministic and never stalls on third-party network.
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (req.url().startsWith(origin)) req.continue();
        else req.abort();
      });
      try {
        await page.goto(`${origin}${path}`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForSelector("h1", { timeout: 15000 }).catch(() => {});
        // Let the <Seo> effect populate canonical/hreflang/JSON-LD.
        await new Promise((r) => setTimeout(r, 300));
        const html = await page.content();
        const outFile =
          path === "/"
            ? resolve(distDir, "index.html")
            : resolve(distDir, `${path.replace(/^\//, "")}/index.html`);
        mkdirSync(dirname(outFile), { recursive: true });
        writeFileSync(outFile, `<!DOCTYPE html>\n${html}`, "utf8");
        done += 1;
      } catch (err) {
        console.warn(`prerender: failed ${path} — ${(err as Error).message}`);
      } finally {
        await page.close();
      }
    }
    console.log(`prerender: wrote ${done}/${paths.length} routes`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

main().catch((err) => {
  warn((err as Error).message);
  process.exit(0);
});
