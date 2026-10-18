import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {api,root,run,setAuditScenario,auditExecutionId as executionId} from './env.mjs';
const users=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json'));
const label=process.argv[2]||'after',report={runId:run.runId,executionId,checks:[]};
const check=async(name,fn)=>{setAuditScenario(name);try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,300));}writeFileSync(run.output+'/market-tools-'+label+'.json',JSON.stringify(report,null,2));};
await check('Zero-risk Monte Carlo stays exactly flat and statistics agree',async()=>{
 const r=await api(users.a.sid,'/tools/montecarlo','POST',{riskPercent:0,initialBalance:10000,numTrades:20,simCount:3});assert.equal(r.status,200);
 assert.equal(r.data.simulations.length,3);assert.ok(r.data.simulations.every(curve=>curve.length===21&&curve.every(v=>v===10000)));
 assert.equal(r.data.stats.median,10000);assert.equal(r.data.stats.avgReturnPercent,'0.0');assert.equal(r.data.stats.ruinProbability,'0.0');
});
await check('Monte Carlo quantiles and return match its returned curves',async()=>{
 const r=await api(users.a.sid,'/tools/montecarlo','POST',{initialBalance:10000,numTrades:30,simCount:20});assert.equal(r.status,200);
 const values=r.data.simulations.map(curve=>curve.at(-1)).sort((a,b)=>a-b);assert.ok(r.data.simulations.every(curve=>curve.length===31&&curve.every(v=>Number.isFinite(v)&&v>=0)));
 for(const [key,index]of[['median',10],['percentile10',2],['percentile90',18]])assert.equal(r.data.stats[key],Math.round(values[index]));
 assert.equal(r.data.stats.avgReturnPercent,((values.reduce((s,v)=>s+v,0)/values.length/10000-1)*100).toFixed(1));
});
await check('Overflowing Monte Carlo inputs return an explicit error without null balances',async()=>{
 const r=await api(users.a.sid,'/tools/montecarlo','POST',{winrate:100,avgR:100,lossR:0,riskPercent:100,initialBalance:100000000,numTrades:1000,simCount:2});assert.equal(r.status,422);assert.equal(typeof r.data.error,'string');
});
await check('Unsupported market pair and missing watchlist never default to another pair',async()=>{
 for(const path of ['/tools/market-context?pair=INVALID','/tools/volatility?pair=INVALID','/tools/watchlist'])assert.equal((await api(users.a.sid,path)).status,400);
 const r=await api(users.a.sid,'/tools/watchlist?pairs=INVALID');assert.equal(r.status,200);assert.ok(r.data.items.every(item=>item.pair==='INVALID'&&!item.supported));
 const pairs=await api(users.a.sid,'/tools/pairs');assert.equal(pairs.status,200);assert.ok(Array.isArray(pairs.data.pairs)&&pairs.data.pairs.length>0);
});
if(report.checks.some(c=>c.status==='failed'))process.exitCode=1;
