import { createHash } from "node:crypto";
import { open, mkdir, rm, type FileHandle } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadEnvLocal } from "../local/lib/env.js";
import { DIRECTIONAL_PAIRS, FEATURE_ORDER, MACRO_FEATURE_ORDER } from "../../artifacts/api-server/src/services/directional/model.js";
import { corpusWindowCovered, documentedMacroFeatures } from "../../artifacts/api-server/src/services/newsHub/corpusCoverage.js";
import type { NewsArticle } from "../../artifacts/api-server/src/services/newsHub/types.js";
import { validPriceObservation, type DirectionalOutlook, type PriceObservation } from "../../artifacts/api-server/src/services/directional/outlook.js";

const args=new Map<string,string>();
for(const argument of process.argv.slice(2)) {
  const match=/^(--mode|--pairs|--output)=(.+)$/.exec(argument);
  if(!match||args.has(match[1]))throw new Error("Use named --mode=, --pairs= and --output= arguments once each");
  args.set(match[1],match[2]);
}
const mode=args.get("--mode")??"forecasts",pairs=[...new Set((args.get("--pairs")??DIRECTIONAL_PAIRS.join(",")).split(",").map(pair=>pair.trim().toUpperCase()))],output=args.get("--output");
if(!["forecasts","observations","macro"].includes(mode)||!output||!pairs.every(p=>DIRECTIONAL_PAIRS.includes(p as typeof DIRECTIONAL_PAIRS[number])))throw new Error("Use --mode=forecasts|observations|macro --pairs=EURUSD,... --output=/path/new.jsonl");
loadEnvLocal();
const {pool,closeDbPool}=await import("../../lib/db/src/index.js");
let client:Awaited<ReturnType<typeof pool.connect>>|undefined;
let file:FileHandle|undefined;
let transaction=false,completed=false;
let count=0;
const write=async(value:unknown)=>file!.write(JSON.stringify(value)+"\n");
try {
  await mkdir(dirname(resolve(output)),{recursive:true});
  file=await open(resolve(output),"wx"); // Never overwrite a previous dataset.
  client=await pool.connect();
  // Stable read-only export; no private decisions, notes or user data are queried.
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  transaction=true;
  await write({type:"metadata",schema:mode==="forecasts"?"directional-dataset-v1":mode==="macro"?"directional-macro-pit-v1":"directional-m1-v1",source:mode==="macro"?"macro_pit_v1":"dukascopy_bid",provenance:mode==="observations"?"historical_research":"prospective",featureOrder:mode==="macro"?MACRO_FEATURE_ORDER.slice(FEATURE_ORDER.length):FEATURE_ORDER,exportedAt:new Date().toISOString(),availability:mode==="observations"?"actual_receipts_preserved_backfills_not_prospective":mode==="macro"?"acquired_documents_and_sampled_source_coverage":"immutable_hourly_snapshots"});
  for(const pair of pairs) {
    if(mode==="observations") {
      await client.query("DECLARE export_rows NO SCROLL CURSOR FOR SELECT payload FROM (SELECT payload,row_number() OVER (PARTITION BY close_at ORDER BY available_at,id) n FROM market_observations WHERE pair=$1 AND source='dukascopy_bid') q WHERE n=1 ORDER BY (payload->>'time')::bigint",[pair]);
    } else {
      // Choose the first issued snapshot before looking at outcomes. Duplicate
      // captures must not create overlapping samples or an outcome-based choice.
      await client.query("DECLARE export_rows NO SCROLL CURSOR FOR SELECT s.id,s.cutoff_at,s.payload,o.payload outcome,o.resolved_at FROM (SELECT id,cutoff_at,payload,row_number() OVER (PARTITION BY cutoff_at ORDER BY created_at,id) n FROM market_snapshots WHERE pair=$1 AND kind='forecast') s LEFT JOIN market_outcomes o ON o.snapshot_id=s.id WHERE s.n=1 ORDER BY s.cutoff_at,s.id",[pair]);
    }
    while(true) {
      const batch=await client.query("FETCH FORWARD 1000 FROM export_rows");if(!batch.rows.length)break;
      for(const row of batch.rows) {
        if(mode==="observations") {
          const observation=row.payload as PriceObservation;
          if(!observation||typeof observation!=="object"||!validPriceObservation(observation))continue;
          const {time,open,high,low,close,closeAt,availableAt,source}=observation;
          await write({time,open,high,low,close,closeAt,availableAt,source,pair,provenance:"historical_research"});count++;continue;
        }
        const outlook=row.payload.outlook as DirectionalOutlook;
        const cutoffTime=Date.parse(outlook?.cutoffAt),issued=Date.parse(outlook?.issuedAt);
        if(!outlook?.features||outlook.features.length<FEATURE_ORDER.length||!outlook.features.every(Number.isFinite)||
          !Number.isFinite(cutoffTime)||cutoffTime%(4*3600_000)!==0||+row.cutoff_at!==cutoffTime||
          Date.parse(outlook.targetEnd)!==cutoffTime+14400000||!outlook.sources?.includes("dukascopy_bid")||
          !Number.isFinite(issued)||issued<cutoffTime||issued-cutoffTime>60000)continue;
        if(mode==="macro") {
          const cutoff=new Date(outlook.cutoffAt),start=new Date(+cutoff-14400000);
          const runs=await client.query("SELECT id,available_at,complete FROM news_corpus_runs WHERE available_at BETWEEN $1 AND $2 ORDER BY available_at,id",[new Date(+start-15*60000),cutoff]);
          const coverage=runs.rows.map(r=>({availableAt:r.available_at.toISOString(),complete:r.complete==="complete"}));
          if(!corpusWindowCovered(coverage,outlook.cutoffAt))continue;
          const docs=await client.query("SELECT id,event_id,first_seen_at,payload FROM news_documents WHERE published_at BETWEEN $1 AND $2 AND first_seen_at<=$2 ORDER BY first_seen_at,id",[start,cutoff]);
          const features=documentedMacroFeatures(pair,outlook.cutoffAt,docs.rows.map(r=>({eventId:r.event_id,firstSeenAt:r.first_seen_at.toISOString(),article:r.payload as NewsArticle})));
          if(!features)continue;
          const complete=coverage.filter(r=>r.complete);
          const inputHash=createHash("sha256").update(JSON.stringify([outlook.cutoffAt,runs.rows.map(r=>r.id),docs.rows.map(r=>r.id)])).digest("hex");
          const availableAt=new Date(Math.max(Date.parse(complete.at(-1)!.availableAt),...docs.rows.map(r=>+r.first_seen_at))).toISOString();
          await write({pair,cutoffAt:outlook.cutoffAt,features,availableAt,coverageFrom:complete[0].availableAt,coverageUntil:complete.at(-1)!.availableAt,maxGapMinutes:15,inputHash,provenance:"prospective",source:"macro_pit_v1"});count++;continue;
        }
        if(!row.outcome||!row.resolved_at||!Number.isFinite(+row.resolved_at)||+row.resolved_at<Date.parse(outlook.targetEnd))continue;
        await write({pair,cutoffAt:outlook.cutoffAt,targetEnd:outlook.targetEnd,issuedAt:outlook.issuedAt,resolvedAt:row.resolved_at.toISOString(),features:outlook.features.slice(0,7),outcome:row.outcome.outcome,referencePrice:outlook.referencePrice,referenceObservedAt:outlook.referenceObservedAt,finalPrice:row.outcome.finalPrice,delta:outlook.delta,inputHash:row.id,provenance:"prospective",source:"dukascopy_bid"});count++;
      }
    }
    await client.query("CLOSE export_rows");
  }
  await client.query("COMMIT");
  transaction=false;
  await file.sync();
  completed=true;
  console.log(JSON.stringify({mode,rows:count,output:resolve(output),predictivePerformanceClaim:false}));
} catch(error){
  if(transaction)await client?.query("ROLLBACK").catch(()=>undefined);
  throw error;
} finally {
  try { await file?.close(); }
  finally {
    try { if(file&&!completed)await rm(resolve(output),{force:true}); }
    finally { client?.release();await closeDbPool(); }
  }
}
