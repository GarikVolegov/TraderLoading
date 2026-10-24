import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {root,run,connect,base,database} from './env.mjs';
process.env.VERIFY_BASE_URL=base;
process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {signIn,USER_B,ensureTestUser,completeOnboarding,apiFromPage,dismiss,loadEnvLocal}=await import('../../verify-usability/lib/common.mjs');
assert.match(loadEnvLocal().CLERK_SECRET_KEY,/^sk_test_/);
const req=createRequire(root+'artifacts/trader-dashboard/package.json');
const USER_A='verify.settings+clerk_test@example.com';
const attemptId=run.runId+'-'+Date.now();
const out=run.output+'/browser-settings-'+(process.argv[2]||'after');mkdirSync(out,{recursive:true});
const report={runId:run.runId,attemptId,mode:'production frontend + production API + Clerk Development',checks:[],pages:[],errors:[],failures:[]};
const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const db=await connect();const uid=await ensureTestUser(USER_A),uidB=await ensureTestUser(USER_B);
for(const id of [uid,uidB])await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated browser audit') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[id]);
const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
await ctx.addInitScript(()=>{if(!localStorage.getItem('tl_language'))localStorage.setItem('tl_language','it');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');localStorage.setItem('tl_cookie_consent_v1','declined');});
const page=await ctx.newPage();page.setDefaultTimeout(12000);
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.status()>=500&&r.url().startsWith(base+'/api/'))report.failures.push({path:new URL(r.url()).pathname,status:r.status()});});
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const check=async(name,fn)=>{try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message.slice(0,1200)});console.log('FAIL',name,e.message.slice(0,500));await page.screenshot({path:out+'/failure-'+report.checks.length+'.png'}).catch(()=>{});await page.keyboard.press('Escape').catch(()=>{});}flush();};
const go=async(path)=>{await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id)&&document.body.innerText.length>100,null,{timeout:30000});await page.locator('a[href="/settings"]').first().waitFor({state:'attached'});await page.waitForTimeout(500);await dismiss(page);};
const visibleButton=(name)=>page.getByRole('button',{name}).filter({visible:true}).first();
try{
 await signIn(page,USER_A);await completeOnboarding(page,['EURUSD']);
 await check('Language preference survives server read and reload',async()=>{await go('/settings?section=lingua');const response=page.waitForResponse(r=>r.url().endsWith('/api/settings')&&r.request().method()==='PUT');await visibleButton(/Deutsch/).click();assert.equal((await response).status(),200);assert.equal((await apiFromPage(page,'/api/settings')).body.language,'de');await page.reload();await page.waitForTimeout(1500);assert.equal((await apiFromPage(page,'/api/settings')).body.language,'de');});
 await check('Failed language save keeps previous selection',async()=>{await go('/settings?section=lingua');const before=await page.evaluate(()=>localStorage.getItem('tl_language'));await page.route('**/api/settings',async route=>{if(route.request().method()==='PUT')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic settings outage'})});else await route.continue();});const response=page.waitForResponse(r=>r.url().endsWith('/api/settings')&&r.status()===503);await visibleButton(/Français/).click();await response;await page.waitForTimeout(500);await page.unroute('**/api/settings');assert.equal(await page.evaluate(()=>localStorage.getItem('tl_language')),before);});
 await check('Font preference persists and rejected save retains the previous font',async()=>{await apiFromPage(page,'/api/settings',{method:'PUT',body:JSON.stringify({fontChoice:'inter'})});await go('/settings?section=aspetto');const response=page.waitForResponse(r=>r.url().endsWith('/api/settings')&&r.request().method()==='PUT');await visibleButton(/^Roboto/).click();assert.equal((await response).status(),200);assert.equal((await apiFromPage(page,'/api/settings')).body.fontChoice,'roboto');await page.reload();await page.waitForTimeout(1200);const before=await page.evaluate(()=>document.documentElement.getAttribute('style'));await page.route('**/api/settings',async route=>{if(route.request().method()==='PUT')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic settings outage'})});else await route.continue();});const failed=page.waitForResponse(r=>r.status()===503&&r.url().endsWith('/api/settings'));await visibleButton(/JetBrains Mono/).click();await failed;await page.waitForTimeout(500);await page.unroute('**/api/settings');assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('style')),before);});
 await check('PIN setup, wrong PIN, unlock, change, new-tab persistence and removal',async()=>{
  await go('/settings?section=lingua');const italian=page.waitForResponse(r=>r.url().endsWith('/api/settings')&&r.request().method()==='PUT');await visibleButton(/Italiano/).click();await italian;await go('/settings?section=sicurezza');await visibleButton('Imposta PIN').click();let inputs=page.getByPlaceholder('••••').filter({visible:true});await inputs.nth(0).fill('1234');await inputs.nth(1).fill('1234');await visibleButton('Conferma').click();await page.reload();await page.getByText('Inserisci il tuo PIN per continuare',{exact:true}).waitFor();await page.keyboard.type('9999',{delay:120});await page.getByText('PIN non corretto',{exact:true}).waitFor();await page.waitForTimeout(750);await page.keyboard.type('1234',{delay:120});await page.getByText('Inserisci il tuo PIN per continuare',{exact:true}).waitFor({state:'hidden'});
  await visibleButton('Cambia PIN').click();await page.getByPlaceholder('••••').filter({visible:true}).fill('1234');await visibleButton('Avanti').click();inputs=page.getByPlaceholder('••••').filter({visible:true});await inputs.nth(0).fill('4321');await inputs.nth(1).fill('4321');await visibleButton('Conferma').click();
  const tab=await ctx.newPage();try{await tab.goto(base+'/settings?section=sicurezza');await tab.getByText('Inserisci il tuo PIN per continuare',{exact:true}).waitFor();await tab.keyboard.type('4321',{delay:120});await tab.getByText('Inserisci il tuo PIN per continuare',{exact:true}).waitFor({state:'hidden'});await tab.getByRole('button',{name:'Rimuovi PIN',exact:true}).filter({visible:true}).click();assert.equal(await tab.evaluate(()=>localStorage.getItem('tl_pin_hash')),null);}finally{await tab.close();}
  await page.reload();await visibleButton('Imposta PIN').waitFor();assert.equal((await apiFromPage(page,'/api/settings')).status,200);
 });
 assert.deepEqual(report.errors,[]);assert.ok(report.failures.every(x=>x.path==='/api/settings'&&x.status===503));
}finally{flush();await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
