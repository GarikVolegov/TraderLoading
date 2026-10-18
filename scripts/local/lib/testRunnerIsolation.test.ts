import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "./env.js";
import { createTestRunPlan, runTests } from "./testRunner.js";

const fixture = await mkdtemp(join(tmpdir(), "test-runner-isolation-"));
const originalSecret = process.env.STRIPE_SECRET_KEY;
process.env.STRIPE_SECRET_KEY = "synthetic-secret-must-not-be-inherited";
try {
  const sentinel = join(fixture, ".local", "broker-connect-intents.json");
  const initial = '{"intents":[{"id":"sentinel","brokerName":"Synthetic personal sentinel"}]}';
  await mkdir(join(fixture, ".local"));
  await writeFile(sentinel, initial);
  const script = join(fixture, "child.mjs");
  const storeModule = pathToFileURL(join(repoRoot, "artifacts/api-server/src/services/brokerHub/connectionIntentStore.ts")).href;
  const uploadsModule = pathToFileURL(join(repoRoot, "artifacts/api-server/src/lib/uploads.ts")).href;
  await writeFile(script, `
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,dirname,sep} from 'node:path';
import {createConnectionIntentStore} from ${JSON.stringify(storeModule)};
import {resolveUploadPath} from ${JSON.stringify(uploadsModule)};
const store=createConnectionIntentStore();
assert.equal(process.env.STRIPE_SECRET_KEY,undefined,'Provider secrets must not reach unit children');
assert.equal(process.env.CLERK_SECRET_KEY,undefined,'Clerk credentials must not reach unit children');
const database=new URL(process.env.DATABASE_URL);assert.equal(database.hostname,'127.0.0.1');assert.equal(database.port,'1');assert.equal(database.pathname,'/tl_unit_no_database');
const saved=await store.createIntent({brokerName:'Synthetic isolated broker'});
assert.equal((await store.getIntent(saved.id)).brokerName,'Synthetic isolated broker');
const uploaded=resolveUploadPath('audit','file.txt');
assert.ok(uploaded.startsWith(process.env.UPLOADS_DIR+sep));
await mkdir(dirname(uploaded),{recursive:true});await writeFile(uploaded,'Synthetic upload');
await writeFile(join(process.cwd(),'observed.json'),JSON.stringify({broker:process.env.BROKER_LOCAL_STORE_DIR,uploads:process.env.UPLOADS_DIR}));
if(process.argv.includes('--fail'))throw new Error('Synthetic failing test after writes');
`);
  const plan = createTestRunPlan([{ absolutePath: script, relativePath: "synthetic-isolated-child", packageRoot: fixture }]);
  for (const fail of [false, true]) {
    const item = { ...plan[0]!, args: [...plan[0]!.args, ...(fail ? ["--fail"] : [])] };
    const result = await runTests([item]);
    assert.equal(result.passed, fail ? 0 : 1);
    assert.equal(result.failed.length, fail ? 1 : 0);
    const observed = JSON.parse(await readFile(join(fixture, "observed.json"), "utf8")) as { broker: string; uploads: string };
    assert.equal(existsSync(observed.broker), false, "Broker sandbox must be removed even on failure");
    assert.equal(existsSync(observed.uploads), false, "Upload sandbox must be removed even on failure");
    assert.equal(await readFile(sentinel, "utf8"), initial, "Default cwd storage must never be modified by the test");
  }
} finally {
  if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalSecret;
  await rm(fixture, { recursive: true, force: true });
}
console.log("test runner isolated default storage and cleanup checks passed");
