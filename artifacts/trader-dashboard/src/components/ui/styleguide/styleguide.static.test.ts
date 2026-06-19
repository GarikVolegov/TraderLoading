import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./Styleguide.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../../App.tsx", import.meta.url), "utf8");

assert.match(page, /export default function Styleguide/, "Styleguide must default-export a component");
for (const needle of ["glass-panel", "glass-raised", "glass-inset", "Button", "Card", "Badge"]) {
  assert.match(page, new RegExp(needle), `Styleguide must showcase ${needle}`);
}
assert.match(app, /path="\/styleguide"/, "App.tsx must register the /styleguide route");
assert.match(app, /Styleguide/, "App.tsx must import Styleguide");

console.log("styleguide static checks passed");
