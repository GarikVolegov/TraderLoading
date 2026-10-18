import { DIRECTIONAL_PAIRS, inferModel, evaluateValidation, type ModelArtifact, type ValidationSample, type Probabilities } from "./model.js";
export type PriceObservation={time:number;open:number;high:number;low:number;close:number;closeAt:string;availableAt:string;source:"dukascopy_bid"};
export function validPriceObservation(b:PriceObservation):boolean {
  return b.source==="dukascopy_bid" && Number.isInteger(b.time/60) &&
    Number.isFinite(Date.parse(b.availableAt)) && Date.parse(b.availableAt)>=Date.parse(b.closeAt) &&
    Date.parse(b.closeAt)===b.time*1000+60000 &&
    [b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0) &&
    b.high>=Math.max(b.open,b.close,b.low) && b.low<=Math.min(b.open,b.close);
}
export type DirectionalOutlook={pair:string;horizon:"4h";status:"available"|"unvalidated"|"insufficient"|"unsupported"|"stale";reason:string|null;
  cutoffAt:string;issuedAt:string;targetEnd:string;referencePrice:number|null;referenceObservedAt:string|null;
  neutralBand:{lower:number;upper:number}|null;probabilities:Probabilities|null;modelVersion:string|null;
  validation:ReturnType<typeof evaluateValidation>|null;sources:string[];features:number[]|null;delta:number|null};
export function buildDirectionalOutlook(pair:string,input:{observations?:PriceObservation[];marketOpen:boolean;model?:ModelArtifact|null;samples?:ValidationSample[];macroFeatures?:number[]|null},now=new Date()):DirectionalOutlook {
  const t=Math.floor(now.getTime()/60000)*60000;
  const out:DirectionalOutlook={pair,horizon:"4h",status:"insufficient",reason:"price_unavailable",cutoffAt:new Date(t).toISOString(),issuedAt:now.toISOString(),targetEnd:new Date(t+14400000).toISOString(),referencePrice:null,referenceObservedAt:null,neutralBand:null,probabilities:null,modelVersion:input.model?.version??null,validation:null,sources:["dukascopy_bid"],features:null,delta:null};
  if(!DIRECTIONAL_PAIRS.includes(pair as typeof DIRECTIONAL_PAIRS[number])) return {...out,status:"unsupported",reason:"unsupported_pair"};
  if(!input.marketOpen) return {...out,reason:"market_calendar_unavailable_or_closed"};
  const observations=(input.observations??[]).filter(b=>validPriceObservation(b)&&Date.parse(b.availableAt)<=t&&Date.parse(b.closeAt)<=t).sort((a,b)=>a.time-b.time);
  const byMinute=new Map(observations.map(b=>[b.time,b]));
  const latest=observations.at(-1);
  if(!latest) return out;
  out.referencePrice=latest.close;out.referenceObservedAt=latest.closeAt;
  if(t-Date.parse(latest.closeAt)>120000) return {...out,status:"stale",reason:"old_price"};
  const hours:{time:number;close:number;high:number;low:number}[]=[];
  const first=Math.floor(observations[0].time/3600)*3600,last=Math.floor(t/3600000)*3600;
  for(let h=first;h+3600<=last;h+=3600) {
    const bars=Array.from({length:60},(_,i)=>byMinute.get(h+i*60));
    if(bars.some(b=>!b)) continue;
    hours.push({time:h,close:bars[59]!.close,high:Math.max(...bars.map(b=>b!.high)),low:Math.min(...bars.map(b=>b!.low))});
  }
  const returns=hours.flatMap((h,i)=>i>0&&h.time-hours[i-1].time===3600?[Math.log(h.close/hours[i-1].close)]:[]).slice(-120);
  if(returns.length<120 || hours.length<25) return {...out,reason:"short_verified_history"};
  const mean=returns.reduce((a,b)=>a+b,0)/120,sigma=Math.sqrt(returns.reduce((n,r)=>n+(r-mean)**2,0)/119);
  if(!Number.isFinite(sigma)||sigma<=0) return {...out,reason:"invalid_volatility"};
  const lastHour=hours.at(-1)!;
  const lookup=(offset:number)=>hours.find(h=>h.time===lastHour.time-offset*3600);
  if(!lookup(1)||!lookup(4)||!lookup(24)) return {...out,reason:"gapped_feature_window"};
  const angle=(t/3600000%24)*Math.PI/12;
  out.features=[1,4,24].map(offset=>Math.log(lastHour.close/lookup(offset)!.close));
  out.features.push(sigma,hours.slice(-20).reduce((n,h)=>n+(h.high-h.low)/h.close,0)/20,Math.sin(angle),Math.cos(angle));
  out.delta=0.5*sigma;out.neutralBand={lower:latest.close*Math.exp(-out.delta),upper:latest.close*Math.exp(out.delta)};
  if(input.model)out.sources=input.model.sources;
  if(input.model?.features.length===10) {
    if(input.macroFeatures?.length!==3||!input.macroFeatures.every(Number.isFinite))return {...out,status:"unvalidated",reason:"macro_history_unavailable"};
    out.features.push(...input.macroFeatures);
  }
  if(!input.model || Date.parse(input.model.trainedThrough)>=t) return {...out,status:"unvalidated",reason:"model_unvalidated"};
  out.validation=evaluateValidation(input.model,input.samples??[],now);out.sources=input.model.sources;
  if(!out.validation.passed) return {...out,status:"unvalidated",reason:"validation_pending"};
  return {...out,status:"available",reason:null,probabilities:inferModel(input.model,out.features)};
}
export function resolveDirectionalOutcome(outlook:DirectionalOutlook,observations:PriceObservation[]|undefined) {
  const start=Date.parse(outlook.cutoffAt),end=Date.parse(outlook.targetEnd);
  if(!observations || !Number.isFinite(start) || end-start!==14400000 || !outlook.referencePrice || outlook.delta===null || !Number.isFinite(outlook.delta) || outlook.delta<=0) return null;
  const byMinute=new Map(observations.filter(validPriceObservation).map(b=>[b.time,b]));
  // An endpoint alone cannot prove that the market traded throughout the target.
  const window=Array.from({length:240},(_,i)=>byMinute.get(start/1000+i*60));
  if(window.some(b=>!b)) return null;
  const observation=window[239]!;
  if(observation.closeAt!==outlook.targetEnd) return null;
  const r=Math.log(observation.close/outlook.referencePrice);
  if(!Number.isFinite(r)) return null;
  return {outcome:r>outlook.delta?"up":r< -outlook.delta?"down":"flat",returnLog:r,finalPrice:observation.close,observedAt:observation.closeAt};
}
