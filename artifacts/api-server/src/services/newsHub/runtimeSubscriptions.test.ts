import assert from "node:assert/strict";
import { createNewsHubRuntime } from "./runtime.js";
import type { NewsResponse } from "./types.js";

const setIntervalBefore = globalThis.setInterval, nowBefore = Date.now;
let tick:()=>void = () => {};
let now = 1_000_000;
globalThis.setInterval = ((callback:()=>void) => { tick=callback; return 1; }) as unknown as typeof setInterval;
Date.now = () => now;
const calls: string[] = [];
const runtime = createNewsHubRuntime({refreshIntervalMs:10_000,snapshotFreshMs:60_000,fetchSnapshot:async request=>{
  calls.push(`${request.pairs}:${request.lang}`);
  return {articles:[],watchedPairs:(request.pairs ?? "").split(",").filter(Boolean),fetchedAt:new Date(now).toISOString(),hasApiKey:false,source:"rss"} satisfies NewsResponse;
}});
const settle = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };
try {
  const detachIt = runtime.subscribe({pairs:"EURUSD",lang:"it"});
  const detachEn1 = runtime.subscribe({pairs:"EUR/USD",lang:"en"});
  const detachEn2 = runtime.subscribe({pairs:"EURUSD",lang:"EN-us"});
  await Promise.all([runtime.refresh({pairs:"EURUSD",lang:"it"}),runtime.refresh({pairs:"EURUSD",lang:"en"})]);
  assert.equal(runtime.getSnapshot({pairs:"EURUSD",lang:"it"})?.lang,"it");
  assert.equal(runtime.getSnapshot({pairs:"EURUSD",lang:"en"})?.lang,"en");
  runtime.start(); calls.length=0;
  tick(); await settle();
  assert.deepEqual(calls,[],"freshness gates are per subscription");
  now+=60_000; tick(); await settle();
  assert.deepEqual(calls.sort(),["EURUSD:en","EURUSD:it"]);
  calls.length=0; detachEn1(); now+=60_000; tick(); await settle();
  assert.deepEqual(calls.sort(),["EURUSD:en","EURUSD:it"],"one of two readers can detach without stopping the other");
  calls.length=0; detachEn2(); now+=60_000; tick(); await settle();
  assert.deepEqual(calls,["EURUSD:it"],"inactive keys no longer rebuild");
  calls.length=0; detachIt(); now+=60_000; tick(); await settle();
  assert.deepEqual(calls,[":it"],"idle runtime refreshes only its default shared corpus");
} finally { await runtime.stop(); globalThis.setInterval=setIntervalBefore; Date.now=nowBefore; }

let release:()=>void = () => {};
const blocked = new Promise<void>(resolve=>{release=resolve;});
let builds=0;
const concurrent = createNewsHubRuntime({refreshIntervalMs:0,fetchSnapshot:async ()=>{builds++;await blocked;return {articles:[],fetchedAt:new Date().toISOString(),hasApiKey:false,source:"rss",watchedPairs:["EUR/USD"]};}});
const a = concurrent.refresh({pairs:"EURUSD",lang:"en"});
const b = concurrent.refresh({pairs:"EUR/USD",lang:"EN-us"});
assert.equal(builds,1,"same normalized pair/language readers share an in-flight build");
release(); const snapshots=await Promise.all([a,b]);
assert.equal(snapshots[0],snapshots[1]);
await concurrent.stop();
console.log("per-subscription periodic refresh, language isolation and single-flight checks passed");
