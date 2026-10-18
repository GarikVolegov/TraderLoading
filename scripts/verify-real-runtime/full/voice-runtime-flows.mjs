import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {api,connect,run,auditExecutionId,setAuditScenario} from './env.mjs';
const label=process.argv[2]||'after';assert.match(label,/^[a-z0-9-]+$/);
const db=await connect(),tag='audit_voice_'+Date.now(),actors=['owner','peer','outsider'].map(k=>({id:tag+'_'+k,sid:randomUUID()})),[owner,peer,outsider]=actors;
const report={runId:run.runId,executionId:auditExecutionId,label,mode:'Actual isolated production API/database; synthetic SDP strings, no microphone or WebRTC audio proof',checks:[]},output=run.output+'/voice-runtime-'+label+'.json';let communityId,voice,text;
async function ok(sid,path,method='GET',body,status=200){const r=await api(sid,path,method,body);assert.equal(r.status,status,path);return r.data;}
async function check(name,fn){setAuditScenario(name);try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(error){report.checks.push({name,status:'failed',error:error.message});console.log('FAIL',name,error.message.slice(0,300));}writeFileSync(output,JSON.stringify(report,null,2));}
async function count(){return(await db.query('SELECT count(*)::int n FROM signals WHERE from_id=ANY($1::text[])',[actors.map(a=>a.id)])).rows[0].n;}
try{
 for(const u of actors){await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[u.id,u.id]);await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status) VALUES($1,'pro','active')",[u.id]);await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[u.sid,{user:{id:u.id},access_token:'isolated-local-session'},new Date(Date.now()+86400000)]);}
 communityId=(await ok(owner.sid,'/community','POST',{name:tag,isPublic:true},201)).id;
 await ok(peer.sid,'/community/'+communityId+'/join','POST',{});
 const c=await ok(owner.sid,'/community/'+communityId);voice=c.channels.find(c=>c.type==='voice').id;text=c.channels.find(c=>c.type==='text').id;
 const path='/community/voice/'+voice;
 await check('Concurrent voice join has one presence per user and stale heartbeat is excluded',async()=>{await ok(null,path+'/join','POST',{},401);const rs=await Promise.all(Array.from({length:8},()=>api(owner.sid,path+'/join','POST',{})));assert.ok(rs.every(r=>r.status===200));await ok(peer.sid,path+'/join','POST',{});assert.equal((await db.query('SELECT count(*)::int n FROM voice_presence WHERE channel_id=$1 AND user_id=$2',[voice,owner.id])).rows[0].n,1);await db.query("UPDATE voice_presence SET last_ping=now()-interval '20 seconds' WHERE channel_id=$1 AND user_id=$2",[voice,peer.id]);assert.ok(!(await ok(owner.sid,path+'/presence')).some(p=>p.userId===peer.id));await ok(peer.sid,path+'/ping','POST',{});assert.ok((await ok(owner.sid,path+'/presence')).some(p=>p.userId===peer.id));});
 await check('Rejoining an existing presence renews its observed join epoch for peer reconnection',async()=>{
  await db.query("UPDATE voice_presence SET joined_at=now()-interval '1 day' WHERE channel_id=$1 AND user_id=$2",[voice,peer.id]);
  await ok(peer.sid,path+'/join','POST');const present=(await ok(owner.sid,path+'/presence')).find(p=>p.userId===peer.id);
  assert.ok(present);assert.ok(new Date(present.joinedAt).getTime()>Date.now()-3000,'Repeated join must renew the timestamp, not retain yesterday');
 });
 await check('Voice access rejects outsiders and text channels without queuing a signal',async()=>{for(const tail of ['presence','signals','ping','join','signal'])await ok(outsider.sid,path+'/'+tail,['ping','join','signal'].includes(tail)?'POST':'GET',tail==='signal'?{to:owner.id,type:'offer',data:'synthetic'}:undefined,403);await ok(owner.sid,'/community/voice/'+text+'/signals','GET',undefined,400);});
 await check('Invalid voice channel IDs cannot alias an existing channel or create a separate signaling scope',async()=>{const failures=[];for(const id of [voice+'tail','0','-1','2147483648','abc'])for(const [method,tail]of [['POST','join'],['POST','ping'],['DELETE','leave'],['GET','presence'],['POST','signal'],['GET','signals']]){const r=await api(owner.sid,'/community/voice/'+id+'/'+tail,method,tail==='signal'?{to:peer.id,type:'offer',data:'synthetic'}:undefined);if(r.status!==400)failures.push({id,tail,status:r.status});}assert.deepEqual(failures,[]);});
 await check('Missing malformed and oversized voice signals fail without database writes',async()=>{const before=await count(),failures=[];for(const body of [undefined,[],{to:peer.id,type:'arbitrary',data:'x'},{to:[peer.id],type:'offer',data:'x'},{to:peer.id,type:'offer',data:{}},{to:peer.id,type:'offer',data:'x'.repeat(131073)}]){const r=await api(owner.sid,path+'/signal','POST',body);if(r.status!==400)failures.push({shape:body===undefined?'missing':Array.isArray(body)?'array':Object.keys(body).join(','),status:r.status});}assert.deepEqual(failures,[]);assert.equal(await count(),before);});
 await check('Signaling rejects a recipient outside the community without storing private SDP',async()=>{const before=await count();await ok(owner.sid,path+'/signal','POST',{to:outsider.id,type:'offer',data:'synthetic-private-sdp'},404);assert.equal(await count(),before);});
 await check('Canonical signaling is delivered once under simultaneous polling and expired signals are discarded',async()=>{await db.query('DELETE FROM signals WHERE from_id=ANY($1::text[])',[actors.map(a=>a.id)]);await ok(owner.sid,path+'/signal','POST',{to:peer.id,type:'offer',data:tag});const responses=await Promise.all(Array.from({length:8},()=>api(peer.sid,path+'/signals')));assert.ok(responses.every(r=>r.status===200));assert.equal(responses.flatMap(r=>r.data.signals).filter(s=>s.data===tag).length,1);await ok(owner.sid,path+'/signal','POST',{to:peer.id,type:'ice',data:'expired-fixture'});await db.query("UPDATE signals SET created_at=now()-interval '31 seconds' WHERE from_id=$1",[owner.id]);assert.deepEqual((await ok(peer.sid,path+'/signals')).signals,[]);});
 await check('Join and leave remove prior negotiation signals atomically and database faults preserve retry state',async()=>{
  await ok(owner.sid,path+'/signal','POST',{to:peer.id,type:'offer',data:'prior-negotiation'});await ok(peer.sid,path+'/leave','DELETE');assert.equal(await count(),0,'Leaving must discard related queued negotiations');await ok(peer.sid,path+'/join','POST');await ok(owner.sid,path+'/signal','POST',{to:peer.id,type:'offer',data:'prior-join'});
  await db.query(`CREATE FUNCTION audit_voice_insert_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id='${peer.id}' THEN RAISE EXCEPTION 'Synthetic voice join fault'; END IF; RETURN NEW; END $$`);await db.query('CREATE TRIGGER audit_voice_insert BEFORE INSERT ON voice_presence FOR EACH ROW EXECUTE FUNCTION audit_voice_insert_fault()');
  try{await ok(peer.sid,path+'/join','POST',undefined,500);assert.equal(await count(),1,'Failed join must roll back signal cleanup');assert.equal((await db.query('SELECT count(*)::int n FROM voice_presence WHERE channel_id=$1 AND user_id=$2',[voice,peer.id])).rows[0].n,1);}finally{await db.query('DROP TRIGGER IF EXISTS audit_voice_insert ON voice_presence');await db.query('DROP FUNCTION IF EXISTS audit_voice_insert_fault()');}
  await ok(peer.sid,path+'/join','POST');assert.equal(await count(),0,'Successful join discards the previous negotiation');await ok(owner.sid,path+'/signal','POST',{to:peer.id,type:'offer',data:'before-leave-fault'});
  await db.query(`CREATE FUNCTION audit_voice_delete_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.user_id='${peer.id}' THEN RAISE EXCEPTION 'Synthetic voice leave fault'; END IF; RETURN OLD; END $$`);await db.query('CREATE TRIGGER audit_voice_delete BEFORE DELETE ON voice_presence FOR EACH ROW EXECUTE FUNCTION audit_voice_delete_fault()');
  try{await ok(peer.sid,path+'/leave','DELETE',undefined,500);assert.equal(await count(),1);assert.equal((await db.query('SELECT count(*)::int n FROM voice_presence WHERE channel_id=$1 AND user_id=$2',[voice,peer.id])).rows[0].n,1);}finally{await db.query('DROP TRIGGER IF EXISTS audit_voice_delete ON voice_presence');await db.query('DROP FUNCTION IF EXISTS audit_voice_delete_fault()');}
  await ok(peer.sid,path+'/leave','DELETE');assert.equal(await count(),0);await ok(peer.sid,path+'/join','POST');
 });
 await check('Removed member cannot renew poll or send but can idempotently release their own presence',async()=>{await ok(owner.sid,'/community/'+communityId+'/members/'+peer.id,'DELETE');for(const [method,tail]of [['POST','ping'],['GET','signals'],['POST','signal']])await ok(peer.sid,path+'/'+tail,method,tail==='signal'?{to:owner.id,type:'offer',data:'synthetic'}:undefined,403);assert.ok(!(await ok(owner.sid,path+'/presence')).some(p=>p.userId===peer.id));for(let n=0;n<2;n++)await ok(peer.sid,path+'/leave','DELETE');assert.equal((await db.query('SELECT count(*)::int n FROM voice_presence WHERE channel_id=$1 AND user_id=$2',[voice,peer.id])).rows[0].n,0);});
 await check('Voice channel deletion removes its queued negotiations',async()=>{
  await ok(peer.sid,'/community/'+communityId+'/join','POST');
  const extra=await ok(owner.sid,'/community/'+communityId+'/channels','POST',{name:'Audit voice deletion',type:'voice'},201);
  await ok(owner.sid,'/community/voice/'+extra.id+'/signal','POST',{to:peer.id,type:'offer',data:'delete-channel-negotiation'});
  assert.equal((await db.query('SELECT count(*)::int n FROM signals WHERE scope=$1',['voice:'+extra.id])).rows[0].n,1);
  await ok(owner.sid,'/community/channels/'+extra.id,'DELETE');
  assert.equal((await db.query('SELECT count(*)::int n FROM signals WHERE scope=$1',['voice:'+extra.id])).rows[0].n,0,'Deleted channel must not leave queued SDP');
 });
 await check('Community deletion removes queued negotiations of its voice channels',async()=>{
  await ok(owner.sid,path+'/signal','POST',{to:peer.id,type:'offer',data:'delete-community-negotiation'});
  assert.equal((await db.query('SELECT count(*)::int n FROM signals WHERE scope=$1',['voice:'+voice])).rows[0].n,1);
  await ok(owner.sid,'/community/'+communityId,'DELETE');communityId=null;
  assert.equal((await db.query('SELECT count(*)::int n FROM signals WHERE scope=$1',['voice:'+voice])).rows[0].n,0,'Deleted community must not leave queued SDP');
 });
}finally{
 if(communityId)await api(owner.sid,'/community/'+communityId,'DELETE');
 await db.query('DELETE FROM signals WHERE from_id=ANY($1::text[]) OR recipient_id=ANY($1::text[])',[actors.map(a=>a.id)]);
 await db.query('DELETE FROM sessions WHERE sid=ANY($1::text[])',[actors.map(a=>a.sid)]);
 for(const table of ['login_access','admin_user_subscriptions','profile'])await db.query('DELETE FROM '+table+' WHERE user_id=ANY($1::text[])',[actors.map(a=>a.id)]);
 await db.end();writeFileSync(output,JSON.stringify(report,null,2));
}
if(report.checks.some(c=>c.status==='failed'))process.exitCode=1;
