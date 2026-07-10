import assert from "node:assert/strict";
import { allBlogPaths, respondToBlogApiRequest, type PublishedBlogPost } from "./blogPaths.ts";

const posts: PublishedBlogPost[] = [
  {
    id: 1,
    slug: "risk-management-basics",
    relatedLibraryContentId: 7,
    orderIndex: 0,
    translations: [
      { lang: "it", title: "Gestione del rischio", metaDescription: "Le basi", bodyMarkdown: "# Ciao" },
      { lang: "en", title: "Risk management basics", metaDescription: "The basics", bodyMarkdown: "# Hello" },
    ],
  },
];

// ─── allBlogPaths ────────────────────────────────────────────────────────────
{
  const paths = allBlogPaths(posts);
  // 5 index paths + 2 article paths (only the 2 published languages, not all 5)
  assert.equal(paths.length, 7);
  assert.ok(paths.includes("/blog"), "english index");
  assert.ok(paths.includes("/it/blog"), "italian index");
  assert.ok(paths.includes("/blog/risk-management-basics"), "english article");
  assert.ok(paths.includes("/it/blog/risk-management-basics"), "italian article");
  assert.ok(!paths.includes("/es/blog/risk-management-basics"), "no spanish translation exists, so no spanish article path");
}

{
  const emptyPaths = allBlogPaths([]);
  assert.equal(emptyPaths.length, 5, "index paths always present, even with zero posts");
  for (const p of ["/blog", "/it/blog", "/es/blog", "/fr/blog", "/de/blog"]) {
    assert.ok(emptyPaths.includes(p), `expected ${p} in ${JSON.stringify(emptyPaths)}`);
  }
}

// ─── respondToBlogApiRequest ────────────────────────────────────────────────
{
  const list = respondToBlogApiRequest(posts, "GET", "/api/blog/posts", "it");
  assert.equal(list?.status, 200);
  assert.deepEqual(list?.body, [
    { id: 1, slug: "risk-management-basics", relatedLibraryContentId: 7, orderIndex: 0, title: "Gestione del rischio", metaDescription: "Le basi" },
  ]);
}
{
  const list = respondToBlogApiRequest(posts, "GET", "/api/blog/posts", "fr");
  assert.deepEqual(list?.body, [], "no french translation -> empty list, not an error");
}
{
  const item = respondToBlogApiRequest(posts, "GET", "/api/blog/posts/risk-management-basics", "en");
  assert.equal(item?.status, 200);
  assert.equal((item?.body as { title: string }).title, "Risk management basics");
}
{
  const missing = respondToBlogApiRequest(posts, "GET", "/api/blog/posts/does-not-exist", "en");
  assert.equal(missing?.status, 404);
}
{
  const wrongLang = respondToBlogApiRequest(posts, "GET", "/api/blog/posts/risk-management-basics", "de");
  assert.equal(wrongLang?.status, 404, "post exists but has no german translation");
}
assert.equal(respondToBlogApiRequest(posts, "GET", "/api/journal/entries", "en"), null, "non-blog path returns null so the caller falls through to static file serving");
assert.equal(respondToBlogApiRequest(posts, "POST", "/api/blog/posts", "en"), null, "only GET is served locally during prerender");

console.log("blogPaths tests passed");
