import { createHash } from "node:crypto";
import { db, marketObservationsTable, marketSnapshotsTable, marketOutcomesTable } from "@workspace/db";
import { and, eq, lte, gte, desc } from "drizzle-orm";
import { dukascopySource } from "./ingest/dukascopy.js";
import { loadTrustedModel, inferModel, DIRECTIONAL_PAIRS, type ValidationSample, type ModelArtifact } from "./directional/model.js";
import { buildDirectionalOutlook, resolveDirectionalOutcome, type PriceObservation, type DirectionalOutlook } from "./directional/outlook.js";
import { loadTradingCalendar, isTradingWindowOpen } from "./directional/calendar.js";
import type { MarketContext } from "./marketContext.js";
import logger from "../lib/logger.js";
import { readMacroFeatures } from "./newsHub/corpusCoverage.js";

const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
export type IntelligenceContext=MarketContext & {horizon:"4h";snapshotId:string|null;outlook:DirectionalOutlook};
type StoredForecast={outlook:DirectionalOutlook;shadow:ValidationSample|null};
export async function recordPriceObservations(pair:string,observations:PriceObservation[]) {
  for(let i=0;i<observations.length;i+=500) await db.insert(marketObservationsTable).values(observations.slice(i,i+500).map(o=>({
    id:hash([pair,o.time,o.open,o.high,o.low,o.close]),pair,source:"dukascopy_bid",closeAt:new Date(o.closeAt),availableAt:new Date(o.availableAt),payload:o,
  }))).onConflictDoNothing();
}
export async function readPriceObservations(pair:string,cutoff:Date,days=14):Promise<PriceObservation[]> {
  const rows=await db.select().from(marketObservationsTable).where(and(eq(marketObservationsTable.pair,pair),eq(marketObservationsTable.source,"dukascopy_bid"),lte(marketObservationsTable.availableAt,cutoff),gte(marketObservationsTable.closeAt,new Date(cutoff.getTime()-days*86400000)),lte(marketObservationsTable.closeAt,cutoff))).orderBy(desc(marketObservationsTable.availableAt));
  // First acquired version per bar. Later revisions do not rewrite prior data.
  const first=new Map<number,PriceObservation>();
  for(const r of rows) first.set((r.payload as PriceObservation).time,r.payload as PriceObservation);
  return [...first.values()].sort((a,b)=>a.time-b.time);
}
export async function readValidationSamples(pair:string,model:ModelArtifact):Promise<ValidationSample[]> {
  const rows=await db.select({forecast:marketSnapshotsTable.payload,outcome:marketOutcomesTable.payload,resolvedAt:marketOutcomesTable.resolvedAt})
    .from(marketSnapshotsTable).innerJoin(marketOutcomesTable,eq(marketOutcomesTable.snapshotId,marketSnapshotsTable.id))
    .where(and(eq(marketSnapshotsTable.pair,pair),eq(marketSnapshotsTable.kind,"forecast"),gte(marketSnapshotsTable.cutoffAt,new Date(Date.now()-370*86400000))));
  return rows.flatMap(r=>{
    const f=r.forecast as StoredForecast, y=r.outcome as {outcome:ValidationSample["outcome"]};
    return f.shadow?.modelVersion===model.version?[{...f.shadow,outcome:y.outcome,resolvedAt:r.resolvedAt.toISOString()}]:[];
  });
}
export async function makeOutlook(pair:string,now=new Date()):Promise<DirectionalOutlook> {
  const cutoff=new Date(Math.floor(now.getTime()/60000)*60000),model=await loadTrustedModel(pair);
  const [observations,calendar,samples,macroFeatures]=await Promise.all([readPriceObservations(pair,cutoff),loadTradingCalendar(),model?readValidationSamples(pair,model):Promise.resolve([]),model?.features.length===10?readMacroFeatures(pair,cutoff):Promise.resolve(null)]);
  const outlook = buildDirectionalOutlook(pair,{observations,marketOpen:isTradingWindowOpen(pair,cutoff.toISOString(),new Date(+cutoff+14400000).toISOString(),calendar),model,samples,macroFeatures},now);
  if (!calendar && outlook.reason === "market_calendar_unavailable_or_closed") outlook.reason = "market_calendar_unavailable";
  return outlook;
}
export async function attachIntelligence(context:MarketContext):Promise<IntelligenceContext> {
  const now=new Date();
  let outlook:DirectionalOutlook;
  try {outlook=await makeOutlook(context.pair,now);} catch {outlook=buildDirectionalOutlook(context.pair,{marketOpen:true},now);outlook.reason="storage_unavailable";}
  const payload={...context,horizon:"4h" as const,outlook,snapshotId:null as string|null};
  // The hash covers the exact response: a decision must retain the times seen.
  const id=hash(payload);
  try {
    await db.insert(marketSnapshotsTable).values({id,pair:context.pair,kind:"context",cutoffAt:new Date(outlook.cutoffAt),targetEnd:new Date(outlook.targetEnd),payload}).onConflictDoNothing();
    payload.snapshotId=id;
  } catch {payload.snapshotId=null;}
  return payload;
}
const baseline=(model:ModelArtifact):ValidationSample["baseline"]|null=>{
  const p=(model as ModelArtifact & {baseline?:ValidationSample["baseline"]}).baseline;
  return p&&Object.values(p).every(v=>Number.isFinite(v)&&v>0)&&Math.abs(p.up+p.flat+p.down-1)<1e-6?p:null;
};
export async function captureHourlyForecast(pair:string,now=new Date()) {
  if(now.getUTCMinutes()!==0) return;
  const outlook=await makeOutlook(pair,now),model=await loadTrustedModel(pair),bench=model?baseline(model):null;
  const issuedAt=new Date();
  // Slow I/O cannot backdate an issuance into the prospective cohort.
  if(+issuedAt-Date.parse(outlook.cutoffAt)>60000 || +issuedAt<Date.parse(outlook.cutoffAt)) return;
  outlook.issuedAt=issuedAt.toISOString();
  const shadow:ValidationSample|null=model&&Date.parse(model.trainedThrough)<Date.parse(outlook.cutoffAt)&&outlook.features?.length===model.features.length&&bench?{cutoffAt:outlook.cutoffAt,targetEnd:outlook.targetEnd,issuedAt:outlook.issuedAt,resolvedAt:"",outcome:"flat",
    probabilities:inferModel(model,outlook.features),baseline:bench,...(model.priceOnlyModel?{priceOnly:inferModel(model.priceOnlyModel,outlook.features.slice(0,7))}:{}),modelVersion:model.version,provenance:"prospective"}:null;
  await db.insert(marketSnapshotsTable).values({id:hash(["forecast",pair,outlook.cutoffAt]),pair,kind:"forecast",cutoffAt:new Date(outlook.cutoffAt),targetEnd:new Date(outlook.targetEnd),payload:{outlook,shadow}}).onConflictDoNothing();
}
export async function resolvePendingForecasts(now=new Date()) {
  const rows=await db.select().from(marketSnapshotsTable).leftJoin(marketOutcomesTable,eq(marketOutcomesTable.snapshotId,marketSnapshotsTable.id))
    .where(and(lte(marketSnapshotsTable.targetEnd,now),gte(marketSnapshotsTable.targetEnd,new Date(+now-7*86400000))));
  for(const r of rows) {
    if(r.market_outcomes) continue;
    const snapshot=r.market_snapshots,payload=snapshot.payload as StoredForecast & IntelligenceContext;
    const outlook=payload.outlook;
    if(!outlook?.referencePrice||outlook.delta===null) continue;
    const quotes=await db.select().from(marketObservationsTable).where(and(eq(marketObservationsTable.pair,snapshot.pair),eq(marketObservationsTable.source,"dukascopy_bid"),gte(marketObservationsTable.closeAt,new Date(+snapshot.cutoffAt+60000)),lte(marketObservationsTable.closeAt,snapshot.targetEnd),lte(marketObservationsTable.availableAt,now))).orderBy(desc(marketObservationsTable.availableAt));
    const first=new Map<number,PriceObservation>();
    for(const quote of quotes) first.set((quote.payload as PriceObservation).time,quote.payload as PriceObservation);
    const result=resolveDirectionalOutcome(outlook,[...first.values()]);
    if(result) await db.insert(marketOutcomesTable).values({snapshotId:snapshot.id,resolvedAt:now,payload:result}).onConflictDoNothing();
  }
}
/** Separate bounded collector; no network or training on request paths. */
export function startMarketIntelligenceScheduler() {
  let stopped=false,running:Promise<void>|null=null,capturing:Promise<void>|null=null,reviewing:Promise<void>|null=null;
  const watermarks=new Map<string,number>();
  const tick=async()=>{
    for(const pair of DIRECTIONAL_PAIRS) {
      if(stopped) return;
      const to=Math.floor(Date.now()/60000)*60;
      try {
        const bars=await dukascopySource.fetchRange(pair,watermarks.get(pair)??to-14*86400,to);
        const receipt=new Date().toISOString();
        const observations:PriceObservation[]=bars.filter(b=>b.time+60<=to).map(b=>({...b,source:"dukascopy_bid",closeAt:new Date((b.time+60)*1000).toISOString(),availableAt:receipt}));
        await recordPriceObservations(pair,observations);
        watermarks.set(pair,Math.max(to-7200,observations.at(-1)?.time??to-7200));
      } catch(err) {logger.warn({err,pair},"Directional price collection unavailable");}
    }
    await resolvePendingForecasts().catch(err=>logger.warn({err},"Directional outcome resolution unavailable"));
  };
  const start=()=>{if(!running&&!stopped)running=tick().finally(()=>{running=null;});};
  const capture=()=>{
    if(capturing||stopped||new Date().getUTCMinutes()!==0) return;
    // Independent from historical downloads, which may take several minutes.
    capturing=Promise.all(DIRECTIONAL_PAIRS.map(pair=>captureHourlyForecast(pair,new Date()).catch(err=>logger.warn({err,pair},"Forecast capture unavailable")))).then(()=>{}).finally(()=>{capturing=null;});
  };
  const review=()=>{
    if(reviewing||stopped)return;
    reviewing=Promise.all(DIRECTIONAL_PAIRS.map(async pair=>{
      try {
        const outlook=await makeOutlook(pair);
        logger.info({pair,modelVersion:outlook.modelVersion,status:outlook.status,reason:outlook.reason,validation:outlook.validation},"Weekly directional quality review");
      } catch(err){logger.warn({err,pair},"Weekly directional quality review unavailable");}
    })).then(()=>{}).finally(()=>{reviewing=null;});
  };
  // Explicit flag allows staged rollout and keeps test/unsupported hosts idle.
  const timer=process.env.MACRO_INTELLIGENCE_COLLECTOR==="1"?setInterval(start,30000):null;
  const captureTimer=timer?setInterval(capture,10000):null;
  const reviewTimer=timer?setInterval(review,7*86400000):null;
  if(timer){timer.unref();captureTimer?.unref();reviewTimer?.unref();capture();start();review();}
  return {close:async()=>{stopped=true;if(timer)clearInterval(timer);if(captureTimer)clearInterval(captureTimer);if(reviewTimer)clearInterval(reviewTimer);await Promise.all([running,capturing,reviewing]);}};
}
