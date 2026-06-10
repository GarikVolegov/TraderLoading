import assert from "node:assert/strict";
import fs from "node:fs";

const adminPage = fs.readFileSync("src/pages/Admin.tsx", "utf8");
const shell = fs.readFileSync("src/components/admin/AdminShell.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

assert.match(adminPage, /getAdminDashboard/);
assert.match(adminPage, /getAdminUsers/);
assert.match(adminPage, /getAdminUserDetail/);
assert.match(adminPage, /revokeAdminUserSessions/);
assert.match(adminPage, /suspendAdminUser/);
assert.match(adminPage, /reactivateAdminUser/);
assert.match(shell, /Dashboard/);
assert.match(shell, /Utenti/);
assert.match(shell, /Sicurezza/);
assert.match(
  app,
  /const Admin = lazy\(\(\) => import\("\.\/pages\/Admin"\)\)/,
);
assert.match(app, /location\.startsWith\("\/admin"\)/);

console.log("admin page static checks passed");
