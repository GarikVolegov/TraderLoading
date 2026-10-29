import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { repoRoot } from "./lib/env.js";

const RETRY_MS = 15 * 60_000;
const TAIL_MS = 60 * 60_000;
let bootstrapped = false;
let stopping = false;
let child: ChildProcess | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let wake: (() => void) | undefined;
const tsxLoader = createRequire(import.meta.url).resolve("tsx");
const ingestEntry = fileURLToPath(new URL("../../artifacts/api-server/src/ingest.ts", import.meta.url));

for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => {
  stopping = true;
  child?.kill(signal);
  if (timer) clearTimeout(timer);
  wake?.();
});

while (!stopping) {
  let waitMs = RETRY_MS;
  try {
    await new Promise<void>((resolve, reject) => {
      child = spawn(process.execPath, ["--import", tsxLoader, ingestEntry, bootstrapped ? "tail" : "seed", "--symbols=XAUUSD,EURUSD,USOIL,BTCUSD,ETHUSD", ...(!bootstrapped ? ["--years=7", "--resume=true"] : [])], {
        cwd: repoRoot, env: process.env, stdio: "inherit", shell: false,
      });
      child.once("error", reject);
      child.once("exit", code => code === 0 ? resolve() : reject(new Error("History import interrupted or incomplete")));
    });
    bootstrapped = true;
    waitMs = TAIL_MS;
  } catch {
    if (!stopping) console.warn("[history] Import incomplete; saved history is retained. Retrying in 15 minutes.");
  }
  if (stopping) break;
  await new Promise<void>(resolve => { wake = resolve; timer = setTimeout(resolve, waitMs); });
}
