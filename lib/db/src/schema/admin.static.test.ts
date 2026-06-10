import assert from "node:assert/strict";
import fs from "node:fs";

const adminSchema = fs.readFileSync("src/schema/admin.ts", "utf8");
const schemaIndex = fs.readFileSync("src/schema/index.ts", "utf8");

assert.match(adminSchema, /pgTable\("admin_users"/);
assert.match(adminSchema, /pgTable\("admin_user_status"/);
assert.match(adminSchema, /pgTable\("admin_audit_logs"/);
assert.match(adminSchema, /admin_users_user_idx/);
assert.match(adminSchema, /admin_user_status_user_unique/);
assert.match(adminSchema, /admin_audit_logs_actor_idx/);
assert.match(adminSchema, /admin_audit_logs_target_idx/);
assert.match(adminSchema, /admin_audit_logs_created_idx/);
assert.match(adminSchema, /super_admin/);
assert.match(adminSchema, /support_agent/);
assert.match(schemaIndex, /export \* from "\.\/admin";/);

console.log("admin schema static checks passed");
