import { createHash } from "node:crypto";
import { OFFICIAL_NEWS_FEEDS } from "./officialSources.js";
import { sanitizeConsensus, observedPairDirection } from "./eventEvidence.js";
import type { NewsArticle, NewsSourceCoverage } from "./types.js";

const requiredUrls=[...OFFICIAL_NEWS_FEEDS.map(f=>f.url),"https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/the-official-cash-rate"];
export const MACRO_MAX_GAP_MS=15*60000;
export type CorpusRun={availableAt:string;complete:boolean};
export function corpusWindowCovered(runs:CorpusRun[],cutoff:string):boolean {
  const end=Date.parse(cutoff),start=end-14400000;
  const times=[...new Set(runs.filter(r=>r.complete&&Number.isFinite(Date.parse(r.availableAt))&&Date.parse(r.availableAt)<=end).map(r=>Date.parse(r.availableAt)))].sort((a,b)=>a-b);
  let anchor=-1;for(let i=0;i<times.length;i++)if(times[i]<=start)anchor=i;
  if(anchor<0) return false;
  const window=times.slice(anchor);
  return start-window[0]<=MACRO_MAX_GAP_MS&&end-window.at(-1)!<=MACRO_MAX_GAP_MS&&window.every((t,i)=>!i||t-window[i-1]<=MACRO_MAX_GAP_MS);
}
export async function recordNewsCorpusRun(coverage:NewsSourceCoverage[],archived:boolean,now=new Date()) {
  const complete=archived&&requiredUrls.every(url=>coverage.some(s=>s.url===url&&s.status==="available"));
  const payload={sources:coverage,policy:"official-all-sampled-15m-v1",archivePersisted:archived};
  try {
    const {db,newsCorpusRunsTable}=await import("@workspace/db");
    await db.insert(newsCorpusRunsTable).values({id:createHash("sha256").update(JSON.stringify([now.toISOString(),payload])).digest("hex"),availableAt:now,complete:complete?"complete":"partial",payload}).onConflictDoNothing();
  } catch { /* A missing archive never becomes quantitative coverage. */ }
}
export type MacroFeatureDocument={eventId:string;firstSeenAt:string;article:NewsArticle};
/** No interpretation enters the quantitative corpus; only acquired, dated facts. */
export function documentedMacroFeatures(pair:string,cutoff:string,documents:MacroFeatureDocument[]):number[]|null {
  const end=Date.parse(cutoff),start=end-14400000,events=new Map<string,MacroFeatureDocument>();
  for(const doc of [...documents].sort((a,b)=>a.firstSeenAt.localeCompare(b.firstSeenAt))) {
    const release=doc.article.release,seen=Date.parse(doc.firstSeenAt),released=Date.parse(release?.releaseAt??"");
    if(!release||!Number.isFinite(seen)||seen>end||!Number.isFinite(released)||released<start||released>end||
      ![pair.slice(0,3),pair.slice(3)].includes(release.country)) continue;
    const first=events.get(doc.eventId);
    // Fill absent extraction from the earliest full evidence available at cutoff.
    // A later changed actual is a revision; it never overwrites the first actual.
    if(!first||first.article.release?.actual===null&&release.actual!==null)events.set(doc.eventId,doc);
  }
  let surprise=0,up=0,down=0;
  for(const doc of events.values()) {
    const release=sanitizeConsensus(doc.article.release!);
    if((release.actual!==null||["cpi_mom","nonfarm_payrolls","gdp"].includes(release.eventType))&&
      (release.actual===null||release.consensus===null||!release.unit))return null;
    if(release.actual!==null&&release.consensus!==null&&release.unit&&Date.parse(release.consensusAsOf!)<=end) {
      // Signed base/quote relative surprise; the model learns its effect.
      surprise+=(release.country===pair.slice(0,3)?1:-1)*(release.actual-release.consensus)/Math.max(1,Math.abs(release.consensus));
    }
    const direction=observedPairDirection(doc.article.originalTitle??doc.article.title,pair);
    if(direction==="bullish")up++;if(direction==="bearish")down++;
  }
  return [events.size,surprise,up&&down?Math.min(up,down)/events.size:0];
}
export async function readMacroFeatures(pair:string,cutoff:Date):Promise<number[]|null> {
  const {db,newsCorpusRunsTable,newsDocumentsTable}=await import("@workspace/db");
  const {and,gte,lte}=await import("drizzle-orm");
  const from=new Date(+cutoff-14400000-MACRO_MAX_GAP_MS);
  const [runs,documents]=await Promise.all([
    db.select().from(newsCorpusRunsTable).where(and(gte(newsCorpusRunsTable.availableAt,from),lte(newsCorpusRunsTable.availableAt,cutoff))),
    db.select().from(newsDocumentsTable).where(and(gte(newsDocumentsTable.publishedAt,new Date(+cutoff-14400000)),lte(newsDocumentsTable.publishedAt,cutoff),lte(newsDocumentsTable.firstSeenAt,cutoff))),
  ]);
  if(!corpusWindowCovered(runs.map(r=>({availableAt:r.availableAt.toISOString(),complete:r.complete==="complete"})),cutoff.toISOString()))return null;
  return documentedMacroFeatures(pair,cutoff.toISOString(),documents.map(r=>({eventId:r.eventId,firstSeenAt:r.firstSeenAt.toISOString(),article:r.payload as NewsArticle})));
}
