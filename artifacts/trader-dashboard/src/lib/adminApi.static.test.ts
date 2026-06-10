import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/lib/adminApi.ts", "utf8");

assert.match(source, /getAdminMe/);
assert.match(source, /getAdminDashboard/);
assert.match(source, /getAdminAudit/);
assert.match(source, /getAdminTradingOverview/);
assert.match(source, /getAdminContentOverview/);
assert.match(source, /getAdminContentItems/);
assert.match(source, /publishAdminContentItem/);
assert.match(source, /unpublishAdminContentItem/);
assert.match(source, /getAdminSupportOverview/);
assert.match(source, /getAdminSystemOverview/);
assert.match(source, /getAdminSubscriptions/);
assert.match(source, /updateAdminSubscription/);
assert.match(source, /getAdminUsers/);
assert.match(source, /getAdminUserDetail/);
assert.match(source, /revokeAdminUserSessions/);
assert.match(source, /suspendAdminUser/);
assert.match(source, /reactivateAdminUser/);
assert.match(
  source,
  /\/admin\/users\/\$\{encodeURIComponent\(userId\)\}\/suspend/,
);
assert.match(source, /\/admin\/audit/);
assert.match(source, /\/admin\/trading\/overview/);
assert.match(source, /\/admin\/content\/overview/);
assert.match(source, /\/admin\/content\/items/);
assert.match(source, /postAdminContentAction\(itemId, "publish", reason\)/);
assert.match(source, /postAdminContentAction\(itemId, "unpublish", reason\)/);
assert.match(source, /\$\{encodeURIComponent\(String\(itemId\)\)\}\/\$\{action\}/);
assert.match(source, /\/admin\/support\/overview/);
assert.match(source, /\/admin\/system\/overview/);
assert.match(source, /\/admin\/subscriptions/);
assert.match(source, /\/admin\/subscriptions\/\$\{encodeURIComponent\(userId\)\}/);
assert.match(source, /plan/);
assert.match(source, /reason/);

console.log("admin api static checks passed");
