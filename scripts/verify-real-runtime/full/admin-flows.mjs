import {auditExecutionId as executionId} from './env.mjs';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {api,connect,root,run,setAuditScenario} from './env.mjs';

const db=await connect(),u=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json'));
const label=process.argv[2]||'after',checks=[],actors={};
const prefix='audit_adminflow_'+Date.now();
async function check(name,fn){setAuditScenario(name);try{await fn();checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,300));}writeFileSync(run.output+'/admin-flows-'+label+'.json',JSON.stringify({runId:run.runId,executionId,checks},null,2));}
async function request(sid,path,method='GET',body,status=200){const r=await api(sid,path,method,body);assert.equal(r.status,status,`${method} ${path}: ${r.status} expected ${status}`);return r.data;}
try{
 await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3) ON CONFLICT(sid) DO UPDATE SET expire=excluded.expire',[u.admin.sid,{user:{id:u.admin.id}},new Date(Date.now()+86400000)]);
 for(const role of ['owner','other','support_agent','moderator','content_manager','read_only_auditor']){
  const id=prefix+'_'+role,sid=randomBytes(32).toString('hex');actors[role]={id,sid};
  await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[id,prefix+' '+role]);
  await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[sid,{user:{id}},new Date(Date.now()+86400000)]);
  if(!['owner','other'].includes(role))await db.query("INSERT INTO admin_users(user_id,role,status) VALUES($1,$2,'active')",[id,role]);
 }
 const {owner,other,support_agent:support,moderator,content_manager:content,read_only_auditor:auditor}=actors;
 await check('Manual subscription upgrades and downgrades enforce Pro gates immediately',async()=>{
  const path='/admin/subscriptions/'+owner.id,body={plan:'pro',status:'active',reason:'Synthetic audit only'};
  await request(owner.sid,'/backtest/sessions','GET',undefined,402);
  for(const sid of [owner.sid,support.sid,moderator.sid,content.sid,auditor.sid])await request(sid,path,'POST',body,403);
  await request(u.admin.sid,path,'POST',{...body,reason:''},400);
  await request(u.admin.sid,path,'POST',{...body,currentPeriodEnd:'invalid'},400);
  await request(u.admin.sid,path,'POST',body);
  await request(owner.sid,'/backtest/sessions');
  assert.equal((await db.query('SELECT plan FROM admin_user_subscriptions WHERE user_id=$1',[owner.id])).rows[0].plan,'pro');
  await request(u.admin.sid,path,'POST',{...body,plan:'free'});
  await request(owner.sid,'/backtest/sessions','GET',undefined,402);
 });
 await check('Support agent replies, owner reads persisted reply, closes and reopens ticket',async()=>{
  const {ticket}=await request(owner.sid,'/support/tickets','POST',{subject:'Synthetic admin flow',body:'Initial test message'},201);
  const path='/admin/support/tickets/'+ticket.id;
  for(const sid of [owner.sid,moderator.sid,content.sid,auditor.sid])await request(sid,path+'/reply','POST',{body:'Forbidden'},403);
  await request(support.sid,path+'/reply','POST',{body:' '},400);
  await request(support.sid,path+'/reply','POST',{body:'Synthetic support response'},201);
  let detail=await request(owner.sid,'/support/tickets/'+ticket.id);
  assert.equal(detail.ticket.status,'pending');assert.equal(detail.messages.length,2);assert.equal(detail.messages[1].body,'Synthetic support response');
  assert.equal((await db.query('SELECT count(*)::int n FROM support_ticket_messages WHERE ticket_id=$1',[ticket.id])).rows[0].n,2);
  await request(other.sid,'/support/tickets/'+ticket.id,'GET',undefined,404);
  await request(support.sid,path+'/status','POST',{status:'invalid'},400);
  for(const status of ['closed','open']){await request(support.sid,path+'/status','POST',{status});detail=await request(owner.sid,'/support/tickets/'+ticket.id);assert.equal(detail.ticket.status,status);}
 });
 await check('Review consent, moderation, edit, withdrawal and resubmission preserve one row',async()=>{
  const body={rating:5,text:'Synthetic review for audit only',consent:true};
  await request(owner.sid,'/reviews','POST',{...body,consent:false},400);
  await request(owner.sid,'/reviews','POST',{...body,rating:0},400);
  const {review}=await request(owner.sid,'/reviews','POST',body,201),path='/admin/reviews/'+review.id;
  const published=async()=> (await request(null,'/public/testimonials')).testimonials.some(x=>x.id===review.id);
  assert.equal(await published(),false);
  for(const sid of [owner.sid,support.sid,content.sid,auditor.sid])await request(sid,path+'/approve','POST',{},403);
  await request(moderator.sid,path+'/approve','POST',{});assert.equal(await published(),true);
  await request(owner.sid,'/reviews/me','PATCH',{text:'Edited synthetic review'});assert.equal(await published(),false);
  await request(moderator.sid,path+'/reject','POST',{reason:''},400);
  await request(moderator.sid,path+'/reject','POST',{reason:'Synthetic moderation test'});
  await request(owner.sid,'/reviews','POST',body);
  await request(moderator.sid,path+'/approve','POST',{});await request(moderator.sid,path+'/hide','POST',{});assert.equal(await published(),false);
  await request(owner.sid,'/reviews/me','DELETE');assert.equal((await request(owner.sid,'/reviews/me')).review.status,'withdrawn');
  await request(owner.sid,'/reviews','POST',body);assert.equal((await request(owner.sid,'/reviews/me')).review.status,'pending');
  assert.equal((await db.query('SELECT count(*)::int n FROM testimonials WHERE user_id=$1',[owner.id])).rows[0].n,1);
  assert.equal((await request(other.sid,'/reviews/me')).review,null);
 });
 await check('Concurrent first review submissions succeed without duplicate rows',async()=>{
  const rs=await Promise.all(Array.from({length:8},()=>api(other.sid,'/reviews','POST',{rating:4,text:'Concurrent synthetic review',consent:true})));
  assert.ok(rs.every(r=>[200,201].includes(r.status)),JSON.stringify(rs.map(r=>r.status)));
  assert.equal((await db.query('SELECT count(*)::int n FROM testimonials WHERE user_id=$1',[other.id])).rows[0].n,1);
 });
 await check('Suspension, reactivation and stored session revocation persist and gate access',async()=>{
  const path='/admin/users/'+owner.id,body={reason:'Synthetic audit only'};
  await request(support.sid,path+'/suspend','POST',body,403);
  await request(u.admin.sid,path+'/suspend','POST',{reason:''},400);
  await request(u.admin.sid,path+'/suspend','POST',body);
  const denied=await api(owner.sid,'/profile');assert.ok([401,403].includes(denied.status));
  assert.equal((await db.query('SELECT status FROM admin_user_status WHERE user_id=$1',[owner.id])).rows[0].status,'suspended');
  await request(u.admin.sid,path+'/reactivate','POST',body);await request(owner.sid,'/profile');
  const result=await request(support.sid,path+'/revoke-sessions','POST',body);assert.equal(result.revokedSessions,1);
  await request(owner.sid,'/profile','GET',undefined,401);
  assert.equal((await db.query('SELECT count(*)::int n FROM sessions WHERE sid=$1',[owner.sid])).rows[0].n,0);
 });
}finally{await db.end();}
if(checks.some(c=>c.status==='failed'))process.exitCode=1;
