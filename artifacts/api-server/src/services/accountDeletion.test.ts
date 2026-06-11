import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  ACCOUNT_DELETION_CATEGORIES,
  getAccountDeletionDisclosure,
} = await import("./accountDeletion.js");

const requiredCategories = [
  "auth-provider",
  "profile",
  "journal",
  "trading-data",
  "push-notifications",
  "social-community",
  "chat-security",
  "broker-connections",
  "supporting-preferences",
] as const;

for (const category of requiredCategories) {
  assert.ok(
    ACCOUNT_DELETION_CATEGORIES.includes(category),
    `account deletion must cover ${category}`,
  );
}

const disclosure = getAccountDeletionDisclosure();

assert.match(disclosure.title, /Elimina account/i);
assert.ok(
  disclosure.deletedData.some((item) => /diario|journal/i.test(item)),
  "disclosure must tell users journal data is deleted",
);
assert.ok(
  disclosure.deletedData.some((item) => /broker|connession/i.test(item)),
  "disclosure must tell users broker connections are deleted",
);
assert.ok(
  disclosure.retainedData.some((item) => /log|sicurezza|frode/i.test(item)),
  "disclosure must explain limited retained security logs",
);
assert.equal(disclosure.confirmationPhrase, "ELIMINA");

console.log("account deletion disclosure checks passed");
