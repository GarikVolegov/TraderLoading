import assert from "node:assert/strict";
import { buildDirectionalOutlook, resolveDirectionalOutcome, type PriceObservation } from "./outlook.js";
import { evaluateValidation, inferModel, validModel, FEATURE_ORDER, MACRO_FEATURE_ORDER, type ModelArtifact, type ValidationSample } from "./model.js";
import { isTradingWindowOpen } from "./calendar.js";

const model:ModelArtifact={version:"fixture-v1",pair:"EURUSD",classes:["up","flat","down"],features:FEATURE_ORDER,sources:["dukascopy_bid"],mean:Array(7).fill(0),scale:Array(7).fill(1),coefficients:Array.from({length:3},()=>Array(7).fill(0)),intercepts:[0,0,0],temperature:1,trainedThrough:"2024-01-01T00:00:00Z",historicalValidation:{passed:true,datasetHash:"a".repeat(64),reportHash:"b".repeat(64),provenance:"historical_research"}};
assert.ok(validModel(model,"EURUSD"));
assert.equal(validModel({...model,classes:["down","flat","up"]},"EURUSD"),false);
assert.deepEqual(inferModel(model,Array(7).fill(0)),{up:1/3,flat:1/3,down:1/3});
assert.throws(()=>inferModel(model,[NaN]));

const now=new Date("2026-10-08T12:00:30Z"),start=+now-200*3600000;
const observations:PriceObservation[]=Array.from({length:200*60-1},(_,i)=>{
  const time=Math.floor(start/60000)*60+i*60,close=1.1+Math.sin(i/65)*.001+i*.0000001;
  return {time,open:close-.00001,close,high:close+.0001,low:close-.0001,closeAt:new Date((time+60)*1000).toISOString(),availableAt:new Date((time+60)*1000+1000).toISOString(),source:"dukascopy_bid"};
});
const input={observations,marketOpen:true,model,samples:[]};
const out=buildDirectionalOutlook("EURUSD",input,now);
assert.equal(out.status,"unvalidated");assert.equal(out.probabilities,null);assert.ok(out.neutralBand);assert.ok(out.features);
assert.equal(buildDirectionalOutlook("BTCUSD",input,now).status,"unsupported");
assert.equal(buildDirectionalOutlook("EURUSD",{...input,marketOpen:false},now).probabilities,null);
assert.equal(buildDirectionalOutlook("EURUSD",{...input,observations:observations.map(b=>({...b,availableAt:new Date(+now+60000).toISOString()}))},now).reason,"price_unavailable");
assert.equal(buildDirectionalOutlook("EURUSD",{...input,observations:observations.slice(0,-10)},now).status,"stale");
assert.equal(buildDirectionalOutlook("EURUSD",{...input,observations:observations.filter((_,i)=>i%60!==0)},now).reason,"short_verified_history");
const macroModel:ModelArtifact={...model,features:MACRO_FEATURE_ORDER,sources:["dukascopy_bid","macro_pit_v1"],mean:Array(10).fill(0),scale:Array(10).fill(1),coefficients:Array.from({length:3},()=>Array(10).fill(0)),priceOnlyModel:model};
const missingMacro=buildDirectionalOutlook("EURUSD",{...input,model:macroModel},now);
assert.equal(missingMacro.reason,"macro_history_unavailable");assert.equal(missingMacro.probabilities,null);
assert.equal(missingMacro.features?.length,7,"missing macro does not discard independently verified price research");
assert.equal(buildDirectionalOutlook("EURUSD",{...input,model:macroModel,macroFeatures:[0,0,0]},now).features?.length,10);
assert.equal(resolveDirectionalOutcome(out,undefined),null);
const targetWindow:PriceObservation[]=Array.from({length:240},(_,i)=>{
  const time=Date.parse(out.cutoffAt)/1000+i*60,close=out.referencePrice!*1.01;
  return {time,open:close,high:close,low:close,close,source:"dukascopy_bid",closeAt:new Date((time+60)*1000).toISOString(),availableAt:new Date((time+60)*1000+1000).toISOString()};
});
assert.equal(resolveDirectionalOutcome(out,targetWindow)?.outcome,"up");
assert.equal(resolveDirectionalOutcome(out,targetWindow.slice(1)),null);
assert.equal(resolveDirectionalOutcome(out,[targetWindow.at(-1)!]),null);
assert.equal(resolveDirectionalOutcome(out,targetWindow.map(b=>({...b,high:0}))),null);

const samples:ValidationSample[]=Array.from({length:1200},(_,i)=>{
  const t=Date.parse("2025-01-01T00:00:00Z")+i*14400000,y=(["up","flat","down"] as const)[i%3];
  return {cutoffAt:new Date(t).toISOString(),targetEnd:new Date(t+14400000).toISOString(),issuedAt:new Date(t+1000).toISOString(),resolvedAt:new Date(t+14401000).toISOString(),outcome:y,probabilities:{up:y==="up"?.98:.01,flat:y==="flat"?.98:.01,down:y==="down"?.98:.01},baseline:{up:1/3,flat:1/3,down:1/3},provenance:"prospective",modelVersion:model.version};
});
assert.equal(evaluateValidation(model,samples,now).passed,true);
assert.equal(evaluateValidation(model,samples.map(s=>({...s,provenance:"synthetic"})),now).passed,false);
assert.equal(evaluateValidation(model,samples.map(s=>({...s,probabilities:{up:.99,flat:.005,down:.005}})),now).passed,false);
assert.equal(evaluateValidation(model,samples.slice(0,499),now).passed,false);
assert.equal(evaluateValidation(model,Array(1200).fill(samples[0]),now).samples,1);
assert.equal(evaluateValidation(model,samples.map(s=>({...s,issuedAt:new Date(Date.parse(s.cutoffAt)-1000).toISOString()})),now).passed,false);
assert.equal(evaluateValidation({...model,trainedThrough:"2027-01-01T00:00:00Z"},samples,now).samples,0);
assert.equal(evaluateValidation({...model,version:`${model.version}@different-artifact`},samples,now).samples,0,"changed artifact cannot reuse a previous prospective cohort");

const cal={verifiedFrom:"2026-01-01T00:00:00Z",verifiedUntil:"2027-01-01T00:00:00Z",sourceUrls:["https://www.dukascopy.com/swiss/english/forex/forex-trading-accounts/link/"],closedIntervals:[]};
assert.equal(isTradingWindowOpen("EURUSD","2026-10-08T12:00:00Z","2026-10-08T16:00:00Z",cal),true);
assert.equal(isTradingWindowOpen("EURUSD","2026-10-09T20:00:00Z","2026-10-10T00:00:00Z",cal),false);
assert.equal(isTradingWindowOpen("XAUUSD","2026-10-08T20:00:00Z","2026-10-09T00:00:00Z",cal),false);
assert.equal(isTradingWindowOpen("EURUSD","2026-10-08T12:00:00Z","2026-10-08T16:00:00Z",null),false);
console.log("Directional source, temporal, calibration and abstention checks passed");
