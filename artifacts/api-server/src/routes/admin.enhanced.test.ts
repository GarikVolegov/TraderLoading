import assert from "node:assert/strict";
import fs from "node:fs";

const adminRoutesSource = fs.readFileSync("src/routes/admin.ts", "utf8");

// Candidate Applications Routes
assert.match(adminRoutesSource, /router\.get\("\/admin\/candidate-applications"/);
assert.match(adminRoutesSource, /router\.patch\("\/admin\/candidate-applications\/:id\/status"/);
assert.match(adminRoutesSource, /router\.post\("\/admin\/candidate-applications\/:id\/admit"/);
assert.match(adminRoutesSource, /router\.patch\("\/admin\/candidate-applications\/:id\/services"/);

// Roles Management Routes
assert.match(adminRoutesSource, /router\.get\("\/admin\/roles"/);
assert.match(adminRoutesSource, /router\.post\("\/admin\/roles\/assign"/);
assert.match(adminRoutesSource, /router\.post\("\/admin\/roles\/revoke"/);

// User Advanced Governance
assert.match(adminRoutesSource, /router\.patch\("\/admin\/users\/:userId\/profile"/);
assert.match(adminRoutesSource, /router\.get\("\/admin\/users\/:userId\/export"/);

// System Feature Flags
assert.match(adminRoutesSource, /router\.get\("\/admin\/system\/flags"/);
assert.match(adminRoutesSource, /router\.post\("\/admin\/system\/flags\/:key\/toggle"/);

// Trading Diagnostics & Operations
assert.match(adminRoutesSource, /router\.get\("\/admin\/trading\/diagnostics"/);
assert.match(adminRoutesSource, /router\.post\("\/admin\/trading\/retry-sync"/);

// Plan tributo_150 verification
assert.match(adminRoutesSource, /"tributo_150"/);

console.log("admin enhanced route checks passed");
