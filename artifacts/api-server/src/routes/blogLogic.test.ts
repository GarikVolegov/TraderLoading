import assert from "node:assert/strict";
import { resolvePublishedTranslation, buildBlogPostUpsert } from "./blogLogic.js";

// ─── resolvePublishedTranslation ───────────────────────────────────────────
{
  const translations = [
    { lang: "it", published: true, title: "Ciao" },
    { lang: "en", published: false, title: "Hello" },
  ];

  assert.equal(resolvePublishedTranslation(translations, "it", false)?.title, "Ciao");
  assert.equal(resolvePublishedTranslation(translations, "en", false), null, "unpublished translation hidden from non-admins");
  assert.equal(resolvePublishedTranslation(translations, "en", true)?.title, "Hello", "admins see unpublished translations");
  assert.equal(resolvePublishedTranslation(translations, "fr", false), null, "missing language returns null");
}

// ─── buildBlogPostUpsert ────────────────────────────────────────────────────
{
  const result = buildBlogPostUpsert({
    slug: "  Risk-Management-Basics  ",
    relatedLibraryContentId: 42,
    orderIndex: 3,
    translations: [
      { lang: "it", title: "Gestione del rischio", metaDescription: "Le basi", bodyMarkdown: "# Ciao", published: true },
      { lang: "xx", title: "Invalid lang" },
    ],
  });
  assert.equal(result.slug, "risk-management-basics", "slug is trimmed + lowercased");
  assert.equal(result.relatedLibraryContentId, 42);
  assert.equal(result.orderIndex, 3);
  assert.equal(result.translations.length, 1, "unsupported language is dropped");
  assert.deepEqual(result.translations[0], {
    lang: "it",
    title: "Gestione del rischio",
    metaDescription: "Le basi",
    bodyMarkdown: "# Ciao",
    published: true,
  });
}

{
  const result = buildBlogPostUpsert({ slug: "minimal-post" });
  assert.equal(result.relatedLibraryContentId, null, "missing relatedLibraryContentId defaults to null");
  assert.equal(result.orderIndex, 0, "missing orderIndex defaults to 0");
  assert.deepEqual(result.translations, [], "missing translations defaults to empty array");
}

assert.throws(
  () => buildBlogPostUpsert({ slug: "Not A Valid Slug!" }),
  /kebab-case/,
  "rejects a slug with spaces/punctuation",
);
assert.throws(() => buildBlogPostUpsert({ slug: "" }), /kebab-case/, "rejects an empty slug");
assert.throws(
  () => buildBlogPostUpsert({ slug: "valid-slug", translations: [{ lang: "it", title: "" }] }),
  /missing a title/,
  "rejects a translation with no title",
);

console.log("blog logic tests passed");
