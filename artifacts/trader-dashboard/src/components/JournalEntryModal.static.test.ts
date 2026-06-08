import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const modalSource = readFileSync(new URL("./JournalEntryModal.tsx", import.meta.url), "utf8");

assert.match(modalSource, /saveJournalTag/);
assert.match(modalSource, /useMutation/);
assert.match(modalSource, /saveTagMutation/);
assert.match(modalSource, /onSaveTag=/);
assert.match(modalSource, /journalTagsQueryKey/);

console.log("journal entry modal saved tag checks passed");
