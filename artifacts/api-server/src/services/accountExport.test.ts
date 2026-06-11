import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { ACCOUNT_EXPORT_CATEGORIES, getAccountExportDisclosure } = await import(
  "./accountExport.js"
);

for (const category of [
  "profile",
  "journal",
  "trading-data",
  "routine",
  "preferences",
  "social-signals",
] as const) {
  assert.ok(
    ACCOUNT_EXPORT_CATEGORIES.includes(category),
    `account export must cover ${category}`,
  );
}

const disclosure = getAccountExportDisclosure();
assert.match(disclosure.title, /Esporta dati/i);
assert.ok(disclosure.format.includes("JSON"));
assert.ok(
  disclosure.includedData.some((item) => /diario|journal/i.test(item)),
  "export disclosure must mention journal data",
);
assert.ok(
  disclosure.includedData.some((item) => /trading|trade/i.test(item)),
  "export disclosure must mention trading data",
);

console.log("account export disclosure checks passed");
