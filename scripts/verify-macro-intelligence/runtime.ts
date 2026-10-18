import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadEnvLocal } from "../local/lib/env.js";

loadEnvLocal();
const original=new URL(process.env.DATABASE_URL!);
assert.ok(["localhost","127.0.0.1","::1"].includes(original.hostname),"This runner only creates disposable databases on local PostgreSQL");
const require=createRequire(new URL("../../lib/db/package.json",import.meta.url));
const {Client}=require("pg") as typeof import("pg");
const admin=new Client({connectionString:original.toString()});
const name=`tl_macro_${Date.now()}`;
const uploads=await mkdtemp(join(tmpdir(),"tl-macro-uploads-"));
await admin.connect();await admin.query(`CREATE DATABASE "${name}"`);
const isolated=new URL(original);isolated.pathname=`/${name}`;
process.env.DATABASE_URL=isolated.toString();process.env.UPLOADS_DIR=uploads;
let server:import("node:http").Server|undefined;
let closeDb:(()=>Promise<void>)|undefined;
try {
  const {db,pool,closeDbPool,marketSnapshotsTable,marketDecisionsTable,journalEntriesTable,newsDocumentsTable}=await import("../../lib/db/src/index.js");closeDb=closeDbPool;
  await pool.query("CREATE TABLE journal_entries(id serial PRIMARY KEY,title text NOT NULL,content text NOT NULL DEFAULT '',trade_date text NOT NULL,result text NOT NULL DEFAULT 'none',tags text,user_id text,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now())");
  await pool.query(await readFile(new URL("../../lib/db/drizzle/0036_market_intelligence.sql",import.meta.url),"utf8"));
  const {default:router}=await import("../../artifacts/api-server/src/routes/market-decisions.js");
  const apiRequire=createRequire(new URL("../../artifacts/api-server/package.json",import.meta.url));
  const {default:express}=await import(apiRequire.resolve("express"));
  const {buildMarketContext}=await import("../../artifacts/api-server/src/services/marketContext.js");
  const {buildDirectionalOutlook}=await import("../../artifacts/api-server/src/services/directional/outlook.js");
  const {linkMarketDecision}=await import("../../artifacts/api-server/src/routes/journal.js");
  const {archiveNewsEvidence}=await import("../../artifacts/api-server/src/services/newsHub/eventEvidence.js");
  const {eq}=await import(apiRequire.resolve("drizzle-orm"));
  const app=express();app.use(express.json());
  // Synthetic auth deliberately tests handler ownership, not Clerk integration.
  app.use((req,_res,next)=>{const id=req.headers["x-fixture-user"];if(typeof id==="string")req.user={id} as typeof req.user;next();});
  app.use("/api",router);
  app.use((_error:unknown,_req:unknown,res:import("express").Response,_next:unknown)=>res.status(500).json({error:"fixture error"}));
  server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server!.once("listening",resolve));
  const port=(server.address() as import("node:net").AddressInfo).port;
  const call=async(path:string,user?:string,body?:unknown)=>{
    const response=await fetch(`http://127.0.0.1:${port}/api/${path}`,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(user?{"x-fixture-user":user}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json()};
  };
  let checks=0;const check=(condition:unknown,message?:string)=>{assert.ok(condition,message);checks++;};
  check((await call("market-decisions")).status===401);
  check((await call("market-decisions",undefined,{})).status===401);
  check((await call("market-decisions","A",{snapshotId:"bad",choice:"trade"})).status===400);
  check((await call("market-decisions","A",{snapshotId:"a".repeat(64),choice:"trade"})).status===404);
  const now=new Date(),context={...buildMarketContext("EURUSD",{},now),horizon:"4h",snapshotId:null,outlook:buildDirectionalOutlook("EURUSD",{marketOpen:false},now)};
  const snapshotId="a".repeat(64);
  await db.insert(marketSnapshotsTable).values({id:snapshotId,pair:"EURUSD",kind:"context",cutoffAt:now,targetEnd:new Date(+now+14400000),payload:context});
  const created=await call("market-decisions","A",{snapshotId,choice:"wait",note:"fixture decision",userId:"B"});check(created.status===201);check(created.data.userId==="A");
  const retry=await call("market-decisions","A",{snapshotId,choice:"wait",note:"fixture decision"});check(retry.data.id===created.data.id);
  check((await call("market-decisions","B")).data.items.length===0);
  const list=await call("market-decisions","A");check(list.data.items.length===1);check(list.data.items[0].snapshot.outlook.probabilities===null);
  const [entryA,entryB]=await db.insert(journalEntriesTable).values([{title:"A",tradeDate:"2026-10-10",userId:"A"},{title:"B",tradeDate:"2026-10-10",userId:"B"}]).returning();
  check((await call("market-decisions","A",{snapshotId,choice:"trade",journalEntryId:entryB.id})).status===404);
  await assert.rejects(db.transaction(tx=>linkMarketDecision(tx,"B",entryB.id,{marketDecisionId:created.data.id})));checks++;
  await assert.rejects(db.transaction(tx=>linkMarketDecision(tx,"A",entryB.id,{marketDecisionId:created.data.id})));checks++;
  await db.transaction(tx=>linkMarketDecision(tx,"A",entryA.id,{marketDecisionId:created.data.id}));
  const [linked]=await db.select().from(marketDecisionsTable).where(eq(marketDecisionsTable.id,created.data.id));check(linked.journalEntryId===entryA.id);
  await db.insert(marketSnapshotsTable).values({id:"b".repeat(64),pair:"EURUSD",kind:"context",cutoffAt:now,targetEnd:new Date(+now+14400000),payload:{...context,score:80}});
  check((await call("market-decisions","A")).data.items[0].snapshot.score===null);
  const oldId="c".repeat(64);await db.insert(marketSnapshotsTable).values({id:oldId,pair:"EURUSD",kind:"context",cutoffAt:now,targetEnd:now,createdAt:new Date(+now-660000),payload:context});
  check((await call("market-decisions","A",{snapshotId:oldId,choice:"trade"})).status===409);
  check((await call("market-decisions?cursor=bad","A")).status===400);
  for(let i=0;i<5;i++)await db.insert(marketDecisionsTable).values({id:`00000000-0000-4000-8000-${String(i).padStart(12,"0")}`,userId:"page",snapshotId,choice:i%2?"wait":"trade",createdAt:now}).onConflictDoNothing();
  // Separate snapshots avoid the deliberate per-view retry uniqueness constraint.
  await pool.query("DELETE FROM market_decisions WHERE user_id='page'");
  for(let i=0;i<5;i++){
    const id=String(i+1).repeat(64);await db.insert(marketSnapshotsTable).values({id,pair:"EURUSD",kind:"context",cutoffAt:now,targetEnd:now,payload:context}).onConflictDoNothing();
    await db.insert(marketDecisionsTable).values({id:`00000000-0000-4000-8000-${String(i).padStart(12,"0")}`,userId:"page",snapshotId:id,choice:"wait",createdAt:now});
  }
  let cursor:string|null=null;const ids=new Set<string>();do{const page=await call(`market-decisions?limit=2${cursor?`&cursor=${encodeURIComponent(cursor)}`:""}`,"page");for(const item of page.data.items)ids.add(item.id);cursor=page.data.nextCursor;}while(cursor);check(ids.size===5);
  const article={title:"Fixture source release",summary:"Documented original text",source:"Fixture",url:"https://example.com/release",publishedAt:now.toISOString(),sentiment:null,imageUrl:null};
  const first=await archiveNewsEvidence([article],new Map(),new Date(+now-1000));
  const again=await archiveNewsEvidence([article],new Map(),now);
  const revision=await archiveNewsEvidence([{...article,summary:"Revised original text"}],new Map(),now);
  check(first[0].sourceDocumentId===again[0].sourceDocumentId);check(first[0].firstSeenAt===again[0].firstSeenAt);
  check(first[0].articleId===revision[0].articleId&&first[0].sourceDocumentId!==revision[0].sourceDocumentId);
  check((await db.select().from(newsDocumentsTable)).length===2);
  // Exporter protocol fixtures use only this disposable database. Their prices,
  // outcomes and complete-coverage records are synthetic, never market evidence.
  const cutoff=new Date("2026-10-08T12:00:00Z"),target=new Date(+cutoff+14400000);
  const forecastId="f".repeat(64),duplicateId="0".repeat(64);
  const fixtureOutlook={...buildDirectionalOutlook("EURUSD",{marketOpen:false},cutoff),reason:"synthetic-exporter-fixture",features:[0.01,0.02,0.03,0.004,0.005,0,1],referencePrice:1.1,referenceObservedAt:cutoff.toISOString(),delta:0.001};
  await db.insert(marketSnapshotsTable).values([
    {id:forecastId,pair:"EURUSD",kind:"forecast",cutoffAt:cutoff,targetEnd:target,createdAt:new Date(+cutoff+5000),payload:{outlook:{...fixtureOutlook,issuedAt:new Date(+cutoff+5000).toISOString()},fixture:"synthetic-exporter-original"}},
    {id:duplicateId,pair:"EURUSD",kind:"forecast",cutoffAt:cutoff,targetEnd:target,createdAt:new Date(+cutoff+6000),payload:{outlook:{...fixtureOutlook,issuedAt:new Date(+cutoff+6000).toISOString(),features:[9,9,9,9,9,9,9]},fixture:"synthetic-exporter-duplicate"}},
  ]);
  await pool.query("INSERT INTO market_outcomes(snapshot_id,resolved_at,payload) VALUES($1,$2,$3),($4,$2,$5)",[forecastId,new Date(+target+60000),JSON.stringify({outcome:"up",finalPrice:1.12}),duplicateId,JSON.stringify({outcome:"down",finalPrice:1.0})]);
  const barTime=+cutoff/1000,closed=new Date(+cutoff+60000).toISOString();
  const observation={time:barTime,open:1.1,high:1.12,low:1.09,close:1.11,closeAt:closed,availableAt:new Date(+cutoff+120000).toISOString(),source:"dukascopy_bid",fixture:"synthetic",privateNote:"must never be exported"};
  await pool.query("INSERT INTO market_observations(id,pair,source,close_at,available_at,payload) VALUES($1,'EURUSD','dukascopy_bid',$2,$3,$4),($5,'EURUSD','dukascopy_bid',$2,$6,$7)",["export-fixture-price-first",closed,observation.availableAt,JSON.stringify(observation),"export-fixture-price-later",new Date(+cutoff+180000),JSON.stringify({...observation,close:1.115,availableAt:new Date(+cutoff+180000).toISOString()})]);
  for(let i=0;i<=16;i++)await pool.query("INSERT INTO news_corpus_runs(id,available_at,complete,payload) VALUES($1,$2,'complete',$3)",[`export-fixture-run-${i}`,new Date(+cutoff-14400000+i*900000),JSON.stringify({fixture:"synthetic complete coverage; not a provider check"})]);
  const release={eventType:"monetary_policy",country:"USD",referencePeriod:null,releaseAt:new Date(+cutoff-2700000).toISOString(),actual:null,previous:null,consensus:null,revisedPrevious:null,unit:null,consensusAsOf:null,sourceUrl:"https://example.test/synthetic-release"};
  const macroFixture={...article,title:"Synthetic policy publication for exporter protocol",publishedAt:release.releaseAt,release};
  await pool.query("INSERT INTO news_documents(id,article_id,event_id,source,published_at,first_seen_at,evidence_text,payload) VALUES($1,$1,$1,'Synthetic exporter fixture',$2,$3,'Synthetic exporter evidence',$4),($5,$5,$5,'Synthetic late fixture',$2,$6,'Must remain unavailable before cutoff',$7)",["export-fixture-policy",release.releaseAt,new Date(+cutoff-1800000),JSON.stringify(macroFixture),"export-fixture-late",new Date(+cutoff+1000),JSON.stringify({...macroFixture,release:{...release,eventType:"cpi_mom",actual:0.3}})]);
  const scriptRequire=createRequire(new URL("../package.json",import.meta.url));
  const exporter=fileURLToPath(new URL("../market-intelligence/export.ts",import.meta.url));
  const executeExport=(mode:string,path:string,extra:string[]=[])=>spawnSync(process.execPath,["--import",scriptRequire.resolve("tsx"),exporter,`--mode=${mode}`,"--pairs=EURUSD,EURUSD",`--output=${path}`,...extra],{cwd:fileURLToPath(new URL("../",import.meta.url)),env:{...process.env,DATABASE_URL:isolated.toString()},encoding:"utf8",timeout:10000,maxBuffer:1_000_000});
  const parseExport=async(path:string)=>(await readFile(path,"utf8")).trim().split("\n").map(line=>JSON.parse(line));
  const counts=async()=>JSON.stringify((await pool.query("SELECT (SELECT count(*) FROM market_snapshots) snapshots,(SELECT count(*) FROM market_outcomes) outcomes,(SELECT count(*) FROM market_observations) observations,(SELECT count(*) FROM news_documents) documents,(SELECT count(*) FROM news_corpus_runs) runs")).rows);
  const countsBefore=await counts();
  const forecastsFile=join(uploads,"forecast fixture.jsonl");
  const forecastsResult=executeExport("forecasts",forecastsFile);assert.equal(forecastsResult.status,0,forecastsResult.stderr);checks++;
  const forecastRows=await parseExport(forecastsFile);check(forecastRows.length===2);check(forecastRows[1].inputHash===forecastId&&forecastRows[1].outcome==="up");
  const unchanged=await readFile(forecastsFile,"utf8"),collision=executeExport("forecasts",forecastsFile);
  check(collision.status!==0&&!collision.error);check((await readFile(forecastsFile,"utf8"))===unchanged);
  const observationsFile=join(uploads,"observation-fixture.jsonl");
  const observationsResult=executeExport("observations",observationsFile);assert.equal(observationsResult.status,0,observationsResult.stderr);checks++;
  const observationRows=await parseExport(observationsFile);check(observationRows.length===2&&observationRows[1].close===1.11);check(observationRows[1].availableAt===observation.availableAt&&observationRows[1].provenance==="historical_research");check(!("privateNote" in observationRows[1]));
  const macroFile=join(uploads,"macro-fixture.jsonl");
  const macroResult=executeExport("macro",macroFile);assert.equal(macroResult.status,0,macroResult.stderr);checks++;
  const macroRows=await parseExport(macroFile);check(macroRows.length===2&&macroRows[0].featureOrder.length===3);check(JSON.stringify(macroRows[1].features)==="[1,0,0]");check(Date.parse(macroRows[1].availableAt)<=+cutoff);
  const repeatedFile=join(uploads,"macro-repeat-fixture.jsonl");const repeated=executeExport("macro",repeatedFile);assert.equal(repeated.status,0,repeated.stderr);checks++;
  check((await parseExport(repeatedFile))[1].inputHash===macroRows[1].inputHash);
  check((await counts())===countsBefore,"exporters must not mutate the warehouse");
  await pool.query("DELETE FROM news_corpus_runs WHERE id='export-fixture-run-8'");
  const gapFile=join(uploads,"macro-gap-fixture.jsonl");const gap=executeExport("macro",gapFile);assert.equal(gap.status,0,gap.stderr);checks++;
  check((await parseExport(gapFile)).length===1,"a 30-minute coverage gap yields no fabricated macro sample");
  await pool.query("INSERT INTO news_corpus_runs(id,available_at,complete,payload) VALUES('export-fixture-run-8',$1,'complete',$2)",[new Date(+cutoff-7200000),JSON.stringify({fixture:"synthetic coverage restored"})]);
  await pool.query("INSERT INTO news_documents(id,article_id,event_id,source,published_at,first_seen_at,evidence_text,payload) VALUES('export-fixture-unknown-consensus','export-fixture-unknown-consensus','export-fixture-unknown-consensus','Synthetic fixture',$1,$2,'Synthetic CPI without consensus',$3)",[release.releaseAt,new Date(+cutoff-1200000),JSON.stringify({...macroFixture,release:{...release,eventType:"cpi_mom",actual:0.3,unit:"percent_mom_seasonally_adjusted",consensus:null}})]);
  const unknownFile=join(uploads,"macro-unknown-consensus-fixture.jsonl"),unknown=executeExport("macro",unknownFile);assert.equal(unknown.status,0,unknown.stderr);checks++;
  check((await parseExport(unknownFile)).length===1,"a released CPI with unknown consensus must not produce a zero surprise");
  const incompleteFile=join(uploads,"incomplete-fixture.jsonl");
  await pool.query("ALTER TABLE market_observations RENAME TO export_fixture_unavailable");
  try {const failed=executeExport("observations",incompleteFile);check(failed.status!==0&&!failed.error);await assert.rejects(readFile(incompleteFile),{code:"ENOENT"});checks++;}
  finally {await pool.query("ALTER TABLE export_fixture_unavailable RENAME TO market_observations");}
  const invalid=executeExport("invalid-mode",join(uploads,"invalid-fixture.jsonl"));check(invalid.status!==0&&!invalid.error);
  // Exercise the real resolver and as-of reader, not just fixture outcomes.
  const {recordPriceObservations,readPriceObservations,resolvePendingForecasts}=await import("../../artifacts/api-server/src/services/marketIntelligence.js");
  const resolverId="d".repeat(64),resolverOutlook={...fixtureOutlook,pair:"GBPUSD",delta:0.001,referencePrice:1.1};
  await db.insert(marketSnapshotsTable).values({id:resolverId,pair:"GBPUSD",kind:"forecast",cutoffAt:cutoff,targetEnd:target,payload:{outlook:resolverOutlook,shadow:null,fixture:"synthetic resolver; never predictive evidence"}});
  const minutes=Array.from({length:240},(_,i)=>{const time=+cutoff/1000+i*60,close=1.12;return {time,open:close,high:close,low:close,close,closeAt:new Date((time+60)*1000).toISOString(),availableAt:new Date((time+60)*1000+1000).toISOString(),source:"dukascopy_bid" as const};});
  await recordPriceObservations("GBPUSD",minutes.slice(0,-1));
  await resolvePendingForecasts(now);
  check((await pool.query("SELECT snapshot_id FROM market_outcomes WHERE snapshot_id=$1",[resolverId])).rowCount===0,"missing exact target minute stays unresolved");
  await recordPriceObservations("GBPUSD",[minutes.at(-1)!]);
  await resolvePendingForecasts(now);
  const resolved=(await pool.query("SELECT payload FROM market_outcomes WHERE snapshot_id=$1",[resolverId])).rows[0];
  check(resolved.payload.outcome==="up"&&resolved.payload.finalPrice===1.12);
  await recordPriceObservations("GBPUSD",[{...minutes[0],availableAt:new Date(+cutoff+300000).toISOString()}]);
  await recordPriceObservations("GBPUSD",[{...minutes[0],open:1.11,low:1.11,close:1.11,availableAt:new Date(+cutoff+300000).toISOString()}]);
  const asOf=await readPriceObservations("GBPUSD",new Date(+cutoff+120000));
  check(asOf.find(b=>b.time===minutes[0].time)?.close===1.12,"future-acquired revision cannot enter past features");
  const after=await readPriceObservations("GBPUSD",new Date(+cutoff+360000));
  check(after.find(b=>b.time===minutes[0].time)?.close===1.12,"first-acquired price version remains stable after a revision");
  check(after.find(b=>b.time===minutes[0].time)?.availableAt===minutes[0].availableAt,"repeated import never rewrites acquisition time");
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id,entryA.id));
  check((await db.select().from(marketDecisionsTable).where(eq(marketDecisionsTable.id,created.data.id)))[0].journalEntryId===null);
  console.log(JSON.stringify({passed:checks,database:name,auth:"synthetic handler fixture",marketData:"synthetic; no predictive performance claim"}));
} finally {
  if(server)await new Promise<void>((resolve,reject)=>server!.close(e=>e?reject(e):resolve()));
  await closeDb?.();
  await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();await rm(uploads,{recursive:true,force:true});
}
