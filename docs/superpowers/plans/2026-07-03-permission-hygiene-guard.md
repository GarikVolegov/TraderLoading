# Permission-Hygiene Static Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A build-time static test that fails `pnpm test`/`pnpm verify` if any permission-prompting browser API appears in dashboard source outside an explicit allowlist.

**Architecture:** One self-contained Node assert script, `artifacts/trader-dashboard/src/permission-hygiene.static.test.ts`, following the existing static-guard convention (`production-copy.static.test.ts`). A pure `findPermissionViolations(source, relPath)` function is self-tested on synthetic sources, then run over the real `src/` tree plus `public/sw.js`. Spec: [2026-07-03-permission-hygiene-guard-design.md](../specs/2026-07-03-permission-hygiene-guard-design.md).

**Tech Stack:** TypeScript, `node:assert/strict`, `node:fs`. Auto-discovered by `scripts/local/run-tests.ts` (pattern `\.test\.tsx?$` under `artifacts/`), executed as `node --import tsx <file>` from the package root.

## Global Constraints

- Toolchain not on PATH: `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"` before any node/pnpm command.
- pnpm only (preinstall guard rejects npm/yarn).
- `@typescript-eslint/no-explicit-any` = error in non-test source; TS strict. (This file is a test, but keep it `any`-free anyway — it's trivial here.)
- Multi-agent shared working tree: stage/commit **only with explicit pathspecs** (`git add <file>` + `git commit -- <file>`), never `git add -A`. Do not `git checkout --` shared files (may clobber another agent's WIP) — the mutation check uses a throwaway new file instead.
- Push the branch after the final commit (fixed user rule).
- Run single test file from repo root with: `pnpm --filter ./scripts exec tsx ../artifacts/trader-dashboard/src/permission-hygiene.static.test.ts`

---

### Task 1: Pure scanner with synthetic self-tests

**Files:**
- Create: `artifacts/trader-dashboard/src/permission-hygiene.static.test.ts`

**Interfaces:**
- Produces: `findPermissionViolations(source: string, relPath: string): Violation[]` with `type Violation = { file: string; line: number; pattern: string }`; constants `FORBIDDEN_PATTERNS` and `PERMISSION_ALLOWLIST` (consumed by Task 2 in the same file).

- [ ] **Step 1: Write the file with self-test assertions and a stub scanner (red)**

```ts
import assert from "node:assert/strict";

// Substring patterns for browser APIs that trigger a permission prompt.
// storage.persist( is deliberately qualified: bare persist( is zustand middleware.
const FORBIDDEN_PATTERNS = [
  ".requestPermission(",
  "getUserMedia(",
  "getDisplayMedia(",
  ".getCurrentPosition(",
  ".watchPosition(",
  "pushManager.subscribe(",
  "clipboard.read",
  "storage.persist(",
  "requestMIDIAccess",
  ".requestDevice(",
] as const;

type ForbiddenPattern = (typeof FORBIDDEN_PATTERNS)[number];

// Every entry is a user-gesture call site reviewed on 2026-07-03. Adding a file
// or pattern here is a deliberate, reviewable act — see POLICY below.
const PERMISSION_ALLOWLIST: Record<string, readonly ForbiddenPattern[]> = {
  "hooks/usePushNotifications.ts": [".requestPermission(", "pushManager.subscribe("],
  "components/social/MessaggiTab.tsx": ["getUserMedia("],
  "components/social/StoryViewer.tsx": ["getUserMedia("],
  "components/social/VoiceChannelView.tsx": ["getUserMedia("],
};

type Violation = { file: string; line: number; pattern: string };

function findPermissionViolations(source: string, relPath: string): Violation[] {
  void source;
  void relPath;
  return [];
}

// --- scanner self-tests on synthetic sources ---

assert.deepEqual(
  findPermissionViolations("navigator.geolocation.getCurrentPosition(onOk);", "pages/Dashboard.tsx"),
  [{ file: "pages/Dashboard.tsx", line: 1, pattern: ".getCurrentPosition(" }],
  "forbidden pattern in a non-allowlisted file must be flagged",
);

assert.deepEqual(
  findPermissionViolations(
    "const x = compute(1);\nawait navigator.clipboard.writeText(text);\npersist(store);",
    "pages/Clean.tsx",
  ),
  [],
  "clipboard.writeText and zustand persist( must not be flagged",
);

assert.deepEqual(
  findPermissionViolations("const p = await Notification.requestPermission();", "hooks/usePushNotifications.ts"),
  [],
  "allowlisted pattern in its allowlisted file must pass",
);

assert.deepEqual(
  findPermissionViolations("navigator.mediaDevices.getUserMedia({ audio: true });", "hooks/usePushNotifications.ts"),
  [{ file: "hooks/usePushNotifications.ts", line: 1, pattern: "getUserMedia(" }],
  "a different forbidden pattern in an allowlisted file must still be flagged",
);

console.log("permission hygiene static checks passed");
```

- [ ] **Step 2: Run it to verify the self-tests fail (stub returns [])**

Run (repo root):
```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
pnpm --filter ./scripts exec tsx ../artifacts/trader-dashboard/src/permission-hygiene.static.test.ts
```
Expected: FAIL — `AssertionError` on the first self-test ("forbidden pattern in a non-allowlisted file must be flagged").

- [ ] **Step 3: Implement the scanner (replace the stub body)**

```ts
function findPermissionViolations(source: string, relPath: string): Violation[] {
  const allowed = new Set<ForbiddenPattern>(PERMISSION_ALLOWLIST[relPath] ?? []);
  const violations: Violation[] = [];
  source.split(/\r?\n/).forEach((line, index) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (line.includes(pattern) && !allowed.has(pattern)) {
        violations.push({ file: relPath, line: index + 1, pattern });
      }
    }
  });
  return violations;
}
```

- [ ] **Step 4: Run again to verify the self-tests pass**

Same command as Step 2. Expected: exit 0, prints `permission hygiene static checks passed`.

- [ ] **Step 5: Commit (pathspec only)**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
git add artifacts/trader-dashboard/src/permission-hygiene.static.test.ts
git commit -m "test(dashboard): permission-hygiene scanner with synthetic self-tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- artifacts/trader-dashboard/src/permission-hygiene.static.test.ts
```

---

### Task 2: Real-tree scan, allowlist staleness check, sw.js, policy message

**Files:**
- Modify: `artifacts/trader-dashboard/src/permission-hygiene.static.test.ts` (append below the self-tests, moving the final `console.log` to the end)

**Interfaces:**
- Consumes: `findPermissionViolations`, `FORBIDDEN_PATTERNS`, `PERMISSION_ALLOWLIST`, `Violation` from Task 1 (same file).

- [ ] **Step 1: Append the tree scan + staleness check**

Add imports at the top:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
```

Replace the final `console.log` line with:

```ts
// --- real tree scan ---

const srcRoot = fileURLToPath(new URL(".", import.meta.url));

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(absolutePath);
    }
  }
  return out;
}

const POLICY =
  "Browser-permission prompts must be requested just-in-time behind an explicit user gesture, "
  + "never at mount/app startup. To add a legitimate call site, add the file + API pattern to "
  + "PERMISSION_ALLOWLIST in permission-hygiene.static.test.ts so the change is visible in review.";

const treeViolations: Violation[] = [];
for (const absolutePath of collectSourceFiles(srcRoot)) {
  const relPath = absolutePath.replace(srcRoot, "").split("\\").join("/");
  treeViolations.push(...findPermissionViolations(readFileSync(absolutePath, "utf8"), relPath));
}

// The service worker could subscribe to push on its own: it has no allowlist and must stay clean.
const swPath = fileURLToPath(new URL("../public/sw.js", import.meta.url));
treeViolations.push(...findPermissionViolations(readFileSync(swPath, "utf8"), "../public/sw.js"));

assert.deepEqual(
  treeViolations.map((v) => `${v.file}:${v.line} uses ${v.pattern}`),
  [],
  POLICY,
);

// --- allowlist staleness: entries must point at files that still use the pattern ---

for (const [relPath, patterns] of Object.entries(PERMISSION_ALLOWLIST)) {
  let source: string;
  try {
    source = readFileSync(join(srcRoot, relPath), "utf8");
  } catch {
    assert.fail(`PERMISSION_ALLOWLIST entry points at a missing file: ${relPath}`);
  }
  for (const pattern of patterns) {
    assert.equal(
      source.includes(pattern),
      true,
      `Stale PERMISSION_ALLOWLIST entry: ${relPath} no longer uses ${pattern}`,
    );
  }
}

console.log("permission hygiene static checks passed");
```

- [ ] **Step 2: Run on the real tree — must pass**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
pnpm --filter ./scripts exec tsx ../artifacts/trader-dashboard/src/permission-hygiene.static.test.ts
```
Expected: exit 0, `permission hygiene static checks passed` (current tree has exactly the four allowlisted call sites — verified 2026-07-03).

- [ ] **Step 3: Mutation check with a throwaway file (never touch shared files)**

```bash
cat > /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/tmp-mutation-check.ts <<'EOF'
export function locateUser(): void {
  navigator.geolocation.getCurrentPosition(() => undefined);
}
EOF
pnpm --filter ./scripts exec tsx ../artifacts/trader-dashboard/src/permission-hygiene.static.test.ts
```
Expected: FAIL, message contains `tmp-mutation-check.ts:2 uses .getCurrentPosition(` and the POLICY text. Then delete the throwaway file:

```bash
rm /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/tmp-mutation-check.ts
```

- [ ] **Step 4: Re-run guard (clean) + typecheck + full test suite**

```bash
pnpm --filter ./scripts exec tsx ../artifacts/trader-dashboard/src/permission-hygiene.static.test.ts
pnpm --filter @workspace/trader-dashboard typecheck
pnpm test
```
Expected: guard passes; typecheck clean; test summary shows previous count + 1 passed (293 if base is 292), 0 failed.

- [ ] **Step 5: Commit (pathspec only) and push**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
git add artifacts/trader-dashboard/src/permission-hygiene.static.test.ts
git commit -m "test(dashboard): enforce just-in-time permission prompts via static guard

Scans src/ + public/sw.js for permission-prompting APIs outside the
reviewed allowlist, with staleness checks on allowlist entries.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- artifacts/trader-dashboard/src/permission-hygiene.static.test.ts
git push
```
Expected: push accepted (report, don't force, if the remote rejects).
