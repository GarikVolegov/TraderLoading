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
const email='verify.push+clerk_test@example.com',label=process.argv[2]||'after';assert.match(label,/^(baseline|after)$/);
const out=run.output+'/browser-push-'+label;mkdirSync(out,{recursive:true});
const report={runId:run.runId,label,mode:'Production frontend/API and real Clerk Development session; browser push subscription simulated, no provider registration/delivery',checks:[],errors:[],requests:[]};
const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const db=await connect(),uid=await ensureTestUser(email);
await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Synthetic push UI audit') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[uid]);
const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
await ctx.addInitScript(()=>{
 localStorage.setItem('tl_language','it');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');localStorage.setItem('tl_cookie_consent_v1','declined');
 // Only the browser registration object is simulated. Real preference requests
 // reach API3002 and the isolated DB. No permission dialog/provider call occurs.
 const sub={endpoint:'https://example.com/audit-browser-only',unsubscribe:async()=>true,toJSON:()=>({endpoint:'https://example.com/audit-browser-only'})};
 const reg={pushManager:{getSubscription:async()=>sub},showNotification:async()=>{}};
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve(reg),getRegistration:async()=>reg,register:async()=>reg,addEventListener:()=>{},removeEventListener:()=>{}}});
});
const page=await ctx.newPage();installResponseProvenance(page);page.setDefaultTimeout(12000);let scenario=null;
page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base+'/api/'))report.requests.push({scenario,method:r.request().method(),path:new URL(r.url()).pathname.replace(/^\/api/,''),status:r.status(),provenance:responseProvenance(r)});});
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const check=async(name,fn)=>{scenario=name;try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message.slice(0,1000)});console.log('FAIL',name,e.message.slice(0,500));await page.screenshot({path:out+'/failure-'+report.checks.length+'.png'}).catch(()=>{});}flush();};
const sw=(name)=>page.getByText(name,{exact:true}).locator('..').locator('..').getByRole('switch');
async function settings(){await page.goto(base+'/settings?section=notifiche',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id),null,{timeout:30000});await dismiss(page);await sw('Messaggi').waitFor();await page.waitForTimeout(500);}
try{
 await signIn(page,email);await completeOnboarding(page,['EURUSD']);await apiFromPage(page,'/api/settings',{method:'PUT',body:JSON.stringify({language:'it'})});await apiFromPage(page,'/api/push/preferences',{method:'PUT',body:JSON.stringify({messages:true,goals:true})});
 await check('Failed push preference save retains previous switch and reports the error',async()=>{
  await settings();assert.equal(await sw('Messaggi').getAttribute('aria-checked'),'true');
  await page.route('**/api/push/preferences',async route=>{if(route.request().method()==='PUT')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic push preference outage'})});else await route.continue();});
  try{const failed=page.waitForResponse(r=>r.url().endsWith('/api/push/preferences')&&r.status()===503);await sw('Messaggi').click();await failed;await page.waitForTimeout(300);assert.equal(await sw('Messaggi').getAttribute('aria-checked'),'true');await page.getByRole('alert').filter({hasText:'Errore nel salvataggio.'}).waitFor();assert.equal((await apiFromPage(page,'/api/push/preferences')).body.messages,true);}finally{await page.unroute('**/api/push/preferences');}
 });
 await check('Push preference retry persists and survives reload',async()=>{
  await settings();const saved=page.waitForResponse(r=>r.url().endsWith('/api/push/preferences')&&r.request().method()==='PUT');await sw('Messaggi').click();assert.equal((await saved).status(),200);await page.waitForTimeout(300);assert.equal(await sw('Messaggi').getAttribute('aria-checked'),'false');assert.equal((await apiFromPage(page,'/api/push/preferences')).body.messages,false);await settings();assert.equal(await sw('Messaggi').getAttribute('aria-checked'),'false');
 });
 await check('Double push preference click makes one write and keeps value until confirmation',async()=>{
  await settings();let writes=0,release;const continuations=[];const wait=new Promise(resolve=>release=resolve);
  await page.route('**/api/push/preferences',async route=>{const task=(async()=>{if(route.request().method()==='PUT'){writes++;await wait;}await route.continue();})();continuations.push(task);await task;});
  try{
   await sw('Obiettivi e scadenze').evaluate(el=>{el.click();el.click();});await page.waitForTimeout(250);assert.equal(writes,1);assert.equal(await sw('Obiettivi e scadenze').getAttribute('aria-checked'),'true');assert.equal(await sw('Obiettivi e scadenze').isDisabled(),true);release();await page.waitForFunction(()=>[...document.querySelectorAll('[role="switch"]')].some(e=>e.getAttribute('aria-label')==='Obiettivi e scadenze'&&e.getAttribute('aria-checked')==='false'));assert.equal((await apiFromPage(page,'/api/push/preferences')).body.goals,false);
  }finally{release();await Promise.allSettled(continuations);await page.unroute('**/api/push/preferences');}
 });
 await check('Push preference switches remain readable and operable on mobile',async()=>{
  await page.setViewportSize({width:390,height:844});await settings();assert.ok(await sw('Messaggi').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);const saved=page.waitForResponse(r=>r.url().endsWith('/api/push/preferences')&&r.request().method()==='PUT');await sw('Messaggi').click();assert.equal((await saved).status(),200);assert.equal((await apiFromPage(page,'/api/push/preferences')).body.messages,true);await page.screenshot({path:out+'/mobile.png'});
 });
 assert.deepEqual(report.errors,[]);
}finally{flush();await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
