import { loadEnvLocal } from "../local/lib/env.js";
import { DIRECTIONAL_PAIRS } from "../../artifacts/api-server/src/services/directional/model.js";
import { dukascopySource } from "../../artifacts/api-server/src/services/ingest/dukascopy.js";

const args=new Map(process.argv.slice(2).map(a=>{const i=a.indexOf("=");return [a.slice(0,i),a.slice(i+1)];}));
const pairs=(args.get("--pairs")??DIRECTIONAL_PAIRS.join(",")).split(",");
const fromRaw=args.get("--from")??"",toRaw=args.get("--to")??"";
const from=Date.parse(fromRaw),until=Date.parse(toRaw);
if(![fromRaw,toRaw].every(t=>/T.*(?:Z|[+-]\d\d:\d\d)$/.test(t))||!Number.isInteger(from/60000)||!Number.isInteger(until/60000)||until<=from||until>Date.now()||!pairs.every(p=>DIRECTIONAL_PAIRS.includes(p as typeof DIRECTIONAL_PAIRS[number])))throw new Error("Use --from=UTC_TIMESTAMP --to=UTC_TIMESTAMP --pairs=EURUSD,...; explicit timezone, whole minutes and past dates only");
loadEnvLocal();
const {recordPriceObservations}=await import("../../artifacts/api-server/src/services/marketIntelligence.js");
const {closeDbPool}=await import("../../lib/db/src/index.js");
let count=0;
try {
  for(const pair of pairs)for(let start=from;start<until;start+=7*86400000) {
    const end=Math.min(until,start+7*86400000);
    const bars=await dukascopySource.fetchRange(pair,Math.floor(start/1000),Math.floor(end/1000));
    const receipt=new Date().toISOString();
    const observations=bars.filter(b=>b.time*1000>=start&&(b.time+60)*1000<=end).map(b=>({...b,source:"dukascopy_bid" as const,closeAt:new Date((b.time+60)*1000).toISOString(),availableAt:receipt}));
    await recordPriceObservations(pair,observations);count+=observations.length;
    console.log(JSON.stringify({pair,from:new Date(start).toISOString(),to:new Date(end).toISOString(),bars:observations.length,availableAt:receipt,provenance:"historical_research",predictivePerformanceClaim:false}));
  }
  console.log(JSON.stringify({completed:true,bars:count}));
} finally {await closeDbPool();}
