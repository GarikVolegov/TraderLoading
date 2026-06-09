import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const shell = fs.readFileSync("src/components/AuthPageShell.tsx", "utf8");

assert.match(app, /import \{ AuthPageShell \} from "\.\/components\/AuthPageShell"/);
assert.match(app, /<AuthPageShell mode="sign-in">/);
assert.match(app, /<AuthPageShell mode="sign-up">/);
assert.match(app, /<SignIn[\s\S]*routing="path"[\s\S]*path=\{`\$\{basePath\}\/sign-in`\}/);
assert.match(app, /<SignUp[\s\S]*routing="path"[\s\S]*path=\{`\$\{basePath\}\/sign-up`\}/);
assert.match(app, /header: "!hidden"/);
assert.match(app, /logoBox: "!hidden"/);
assert.match(app, /footer: "!hidden"/);
assert.match(shell, /type AuthPageShellProps/);
assert.match(shell, /mode: "sign-in" \| "sign-up"/);
assert.match(shell, /app-icon-192\.png/);
assert.match(shell, /TraderLoading/);
assert.doesNotMatch(shell, /TraderLOADING|TRADERLOADING/);
assert.doesNotMatch(shell, /TRADER[\s\S]{0,120}LOADING/);
assert.match(shell, /children/);

console.log("app auth shell static checks passed");
