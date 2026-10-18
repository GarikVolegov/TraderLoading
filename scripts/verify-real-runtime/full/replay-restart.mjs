import assert from 'node:assert/strict';import {readFileSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {api,root,run,auditExecutionId,setAuditScenario} from './env.mjs';
const marker=root+'.local-logs/replay-restart-fixture.json',user=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json')).a,processMarker=JSON.parse(readFileSync(root+'.local-logs/runtime-api-process.json'));
assert.ok(user.id.startsWith('audit_'+run.runId+'_'));
if(process.argv[2]==='prepare'){
 assert.equal(existsSync(marker),false,'Previous replay restart fixture needs review');
 const created=await api(user.sid,'/backtest/sessions','POST',{name:'Audit replay restart '+Date.now(),pair:'EUR/USD',timeframe:'H1'});assert.equal(created.status,200);
 const body={clientRequestId:randomUUID(),direction:'buy',entryPrice:'1.1',exitPrice:'1.1',stopLoss:'1.098',lotSize:'0.5',result:'breakeven',pips:'0',tradeDate:'2024-06-03'};
 const saved=await api(user.sid,'/backtest/sessions/'+created.data.id+'/trades','POST',body);assert.equal(saved.status,200);
 writeFileSync(marker,JSON.stringify({runId:run.runId,userId:user.id,sessionId:created.data.id,tradeId:saved.data.id,body,pid:processMarker.pid}),{mode:0o600});console.log('Prepared a synthetic replay trade; now restart only the audit API');
}else if(process.argv[2]==='resume'){
 const fixture=JSON.parse(readFileSync(marker));assert.equal(fixture.runId,run.runId);assert.equal(fixture.userId,user.id);assert.notEqual(processMarker.pid,fixture.pid,'Actual API process restart required');
 const name='Durable replay receipt survives actual API restart';setAuditScenario(name);const report={runId:run.runId,executionId:auditExecutionId,mode:'Actual isolated API process restart and SQL persistence, synthetic trade',checks:[]};
 try{const response=await api(user.sid,'/backtest/sessions/'+fixture.sessionId+'/trades','POST',fixture.body);assert.equal(response.status,200);assert.equal(response.data.id,fixture.tradeId);const trades=await api(user.sid,'/backtest/sessions/'+fixture.sessionId+'/trades');assert.equal(trades.data.length,1);report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message});process.exitCode=1;}
 finally{const removed=await api(user.sid,'/backtest/sessions/'+fixture.sessionId,'DELETE');assert.equal(removed.status,200);unlinkSync(marker);writeFileSync(run.output+'/replay-restart-after.json',JSON.stringify(report,null,2));}
}else throw Error('Use prepare then resume after restarting the audit API');
