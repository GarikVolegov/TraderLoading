/**
 * AUREUS PROTOCOL — IndexNow Instant Discovery Push
 *
 * Submits all public localized URLs and canonical gateways directly to
 * Bing, Yandex, Seznam, and AI search engines (ChatGPT Search, Copilot) via IndexNow API.
 */
import { allMarketingPaths, absoluteUrl } from "../src/lib/seo.ts";

export const INDEXNOW_HOST = "aureus-os.app";
export const INDEXNOW_KEY = "8f7b2c9e4a1d6e3f5b0a7c9d1e4f2a8b";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export function collectIndexNowUrls(): string[] {
  const marketing = allMarketingPaths().map((p) => absoluteUrl(p));
  const sovereignGateways = [
    absoluteUrl("/protocollo"),
    absoluteUrl("/academy"),
    absoluteUrl("/verifica"),
    absoluteUrl("/sign-up"),
  ];

  return Array.from(new Set([...marketing, ...sovereignGateways]));
}

export async function submitToIndexNow(options: { dryRun?: boolean } = {}): Promise<{
  submitted: number;
  status: number | string;
}> {
  const urlList = collectIndexNowUrls();
  const payload = {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
    urlList,
  };

  if (options.dryRun) {
    console.log(`[IndexNow DRY-RUN] Prepared ${urlList.length} URLs for submission:`);
    console.log(JSON.stringify(payload, null, 2));
    return { submitted: urlList.length, status: "dry-run" };
  }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "AUREUS-IndexNow-Bot/1.0 (+https://aureus-os.app)",
      },
      body: JSON.stringify(payload),
    });

    console.log(`[IndexNow] Submission result: HTTP ${res.status} (${res.statusText}) for ${urlList.length} URLs.`);
    return { submitted: urlList.length, status: res.status };
  } catch (err) {
    console.warn(`[IndexNow] Network push skipped or failed (offline/sandbox):`, (err as Error).message);
    return { submitted: urlList.length, status: "network-skipped" };
  }
}

// Auto-run if executed directly via tsx
if (import.meta.url.startsWith("file:") && process.argv[1]?.endsWith("submit-indexnow.ts")) {
  const isDryRun = process.argv.includes("--dry-run");
  submitToIndexNow({ dryRun: isDryRun }).then(() => {
    process.exit(0);
  });
}
