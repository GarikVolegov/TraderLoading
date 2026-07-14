import assert from "node:assert/strict";
import fs from "node:fs";
import { readAdminFeatureSource } from "./adminFeatureSource";

const adminPage = readAdminFeatureSource();
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
assert.match(adminPage, /billingQueryKey/);
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
assert.match(adminPage, /queryClient\.invalidateQueries\(\{ queryKey: billingQueryKey \}\)/);
assert.match(adminPage, /manualOverride/);
assert.match(adminPage, /Pro - 7 euro/);
assert.match(adminPage, /rowReasons/);
assert.match(adminPage, /setRowReason/);
assert.match(adminPage, /reasonForRow\(row\.userId\)/);
assert.match(
  adminPage,
  /submitSubscriptionUpdate\(\s*row\.userId,\s*"free",\s*"active",\s*null,\s*effectiveReason,?\s*\)/,
);
assert.doesNotMatch(adminPage, /!reasonReady \|\|\s*!row\.userId/);
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
// Le label di navigazione sono passate all'i18n: chiavi nella shell, copy nel catalogo.
const i18nDict = fs.readFileSync("src/lib/i18n/dict.it.ts", "utf8");
assert.match(shell, /labelKey: "admin\.nav\.dashboard"/);
assert.match(shell, /labelKey: "admin\.nav\.users"/);
assert.match(shell, /labelKey: "admin\.nav\.security"/);
assert.match(shell, /labelKey: "admin\.nav\.subscriptions"/);
assert.match(i18nDict, /"admin\.nav\.dashboard":\s*"Dashboard"/);
assert.match(i18nDict, /"admin\.nav\.users":\s*"Utenti"/);
assert.match(i18nDict, /"admin\.nav\.security":\s*"Sicurezza"/);
assert.match(i18nDict, /"admin\.nav\.subscriptions":\s*"Abbonamenti"/);
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
