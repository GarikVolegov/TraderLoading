/**
 * Prerender the public marketing surface to static HTML so non-JS crawlers
 * (GPTBot, PerplexityBot, ClaudeBot, Bingbot, …) and search engines see fully
 * rendered, per-language content + head tags.
 *
 * Approach: serve the freshly built dist/public with a tiny static server, drive
 * a headless Chromium over every public route × language, and snapshot the
 * settled DOM to <route>/index.html.
 *
 * Hard-fail by design: puppeteer/sirv are required dependencies, and every
 * captured snapshot is validated (see ./seoSnapshot.ts) before being written.
 * A missing dependency, a browser launch failure, or ANY route failing
 * validation exits the process with a non-zero code so a broken deploy never
 * silently ships bad content to crawlers.
 *
 * Run via tsx as part of `pnpm build` (after `vite build` + sitemap).
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { allMarketingPaths } from "../src/lib/seo.ts";
import { isValidSnapshot } from "./seoSnapshot.ts";
import { fetchPublishedBlogData, allBlogPaths, respondToBlogApiRequest } from "./blogPaths.ts";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, "../dist/public");

function fail(message: string): never {
  console.error(`prerender: FAILED — ${message}`);
  process.exit(1);
}

async function main() {
  if (!existsSync(resolve(distDir, "index.html"))) {
    fail(`no build at ${distDir} (run vite build first)`);
  }

  let sirv: typeof import("sirv").default;
  let puppeteer: typeof import("puppeteer").default;
  try {
    sirv = (await import("sirv")).default;
    puppeteer = (await import("puppeteer")).default;
  } catch (err) {
    fail(`puppeteer/sirv failed to import — ${(err as Error).message}`);
  }

  const publishedBlogPosts = await fetchPublishedBlogData();

  const serveStatic = sirv(distDir, { single: true, dev: false });
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/api/blog/")) {
      const url = new URL(req.url, "http://localhost");
      const lang = url.searchParams.get("lang") ?? "en";
      const apiResult = respondToBlogApiRequest(publishedBlogPosts, req.method ?? "GET", url.pathname, lang);
      if (apiResult) {
        res.statusCode = apiResult.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(apiResult.body));
        return;
      }
    }
    serveStatic(req, res, () => {
      res.statusCode = 404;
      res.end("not found");
    });
  });
  await new Promise<void>((ok) => server.listen(0, ok));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  const failures: string[] = [];
  try {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    } catch (err) {
      fail(`Chromium failed to launch — ${(err as Error).message}`);
    }

    // allMarketingPaths() already includes "/" (English x-default) + every
    // /{lang} landing and localized keyword page.
    const paths = Array.from(new Set([...allMarketingPaths(), ...allBlogPaths(publishedBlogPosts)]));
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
        if (!isValidSnapshot(html)) {
          failures.push(`${path} — captured HTML failed content validation`);
          continue;
        }
        const outFile =
          path === "/"
            ? resolve(distDir, "index.html")
            : resolve(distDir, `${path.replace(/^\//, "")}/index.html`);
        mkdirSync(dirname(outFile), { recursive: true });
        writeFileSync(outFile, `<!DOCTYPE html>\n${html}`, "utf8");
        done += 1;
      } catch (err) {
        failures.push(`${path} — ${(err as Error).message}`);
      } finally {
        await page.close();
      }
    }
    console.log(`prerender: wrote ${done}/${paths.length} routes`);
    if (failures.length > 0) {
      console.error(`prerender: ${failures.length} route(s) failed:`);
      for (const f of failures) console.error(`  - ${f}`);
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(`prerender: FAILED — ${(err as Error).message}`);
  process.exit(1);
});
