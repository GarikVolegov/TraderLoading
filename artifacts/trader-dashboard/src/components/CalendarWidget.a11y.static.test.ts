import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./CalendarWidget.tsx", import.meta.url), "utf8");

// Economic-calendar event rows with details must be keyboard-operable, not
// mouse-only: a real button role, focusable, Enter/Space handling, and an
// aria-expanded state for screen readers.
assert.match(source, /role: "button"/, "expandable event row exposes a button role");
assert.match(source, /tabIndex: 0/, "expandable event row is focusable");
assert.match(source, /onKeyDown:/, "expandable event row handles keyboard activation");
assert.match(source, /"aria-expanded": isExpanded/, "expandable event row announces its expanded state");
assert.match(source, /e\.key === "Enter" \|\| e\.key === " "/, "Enter and Space activate the row");

console.log("calendar a11y checks passed");
