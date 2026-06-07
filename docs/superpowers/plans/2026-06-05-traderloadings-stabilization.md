# TraderLoadings Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TraderLoadings install, verify, start, and debug reliably on the local Windows workspace.

**Architecture:** Add a small Node-based local tooling layer at the repo root, leaving the current API/frontend architecture intact. Root package scripts will call these tools to verify codegen, typecheck, build, runtime health, and local startup with clear diagnostics.

**Tech Stack:** pnpm workspace, Node.js scripts, TypeScript, Vite, Express, Drizzle, Docker/Postgres, Orval.

---

## File Structure

- Create `scripts/local/lib/env.ts`: parse `.env.local` safely for local tooling.
- Create `scripts/local/lib/process.ts`: port and process helpers for Windows-friendly diagnostics.
- Create `scripts/local/lib/health.ts`: HTTP and TCP probe helpers.
- Create `scripts/local/verify.ts`: full static verification command.
- Create `scripts/local/verify-runtime.ts`: runtime health probes for frontend/API/DB.
- Create `scripts/local/start.ts`: local orchestrator for install, DB readiness, schema push, backend/frontend startup.
- Modify `scripts/package.json`: expose script-local dependencies and commands if needed.
- Modify root `package.json`: add `codegen`, `verify`, `verify:runtime`, and `start:local` scripts.
- Modify `start-local.bat`: call `pnpm run start:local`.
- Modify `start-local.sh`: call `pnpm run start:local`.
- Modify `README-BRAIN.md`: document the new local workflow and troubleshooting.

---

### Task 1: Add Local Env Parser

**Files:**
- Create: `scripts/local/lib/env.ts`
- Test: `pnpm --filter ./scripts exec tsx scripts/local/lib/env.ts`

- [ ] **Step 1: Create env parser**

```ts
import fs from "node:fs";
import path from "node:path";

export function loadDotEnvLocal(root = process.cwd()): Record<string, string> {
  const filePath = path.join(root, ".env.local");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing .env.local at ${filePath}`);
  }

  const values: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    values[key] = value;
    process.env[key] = process.env[key] ?? value;
  }

  return values;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const env = loadDotEnvLocal(path.resolve(import.meta.dirname, "..", "..", ".."));
  console.log(`Loaded ${Object.keys(env).length} local env vars`);
}
```

- [ ] **Step 2: Run parser**

Run: `pnpm --filter ./scripts exec tsx scripts/local/lib/env.ts`

Expected: prints `Loaded N local env vars`.

---

### Task 2: Add Probe Helpers

**Files:**
- Create: `scripts/local/lib/health.ts`
- Create: `scripts/local/lib/process.ts`

- [ ] **Step 1: Add TCP and HTTP helpers**

```ts
import net from "node:net";

export async function waitForTcp(host: string, port: number, timeoutMs = 30_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await canConnect(host, port)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

export function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 1_500 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

export async function fetchText(url: string, timeoutMs = 10_000): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { status: response.status, text: await response.text() };
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 2: Add process helper**

```ts
import { execFileSync } from "node:child_process";

export function getPortOwner(port: number): string {
  if (process.platform !== "win32") return "port owner lookup is only implemented for Windows";
  try {
    return execFileSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort,OwningProcess | ConvertTo-Json -Compress`,
    ], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}
```

---

### Task 3: Add Static Verify Script

**Files:**
- Create: `scripts/local/verify.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement command runner**

```ts
import { spawnSync } from "node:child_process";

function run(label: string, command: string, args: string[]) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

run("Install dependencies", "pnpm", ["install"]);
run("Generate API clients", "pnpm", ["--filter", "@workspace/api-spec", "run", "codegen"]);
run("Typecheck libraries", "pnpm", ["run", "typecheck:libs"]);
run("Typecheck workspace apps", "pnpm", ["run", "typecheck"]);
run("Build workspace", "pnpm", ["run", "build"]);

console.log("\nVerification passed.");
```

- [ ] **Step 2: Add root script**

Modify `package.json` scripts:

```json
{
  "codegen": "pnpm --filter @workspace/api-spec run codegen",
  "verify": "pnpm --filter ./scripts exec tsx scripts/local/verify.ts"
}
```

- [ ] **Step 3: Run verify**

Run: `pnpm run verify`

Expected: exits `0` and prints `Verification passed.`

---

### Task 4: Add Runtime Verify Script

**Files:**
- Create: `scripts/local/verify-runtime.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement runtime probes**

```ts
import path from "node:path";
import { loadDotEnvLocal } from "./lib/env";
import { canConnect, fetchText } from "./lib/health";

const root = path.resolve(import.meta.dirname, "..", "..");
loadDotEnvLocal(root);

const checks: Array<[string, () => Promise<void>]> = [
  ["Postgres TCP 127.0.0.1:5432", async () => {
    if (!(await canConnect("127.0.0.1", 5432))) throw new Error("Postgres port is not reachable");
  }],
  ["API health http://127.0.0.1:3001/api/health", async () => {
    const response = await fetchText("http://127.0.0.1:3001/api/health");
    if (response.status !== 200 || !response.text.includes("status")) {
      throw new Error(`Unexpected API health response: ${response.status} ${response.text.slice(0, 120)}`);
    }
  }],
  ["Frontend http://127.0.0.1:5173", async () => {
    const response = await fetchText("http://127.0.0.1:5173");
    if (response.status !== 200 || !response.text.toLowerCase().includes("<html")) {
      throw new Error(`Unexpected frontend response: ${response.status}`);
    }
  }],
];

for (const [label, check] of checks) {
  process.stdout.write(`==> ${label} ... `);
  await check();
  console.log("ok");
}

console.log("\nRuntime verification passed.");
```

- [ ] **Step 2: Add root script**

Modify `package.json` scripts:

```json
{
  "verify:runtime": "pnpm --filter ./scripts exec tsx scripts/local/verify-runtime.ts"
}
```

- [ ] **Step 3: Run with services active**

Run: `pnpm run verify:runtime`

Expected: each probe prints `ok`.

---

### Task 5: Add Local Startup Orchestrator

**Files:**
- Create: `scripts/local/start.ts`
- Modify: `start-local.bat`
- Modify: `start-local.sh`
- Modify: `package.json`

- [ ] **Step 1: Implement startup script**

```ts
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { loadDotEnvLocal } from "./lib/env";
import { waitForTcp } from "./lib/health";
import { getPortOwner } from "./lib/process";

const root = path.resolve(import.meta.dirname, "..", "..");
loadDotEnvLocal(root);

function run(label: string, command: string, args: string[]) {
  console.log(`==> ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`${label} failed`);
}

function start(label: string, command: string, args: string[], env: NodeJS.ProcessEnv) {
  console.log(`==> Starting ${label}`);
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => console.log(`${label} exited with ${code}`));
  return child;
}

console.log("==> Checking occupied ports");
for (const port of [3001, 5173]) {
  const owner = getPortOwner(port);
  if (owner) console.log(`Port ${port} appears occupied: ${owner}`);
}

console.log("==> Starting PostgreSQL container if needed");
spawnSync("docker", ["start", "traderloadings-db"], { cwd: root, stdio: "ignore", shell: process.platform === "win32" });
if (spawnSync("docker", ["inspect", "traderloadings-db"], { cwd: root, stdio: "ignore", shell: process.platform === "win32" }).status !== 0) {
  run("Create PostgreSQL container", "docker", [
    "run", "-d", "--name", "traderloadings-db",
    "-e", "POSTGRES_USER=trader",
    "-e", "POSTGRES_PASSWORD=trader",
    "-e", "POSTGRES_DB=traderloadings",
    "-p", "5432:5432",
    "postgres:16",
  ]);
}

await waitForTcp("127.0.0.1", 5432, 45_000);
run("Install dependencies", "pnpm", ["install"]);
run("Push database schema", "pnpm", ["--filter", "@workspace/db", "run", "push"]);

const api = start("API", "pnpm", ["--filter", "@workspace/api-server", "run", "dev"], { PORT: "3001", BASE_PATH: "/" });
await new Promise((resolve) => setTimeout(resolve, 4_000));
const web = start("Frontend", "pnpm", ["--filter", "@workspace/trader-dashboard", "run", "dev"], { PORT: "5173", BASE_PATH: "/" });

console.log("\nOpen http://localhost:5173");

process.on("SIGINT", () => {
  api.kill();
  web.kill();
  process.exit(0);
});
```

- [ ] **Step 2: Add root script**

Modify `package.json` scripts:

```json
{
  "start:local": "pnpm --filter ./scripts exec tsx scripts/local/start.ts"
}
```

- [ ] **Step 3: Replace Windows wrapper**

Replace `start-local.bat` body with:

```bat
@echo off
cd /d "%~dp0"
call pnpm run start:local
pause
```

- [ ] **Step 4: Replace shell wrapper**

Replace `start-local.sh` body with:

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
pnpm run start:local
```

---

### Task 6: Update Documentation

**Files:**
- Modify: `README-BRAIN.md`

- [ ] **Step 1: Add local commands section**

Add:

```md
## Comandi locali consigliati

- `pnpm run verify` controlla installazione, codegen, typecheck e build.
- `pnpm run start:local` avvia database, backend e frontend.
- `pnpm run verify:runtime` controlla servizi già avviati.

Se `pnpm run start:local` segnala un errore DB, controlla che Docker Desktop sia aperto e che nessun altro PostgreSQL stia usando la porta `5432` con credenziali diverse.
```

- [ ] **Step 2: Document recovery**

Add:

```md
## Debug rapido

1. Esegui `pnpm run verify`.
2. Se fallisce codegen, controlla `lib/api-spec/openapi.yaml`.
3. Se fallisce il DB, controlla `DATABASE_URL` in `.env.local`.
4. Se una porta è occupata, chiudi il processo indicato o cambia porta.
5. Dopo modifiche API, esegui sempre `pnpm run codegen`.
```

---

### Task 7: Final Verification

**Files:**
- No code changes unless a verification failure identifies a root cause.

- [ ] **Step 1: Run static verification**

Run: `pnpm run verify`

Expected: exits `0`.

- [ ] **Step 2: Run local startup**

Run: `pnpm run start:local`

Expected:

- Postgres becomes reachable.
- API starts on `3001`.
- Frontend starts on `5173`.
- Browser can open `http://localhost:5173`.

- [ ] **Step 3: Run runtime verification in a second terminal**

Run: `pnpm run verify:runtime`

Expected: all probes print `ok`.

---

## Self-Review

- Spec coverage: local startup, DB diagnostics, codegen, typecheck, build, health probes, and docs are covered.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: helper names in tasks match their imports.
- Scope check: this plan intentionally does not redesign feature modules; those are follow-up phases after stabilization.
