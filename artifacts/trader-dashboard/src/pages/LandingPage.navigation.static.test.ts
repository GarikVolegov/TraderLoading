import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync(new URL("./LandingPage.tsx", import.meta.url), "utf8");
const navigation = readFileSync(
  new URL("../components/landing/LandingNavigation.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(new URL("./LandingPage.css", import.meta.url), "utf8");
assert.match(page, /href="#landing-main"/);
assert.match(page, /<LandingNavigation/);
assert.match(navigation, /href="\/sign-in"/);
assert.match(navigation, /htmlFor="landing-language"/);
assert.match(navigation, /htmlFor="landing-mobile-language"/);
assert.match(navigation, /setLocation\(landingPath\(next\)\)/);
assert.match(navigation, /Dialog.Root open=\{open\} onOpenChange=\{setOpen\}/);
assert.match(navigation, /Dialog.Trigger asChild/);
assert.match(navigation, /Dialog.Title/);
assert.match(navigation, /Dialog.Description/);
assert.match(navigation, /firstLink.current\?\.focus\(\)/);
assert.match(navigation, /desktop.removeEventListener/);
assert.match(navigation, /placement="navigation" compact/);
assert.match(navigation, /if \(href === "#how"\) onStart\(\)/);
assert.match(css, /:focus-visible/);
assert.match(css, /scroll-margin-top/);
assert.match(css, /prefers-reduced-motion/);
console.log("Landing navigation and accessibility checks passed");
