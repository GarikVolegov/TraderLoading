import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

const requiredTokens = [
  "--surface-0", "--surface-1", "--surface-2", "--surface-3",
  "--border-subtle", "--border-strong",
  "--text-hi", "--text-lo", "--text-faint",
  "--accent-jade", "--accent-jade-soft",
  "--glass-blur-bar", "--glass-blur-panel", "--glass-blur-raised", "--glass-blur-inset",
  "--glass-tint", "--glass-border", "--glass-highlight", "--glass-shadow", "--glass-glow",
  "--ease-glass", "--ease-spring", "--ease-out",
  "--dur-fast", "--dur-base", "--dur-slow", "--dur-slower",
  "--radius-sm", "--radius-md", "--radius-lg", "--radius-pill",
];
for (const token of requiredTokens) {
  assert.match(css, new RegExp(`${token}\\s*:`), `index.css must define ${token}`);
}

// shadcn aliases must re-point to the new ramp/jade
assert.match(css, /--background:\s*var\(--surface-0\)/, "--background must alias --surface-0");
assert.match(css, /--primary:\s*var\(--accent-jade\)/, "--primary must alias --accent-jade");
assert.match(css, /--ring:\s*var\(--accent-jade\)/, "--ring must alias --accent-jade");

// Trading semantics must remain present and saturated (functional colors)
for (const token of ["--success", "--destructive", "--warning"]) {
  assert.match(css, new RegExp(`${token}\\s*:`), `index.css must keep ${token}`);
}

console.log("design tokens static checks passed");
