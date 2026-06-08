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

console.log("modal layer static checks passed");
