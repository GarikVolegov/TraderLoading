import assert from "node:assert/strict";
import fs from "node:fs";

// The reusable dialog-a11y hook must preserve every hardening behavior of the
// components/ui/modal.tsx focus-trap it was extracted from (audit finding 3.4).
const hook = fs.readFileSync("src/hooks/useDialogA11y.ts", "utf8");

assert.match(hook, /role: "dialog"/, "panelProps need role=dialog");
assert.match(hook, /"aria-modal": true/, "panelProps need aria-modal");
assert.match(hook, /"aria-labelledby"/, "the title must label the dialog");
assert.match(hook, /"Escape"/, "Escape must close the dialog");
assert.match(hook, /"Tab"/, "Tab must be trapped inside the dialog");
assert.match(hook, /activeElement/, "focus must be captured and restored");
assert.match(hook, /inert/, "background must be made inert to assistive tech + tab order");
assert.match(hook, /getClientRects/, "focus trap must ignore hidden (non-focusable) elements");
assert.match(hook, /defaultPrevented/, "Escape must yield to a child overlay that handled it");
assert.match(
  hook,
  /getElementById\("root"\)/,
  "inline (non-portaled) overlays must skip the inert step instead of inerting unrelated portals",
);
assert.match(
  hook,
  /initialFocusRef/,
  "an optional initial-focus override must exist so a panel's own autoFocus input isn't silently overridden by the default first-focusable pick",
);

console.log("useDialogA11y static checks passed");
