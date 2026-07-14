# Chat At-Rest Encryption + Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the misleading E2EE claim in favor of honest at-rest encryption, and fix the two adjacent real bugs (chat-key backup overwrite → history loss; chat media served without auth).

**Architecture:** Three independent parts. B (client crypto fix) and A (relabel) are self-contained. C (media auth-gate) adds a `chat_file_access` table recorded at upload so the server can authorize downloads participant-by-participant (the media URL itself lives inside the message ciphertext, so the server otherwise can't map a file to its DM).

**Tech Stack:** Express 5 + Drizzle/Postgres (api-server), React 19 (trader-dashboard), hand-authored SQL migrations, tests are plain `node:assert` files run with `tsx`.

## Global Constraints

- Run tests with: `cd artifacts/api-server && ./node_modules/.bin/tsx <file>` (server) — ensure `PATH="$HOME/.local/node/bin:$PATH"`. Frontend logic/static tests run the same way from `artifacts/trader-dashboard` if it has a local tsx, else from api-server's tsx by absolute path.
- Typecheck: `cd artifacts/api-server && /Users/gazz/Desktop/TraderLoadingsLOCALE/node_modules/.bin/tsc --noEmit -p tsconfig.json` (expect exit 0). Frontend: same with `artifacts/trader-dashboard/tsconfig.json`.
- **i18n rule:** any new user-visible copy needs a key present in ALL 5 dicts (`dict.{it,en,es,fr,de}.ts`); never pass string literals to visible props. Avoid the chars `Ã â Â ð` in dict values (mojibake test).
- **Multi-agent branch:** commit with explicit pathspec (`git commit -- <paths>`), never `git add -A`. Do NOT touch `artifacts/trader-dashboard/src/permission-hygiene.static.test.ts` (another agent's WIP).
- **Migrations are hand-authored** (do NOT run `db:generate`). Number the new file after the current highest in `lib/db/drizzle/`.
- End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. `git push origin feat/community-management` after each task.

---

### Task 1: Fix chat-key backup overwrite (data-loss)

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/e2ee.ts` (`getOrCreateAccountKeyPair`, ~lines 158-195)
- Test: `artifacts/trader-dashboard/src/lib/e2ee.test.ts`

**Interfaces:**
- Consumes: `AccountKeyBackupStore { load(): Promise<E2EEKeyPair|null>; save(p): Promise<void>; loadLocal?; saveLocal? }` (already defined in e2ee.ts).
- Produces: `getOrCreateAccountKeyPair` that never overwrites the remote backup when `load()` throws.

- [ ] **Step 1: Write the failing tests** — append to `e2ee.test.ts`:

```ts
// A transient backup load failure must NEVER regenerate + overwrite the backup
// (that would make all past messages undecryptable). Fail closed.
{
  const saves: string[] = [];
  const store = {
    load: async () => { throw new Error("network"); },
    save: async () => { saves.push("save"); },
    loadLocal: async () => null,       // new device, no local key
    saveLocal: async () => {},
  };
  let threw = false;
  try { await getOrCreateAccountKeyPair("u1", store); } catch { threw = true; }
  assert.equal(threw, true, "load failure with no local key surfaces, not silently regenerates");
  assert.equal(saves.length, 0, "must not overwrite the remote backup on load failure");
}
{
  // load fails but a local key exists → use it, do NOT overwrite the backup.
  const local = await generateKeyPair("u2");
  const saves: string[] = [];
  const store = {
    load: async () => { throw new Error("timeout"); },
    save: async () => { saves.push("save"); },
    loadLocal: async () => local,
    saveLocal: async () => {},
  };
  const result = await getOrCreateAccountKeyPair("u2", store);
  assert.equal(result, local);
  assert.equal(saves.length, 0, "local key present → never overwrite backup on load failure");
}
{
  // load returns null (definitively no backup) → generate + save (unchanged path).
  const saves: string[] = [];
  const store = {
    load: async () => null,
    save: async () => { saves.push("save"); },
    loadLocal: async () => null,
    saveLocal: async () => {},
  };
  const created = await getOrCreateAccountKeyPair("u3", store);
  assert.ok(created.publicKey && created.privateKey);
  assert.equal(saves.length, 1, "first-ever key is backed up");
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/trader-dashboard && $HOME/.local/node/bin/node ../api-server/node_modules/.bin/tsx src/lib/e2ee.test.ts`
Expected: FAIL — current code catches the throw, regenerates, and calls `save` (saves.length === 1, and no throw).

- [ ] **Step 3: Implement fail-closed logic** — replace the body of `getOrCreateAccountKeyPair`:

```ts
export async function getOrCreateAccountKeyPair(
  userId: string,
  accountBackup: AccountKeyBackupStore,
): Promise<E2EEKeyPair> {
  const loadLocal = accountBackup.loadLocal ?? loadKeyPair;
  const saveLocal = accountBackup.saveLocal ?? storeKeyPairBestEffort;

  const localPair = await loadLocal(userId);

  let accountPair: E2EEKeyPair | null;
  try {
    accountPair = await accountBackup.load(); // null = no backup exists
  } catch (err) {
    // Couldn't determine whether a backup exists (network/server error). Fail
    // closed: never regenerate, which would overwrite the only key copy and make
    // every past message undecryptable. Use the local key if present, else surface.
    if (localPair) return localPair;
    throw err;
  }

  if (accountPair) {
    await saveLocal(userId, accountPair);
    return accountPair;
  }
  if (localPair) {
    try { await accountBackup.save(localPair); } catch { /* retry on a later login */ }
    return localPair;
  }
  const generated = await generateKeyPair(userId);
  try { await accountBackup.save(generated); } catch { /* local is enough to start */ }
  return generated;
}
```

- [ ] **Step 4: Run to verify pass**

Run: same as Step 2.
Expected: PASS — `e2ee.test.ts` prints its success line.

- [ ] **Step 5: Typecheck + commit**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
artifacts/trader-dashboard has no tsc; run: node_modules/.bin/tsc --noEmit -p artifacts/trader-dashboard/tsconfig.json  # expect exit 0
git add artifacts/trader-dashboard/src/lib/e2ee.ts artifacts/trader-dashboard/src/lib/e2ee.test.ts
git commit -- artifacts/trader-dashboard/src/lib/e2ee.ts artifacts/trader-dashboard/src/lib/e2ee.test.ts -m "fix(chat): never overwrite key backup on transient load failure

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin feat/community-management
```

---

### Task 2: Relabel E2EE → honest "cifrato" + document

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n/dict.it.ts`, `dict.en.ts`, `dict.es.ts`, `dict.fr.ts`, `dict.de.ts` (change the E2EE copy values; add one new key)
- Modify: `artifacts/trader-dashboard/src/components/social/MessaggiTab.tsx:813` (hardcoded `E2EE` literal → `t()`)
- Modify: `artifacts/api-server/src/routes/chat.ts`, `artifacts/trader-dashboard/src/lib/e2ee.ts` (doc comments)
- Test: `artifacts/trader-dashboard/src/lib/i18n/no-e2ee-claim.static.test.ts` (new)

**Interfaces:**
- Produces: new i18n key `chat.encrypted_badge` = "Cifrato" (all 5 langs).

- [ ] **Step 1: Write the failing static test** — create `no-e2ee-claim.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Honest at-rest model: no UI copy may claim end-to-end encryption. Scan the
// canonical dict values.
const it = readFileSync(new URL("./dict.it.ts", import.meta.url), "utf8");
assert.doesNotMatch(it, /end-to-end|E2EE/i);
// The new honest badge key must exist.
assert.match(it, /"chat\.encrypted_badge"/);
console.log("no-e2ee-claim static checks passed");
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/trader-dashboard && $HOME/.local/node/bin/node ../api-server/node_modules/.bin/tsx src/lib/i18n/no-e2ee-claim.static.test.ts`
Expected: FAIL — `dict.it.ts` currently contains "end-to-end"/"E2EE" and lacks `chat.encrypted_badge`.

- [ ] **Step 3: Update dict values (all 5 langs)** — in each `dict.<lang>.ts` change these keys' VALUES (keep keys), removing "E2EE"/"end-to-end". Italian shown; translate for en/es/fr/de:

```
"auth.shell.footer.secure": "Connessione protetta · le tue chat sono cifrate",
"auth.shell.trust.e2ee.desc": "I messaggi sono cifrati, non in chiaro.",
"auth.shell.trust.e2ee.title": "Chat cifrate",
"auto.ui.5196dca303": "Messaggi cifrati",
"chat.e2ee_info": "Messaggi cifrati",
"landing.features.community.desc": "Feed social, messaggi cifrati e classifica trader.",
```
Add the new key to every dict (Italian value shown):
```
"chat.encrypted_badge": "Cifrato",
```
(en: "Encrypted", es: "Cifrado", fr: "Chiffré", de: "Verschlüsselt".)

- [ ] **Step 4: Replace the hardcoded literal** — `MessaggiTab.tsx:813`, change `<Shield className="w-3 h-3" /> E2EE` to `<Shield className="w-3 h-3" /> {t("chat.encrypted_badge")}` (confirm `t` is in scope in this component; it uses `uiText`/`t` already — use whichever the file imports).

- [ ] **Step 5: Add doc comments** — at the `PUT /chat/key-backup` handler in `routes/chat.ts` and above `deriveSharedKey` in `e2ee.ts`, add: `// NOTE: messages are AES-GCM encrypted at rest; the private key is escrowed by the server for cross-device recovery. This is NOT end-to-end encryption.`

- [ ] **Step 6: Run static + parity tests**

Run the new test (Step 2 cmd) → PASS.
Run i18n parity: `cd artifacts/trader-dashboard && $HOME/.local/node/bin/node ../api-server/node_modules/.bin/tsx src/lib/i18n/i18n.parity.static.test.ts` → PASS (keys unchanged). Also run `production-copy.static.test.ts` and `i18n.mojibake`/parity if present → PASS.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/i18n/dict.*.ts artifacts/trader-dashboard/src/lib/i18n/no-e2ee-claim.static.test.ts artifacts/trader-dashboard/src/components/social/MessaggiTab.tsx artifacts/api-server/src/routes/chat.ts artifacts/trader-dashboard/src/lib/e2ee.ts
git commit -- <those paths> -m "refactor(chat): drop misleading E2EE claim, label as at-rest encrypted

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin feat/community-management
```

---

### Task 3: `chat_file_access` table (migration + schema)

**Files:**
- Create: `lib/db/drizzle/00NN_chat_file_access.sql` (NN = current max + 1; check `ls lib/db/drizzle/`)
- Modify: `lib/db/src/schema/chat.ts` (add table + type), `lib/db/src/schema/index.ts` if it re-exports per-table (verify)
- Modify: `lib/db/drizzle/meta/_journal.json` — follow the existing pattern for registering a migration (inspect an existing entry; the migrations test `scripts/local/dbMigrations.test.ts` checks file↔journal consistency)
- Test: `scripts/local/dbMigrations.test.ts` (must stay green)

**Interfaces:**
- Produces: `chatFileAccessTable` with columns `id, fileKey (text unique), ownerUserId (text), peerUserId (text), createdAt`.

- [ ] **Step 1: Add the Drizzle table** to `lib/db/src/schema/chat.ts`:

```ts
export const chatFileAccessTable = pgTable("chat_file_access", {
  id: serial("id").primaryKey(),
  fileKey: text("file_key").notNull().unique(),
  ownerUserId: text("owner_user_id").notNull(),
  peerUserId: text("peer_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("chat_file_access_owner_idx").on(t.ownerUserId),
  index("chat_file_access_peer_idx").on(t.peerUserId),
]);
export type ChatFileAccess = typeof chatFileAccessTable.$inferSelect;
```
(Confirm `pgTable, serial, text, timestamp, index` are imported at the top of chat.ts; add any missing.)

- [ ] **Step 2: Write the SQL migration** — `lib/db/drizzle/00NN_chat_file_access.sql`:

```sql
CREATE TABLE IF NOT EXISTS "chat_file_access" (
  "id" serial PRIMARY KEY,
  "file_key" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "peer_user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "chat_file_access_file_key_unique" ON "chat_file_access" ("file_key");
CREATE INDEX IF NOT EXISTS "chat_file_access_owner_idx" ON "chat_file_access" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "chat_file_access_peer_idx" ON "chat_file_access" ("peer_user_id");
```

- [ ] **Step 3: Register in the journal** — add the new migration entry to `lib/db/drizzle/meta/_journal.json` mirroring the format of the last entry (idx incremented, tag = filename without `.sql`).

- [ ] **Step 4: Run the migrations bookkeeping test**

Run: `cd artifacts/api-server && $HOME/.local/node/bin/node ./node_modules/.bin/tsx ../../scripts/local/dbMigrations.test.ts` (or the path the repo uses)
Expected: PASS (file registered).

- [ ] **Step 5: Typecheck + commit**

```bash
cd artifacts/api-server && /Users/gazz/Desktop/TraderLoadingsLOCALE/node_modules/.bin/tsc --noEmit -p tsconfig.json  # exit 0
git add lib/db/src/schema/chat.ts lib/db/drizzle/00NN_chat_file_access.sql lib/db/drizzle/meta/_journal.json
git commit -- <those paths> -m "feat(db): chat_file_access table for participant-scoped chat media

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin feat/community-management
```

---

### Task 4: Record access on upload + authenticated serving

**Files:**
- Modify: `artifacts/api-server/src/routes/social.ts` (upload endpoints `/social/upload-image|file|voice`; add serving routes)
- Modify: `artifacts/api-server/src/lib/security.ts` (remove `chat-files`, `voice` from `ALLOWED_UPLOAD_DIRS`)
- Modify: `artifacts/api-server/src/lib/security.test.ts` (assert they're now gated)
- Test: `artifacts/api-server/src/routes/social.chat-media.static.test.ts` (new)

**Interfaces:**
- Consumes: `chatFileAccessTable` (Task 3), `areMutualFollowers(a, b)` (existing in social/friends services — grep for its exact import), `db`.
- Produces: `GET /api/uploads/chat-files/:filename` and `/api/uploads/voice/:filename` gated on owner/peer.

- [ ] **Step 1 (RED, guard): update security.test.ts** — change the two lines asserting `isAllowedUploadPath("/voice/…")` and `"/chat-files/…"` are `true` to `false`, and add a 404 guard assertion (mirror the wiki block already there). Run it → FAIL (still allowed).

- [ ] **Step 2 (GREEN, guard):** in `lib/security.ts` remove `"voice"` and `"chat-files"` from `ALLOWED_UPLOAD_DIRS` (leave `post-images`). Run security.test.ts → PASS.

- [ ] **Step 3: Upload endpoints record access** — in each of `/social/upload-image`, `/social/upload-file`, `/social/upload-voice` (social.ts), after the file is saved and `filename` known:

```ts
const userId = req.user?.id;
if (!userId) { res.status(401).json({ error: "Non autorizzato" }); return; }
const toUserId = typeof req.body?.toUserId === "string" ? req.body.toUserId : "";
if (!toUserId || !(await areMutualFollowers(userId, toUserId))) {
  res.status(400).json({ error: "Destinatario non valido" }); return;
}
await db.insert(chatFileAccessTable)
  .values({ fileKey: req.file.filename, ownerUserId: userId, peerUserId: toUserId })
  .onConflictDoNothing({ target: chatFileAccessTable.fileKey });
```
(Adjust to each endpoint's existing response shape; keep returning the same `fileUrl`/`imageUrl`.)

- [ ] **Step 4: Authenticated serving routes** — add to social.ts (before `export default`):

```ts
async function serveGatedMedia(dir: string, prefix: string, req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Non autorizzato" }); return; }
  const filename = req.params.filename;
  const [row] = await db.select().from(chatFileAccessTable)
    .where(eq(chatFileAccessTable.fileKey, filename)).limit(1);
  if (!row || (row.ownerUserId !== userId && row.peerUserId !== userId)) {
    res.status(404).json({ error: "File non trovato" }); return; // no existence signal
  }
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File non trovato" }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(filePath);
}
router.get("/uploads/chat-files/:filename", (req, res) => serveGatedMedia(CHAT_FILES_DIR, "chat-files", req, res));
router.get("/uploads/voice/:filename", (req, res) => serveGatedMedia(VOICE_DIR, "voice", req, res));
```
(Confirm `path`, `fs`, `eq`, `Request`, `Response` are imported.)

- [ ] **Step 5: Static test** — `social.chat-media.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./social.ts", import.meta.url), "utf8");
assert.match(src, /router\.get\("\/uploads\/chat-files\/:filename"/);
assert.match(src, /router\.get\("\/uploads\/voice\/:filename"/);
assert.match(src, /row\.ownerUserId !== userId && row\.peerUserId !== userId/);
assert.match(src, /areMutualFollowers\(userId, toUserId\)/);
console.log("social chat-media static checks passed");
```

- [ ] **Step 6: Typecheck + run tests + commit**

Run typecheck (exit 0), security.test.ts (PASS), social.chat-media.static.test.ts (PASS).
```bash
git add artifacts/api-server/src/routes/social.ts artifacts/api-server/src/lib/security.ts artifacts/api-server/src/lib/security.test.ts artifacts/api-server/src/routes/social.chat-media.static.test.ts
git commit -- <those paths> -m "fix(chat): serve DM media only to conversation participants

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin feat/community-management
```

---

### Task 5: Frontend passes `toUserId` on upload

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/social/MessaggiTab.tsx` (image/file/voice upload calls, ~lines 215-320)
- Modify: the upload API helper the component calls (grep for the `upload-image`/`upload-file`/`upload-voice` fetch — likely in a `social` api module)

**Interfaces:**
- Consumes: the active conversation peer id (already in component state as the selected friend id).

- [ ] **Step 1:** Locate the upload call sites and their API helper (grep `upload-image|upload-file|upload-voice` under `src/`). Add a `toUserId` field to the multipart `FormData` (`form.append("toUserId", activeFriendId)`) in each helper, and thread `activeFriendId` from MessaggiTab to those calls.

- [ ] **Step 2: Manual/behavior check** — since there's no frontend render harness, verify by typecheck (exit 0) and by reading the diff: every upload call now includes `toUserId`. (Runtime verification happens in the app: send an image in a DM, confirm it loads for both sender and recipient; confirm a logged-out/third-party GET on the URL 404s.)

- [ ] **Step 3: Commit**

```bash
git add <MessaggiTab.tsx and the api helper>
git commit -- <those paths> -m "feat(chat): send recipient id when uploading DM media

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin feat/community-management
```

---

### Task 6: GDPR deletion covers `chat_file_access`

**Files:**
- Modify: `artifacts/api-server/src/services/accountDeletion.ts` (add DELETE)
- Test: `artifacts/api-server/src/services/accountDeletion.coverage.static.test.ts` (extend the explicit-table list)

**Interfaces:**
- Consumes: existing `deleteLocalAccountData` transaction.

- [ ] **Step 1 (RED):** In `accountDeletion.coverage.static.test.ts`, add `"chat_file_access"` to the explicit indirect-tables loop (the one listing `community_review_reports`, `sessions`, etc.). Run it → FAIL (not yet deleted).

- [ ] **Step 2 (GREEN):** In `deleteLocalAccountData`, alongside the chat block, add:

```ts
await tx.execute(sql`DELETE FROM chat_file_access WHERE owner_user_id = ${userId} OR peer_user_id = ${userId}`);
```

- [ ] **Step 3:** Run the coverage test → PASS; typecheck (exit 0).

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/services/accountDeletion.ts artifacts/api-server/src/services/accountDeletion.coverage.static.test.ts
git commit -- <those paths> -m "fix(privacy): erase chat_file_access on account deletion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin feat/community-management
```

---

## Self-Review

- **Spec coverage:** Part A → Task 2. Part B → Task 1. Part C → Tasks 3 (table), 4 (upload+serving+guard), 5 (client), 6 (GDPR). Legacy-media 404 consequence is accepted in the spec (no task needed). ✓
- **Placeholder scan:** upload endpoint code is shown; serving route shown; test bodies shown. The one lookup left to execution is the exact `areMutualFollowers` import path and the frontend upload-helper location — both are "grep to confirm", not placeholder logic. ✓
- **Type consistency:** `chatFileAccessTable` columns (`fileKey/ownerUserId/peerUserId`) are used identically in Tasks 3/4/6. `chat.encrypted_badge` key consistent between Task 2 steps. ✓
