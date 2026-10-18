import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const DIRECTIONAL_PAIRS = ["EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","XAUUSD"] as const;
export const FEATURE_ORDER = ["return1h","return4h","return24h","volatility120h","range20h","hourSin","hourCos"];
export const MACRO_FEATURE_ORDER = [...FEATURE_ORDER,"macroEvents4h","macroSurprise4h","macroConflict4h"];
export type Probabilities = {up:number;flat:number;down:number};
export type ModelArtifact = {
  version:string; pair:string; classes:["up","flat","down"]; features:string[]; sources:string[];
  mean:number[]; scale:number[]; coefficients:number[][]; intercepts:number[]; temperature:number;
  baseline?:Probabilities;priceOnlyModel?:ModelArtifact;
  trainedThrough:string; historicalValidation:{passed:boolean;datasetHash:string;reportHash:string;provenance:"historical_research"|"prospective"};
};
export type ValidationSample = {cutoffAt:string;targetEnd:string;resolvedAt:string;issuedAt:string;
  outcome:"up"|"flat"|"down";probabilities:Probabilities;baseline:Probabilities;priceOnly?:Probabilities;provenance:"prospective"|"synthetic";modelVersion:string};

export function validModel(value: unknown, pair: string): value is ModelArtifact {
  if(!value || typeof value!=="object") return false;
  const m=value as ModelArtifact;
  const size=m.features?.length,macro=JSON.stringify(m.features)===JSON.stringify(MACRO_FEATURE_ORDER);
  return m.pair===pair && JSON.stringify(m.classes)===JSON.stringify(["up","flat","down"]) &&
    (JSON.stringify(m.features)===JSON.stringify(FEATURE_ORDER)||macro) && typeof m.version==="string" &&
    Array.isArray(m.mean)&&m.mean.length===size && Array.isArray(m.scale)&&m.scale.length===size && m.scale.every(v=>Number.isFinite(v)&&v>0) &&
    Array.isArray(m.coefficients)&&m.coefficients.length===3 && m.coefficients.every(r=>Array.isArray(r)&&r.length===size&&r.every(Number.isFinite)) &&
    m.mean.every(Number.isFinite) && Array.isArray(m.intercepts)&&m.intercepts.length===3 && m.intercepts.every(Number.isFinite) &&
    Number.isFinite(m.temperature) && m.temperature>0 && Number.isFinite(Date.parse(m.trainedThrough)) &&
    JSON.stringify(m.sources)===JSON.stringify(macro?["dukascopy_bid","macro_pit_v1"]:["dukascopy_bid"]) &&
    (!macro||Boolean(m.priceOnlyModel&&m.priceOnlyModel.features.length===7&&validModel(m.priceOnlyModel,pair)&&Date.parse(m.priceOnlyModel.trainedThrough)<=Date.parse(m.trainedThrough))) &&
    ["historical_research","prospective"].includes(m.historicalValidation?.provenance) &&
    /^[a-f0-9]{64}$/.test(m.historicalValidation.datasetHash) && /^[a-f0-9]{64}$/.test(m.historicalValidation.reportHash);
}
type ReportMetric={samples:number;classCounts:Record<string,number>;spanDays:number;start:string;end:string;
  brier:number;baselineBrier:number;logLoss:number;baselineLogLoss:number;pValue:number;weeklyBlocks:number;
  brierImprovementCI95:number[];calibration:Record<string,number>;calibrationBins:Record<string,{samples:number;predicted:number;observed:number}[]>};
type HistoricalReport={schema:string;pair:string;classes:string[];featureOrder:string[];datasetHash:string;provenance:string;
  splitPolicy:string;walkForward:Record<string,unknown>[];holdout:ReportMetric;priceOnly?:ReportMetric;
  trainStart:string;trainEnd:string;calibrationStart:string;calibrationEnd:string;holdoutStart:string;holdoutEnd:string;passed:boolean};
const monthShift=(date:string,months:number)=>{
  const d=new Date(date),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return +d;
};
/** Return null for invalid evidence. A boolean claim in an artifact is never sufficient. */
export function verifyHistoricalReport(model:ModelArtifact,value:unknown):boolean|null {
  if(!value||typeof value!=="object") return null;
  const r=value as HistoricalReport;
  if(r.schema!=="directional-validation-v1"||r.pair!==model.pair||r.datasetHash!==model.historicalValidation.datasetHash||
    !["historical_research","prospective"].includes(r.provenance)||
    JSON.stringify(r.classes)!==JSON.stringify(model.classes)||JSON.stringify(r.featureOrder)!==JSON.stringify(model.features)||
    r.splitPolicy!=="train24m-cal3m-test3m-walkforward-purge4h-final6m-min183d-v1"||!Array.isArray(r.walkForward)||r.walkForward.length<2||
    ![r.trainStart,r.trainEnd,r.calibrationStart,r.calibrationEnd,r.holdoutStart,r.holdoutEnd].every(t=>Number.isFinite(Date.parse(t)))||
    monthShift(r.trainEnd,-24)!==Date.parse(r.trainStart)||r.trainEnd!==r.calibrationStart||
    monthShift(r.calibrationEnd,-3)!==Date.parse(r.calibrationStart)||r.calibrationEnd!==r.holdoutStart||
    Date.parse(model.trainedThrough)>Date.parse(r.calibrationEnd)||Date.parse(model.trainedThrough)<Date.parse(r.calibrationStart)) return null;
  const span=Date.parse(r.holdoutEnd)-Date.parse(r.holdoutStart);
  if(span<183*86400000||span>190*86400000) return null;
  let previousEnd=-Infinity;
  for(const fold of r.walkForward) {
    const times=["trainStart","trainEnd","calibrationStart","calibrationEnd","testStart","testEnd"].map(k=>String(fold[k]));
    const [trainStart,trainEnd,calStart,calEnd,testStart,testEnd]=times;
    if(!times.every(t=>Number.isFinite(Date.parse(t)))||monthShift(trainEnd,-24)!==Date.parse(trainStart)||trainEnd!==calStart||
      monthShift(calEnd,-3)!==Date.parse(calStart)||calEnd!==testStart||monthShift(testStart,3)!==Date.parse(testEnd)||
      Date.parse(testStart)<previousEnd||Date.parse(testEnd)>Date.parse(r.holdoutStart)) return null;
    previousEnd=Date.parse(testEnd);
  }
  const h=r.holdout;
  if(!h||!Number.isInteger(h.samples)||!keys.every(k=>Number.isInteger(h.classCounts?.[k])&&h.classCounts[k]>=0)||
    keys.reduce((n,k)=>n+h.classCounts[k],0)!==h.samples||Date.parse(h.start)<Date.parse(r.holdoutStart)||
    Date.parse(h.end)>Date.parse(r.holdoutEnd)||!Number.isFinite(h.spanDays)||
    Math.abs(h.spanDays-(Date.parse(h.end)-Date.parse(h.start))/86400000)>1e-6) return null;
  const binsValid=keys.every(k=>Array.isArray(h.calibrationBins?.[k])&&h.calibrationBins[k].length>0&&
    h.calibrationBins[k].every(b=>Number.isInteger(b.samples)&&b.samples>=50&&[b.predicted,b.observed].every(v=>Number.isFinite(v)&&v>=0&&v<=1))&&
    h.calibrationBins[k].reduce((n,b)=>n+b.samples,0)===h.samples&&Number.isFinite(h.calibration?.[k])&&
    Math.abs(h.calibration[k]-h.calibrationBins[k].reduce((n,b)=>n+Math.abs(b.predicted-b.observed)*b.samples/h.samples,0))<1e-8);
  const metricPass=(m:ReportMetric)=>m&&[m.brier,m.baselineBrier,m.logLoss,m.baselineLogLoss,m.pValue,m.brierImprovementCI95?.[0]].every(Number.isFinite)&&
    m.brier<m.baselineBrier&&m.logLoss<=m.baselineLogLoss&&m.pValue>=0&&m.pValue<=0.05/8&&m.weeklyBlocks>=20&&m.brierImprovementCI95[0]>0;
  return r.passed===true&&model.historicalValidation.passed===true&&binsValid&&h.samples>=500&&h.spanDays>=183&&keys.every(k=>h.classCounts[k]>=75&&h.calibration[k]<=0.05)&&metricPass(h)&&
    (model.features.length===7||r.provenance==="prospective"&&Boolean(r.priceOnly&&r.priceOnly.samples===h.samples&&r.priceOnly.start===h.start&&r.priceOnly.end===h.end&&r.priceOnly.brier===h.brier&&r.priceOnly.logLoss===h.logLoss&&metricPass(r.priceOnly)));
}
export function inferModel(model:ModelArtifact,features:number[]):Probabilities {
  if(features.length!==model.features.length || !features.every(Number.isFinite)) throw new Error("Invalid model features");
  const z=features.map((v,i)=>(v-model.mean[i])/model.scale[i]);
  const logits=model.coefficients.map((row,i)=>(row.reduce((n,v,j)=>n+v*z[j],model.intercepts[i]))/model.temperature);
  const largest=Math.max(...logits), weights=logits.map(v=>Math.exp(v-largest)),total=weights.reduce((a,b)=>a+b,0);
  return {up:weights[0]/total,flat:weights[1]/total,down:weights[2]/total};
}
export async function loadTrustedModel(pair:string):Promise<ModelArtifact|null> {
  const root=process.env.DIRECTIONAL_MODEL_DIR,hash=process.env[`DIRECTIONAL_MODEL_SHA256_${pair}`];
  if(!root || !hash || !DIRECTIONAL_PAIRS.includes(pair as typeof DIRECTIONAL_PAIRS[number])) return null;
  try {
    const {join}=await import("node:path");
    const bytes=await readFile(join(root,`${pair}.json`));
    if(createHash("sha256").update(bytes).digest("hex")!==hash) return null;
    const parsed:unknown=JSON.parse(bytes.toString());
    if(!validModel(parsed,pair)) return null;
    const report=await readFile(join(root,`${pair}.validation.json`));
    if(createHash("sha256").update(report).digest("hex")!==parsed.historicalValidation.reportHash) return null;
    const verified=verifyHistoricalReport(parsed,JSON.parse(report.toString()));
    if(verified===null) return null;
    // Never mix prospective cohorts after coefficients/report bytes change,
    // even if a research job reused its human-readable version label.
    return {...parsed,version:`${parsed.version}@${hash}`,historicalValidation:{...parsed.historicalValidation,passed:verified}};
  } catch { return null; }
}
const keys=["up","flat","down"] as const;
const validProb=(p:Probabilities)=>p && keys.every(k=>Number.isFinite(p[k])&&p[k]>=0&&p[k]<=1)&&Math.abs(keys.reduce((n,k)=>n+p[k],0)-1)<1e-6;
const brier=(p:Probabilities,y:string)=>keys.reduce((n,k)=>n+(p[k]-(y===k?1:0))**2,0);
const loss=(p:Probabilities,y:ValidationSample["outcome"])=>-Math.log(Math.max(1e-12,p[y]));
export function calibrationError(samples:ValidationSample[],key:typeof keys[number]):number {
  const sorted=[...samples].sort((a,b)=>a.probabilities[key]-b.probabilities[key]);
  const bins=Math.min(10,Math.floor(sorted.length/50));
  if(bins<1) return Infinity;
  let error=0;
  for(let i=0;i<bins;i++) {
    const bin=sorted.slice(Math.floor(i*sorted.length/bins),Math.floor((i+1)*sorted.length/bins));
    error+=Math.abs(bin.reduce((n,s)=>n+s.probabilities[key],0)/bin.length-bin.filter(s=>s.outcome===key).length/bin.length)*bin.length/sorted.length;
  }
  return error;
}
/** Deterministic paired bootstrap of whole UTC weeks, preserving overlap/clusters. */
function improvementP(samples:ValidationSample[],benchmark:(s:ValidationSample)=>Probabilities):number {
  const week=new Map<number,number[]>();
  for(const s of samples) {
    const k=Math.floor((Date.parse(s.cutoffAt)/86400000+3)/7);
    const a=week.get(k)??[];a.push(brier(benchmark(s),s.outcome)-brier(s.probabilities,s.outcome));week.set(k,a);
  }
  const blocks=[...week.values()];if(blocks.length<20) return 1;
  let seed=77123,nonPositive=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let draw=0;draw<2000;draw++) {
    let sum=0;
    for(let i=0;i<blocks.length;i++) sum+=blocks[Math.floor(random()*blocks.length)].reduce((a,b)=>a+b,0);
    if(sum<=0) nonPositive++;
  }
  return (nonPositive+1)/2001;
}
export function evaluateValidation(model:ModelArtifact,samples:ValidationSample[],now=new Date()) {
  // Cohort is fixed before observing outcomes, not selected for winning forecasts.
  const cohort=samples.filter(s=>s.modelVersion===model.version&&s.provenance==="prospective"&&
    Date.parse(s.cutoffAt)>Date.parse(model.trainedThrough)&&
    keys.includes(s.outcome)&&Number.isFinite(Date.parse(s.cutoffAt))&&new Date(s.cutoffAt).getUTCHours()%4===0&&new Date(s.cutoffAt).getUTCMinutes()===0&&
    new Date(s.cutoffAt).getUTCSeconds()===0&&new Date(s.cutoffAt).getUTCMilliseconds()===0&&
    Date.parse(s.targetEnd)-Date.parse(s.cutoffAt)===14400000&&Date.parse(s.issuedAt)>=Date.parse(s.cutoffAt)&&
    Date.parse(s.issuedAt)-Date.parse(s.cutoffAt)<=60000&&Date.parse(s.resolvedAt)>=Date.parse(s.targetEnd)&&Date.parse(s.resolvedAt)<=now.getTime()&&
    validProb(s.probabilities)&&validProb(s.baseline)).sort((a,b)=>a.cutoffAt.localeCompare(b.cutoffAt));
  const unique=[...new Map(cohort.map(s=>[s.cutoffAt,s])).values()];
  const counts=Object.fromEntries(keys.map(k=>[k,unique.filter(s=>s.outcome===k).length]));
  const calibration=Object.fromEntries(keys.map(k=>[k,calibrationError(unique,k)]));
  const mean=(fn:(s:ValidationSample)=>number)=>unique.length?unique.reduce((n,s)=>n+fn(s),0)/unique.length:Infinity;
  const comparisons=[(s:ValidationSample)=>s.baseline];
  if(model.sources.some(s=>s!=="dukascopy_bid")) comparisons.push(s=>s.priceOnly!);
  const complete=comparisons.every(fn=>unique.every(s=>validProb(fn(s))));
  const p=complete?Math.max(...comparisons.map(fn=>improvementP(unique,fn))):1;
  // Bonferroni at .05/8 is more conservative than Holm and remains valid when
  // the other pairs have not yet supplied their evaluation evidence.
  const duration=unique.length?Date.parse(unique.at(-1)!.cutoffAt)-Date.parse(unique[0].cutoffAt):0;
  const passed=model.historicalValidation.passed && unique.length>=500 && duration>=183*86400000 &&
    keys.every(k=>counts[k]>=75&&calibration[k]<=0.05)&&p<=0.05/8&&complete&&
    comparisons.every(fn=>mean(s=>loss(s.probabilities,s.outcome))<=mean(s=>loss(fn(s),s.outcome)));
  return {passed,samples:unique.length,classCounts:counts,calibration,pValue:p,
    brier:Number.isFinite(mean(s=>brier(s.probabilities,s.outcome)))?mean(s=>brier(s.probabilities,s.outcome)):null,
    startedAt:unique[0]?.cutoffAt??null,endedAt:unique.at(-1)?.cutoffAt??null};
}
