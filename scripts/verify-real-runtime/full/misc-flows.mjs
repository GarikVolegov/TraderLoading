import {auditExecutionId as executionId} from './env.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {api,connect,run,setAuditScenario} from './env.mjs';

const db=await connect(), label=process.argv[2]||'after';
assert.match(label,/^(baseline|after)$/);
const report={runId:run.runId,executionId,label,startedAt:new Date().toISOString(),checks:[]};
const actors=[], tag='audit_misc_'+Date.now();
async function actor(name){
 const id=tag+'_'+name,sid=randomBytes(32).toString('hex');
 await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[sid,{user:{id,email:null},access_token:'isolated-local-session'},new Date(Date.now()+86400000).toISOString()]);
 await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[id,id]);
 await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status) VALUES($1,'pro','active')",[id]);
 const a={id,sid};actors.push(a);return a;
}
const a=await actor('a'), b=await actor('b'), outsider=await actor('outsider');
async function ok(sid,path,method='GET',body,status=200){const r=await api(sid,path,method,body);assert.equal(r.status,status,method+' '+path+': '+JSON.stringify(r.data).slice(0,140));return r.data;}
async function check(name,fn){setAuditScenario(name);try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,250));}writeFileSync(run.output+'/misc-flows-'+label+'.json',JSON.stringify(report,null,2));}
const keys={p256dh:Buffer.concat([Buffer.from([4]),randomBytes(64)]).toString('base64url'),auth:randomBytes(16).toString('base64url')};
const endpoint=(name)=>'https://example.com/push/'+tag+'/'+name;
try{
 await check('Production anonymous utility routes require authentication',async()=>{for(const p of ['/quotes','/quotes/random','/push/preferences','/push/vapid-public-key','/referral','/news/preferences','/reviews/prompt-status','/routines/competition','/account/export'])await ok(null,p,'GET',undefined,401);});
 await check('Quotes CRUD persists trimmed content and remains private',async()=>{
  const q=await ok(a.sid,'/quotes','POST',{text:'Synthetic private quote',author:'Audit'},201);
  assert.ok((await ok(a.sid,'/quotes')).some(x=>x.id===q.id));assert.ok(!(await ok(b.sid,'/quotes')).some(x=>x.id===q.id));
  await ok(b.sid,'/quotes/'+q.id,'PUT',{text:'Other'},404);await ok(b.sid,'/quotes/'+q.id,'DELETE',undefined,404);
  await ok(a.sid,'/quotes/'+q.id,'PUT',{text:'Updated synthetic quote',author:''});
  const saved=(await ok(a.sid,'/quotes')).find(x=>x.id===q.id);assert.equal(saved.text,'Updated synthetic quote');assert.equal(saved.author,null);
  assert.equal((await ok(a.sid,'/quotes/random')).id,q.id);await ok(a.sid,'/quotes/'+q.id,'DELETE');assert.ok(!(await ok(a.sid,'/quotes')).some(x=>x.id===q.id));assert.ok((await ok(a.sid,'/quotes/random')).id<0);
 });
 await check('Quotes reject invalid text author and identifiers without mutation',async()=>{
  const before=(await ok(a.sid,'/quotes')).length;
  for(const payload of [{text:'   '},{text:{unsafe:'object'}},{text:'Valid',author:{invalid:true}}])await ok(a.sid,'/quotes','POST',payload,400);
  await ok(a.sid,'/quotes/not-a-number','PUT',{text:'Valid'},400);await ok(a.sid,'/quotes/-1','DELETE',undefined,400);
  const q=await ok(a.sid,'/quotes','POST',{text:'Keep this quote'},201);await ok(a.sid,'/quotes/'+q.id,'PUT',{text:''},400);assert.equal((await ok(a.sid,'/quotes')).find(x=>x.id===q.id).text,q.text);await ok(a.sid,'/quotes/'+q.id,'DELETE');assert.equal((await ok(a.sid,'/quotes')).length,before);
 });
 await check('Quote edit racing with deletion returns missing record instead of server error',async()=>{
  const q=await ok(a.sid,'/quotes','POST',{text:'Concurrent disposable quote'},201);await db.query('BEGIN');await db.query('SELECT id FROM quotes WHERE id=$1 FOR UPDATE',[q.id]);
  const remove=api(a.sid,'/quotes/'+q.id,'DELETE');await new Promise(r=>setTimeout(r,100));const edit=api(a.sid,'/quotes/'+q.id,'PUT',{text:'Late edit'});
  try{await new Promise(r=>setTimeout(r,100));}finally{await db.query('COMMIT');}
  assert.equal((await remove).status,200);assert.equal((await edit).status,404);assert.equal((await db.query('SELECT count(*)::int n FROM quotes WHERE id=$1',[q.id])).rows[0].n,0);
 });
 await check('Push preferences persist partial updates and preserve another user',async()=>{
  const defaults=await ok(b.sid,'/push/preferences');await ok(a.sid,'/settings','PUT',{language:'de'});
  const changed=await ok(a.sid,'/push/preferences','PUT',{messages:false,macroEvents:false});assert.equal(changed.messages,false);assert.equal(changed.sessions,true);assert.equal((await ok(a.sid,'/push/preferences')).macroEvents,false);assert.deepEqual(await ok(b.sid,'/push/preferences'),defaults);assert.equal((await ok(a.sid,'/settings')).language,'de');assert.equal((await ok(a.sid,'/push/vapid-public-key')).publicKey,null);
 });
 await check('Concurrent first settings reads create one row without server errors',async()=>{
  const fresh=await actor('first-settings');const responses=await Promise.all(Array.from({length:8},()=>api(fresh.sid,'/settings')));assert.ok(responses.every(x=>x.status===200),JSON.stringify(responses.map(x=>x.status)));assert.equal((await db.query('SELECT count(*)::int n FROM user_settings WHERE user_id=$1',[fresh.id])).rows[0].n,1);
 });
 await check('Push preferences reject invalid booleans and unknown fields',async()=>{
  const before=await ok(a.sid,'/push/preferences');for(const p of [{messages:'false'},{goals:null},{arbitrary:'stored'},{__language:'xx'}])await ok(a.sid,'/push/preferences','PUT',p,400);assert.deepEqual(await ok(a.sid,'/push/preferences'),before);
 });
 await check('Concurrent push language and risk guard updates preserve every independent field',async()=>{
  await ok(a.sid,'/push/preferences','PUT',{messages:true,goals:true});await ok(a.sid,'/settings','PUT',{language:'de',riskGuard:{maxDailyTrades:9}});
  await db.query('BEGIN');await db.query('SELECT id FROM user_settings WHERE user_id=$1 FOR UPDATE',[a.id]);
  const pending=[api(a.sid,'/push/preferences','PUT',{messages:false}),api(a.sid,'/push/preferences','PUT',{goals:false}),api(a.sid,'/settings','PUT',{language:'fr',riskGuard:{maxDailyTrades:3}})];
  try{await new Promise(r=>setTimeout(r,150));}finally{await db.query('COMMIT');}
  const responses=await Promise.all(pending);assert.ok(responses.every(x=>x.status===200));const prefs=await ok(a.sid,'/push/preferences'),settings=await ok(a.sid,'/settings');assert.equal(prefs.messages,false);assert.equal(prefs.goals,false);assert.equal(settings.language,'fr');assert.equal(settings.riskGuard.maxDailyTrades,3);
 });
 await check('Push endpoint registration cannot transfer another user subscription',async()=>{
  const ep=endpoint('ownership');await ok(a.sid,'/push/subscribe','POST',{endpoint:ep,keys});await ok(a.sid,'/push/subscribe','POST',{endpoint:ep,keys});await ok(b.sid,'/push/subscribe','POST',{endpoint:ep,keys},409);
  const rows=(await db.query('SELECT user_id FROM push_subscriptions WHERE endpoint=$1',[ep])).rows;assert.equal(rows.length,1);assert.equal(rows[0].user_id,a.id);
 });
 await check('Push unsubscribe only removes the current user endpoint',async()=>{
  const ep=endpoint('deletion');await ok(a.sid,'/push/subscribe','POST',{endpoint:ep,keys});await ok(b.sid,'/push/unsubscribe','DELETE',{endpoint:ep});assert.equal((await db.query('SELECT count(*)::int n FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2',[ep,a.id])).rows[0].n,1);
  await ok(a.sid,'/push/unsubscribe','DELETE',{endpoint:ep});assert.equal((await db.query('SELECT count(*)::int n FROM push_subscriptions WHERE endpoint=$1',[ep])).rows[0].n,0);await ok(a.sid,'/push/unsubscribe','DELETE',{endpoint:ep});
 });
 await check('Push registration rejects internal URLs insecure schemes and malformed keys',async()=>{
  for(const ep of ['http://example.com/push','https://127.0.0.1/push','https://169.254.169.254/push','https://[::1]/push','https://user:pass@example.com/push'])await ok(a.sid,'/push/subscribe','POST',{endpoint:ep,keys},400);
  await ok(a.sid,'/push/subscribe','POST',{endpoint:endpoint('keys'),keys:{p256dh:'not-a-key',auth:'bad'}},400);await ok(a.sid,'/push/unsubscribe','DELETE',{endpoint:{}},400);
 });
 await check('News preferences return the same normalized values that persist',async()=>{
  const saved=await ok(a.sid,'/news/preferences','PUT',{keywords:['  gold  ','',' rates '],profile:'Synthetic research profile'});assert.deepEqual(saved.keywords,['gold','rates']);assert.deepEqual(await ok(a.sid,'/news/preferences'),saved);assert.deepEqual(await ok(b.sid,'/news/preferences'),{keywords:[],profile:''});
  const bounded=await ok(a.sid,'/news/preferences','PUT',{keywords:Array.from({length:45},(_,i)=>' keyword-'+i+' '),profile:'x'.repeat(2300)});assert.equal(bounded.keywords.length,40);assert.equal(bounded.profile.length,2000);assert.deepEqual(await ok(a.sid,'/news/preferences'),bounded);
 });
 await check('News preferences reject invalid input without erasing existing selection',async()=>{
  const before=await ok(a.sid,'/news/preferences');for(const p of [{keywords:'gold',profile:'Test'},{keywords:[{}],profile:'Test'},{keywords:[],profile:123}])await ok(a.sid,'/news/preferences','PUT',p,400);assert.deepEqual(await ok(a.sid,'/news/preferences'),before);
 });
 await check('News feedback upsert remains per user and accepts all three votes',async()=>{
  const articleKey=tag+'-news';for(const vote of [1,-1,0]){await ok(a.sid,'/news/feedback','POST',{articleKey,source:'synthetic',vote});assert.equal((await db.query('SELECT vote FROM news_feedback WHERE user_id=$1 AND article_key=$2',[a.id,articleKey])).rows[0].vote,vote);}
  await ok(b.sid,'/news/feedback','POST',{articleKey,source:'other',vote:1});assert.equal((await db.query('SELECT count(*)::int n FROM news_feedback WHERE article_key=$1',[articleKey])).rows[0].n,2);
 });
 await check('News feedback rejects invalid vote and empty key instead of storing neutral',async()=>{for(const p of [{articleKey:tag+'-invalid',source:'synthetic',vote:2},{articleKey:'   ',source:'synthetic',vote:1},{articleKey:tag+'-invalid',source:3,vote:1}])await ok(a.sid,'/news/feedback','POST',p,400);assert.equal((await db.query('SELECT count(*)::int n FROM news_feedback WHERE article_key=$1',[tag+'-invalid'])).rows[0].n,0);});
 await check('Referral codes are stable private and refuse self invalid or repeat attribution',async()=>{
  const r=await ok(a.sid,'/referral');assert.equal((await ok(a.sid,'/referral')).code,r.code);assert.notEqual((await ok(b.sid,'/referral')).code,r.code);assert.match(r.code,/^[A-Z0-9]{8}$/);
  assert.equal((await ok(a.sid,'/referral/attribute','POST',{code:r.code})).attributed,false);assert.equal((await ok(b.sid,'/referral/attribute','POST',{code:'INVALID-CODE'})).attributed,false);await ok(b.sid,'/referral/attribute','POST',{},400);
  const before=(await db.query('SELECT xp FROM profile WHERE user_id=$1',[a.id])).rows[0].xp;
  const calls=await Promise.all(Array.from({length:8},()=>api(b.sid,'/referral/attribute','POST',{code:r.code.toLowerCase()})));assert.ok(calls.every(x=>x.status===200));assert.equal(calls.filter(x=>x.data.attributed).length,1);assert.equal((await db.query('SELECT xp FROM profile WHERE user_id=$1',[a.id])).rows[0].xp-before,r.rewardXp);assert.equal((await ok(a.sid,'/referral')).referrals,1);assert.equal((await ok(b.sid,'/referral')).referrals,0);
 });
 await check('Concurrent distinct referrals respect the five rewards daily cap',async()=>{
  const ref=await actor('cap'),r=await ok(ref.sid,'/referral'),invitees=[];for(let i=0;i<12;i++)invitees.push(await actor('cap'+i));
  const responses=await Promise.all(invitees.map(u=>api(u.sid,'/referral/attribute','POST',{code:r.code})));assert.ok(responses.every(x=>x.status===200));const q=(await db.query('SELECT count(*)::int n FROM referrals WHERE referrer_user_id=$1 AND rewarded_at IS NOT NULL',[ref.id])).rows[0];assert.equal(q.n,5);assert.equal((await db.query('SELECT xp FROM profile WHERE user_id=$1',[ref.id])).rows[0].xp,5*r.rewardXp);assert.equal((await ok(ref.sid,'/referral')).referrals,12);
 });
 await check('Referral credit failure rolls back attribution and allows retry',async()=>{
  const ref=await actor('rollback'),invitee=await actor('retry'),r=await ok(ref.sid,'/referral');
  try{
   await db.query(`CREATE OR REPLACE FUNCTION audit_misc_reject_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id='${ref.id}' AND NEW.xp<>OLD.xp THEN RAISE EXCEPTION 'synthetic referral failure'; END IF; RETURN NEW; END $$`);await db.query('CREATE TRIGGER audit_misc_reject_credit BEFORE UPDATE ON profile FOR EACH ROW EXECUTE FUNCTION audit_misc_reject_credit()');
   await ok(invitee.sid,'/referral/attribute','POST',{code:r.code},500);assert.equal((await db.query('SELECT count(*)::int n FROM referrals WHERE referred_user_id=$1',[invitee.id])).rows[0].n,0);
  }finally{await db.query('DROP TRIGGER IF EXISTS audit_misc_reject_credit ON profile');await db.query('DROP FUNCTION IF EXISTS audit_misc_reject_credit()');}
  assert.equal((await ok(invitee.sid,'/referral/attribute','POST',{code:r.code})).attributed,true);assert.equal((await db.query('SELECT xp FROM profile WHERE user_id=$1',[ref.id])).rows[0].xp,r.rewardXp);
 });
 await check('Review prompt snooze and opt-out persist without affecting another account',async()=>{
  assert.equal((await ok(a.sid,'/reviews/prompt-status')).reason,'below_threshold');const t=Date.now(),s=await ok(a.sid,'/reviews/prompt-status/snooze','POST',{days:7});assert.ok(Math.abs(Date.parse(s.snoozedUntil)-t-7*86400000)<5000);assert.equal((await ok(a.sid,'/reviews/prompt-status?signal=coach')).reason,'snoozed');assert.equal((await ok(b.sid,'/reviews/prompt-status')).reason,'below_threshold');await ok(a.sid,'/reviews/prompt-status/opt-out','POST',{});assert.equal((await ok(a.sid,'/reviews/prompt-status')).reason,'opted_out');assert.equal((await db.query('SELECT opted_out FROM review_prompt_state WHERE user_id=$1',[a.id])).rows[0].opted_out,true);
 });
 await check('Health liveness readiness and status show healthy isolated database',async()=>{const live=await ok(null,'/healthz');assert.equal(live.status,'ok');assert.equal(live.service,'api');for(const p of ['/readyz','/status']){const s=await ok(null,p);assert.equal(s.status,'ok');assert.equal(s.checks.database.status,'ok');assert.ok(s.checks.database.latencyMs>=0);assert.equal(s.checks.redis,undefined);assert.ok(Number.isFinite(Date.parse(s.timestamp)));assert.ok(!JSON.stringify(s).includes('trader:trader'));}});
 await check('Account disclosures and export match ownership and omit push secrets',async()=>{
  const deletion=await ok(null,'/account/deletion-disclosure'),exp=await ok(null,'/account/export-disclosure');assert.equal(deletion.confirmationPhrase,'ELIMINA');assert.ok(deletion.deletedData.length);assert.equal(exp.format,'JSON');assert.ok(exp.excludedData.length);
  await ok(a.sid,'/quotes','POST',{text:tag+'-export-A'},201);await ok(b.sid,'/quotes','POST',{text:tag+'-export-B'},201);const data=await ok(a.sid,'/account/export');assert.equal(data.userId,a.id);assert.equal(data.formatVersion,1);assert.ok(JSON.stringify(data.data).includes(tag+'-export-A'));assert.ok(!JSON.stringify(data.data).includes(tag+'-export-B'));for(const s of data.data.pushSubscriptions){assert.equal(s.p256dh,undefined);assert.equal(s.auth,undefined);}
 });
 await check('Routine completion competition uses Rome date and accepted friends only',async()=>{
  await db.query("INSERT INTO friendships(user_id,friend_id,status) VALUES($1,$2,'accepted'),($1,$3,'pending')",[a.id,b.id,outsider.id]);
  const c=await ok(a.sid,'/routines/completions','POST',{routineId:tag,routineTitle:'Audit morning',template:'morning',answers:{emotion:'calm',risk:false,focus:0,notes:' ',list:[]}},201);assert.equal(c.qualityScore,60);const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());assert.equal(c.completionDate,date);const q=(await db.query('SELECT * FROM routine_completions WHERE id=$1',[c.id])).rows[0];assert.equal(q.user_id,a.id);assert.equal(q.completion_date,date);
  await ok(b.sid,'/routines/completions','POST',{routineId:tag,routineTitle:'Audit evening',template:'evening',answers:{note:'Ready'}},201);const rows=await ok(a.sid,'/routines/competition');assert.deepEqual(new Set(rows.map(x=>x.userId)),new Set([a.id,b.id]));const self=rows.find(x=>x.isCurrentUser);assert.equal(self.totalCompletions,1);assert.equal(self.completedToday,true);assert.equal(self.currentStreakDays,1);assert.equal(self.score,115);assert.ok(!(await ok(outsider.sid,'/routines/competition')).some(x=>x.userId===a.id));
  const before=(await db.query('SELECT count(*)::int n FROM routine_completions WHERE user_id=$1',[a.id])).rows[0].n;await ok(a.sid,'/routines/completions','POST',{routineId:'',routineTitle:'',template:'invalid'},400);assert.equal((await db.query('SELECT count(*)::int n FROM routine_completions WHERE user_id=$1',[a.id])).rows[0].n,before);
 });
}finally{
 // Test subscriptions must never be delivered to a provider. The isolated API
 // has no VAPID keys; remove synthetic endpoints as a second containment measure.
 await db.query('DELETE FROM push_subscriptions WHERE user_id=ANY($1::text[])',[actors.map(x=>x.id)]);
 await db.end();report.finishedAt=new Date().toISOString();writeFileSync(run.output+'/misc-flows-'+label+'.json',JSON.stringify(report,null,2));
}
console.log('TOTAL',report.checks.length,'FAILED',report.checks.filter(x=>x.status==='failed').length);if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
