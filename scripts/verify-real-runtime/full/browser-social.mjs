import {installResponseProvenance,responseProvenance} from './response-provenance.mjs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {root,run,connect,base,database} from './env.mjs';
process.env.VERIFY_BASE_URL=base;
process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {signIn,ensureTestUser,completeOnboarding,apiFromPage,dismiss,loadEnvLocal}=await import('../../verify-usability/lib/common.mjs');
assert.match(loadEnvLocal().CLERK_SECRET_KEY,/^sk_test_/);
const req=createRequire(root+'artifacts/trader-dashboard/package.json');
const USER_B='verify.story.b+clerk_test@example.com';
const USER_A='verify.story.a+clerk_test@example.com';
const attemptId=run.runId+'-'+Date.now();
const out=run.output+'/browser-social-'+(process.argv[2]||'after');mkdirSync(out,{recursive:true});
const report={runId:run.runId,mode:'production frontend + production API + Clerk Development',checks:[],pages:[],requests:[],errors:[],failures:[]};
const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath(),args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const db=await connect();const uid=await ensureTestUser(USER_A),uidB=await ensureTestUser(USER_B);
for(const id of [uid,uidB])await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated browser audit') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[id]);
const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
await ctx.grantPermissions(['microphone'],{origin:base});
await ctx.addInitScript(()=>{
 if(!navigator.mediaDevices?.getUserMedia)return;
 const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 window.__auditAudioTracks=[];
 navigator.mediaDevices.getUserMedia=async options=>{const stream=await original(options);window.__auditAudioTracks.push(...stream.getTracks());if(window.__auditDelayMic)await new Promise(resolve=>window.__auditResolveMic=resolve);return stream;};
});
await ctx.addInitScript(()=>{if(!localStorage.getItem('tl_language'))localStorage.setItem('tl_language','it');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');localStorage.setItem('tl_cookie_consent_v1','declined');});
let activeScenario=null;const requestScenarios=new WeakMap();
const observe=p=>{installResponseProvenance(p);p.on('request',r=>requestScenarios.set(r,activeScenario));p.on('response',r=>{const scenario=requestScenarios.get(r.request());if(scenario&&r.url().startsWith(base+'/api/'))report.requests.push({scenario,method:r.request().method(),path:new URL(r.url()).pathname.slice(4),status:r.status(),provenance:responseProvenance(r)});});};
const page=await ctx.newPage();page.setDefaultTimeout(12000);observe(page);
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.status()>=500&&r.url().startsWith(base+'/api/'))report.failures.push({path:new URL(r.url()).pathname,status:r.status(),provenance:responseProvenance(r)});});
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const check=async(name,fn)=>{activeScenario=name;try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message.slice(0,1200)});console.log('FAIL',name,e.message.slice(0,500));await page.screenshot({path:out+'/failure-'+report.checks.length+'.png'}).catch(()=>{});await page.keyboard.press('Escape').catch(()=>{});}finally{activeScenario=null;}flush();};
const _go=async(path)=>{await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id)&&document.body.innerText.length>100,null,{timeout:30000});await page.locator('a[href="/settings"]').first().waitFor({state:'attached'});await page.waitForTimeout(500);await dismiss(page);};
let other;
const go=async(p,path)=>{await p.goto(base+path);await p.waitForFunction(()=>Boolean(window.Clerk?.user?.id),null,{timeout:30000});await p.waitForTimeout(700);await dismiss(p);};
const ready=async(p)=>{await p.waitForFunction(async()=>{const r=await fetch('/api/chat/key-backup');return r.ok&&(await r.json()).hasBackup;},null,{timeout:30000});};
try{
 await signIn(page,USER_A);await completeOnboarding(page,['EURUSD']);
 const otherCtx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
 await otherCtx.addInitScript(()=>{localStorage.setItem('tl_language','it');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');localStorage.setItem('tl_cookie_consent_v1','declined');});
 other=await otherCtx.newPage();observe(other);other.on('pageerror',e=>report.errors.push(e.message));
 await signIn(other,USER_B);await completeOnboarding(other,['EURUSD']);
 for(const [p,id] of [[page,uidB],[other,uid]]){const r=await apiFromPage(p,'/api/social/follow/'+id,{method:'POST'});assert.ok([201,409].includes(r.status));}
 await go(page,'/chat?t=messaggi');await ready(page);await go(other,'/chat?t=messaggi');await ready(other);
 const nameA=(await apiFromPage(page,'/api/profile')).body.name,nameB=(await apiFromPage(other,'/api/profile')).body.name;
 await check('Private chat mounts one composer and one message copy on desktop and mobile',async()=>{
  await page.getByText(nameB,{exact:true}).first().click();assert.equal(await page.locator('input[placeholder]').filter({hasNot:page.locator('[type=hidden]')}).evaluateAll(inputs=>inputs.filter(i=>i.placeholder==='Messaggio cifrato...').length),1);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.locator('input').evaluateAll(inputs=>inputs.filter(i=>i.placeholder==='Messaggio cifrato...').length),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:out+'/private-chat-mobile.png'});await page.setViewportSize({width:1440,height:1000});
 });
 // Old synthetic stories can have pre-fix SQL timestamps two hours ahead.
 // Start each scenario with a single story belonging to this dedicated actor.
 await db.query('DELETE FROM posts WHERE user_id=$1 AND is_story=true',[uidB]);
 const story=(await apiFromPage(other,'/api/social/posts',{method:'POST',body:JSON.stringify({content:'Story browser '+attemptId,isStory:true})})).body;
 await check('Story reply error keeps draft and retry reaches real recipient inbox after reload',async()=>{
  await go(page,'/chat?t=social');await page.getByText(nameB,{exact:true}).first().click();await page.getByRole('button',{name:'Rispondi',exact:true}).click();
  const input=page.getByPlaceholder('Scrivi una risposta...');await input.fill('Story answer '+attemptId);
  await page.route(`**/api/social/story-reply/${story.id}`,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic reply outage'})}),{times:1});
  const failed=page.waitForResponse(r=>r.url().endsWith('/social/story-reply/'+story.id)&&r.status()===503);await page.getByRole('button',{name:'Invia risposta',exact:true}).click();await failed;assert.equal(await input.inputValue(),'Story answer '+attemptId);assert.equal(await page.getByText('✓ Risposta inviata!',{exact:true}).count(),0);const alert=page.getByRole('dialog').getByRole('alert');await alert.filter({hasText:'Synthetic reply outage'}).waitFor();assert.equal(await alert.evaluate(el=>Boolean(el.closest('[inert]'))),false);
  const sent=page.waitForResponse(r=>r.url().endsWith('/social/story-reply/'+story.id)&&r.status()===200);await page.getByRole('button',{name:'Invia risposta',exact:true}).click();await sent;await page.getByText('✓ Risposta inviata!',{exact:true}).waitFor();
  await go(other,'/chat?t=messaggi');await other.getByText(nameA,{exact:true}).first().click();await other.getByText('Story answer '+attemptId,{exact:true}).waitFor({timeout:20000});await other.reload();await other.getByText(nameA,{exact:true}).first().click();await other.getByText('Story answer '+attemptId,{exact:true}).waitFor();
  const rows=await db.query('SELECT ciphertext FROM chat_messages WHERE sender_id=$1 AND receiver_id=$2',[uid,uidB]);assert.ok(rows.rowCount>=1);assert.ok(rows.rows.every(r=>!r.ciphertext.includes('Story answer')));
  await other.screenshot({path:out+'/recipient-inbox.png'});
 });
 await check('Direct message composer sends encrypted message to a second browser',async()=>{
  await go(page,'/chat?t=messaggi');await page.getByText(nameB,{exact:true}).first().click();const input=page.locator('input').filter({visible:true}).last();await input.fill('Direct message '+attemptId);await input.press('Enter');await page.getByText('Direct message '+attemptId,{exact:true}).waitFor();await go(other,'/chat?t=messaggi');await other.getByText(nameA,{exact:true}).first().click();await other.getByText('Direct message '+attemptId,{exact:true}).waitFor({timeout:20000});
 });
 await check('Voice reply preserves recorded draft on failure and retries without a second upload',async()=>{
  await go(page,'/chat?t=social');await page.getByText(nameB,{exact:true}).first().click();await page.getByRole('button',{name:'Rispondi',exact:true}).click();await page.getByRole('button',{name:'🎤',exact:true}).click();
  await page.getByRole('button',{name:'Registra vocale',exact:true}).click();await page.getByRole('button',{name:'Ferma registrazione',exact:true}).waitFor();await page.waitForTimeout(400);await page.getByRole('button',{name:'Ferma registrazione',exact:true}).click();await page.locator('audio').waitFor();
  const before=(await db.query("SELECT count(*)::int n FROM chat_file_access WHERE owner_user_id=$1 AND peer_user_id=$2 AND file_key LIKE 'voice-%'",[uid,uidB])).rows[0].n;
  await page.route(`**/api/social/story-reply/${story.id}`,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic voice save outage'})}),{times:1});
  const failed=page.waitForResponse(r=>r.url().endsWith('/social/story-reply/'+story.id)&&r.status()===503);await page.getByRole('button',{name:'Invia risposta',exact:true}).click();await failed;await page.locator('audio').waitFor();
  const sent=page.waitForResponse(r=>r.url().endsWith('/social/story-reply/'+story.id)&&r.status()===200);await page.getByRole('button',{name:'Invia risposta',exact:true}).click();await sent;
  assert.equal((await db.query("SELECT count(*)::int n FROM chat_file_access WHERE owner_user_id=$1 AND peer_user_id=$2 AND file_key LIKE 'voice-%'",[uid,uidB])).rows[0].n,before+1);
  assert.ok(await page.evaluate(()=>window.__auditAudioTracks.every(track=>track.readyState==='ended')));
 });
 await check('Story dialog traps keyboard focus, closes with Escape and restores its opener',async()=>{
  await go(page,'/chat?t=social');const opener=page.getByRole('button',{name:'Storia di '+nameB,exact:true});await opener.focus();await opener.press('Enter');const dialog=page.getByRole('dialog',{name:nameB,exact:true});await dialog.waitFor();assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.getByRole('button',{name:'Rispondi',exact:true}).click();for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));}await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');assert.ok(await opener.evaluate(el=>el===document.activeElement));
 });
 await check('Cancelling a microphone request stops tracks when the delayed permission resolves',async()=>{
  await go(page,'/chat?t=social');await page.getByText(nameB,{exact:true}).first().click();await page.getByRole('button',{name:'Rispondi',exact:true}).click();await page.getByRole('button',{name:'🎤',exact:true}).click();await page.evaluate(()=>window.__auditDelayMic=true);await page.getByRole('button',{name:'Registra vocale',exact:true}).click();await page.waitForFunction(()=>Boolean(window.__auditResolveMic));await page.getByRole('button',{name:'Annulla',exact:true}).click();await page.evaluate(()=>window.__auditResolveMic());await page.waitForFunction(()=>window.__auditAudioTracks.every(track=>track.readyState==='ended'));
 });
 assert.deepEqual(report.errors,[]);assert.ok(report.failures.every(x=>x.path.endsWith('/story-reply/'+story.id)&&x.status===503));
 await otherCtx.close();
}finally{flush();await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
