import assert from "node:assert/strict";
import fs from "node:fs";

// Review finding: handleSave already shows its own "journal_modal.error" toast
// in a try/catch around 4 mutateAsync calls. Without opting out, App.tsx's
// global MutationCache would ALSO toast a generic error on the same failure —
// a double-toast regression on the app's most central flow.
const src = fs.readFileSync("src/components/JournalEntryModal.tsx", "utf8");

assert.match(
  src,
  /suppressGlobalError:\s*true/,
  "journal mutations must opt out of the global mutation-error toast (they already show their own)",
);
for (const hook of ["useCreateJournalEntry", "useUpdateJournalEntry", "useUploadJournalImage", "useDeleteJournalImage"]) {
  const call = new RegExp(`${hook}\\(suppressGlobalErrorMeta\\)`);
  assert.match(src, call, `${hook} must pass the suppressGlobalError meta`);
}

console.log("JournalEntryModal suppressGlobalError checks passed");
