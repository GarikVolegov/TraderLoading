import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {root,run,base,database,connect,auditExecutionId} from './env.mjs';
import {installResponseProvenance,responseProvenance} from './response-provenance.mjs';
process.env.VERIFY_BASE_URL=base;process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {ensureTestUser,signIn,completeOnboarding,dismiss,apiFromPage}=await import('../../verify-usability/lib/common.mjs');
const label=process.argv[2]||'after';assert.match(label,/^[a-z0-9-]+$/);
const out=run.output+'/browser-voice-'+label;mkdirSync(out,{recursive:true});
const frontendBuild=JSON.parse(readFileSync(root+'.local-logs/runtime-api-process.json')).frontendBuild?.sha256;
const db=await connect(),req=createRequire(root+'artifacts/trader-dashboard/package.json');
const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath(),args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const report={runId:run.runId,executionId:auditExecutionId,label,frontendBuild,mode:'Real Clerk Development and isolated production API/database; Chromium synthetic microphone, host-only WebRTC peers, explicit HTTP outage fixtures; no real microphone, users or TURN service',checks:[],requests:[],errors:[],voiceWarnings:[]},people=[];
let lastAnswer;
let scenario,communityId,voice;
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
async function check(name,fn){if(process.env.AUDIT_SCENARIO_FILTER&&!name.includes(process.env.AUDIT_SCENARIO_FILTER))return;scenario=name;try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message.slice(0,1600)});console.log('FAIL',name,e.message.slice(0,300));for(const p of people)await p.page.screenshot({path:out+'/'+p.role+'-failure-'+report.checks.length+'.png'}).catch(()=>{});}flush();}
async function go(p){await p.page.goto(base+`/chat?t=conversazioni&community=${communityId}&channel=${voice}`,{waitUntil:'domcontentloaded'});await p.page.getByRole('button',{name:'Entra nel canale',exact:true}).waitFor({timeout:30000});await p.page.waitForTimeout(700);await dismiss(p.page);}
async function join(p){await p.page.getByRole('button',{name:'Entra nel canale',exact:true}).click();await p.page.getByText(/^Connesso in /).filter({visible:true}).first().waitFor();}
async function stats(p){return await p.page.evaluate(async()=>{const result=[];for(const pc of window.__auditVoicePeers||[]){let bytes=0;for(const r of(await pc.getStats()).values())if(r.type==='inbound-rtp'&&r.kind==='audio')bytes+=r.bytesReceived||0;result.push({state:pc.connectionState,signaling:pc.signalingState,bytes});}return result;});}
async function until(fn,ms=15000,phase='Expected voice state'){const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await new Promise(r=>setTimeout(r,250));}assert.fail(phase+' did not settle within '+ms+'ms');}
try{
 for(const role of ['owner','peer']){
  const email='verify.voice.'+role+'+clerk_test@example.com',id=await ensureTestUser(email);
  await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated voice audit') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[id]);
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block',permissions:['microphone']});
  await ctx.addInitScript(()=>{
   localStorage.setItem('tl_language','it');localStorage.setItem('tl_cookie_consent_v1','declined');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');
   window.__auditVoicePeers=[];window.__auditVoiceStreams=[];
   const NativePC=window.RTCPeerConnection;window.RTCPeerConnection=class extends NativePC{constructor(config){super({...config,iceServers:[]});window.__auditVoicePeers.push(this);}};
   const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await get(constraints);window.__auditVoiceStreams.push(stream);return stream;};
  });
  await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});const page=await ctx.newPage();page.setDefaultTimeout(10000);installResponseProvenance(page);
  page.on('pageerror',e=>report.errors.push({scenario,error:e.message}));page.on('response',r=>{if(r.url().startsWith(base+'/api/'))report.requests.push({scenario,path:new URL(r.url()).pathname,method:r.request().method(),status:r.status(),provenance:responseProvenance(r)});});
  page.on('console',m=>{if(m.type()==='warning'&&m.text().startsWith('[community voice'))report.voiceWarnings.push({scenario,role,message:m.text().slice(0,600)});});
  page.on('request',r=>{if(r.method()==='POST'&&/\/community\/voice\/\d+\/signal$/.test(new URL(r.url()).pathname)){try{const body=r.postDataJSON();if(body.type==='answer')lastAnswer={sender:role,body};}catch{/* Requests without JSON do not represent a WebRTC answer. */}}});
  people.push({role,id,ctx,page});await signIn(page,email);await completeOnboarding(page,['EURUSD']);
 }
 const [owner,peer]=people;
 const created=await apiFromPage(owner.page,'/api/community',{method:'POST',body:JSON.stringify({name:'Audit voice UI '+Date.now(),isPublic:true})});assert.equal(created.status,201);communityId=created.body.id;
 report.fixture={communityId,ownerId:owner.id,peerId:peer.id};flush();
 assert.equal((await apiFromPage(peer.page,'/api/community/'+communityId+'/join',{method:'POST'})).status,200);
 voice=(await apiFromPage(owner.page,'/api/community/'+communityId)).body.channels.find(c=>c.type==='voice').id;
 await check('Failed voice join stops the synthetic microphone shows an error and permits retry',async()=>{
  await go(owner);await owner.page.route('**/api/community/voice/*/join',route=>route.fulfill({status:503,json:{error:'Synthetic voice join outage'}}));
  try{await owner.page.getByRole('button',{name:'Entra nel canale',exact:true}).click();await until(()=>owner.page.evaluate(()=>window.__auditVoiceStreams.length>0&&window.__auditVoiceStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));assert.ok((await owner.page.getByRole('alert').allTextContents()).some(t=>t.includes('Synthetic voice join outage')),'Join failure must be visible');}finally{await owner.page.unroute('**/api/community/voice/*/join');}
  await join(owner);assert.equal((await db.query('SELECT count(*)::int n FROM voice_presence WHERE channel_id=$1 AND user_id=$2',[voice,owner.id])).rows[0].n,1);
 });
 await check('Two browser peers exchange actual synthetic audio in both directions',async()=>{
  await go(owner);await go(peer);await Promise.all(people.map(join));await until(async()=>{const ss=await Promise.all(people.map(stats));return ss.every(s=>s.some(p=>p.state==='connected'&&p.bytes>0));},20000);const first=await Promise.all(people.map(stats));await owner.page.waitForTimeout(1000);const second=await Promise.all(people.map(stats));assert.ok(second.every((ss,i)=>ss.some(p=>p.bytes>Math.max(...first[i].map(v=>v.bytes)))));report.audioEvidence={first,second};await owner.page.screenshot({path:out+'/desktop-audio.png'});
 });
 await check('Simultaneous presence refresh negotiates audio without colliding offers',async()=>{
  for(const p of people)await p.page.goto(base+'/journal',{waitUntil:'domcontentloaded'});
  await db.query('DELETE FROM voice_presence WHERE channel_id=$1',[voice]);
  await go(owner);await go(peer);let seen=0,release;const barrier=new Promise(r=>release=r);
  for(const p of people){let intercepted=false;await p.page.route('**/api/community/voice/*/presence',async route=>{if(intercepted)return route.continue();intercepted=true;const response=await route.fetch();if(++seen>=2)release();await barrier;await route.fulfill({response});});}
  try{await Promise.all(people.map(join));await until(async()=>seen>=2,15000,'Both presence requests');await until(async()=>{const ss=await Promise.all(people.map(stats));report.concurrentAudioStates=ss;return ss.every(s=>s.some(p=>p.state==='connected'&&p.bytes>0));},15000,'Audio after simultaneous presence refresh');}finally{release();for(const p of people)await p.page.unrouteAll({behavior:'wait'});}
 });
 await check('Mute and leave controls have keyboard names and toggle the actual local track',async()=>{
  await go(owner);await join(owner);const mute=owner.page.getByRole('button',{name:'Disattiva microfono',exact:true});await mute.click();assert.equal(await owner.page.evaluate(()=>window.__auditVoiceStreams.at(-1).getAudioTracks()[0].enabled),false);await owner.page.getByRole('button',{name:'Attiva microfono',exact:true}).click();assert.equal(await owner.page.evaluate(()=>window.__auditVoiceStreams.at(-1).getAudioTracks()[0].enabled),true);await owner.page.getByRole('button',{name:'Esci dal canale vocale',exact:true}).click();await until(()=>owner.page.evaluate(()=>window.__auditVoiceStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
 });
 await check('Repeated answer is ignored after negotiation instead of applying it in stable state',async()=>{
  await go(owner);await go(peer);await Promise.all(people.map(join));await until(async()=> (await Promise.all(people.map(stats))).every(s=>s.some(p=>p.state==='connected'&&p.bytes>0)),20000,'Audio before repeated answer');assert.ok(lastAnswer);const sender=people.find(p=>p.role===lastAnswer.sender),before=report.voiceWarnings.length;
  assert.equal((await apiFromPage(sender.page,'/api/community/voice/'+voice+'/signal',{method:'POST',body:JSON.stringify(lastAnswer.body)})).status,200);await sender.page.waitForTimeout(3000);
  assert.ok(!report.voiceWarnings.slice(before).some(w=>w.message.includes('wrong state')),'Duplicate answer must not be applied in stable state');assert.ok((await Promise.all(people.map(stats))).every(s=>s.some(p=>p.state==='connected'&&p.bytes>0)));
 });
 await check('Departing peer closes its remote audio connection after the next presence refresh',async()=>{
  await go(owner);await go(peer);await Promise.all(people.map(join));await until(async()=> (await stats(owner)).some(s=>s.state==='connected'),20000,'Connection before departure');await peer.page.locator('a[href="/journal"]').filter({visible:true}).first().click();await peer.page.waitForURL(url=>url.pathname==='/journal');await until(async()=> (await stats(owner)).every(s=>s.state==='closed'),12000,'Remote connection cleanup after SPA exit');
 });
 await check('Mobile voice layout and touch controls remain accessible',async()=>{
  await owner.page.setViewportSize({width:390,height:844});await go(owner);await join(owner);assert.ok(await owner.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));for(const name of ['Disattiva microfono','Esci dal canale vocale']){const box=await owner.page.getByRole('button',{name,exact:true}).boundingBox();assert.ok(box&&box.width>=44&&box.height>=44&&box.x>=0&&box.x+box.width<=390);}await owner.page.screenshot({path:out+'/mobile-voice.png'});await owner.page.setViewportSize({width:1440,height:1000});
 });
 await check('Revoked membership stops capture and surfaces denied keepalive',async()=>{
  await go(owner);await go(peer);await join(peer);assert.equal((await apiFromPage(owner.page,'/api/community/'+communityId+'/members/'+peer.id,{method:'DELETE'})).status,200);
  await until(()=>peer.page.evaluate(()=>window.__auditVoiceStreams.length>0&&window.__auditVoiceStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),15000);await peer.page.getByRole('button',{name:'Entra nel canale',exact:true}).waitFor();assert.ok((await peer.page.getByRole('alert').allTextContents()).some(t=>t.length>0));
 });
}finally{
 if(communityId&&people[0])await apiFromPage(people[0].page,'/api/community/'+communityId,{method:'DELETE'}).catch(()=>{});
 flush();for(const p of people){const trace=out+'/'+p.role+'-actions.zip';await p.ctx.tracing.stop({path:trace});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',trace]);}
 await browser.close();await db.end();
}
if(report.checks.some(c=>c.status==='failed'))process.exitCode=1;
