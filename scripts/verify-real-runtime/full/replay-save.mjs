import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {api,connect,run,auditExecutionId,setAuditScenario} from './env.mjs';
const label=process.argv[2]||'after';assert.match(label,/^[a-z0-9-]+$/);
const db=await connect(),tag='audit_replay_save_'+Date.now(),actors=['a','b','free'].map(k=>({id:tag+'_'+k,sid:randomUUID()})),[a,b,free]=actors,ids=[];
const report={runId:run.runId,executionId:auditExecutionId,label,mode:'Actual isolated production API and PostgreSQL; synthetic replay trades only',checks:[]},output=run.output+'/replay-save-'+label+'.json';
const trade={direction:'buy',entryPrice:'1.10000',exitPrice:'1.10000',stopLoss:'1.09800',takeProfit:'1.10400',lotSize:'0.50',result:'breakeven',pips:'0',tradeDate:'2024-06-03'};
async function ok(sid,path,method='GET',body,status=200){const r=await api(sid,path,method,body);assert.equal(r.status,status,path);return r.data;}
async function session(user=a){const s=await ok(user.sid,'/backtest/sessions','POST',{name:tag,pair:'EUR/USD',timeframe:'H1'});ids.push(s.id);return s.id;}
async function check(name,fn){setAuditScenario(name);try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,300));}writeFileSync(output,JSON.stringify(report,null,2));}
try{
 for(const u of actors){await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[u.id,u.id]);if(u!==free)await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status) VALUES($1,'pro','active')",[u.id]);await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[u.sid,{user:{id:u.id}},new Date(Date.now()+86400000)]);}
 await check('A replayed save returns the original trade without duplicating statistics',async()=>{const id=await session(),path='/backtest/sessions/'+id+'/trades',body={...trade,clientRequestId:randomUUID()};const first=await ok(a.sid,path,'POST',body),next=await ok(a.sid,path,'POST',body);assert.equal(next.id,first.id);assert.equal((await ok(a.sid,path)).length,1);assert.equal((await ok(a.sid,'/backtest/sessions')).find(s=>s.id===id).stats.total,1);});
 await check('Eight concurrent saves reserve one durable trade',async()=>{const id=await session(),path='/backtest/sessions/'+id+'/trades',body={...trade,clientRequestId:randomUUID()};const responses=await Promise.all(Array.from({length:8},()=>api(a.sid,path,'POST',body)));assert.ok(responses.every(r=>r.status===200));assert.equal(new Set(responses.map(r=>r.data.id)).size,1);assert.equal((await ok(a.sid,path)).length,1);});
 await check('Reuse with different content is a conflict and cannot overwrite or add a trade',async()=>{const id=await session(),path='/backtest/sessions/'+id+'/trades',body={...trade,clientRequestId:randomUUID()};const first=await ok(a.sid,path,'POST',body);await ok(a.sid,path,'POST',{...body,exitPrice:'1.101',result:'win',pips:'10'},409);assert.equal((await ok(a.sid,path)).length,1);assert.equal((await ok(a.sid,path))[0].id,first.id);});
 await check('Anonymous Free and foreign owners cannot replay the owner receipt',async()=>{const id=await session(),path='/backtest/sessions/'+id+'/trades',body={...trade,clientRequestId:randomUUID()};await ok(a.sid,path,'POST',body);await ok(null,path,'POST',body,401);await ok(free.sid,path,'POST',body,402);await ok(b.sid,path,'POST',body,404);const own=await session(b);await ok(b.sid,'/backtest/sessions/'+own+'/trades','POST',body);assert.equal((await ok(a.sid,path)).length,1);});
 await check('Invalid request identities fail before writing any trade',async()=>{const id=await session(),path='/backtest/sessions/'+id+'/trades';for(const clientRequestId of ['',{},'x'.repeat(101),'white space'])await ok(a.sid,path,'POST',{...trade,clientRequestId},400);assert.equal((await ok(a.sid,path)).length,0);});
 await check('Legacy manual requests without an identity still create distinct trades',async()=>{const id=await session(),path='/backtest/sessions/'+id+'/trades';const first=await ok(a.sid,path,'POST',trade),second=await ok(a.sid,path,'POST',trade);assert.notEqual(first.id,second.id);assert.equal((await ok(a.sid,path)).length,2);});
 await check('Deleted trades cannot be resurrected by a delayed replay and session deletion removes receipts',async()=>{const id=await session(),path='/backtest/sessions/'+id+'/trades',body={...trade,clientRequestId:randomUUID()};const first=await ok(a.sid,path,'POST',body);await ok(a.sid,'/backtest/trades/'+first.id,'DELETE');await ok(a.sid,path,'POST',body,409);assert.equal((await ok(a.sid,path)).length,0);await ok(a.sid,'/backtest/sessions/'+id,'DELETE');assert.equal((await db.query("SELECT count(*)::int n FROM broker_profile_store WHERE store_key LIKE 'backtest-trade:%' AND data->>'sessionId'=$1",[String(id)])).rows[0].n,0);});
 if(label!=='baseline')await check('Receipt insert failure rolls back the trade and the same request retries once',async()=>{
  const id=await session(),path='/backtest/sessions/'+id+'/trades',body={...trade,clientRequestId:randomUUID()};
  await db.query(`CREATE FUNCTION audit_replay_receipt_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.store_key LIKE 'backtest-trade:%' AND NEW.data->>'userId'='${a.id}' THEN RAISE EXCEPTION 'Synthetic receipt fault'; END IF; RETURN NEW; END $$`);await db.query('CREATE TRIGGER audit_replay_receipt BEFORE INSERT ON broker_profile_store FOR EACH ROW EXECUTE FUNCTION audit_replay_receipt_fault()');
  try{await ok(a.sid,path,'POST',body,500);assert.equal((await ok(a.sid,path)).length,0);}finally{await db.query('DROP TRIGGER IF EXISTS audit_replay_receipt ON broker_profile_store');await db.query('DROP FUNCTION IF EXISTS audit_replay_receipt_fault()');}
  await ok(a.sid,path,'POST',body);await ok(a.sid,path,'POST',body);assert.equal((await ok(a.sid,path)).length,1);
 });
 if(label!=='baseline')await check('Deleting a synthetic account removes its replay receipts and preserves the other owner',async()=>{
  const id=await session(b);await ok(b.sid,'/backtest/sessions/'+id+'/trades','POST',{...trade,clientRequestId:randomUUID()});
  assert.ok((await db.query("SELECT count(*)::int n FROM broker_profile_store WHERE store_key LIKE 'backtest-trade:%' AND data->>'userId'=$1",[b.id])).rows[0].n>0);
  assert.ok(b.id.startsWith('audit_replay_save_'));await ok(b.sid,'/account','DELETE');
  assert.equal((await db.query("SELECT count(*)::int n FROM broker_profile_store WHERE store_key LIKE 'backtest-trade:%' AND data->>'userId'=$1",[b.id])).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM profile WHERE user_id=$1',[a.id])).rows[0].n,1);
 });
}finally{
 await db.query('DELETE FROM backtest_sessions WHERE id=ANY($1::int[])',[ids]);await db.query("DELETE FROM broker_profile_store WHERE store_key LIKE 'backtest-trade:%' AND data->>'userId'=ANY($1::text[])",[actors.map(u=>u.id)]);
 for(const u of actors){await db.query('DELETE FROM sessions WHERE sid=$1',[u.sid]);await db.query('DELETE FROM login_access WHERE user_id=$1',[u.id]);await db.query('DELETE FROM admin_user_subscriptions WHERE user_id=$1',[u.id]);await db.query('DELETE FROM profile WHERE user_id=$1',[u.id]);}
 await db.end();writeFileSync(output,JSON.stringify(report,null,2));
}
if(report.checks.some(c=>c.status==='failed'))process.exitCode=1;
