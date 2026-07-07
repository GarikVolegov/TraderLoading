import assert from "node:assert/strict";
import fs from "node:fs";

function maxZIndex(source: string): number {
  const matches = source.matchAll(/z-(?:\[(\d+)\]|(\d+))/g);
  const values = Array.from(matches, (match) =>
    Number.parseInt(match[1] ?? match[2], 10),
  ).filter(Number.isFinite);

  assert.ok(values.length > 0, "expected at least one z-index class");
  return Math.max(...values);
}

const modal = fs.readFileSync("src/components/ui/modal.tsx", "utf8");
const topNav = fs.readFileSync("src/components/TopNav.tsx", "utf8");
const bottomNav = fs.readFileSync("src/components/BottomNav.tsx", "utf8");

const modalZ = maxZIndex(modal);
const appShellZ = Math.max(maxZIndex(topNav), maxZIndex(bottomNav));

assert.ok(
  modalZ > appShellZ,
  `modal z-index (${modalZ}) must be above app shell z-index (${appShellZ})`,
);

assert.match(modal, /from "react-dom"/);
assert.match(modal, /createPortal/);
assert.match(modal, /document\.body/);

// A11y (finding 3.4): the custom modal must expose dialog semantics, trap focus,
// close on Escape, and restore focus to the opener on close.
assert.match(modal, /role="dialog"/, "modal needs role=dialog");
assert.match(modal, /aria-modal="true"/, "modal needs aria-modal");
assert.match(modal, /aria-labelledby=/, "the title must label the dialog");
assert.match(modal, /"Escape"/, "Escape must close the modal");
assert.match(modal, /"Tab"/, "Tab must be trapped inside the modal");
assert.match(modal, /activeElement/, "focus must be captured and restored");
assert.match(modal, /aria-label=/, "the close button needs an accessible label");

// Hardening confirmed by the adversarial a11y review:
assert.match(modal, /inert/, "background must be made inert to assistive tech + tab order");
assert.match(modal, /getClientRects/, "focus trap must ignore hidden (non-focusable) elements");
assert.match(modal, /defaultPrevented/, "Escape must yield to a child overlay that handled it");

console.log("modal layer static checks passed");
