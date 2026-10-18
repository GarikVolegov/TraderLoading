import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync,existsSync,rmSync} from 'node:fs';
import {api,connect,root,run,auditExecutionId,setAuditScenario} from './env.mjs';
const mode=process.argv[2];assert.ok(['prepare','resume'].includes(mode));
const marker=root+'.local-logs/broker-restart-fixture.json',output=run.output+'/broker-restart-after.json';
if(mode==='prepare')assert.equal(existsSync(marker),false,'Unfinished restart fixture: resume or inspect it before preparing another');
if(mode==='resume')rmSync(output,{force:true});
const users=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json')),sid=users.a.sid,db=await connect();
async function ok(path,method='GET',body,status=200){const r=await api(sid,path,method,body);assert.equal(r.status,status,path);return r.data;}
setAuditScenario('Durable simulated order receipt prevents resending after API restart');
try{
 if(mode==='prepare'){
  const p=(await ok('/brokers/profiles','POST',{label:'audit_restart_'+Date.now(),brokerName:'Synthetic',kind:'demo',providerKind:'demo',environment:'demo',tradingEnabled:true},201)).profile;
  assert.equal(p.kind,'demo');assert.equal(p.environment,'demo');const url='/brokers/profiles/'+p.id;
  assert.equal((await ok(url+'/connect','POST')).snapshot.kind,'demo');
  const request={symbol:'EURUSD',side:'buy',volume:0.1,clientRequestId:'restart-'+Date.now()};
  const result=await ok(url+'/orders','POST',request);assert.equal(result.accepted,true);
  assert.equal((await ok(url+'/snapshot')).positions.length,1);
  const receipt=(await db.query("SELECT data FROM broker_profile_store WHERE store_key LIKE 'order-receipt:%' AND data->>'profileId'=$1",[p.id])).rows;
  assert.equal(receipt.length,1);assert.equal(receipt[0].data.phase,'resolved');assert.deepEqual(receipt[0].data.result,result);
  const pid=JSON.parse(readFileSync(root+'.local-logs/runtime-api-process.json')).pid;
  writeFileSync(marker,JSON.stringify({runId:run.runId,executionId:auditExecutionId,pid,profileId:p.id,request,result}),{mode:0o600});
  console.log('Prepared one simulated order and verified its database receipt; restart audit API before resume');
 }else{
  const fixture=JSON.parse(readFileSync(marker));assert.equal(fixture.runId,run.runId);
  const current=JSON.parse(readFileSync(root+'.local-logs/runtime-api-process.json'));assert.equal(current.mode,'production');assert.notEqual(current.pid,fixture.pid,'A real API process restart is required');
  const url='/brokers/profiles/'+fixture.profileId;
  assert.equal((await ok(url+'/connect','POST')).snapshot.kind,'demo');
  assert.equal((await ok(url+'/snapshot')).positions.length,0,'Fresh demo connector must have no positions after restart');
  assert.deepEqual(await ok(url+'/orders','POST',fixture.request),fixture.result);
  assert.equal((await ok(url+'/snapshot')).positions.length,0,'Resolved retry must not dispatch into the new demo connector');
  assert.equal((await ok(url+'/orders','POST',{...fixture.request,volume:0.2})).accepted,false);
  assert.equal((await ok(url+'/snapshot')).positions.length,0);
  const pendingRequest={...fixture.request,clientRequestId:'pending-'+Date.now()};
  // Keep the genuine reservation pending by failing only its database completion.
  await db.query(`CREATE OR REPLACE FUNCTION audit_block_order_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.store_key LIKE 'order-receipt:%' AND NEW.data->>'profileId'='${fixture.profileId.replaceAll("'","''")}' AND NEW.data->>'phase'='resolved' THEN RAISE EXCEPTION 'Synthetic receipt completion outage'; END IF; RETURN NEW; END $$`);
  await db.query('CREATE TRIGGER audit_order_completion BEFORE UPDATE ON broker_profile_store FOR EACH ROW EXECUTE FUNCTION audit_block_order_completion()');
  try{
   const unconfirmed=await ok(url+'/orders','POST',pendingRequest);assert.equal(unconfirmed.accepted,false);assert.match(unconfirmed.reason,/non confermato/);
   assert.equal((await ok(url+'/snapshot')).positions.length,1);
  }finally{await db.query('DROP TRIGGER IF EXISTS audit_order_completion ON broker_profile_store');await db.query('DROP FUNCTION IF EXISTS audit_block_order_completion()');}
  assert.equal((await ok(url+'/orders','POST',pendingRequest)).accepted,false);
  assert.equal((await ok(url+'/snapshot')).positions.length,1,'Pending receipt must block dispatch after completion service recovers');
  const rows=(await db.query("SELECT data FROM broker_profile_store WHERE store_key LIKE 'order-receipt:%' AND data->>'profileId'=$1",[fixture.profileId])).rows;
  assert.equal(rows.length,2);assert.equal(rows.filter(r=>r.data.phase==='pending').length,1);
  await ok(url,'DELETE',undefined,204);
  await db.query("DELETE FROM broker_profile_store WHERE store_key LIKE 'order-receipt:%' AND data->>'profileId'=$1",[fixture.profileId]);
  writeFileSync(output,JSON.stringify({runId:run.runId,executionId:auditExecutionId,prepareExecutionId:fixture.executionId,mode:'Actual production API restart and isolated database completion fault; DEMO connector only',checks:[{name:'Durable simulated order receipt prevents resending after API restart',status:'passed'}],observations:{actualRestart:true,resolvedReplayDispatches:0,pendingRetryDispatches:0,receiptCount:2}},null,2));
  unlinkSync(marker);console.log('PASS durable restart replay, conflicting intent and pending completion outage');
 }
}catch(error){
 writeFileSync(output,JSON.stringify({runId:run.runId,executionId:auditExecutionId,mode,checks:[{name:'Durable simulated order receipt prevents resending after API restart',status:'failed',error:error.message}]},null,2));
 throw error;
}finally{await db.end();}
