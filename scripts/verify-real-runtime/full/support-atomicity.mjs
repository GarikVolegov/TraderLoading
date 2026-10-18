import {auditExecutionId as executionId} from './env.mjs';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {api,connect,root,run,setAuditScenario} from './env.mjs';
const db=await connect(),users=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json'));
const id='audit_support_atomic_'+Date.now(),sid=randomBytes(32).toString('hex'),label=process.argv[2]||'after',checks=[];
async function check(name,fn){setAuditScenario(name);try{await fn();checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,300));}writeFileSync(run.output+'/support-atomicity-'+label+'.json',JSON.stringify({runId:run.runId,executionId,checks},null,2));}
async function removeFault(){await db.query('DROP TRIGGER IF EXISTS audit_support_message ON support_ticket_messages');await db.query('DROP TRIGGER IF EXISTS audit_support_status ON support_tickets');await db.query('DROP TRIGGER IF EXISTS audit_support_log ON admin_audit_logs');await db.query('DROP FUNCTION IF EXISTS audit_support_fault()');}
try{
 await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[id,id]);
 await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[sid,{user:{id}},new Date(Date.now()+86400000)]);
 await check('Failed initial message rolls back ticket creation and retry creates exactly one ticket',async()=>{
  try{
   await db.query(`CREATE FUNCTION audit_support_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.author_id = '${id}' THEN RAISE EXCEPTION 'synthetic message failure'; END IF; RETURN NEW; END $$`);
   await db.query('CREATE TRIGGER audit_support_message BEFORE INSERT ON support_ticket_messages FOR EACH ROW EXECUTE FUNCTION audit_support_fault()');
   assert.equal((await api(sid,'/support/tickets','POST',{subject:'Rollback initial',body:'Initial'})).status,500);
   assert.equal((await db.query('SELECT count(*)::int n FROM support_tickets WHERE user_id=$1',[id])).rows[0].n,0);
  }finally{await removeFault();}
  assert.equal((await api(sid,'/support/tickets','POST',{subject:'Rollback initial',body:'Initial'})).status,201);
  assert.equal((await db.query('SELECT count(*)::int n FROM support_tickets WHERE user_id=$1',[id])).rows[0].n,1);
 });
 for(const author of ['user','admin'])await check(`Failed ${author} reply rolls back message and retry persists one reply`,async()=>{
  const r=await api(sid,'/support/tickets','POST',{subject:'Rollback '+author,body:'Initial'});assert.equal(r.status,201);
  const ticket=r.data.ticket.id,path=author==='user'?`/support/tickets/${ticket}/messages`:`/admin/support/tickets/${ticket}/reply`,actorSid=author==='user'?sid:users.admin.sid;
  try{
   await db.query(`CREATE FUNCTION audit_support_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = ${Number(ticket)} THEN RAISE EXCEPTION 'synthetic status failure'; END IF; RETURN NEW; END $$`);
   await db.query('CREATE TRIGGER audit_support_status BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION audit_support_fault()');
   assert.equal((await api(actorSid,path,'POST',{body:'Retry reply'})).status,500);
   assert.equal((await db.query('SELECT count(*)::int n FROM support_ticket_messages WHERE ticket_id=$1',[ticket])).rows[0].n,1);
  }finally{await removeFault();}
  assert.equal((await api(actorSid,path,'POST',{body:'Retry reply'})).status,201);
  assert.equal((await db.query('SELECT count(*)::int n FROM support_ticket_messages WHERE ticket_id=$1',[ticket])).rows[0].n,2);
  assert.equal((await api(sid,'/support/tickets/'+ticket)).data.ticket.status,author==='user'?'open':'pending');
 });
 await check('Failed admin audit log rolls back both reply and status change',async()=>{
  const r=await api(sid,'/support/tickets','POST',{subject:'Rollback audit log',body:'Initial'});assert.equal(r.status,201);
  const ticket=r.data.ticket.id;
  try{
   await db.query(`CREATE FUNCTION audit_support_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.target_type = 'support_ticket' AND NEW.target_id = '${Number(ticket)}' THEN RAISE EXCEPTION 'synthetic audit log failure'; END IF; RETURN NEW; END $$`);
   await db.query('CREATE TRIGGER audit_support_log BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION audit_support_fault()');
   assert.equal((await api(users.admin.sid,`/admin/support/tickets/${ticket}/reply`,'POST',{body:'Rejected transaction'})).status,500);
   assert.equal((await api(users.admin.sid,`/admin/support/tickets/${ticket}/status`,'POST',{status:'closed'})).status,500);
   const detail=await api(sid,'/support/tickets/'+ticket);assert.equal(detail.data.messages.length,1);assert.equal(detail.data.ticket.status,'open');
  }finally{await removeFault();}
  assert.equal((await api(users.admin.sid,`/admin/support/tickets/${ticket}/status`,'POST',{status:'closed'})).status,200);
  assert.equal((await api(sid,'/support/tickets/'+ticket)).data.ticket.status,'closed');
 });
}finally{await removeFault();await db.end();}
if(checks.some(c=>c.status==='failed'))process.exitCode=1;
