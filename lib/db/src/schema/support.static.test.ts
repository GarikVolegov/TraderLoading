import assert from "node:assert/strict";
import fs from "node:fs";

const supportSchema = fs.readFileSync("src/schema/support.ts", "utf8");
const schemaIndex = fs.readFileSync("src/schema/index.ts", "utf8");

assert.match(supportSchema, /pgTable\("support_tickets"/);
assert.match(supportSchema, /pgTable\("support_ticket_messages"/);
assert.match(supportSchema, /support_tickets_user_idx/);
assert.match(supportSchema, /support_tickets_status_idx/);
assert.match(supportSchema, /support_ticket_messages_ticket_idx/);
assert.match(supportSchema, /author_type/);
assert.match(schemaIndex, /export \* from "\.\/support";/);

console.log("support schema static checks passed");
