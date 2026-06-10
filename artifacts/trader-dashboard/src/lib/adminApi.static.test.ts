import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/lib/adminApi.ts", "utf8");

assert.match(source, /getAdminMe/);
assert.match(source, /getAdminDashboard/);
assert.match(source, /getAdminUsers/);
assert.match(source, /getAdminUserDetail/);
assert.match(source, /revokeAdminUserSessions/);
assert.match(source, /suspendAdminUser/);
assert.match(source, /reactivateAdminUser/);
assert.match(
  source,
  /\/admin\/users\/\$\{encodeURIComponent\(userId\)\}\/suspend/,
);

console.log("admin api static checks passed");
