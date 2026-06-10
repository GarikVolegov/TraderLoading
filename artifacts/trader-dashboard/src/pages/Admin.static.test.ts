import assert from "node:assert/strict";
import fs from "node:fs";

const adminPage = fs.readFileSync("src/pages/Admin.tsx", "utf8");
const shell = fs.readFileSync("src/components/admin/AdminShell.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

assert.match(adminPage, /getAdminDashboard/);
assert.match(adminPage, /getAdminAudit/);
assert.match(adminPage, /getAdminTradingOverview/);
assert.match(adminPage, /getAdminContentOverview/);
assert.match(adminPage, /getAdminContentItems/);
assert.match(adminPage, /publishAdminContentItem/);
assert.match(adminPage, /unpublishAdminContentItem/);
assert.match(adminPage, /getAdminSupportOverview/);
assert.match(adminPage, /getAdminSystemOverview/);
assert.match(adminPage, /getAdminSubscriptions/);
assert.match(adminPage, /updateAdminSubscription/);
assert.match(adminPage, /getAdminUsers/);
assert.match(adminPage, /getAdminUserDetail/);
assert.match(adminPage, /revokeAdminUserSessions/);
assert.match(adminPage, /suspendAdminUser/);
assert.match(adminPage, /reactivateAdminUser/);
assert.match(adminPage, /AdminSecurityPage/);
assert.match(adminPage, /AdminTradingPage/);
assert.match(adminPage, /AdminContentPage/);
assert.match(adminPage, /contentAction\.mutate/);
assert.match(adminPage, /queryClient\.invalidateQueries\(\{ queryKey: \["admin-content-items"\] \}\)/);
assert.doesNotMatch(adminPage, /publish\/unpublish saranno collegati/);
assert.match(adminPage, /AdminSupportPage/);
assert.match(adminPage, /AdminSystemPage/);
assert.match(adminPage, /AdminSubscriptionsPage/);
assert.match(adminPage, /subscriptionAction\.mutate/);
assert.match(adminPage, /manualOverride/);
assert.match(adminPage, /Pro - 7 euro/);
assert.match(adminPage, /submitSubscriptionUpdate\(row\.userId, "free", "active", null\)/);
assert.doesNotMatch(adminPage, /starter/);
assert.doesNotMatch(adminPage, /team/);
assert.match(adminPage, /AdminUserDetailTabs/);
assert.match(adminPage, /getInitialAdminUserStatus/);
assert.match(adminPage, /syncAdminUserFiltersToUrl/);
assert.match(adminPage, /<Tabs/);
assert.match(adminPage, /<Route path="\/admin\/audit"/);
assert.match(adminPage, /<Route path="\/admin\/security"/);
assert.match(adminPage, /component=\{AdminTradingPage\}/);
assert.match(adminPage, /component=\{AdminContentPage\}/);
assert.match(adminPage, /component=\{AdminSupportPage\}/);
assert.match(adminPage, /component=\{AdminSystemPage\}/);
assert.match(adminPage, /component=\{AdminSubscriptionsPage\}/);
assert.doesNotMatch(adminPage, /AdminComingSoon/);
assert.match(shell, /Dashboard/);
assert.match(shell, /Utenti/);
assert.match(shell, /Sicurezza/);
assert.match(shell, /Abbonamenti/);
assert.match(shell, /billing\.subscriptions\.write/);
assert.match(shell, /permissions/);
assert.match(shell, /mobile-admin-navigation/);
assert.match(shell, /aria-current/);
assert.match(
  app,
  /const Admin = lazy\(\(\) => import\("\.\/pages\/Admin"\)\)/,
);
assert.match(app, /location\.startsWith\("\/admin"\)/);

console.log("admin page static checks passed");
