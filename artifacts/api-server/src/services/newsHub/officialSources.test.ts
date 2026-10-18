import assert from "node:assert/strict";
import { extractOfficialArticleText, fetchOfficialArticleText, fetchRbnzPolicyArticle, officialArticleUrl, officialSourceExcerpt } from "./officialSources.js";

const fed = "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm";
const ecb = "https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.test.en.html";
const body = "The Committee decided to maintain the target range for the federal funds rate. Economic activity continued to expand and inflation remained elevated. The Committee will assess incoming data and the evolving outlook before making further policy decisions.";
const html = `<header>Navigation</header><div id="article"><h1>Policy decision</h1><div><p>${body}</p></div><script>secret menu text</script><p>Last Update: today</p></div><footer>Other stories</footer>`;
assert.equal(officialArticleUrl(`${fed}#content`), fed);
for (const url of ["http://www.federalreserve.gov/newsevents/pressreleases/a.htm", "https://www.federalreserve.gov.evil.test/newsevents/pressreleases/a.htm", "https://user@www.ecb.europa.eu/press/a", "https://www.ecb.europa.eu:8443/press/a", "https://127.0.0.1/press/a", "https://www.ecb.europa.eu/home/html/index.en.html"]) {
  assert.equal(officialArticleUrl(url), null, url);
}
assert.equal(extractOfficialArticleText(html, fed), `Policy decision\n${body}`);
assert.equal(extractOfficialArticleText(`<nav>Menu</nav><main><p>${body}</p></main><footer>Related</footer>`, ecb), body);
assert.equal(extractOfficialArticleText("<main>Short</main>", ecb), null);
assert.equal(extractOfficialArticleText(`<div id="article"><p>${body}</p>`, fed), null);
assert.doesNotThrow(() => extractOfficialArticleText(`<main>${body} &#99999999; &#xD800;</main>`, ecb));
assert.equal(officialSourceExcerpt(`Policy decision\n${body}`, "Policy decision"), body);
const mock = (fn: (url: string) => Response | Promise<Response>) => (async (url: string | URL | Request) => fn(String(url))) as typeof fetch;
assert.equal(await fetchOfficialArticleText(fed, mock(() => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }))), `Policy decision\n${body}`);
let calls = 0;
assert.equal(await fetchOfficialArticleText(fed, mock(() => {
  calls++;
  return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
})), null);
assert.equal(calls, 1, "redirects cannot escape the official source allowlist");
assert.equal(await fetchOfficialArticleText(fed, mock(() => new Response("not html", { headers: { "content-type": "application/json" } }))), null);
assert.equal(await fetchOfficialArticleText(fed, mock(() => new Response("x".repeat(2 * 1024 * 1024 + 1), { headers: { "content-type": "text/html" } }))), null);
assert.equal(await fetchOfficialArticleText(fed, mock(() => { throw new Error("source unavailable"); })), null);
assert.equal(await fetchOfficialArticleText(fed, mock(url => url === fed
  ? new Response(null, { status: 302, headers: { location: ecb } })
  : new Response(`<main>${body}</main>`, { headers: { "content-type": "text/html" } }))), body);
for (const url of [
  "https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes/2026/october-2026",
  "https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2026/decision.htm",
  "https://www.snb.ch/en/publications/communication/press-releases-restricted/pre_20260924",
  "https://www.bankofcanada.ca/2026/09/fad-press-release/",
  "https://www.rba.gov.au/media-releases/2026/mr-26-20.html",
  "https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/the-official-cash-rate",
  "https://www.bls.gov/news.release/cpi.nr0.htm",
  "https://www.bea.gov/news/2026/gross-domestic-product",
]) assert.ok(officialArticleUrl(url),url);
assert.equal(officialArticleUrl("https://www.bls.gov.evil.test/news.release/cpi.htm"),null);
assert.equal(extractOfficialArticleText(`<header>Unrelated navigation</header><div id="bodytext"><pre>${body}</pre></div><footer>Other numbers</footer>`,"https://www.bls.gov/news.release/cpi.nr0.htm"),body);
const rbnz = await fetchRbnzPolicyArticle(mock(()=>new Response(`<main><nav>Site menu</nav><article>${body}</article><footer>Footer</footer></main>`,{headers:{"content-type":"text/html"}})));
assert.equal(rbnz[0].publishedAt,null,"no trustworthy publication instant means no fabricated timestamp");
assert.equal(rbnz[0].rawEvidenceText,body);
await assert.rejects(fetchRbnzPolicyArticle(mock(()=>new Response("Forbidden",{status:403}))),/RBNZ HTTP 403/);
console.log("official news source checks passed");
