import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {root,run,connect,base,database} from './env.mjs';
process.env.VERIFY_BASE_URL=base;
process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {signIn,USER_A,USER_B,ensureTestUser,completeOnboarding,apiFromPage,dismiss,loadEnvLocal}=await import('../../verify-usability/lib/common.mjs');
assert.match(loadEnvLocal().CLERK_SECRET_KEY,/^sk_test_/);
const req=createRequire(root+'artifacts/trader-dashboard/package.json');
const attemptId=run.runId+'-'+Date.now();
const out=run.output+'/browser';mkdirSync(out,{recursive:true});
let scenario=null;
const report={requests:[],runId:run.runId,mode:'production frontend + production API + Clerk Development',checks:[],pages:[],errors:[],failures:[]};
const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const db=await connect();const uid=await ensureTestUser(USER_A),uidB=await ensureTestUser(USER_B);
for(const id of [uid,uidB])await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated browser audit') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[id]);
const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
await ctx.addInitScript(()=>{localStorage.setItem('tl_language','it');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');localStorage.setItem('tl_cookie_consent_v1','declined');});
const page=await ctx.newPage();page.setDefaultTimeout(12000);
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith(base+'/api/'))report.requests.push({scenario,method:r.request().method(),path:new URL(r.url()).pathname.slice(4),status:r.status()});if(r.status()>=500&&r.url().startsWith(base+'/api/'))report.failures.push({path:new URL(r.url()).pathname,status:r.status()});});
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const check=async(name,fn)=>{scenario=name;try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message.slice(0,1200)});console.log('FAIL',name,e.message.slice(0,500));await page.screenshot({path:out+'/failure-'+report.checks.length+'.png'}).catch(()=>{});await page.keyboard.press('Escape').catch(()=>{});}flush();};
const go=async(path)=>{await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id)&&document.body.innerText.length>100,null,{timeout:30000});await page.locator('a[href="/settings"]').first().waitFor({state:'attached'});await page.waitForTimeout(500);await dismiss(page);};
let entryId;
try{
 await signIn(page,USER_A);await completeOnboarding(page,['EURUSD']);await go('/');
 await check('Clerk login identifies the expected synthetic account',async()=>{assert.equal(await page.evaluate(()=>window.Clerk.user.id),uid);assert.equal((await apiFromPage(page,'/api/settings')).status,200);});
 // A page inventory records accessibility only, never successful feature execution.
 for(const path of ['/','/journal','/checklist','/routine','/backtest','/wiki','/chat','/library','/missions','/milestones','/tornei','/broker','/clock','/settings','/support','/calendar','/news','/pro']){
  await go(path);const body=await page.locator('body').innerText();
  const controls=await page.locator('button,a,input,select,textarea').evaluateAll(nodes=>nodes.map(el=>({tag:el.tagName,label:(el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.textContent||'').trim().slice(0,140),href:el.getAttribute('href'),type:el.getAttribute('type')})));
  report.pages.push({path,controls,bodyLength:body.length,accessible:body.length>100,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)});
  await page.screenshot({path:out+'/'+(path==='/'?'home':path.slice(1))+'.png'});console.log('VISIT',path);flush();
 }
 await check('Journal create via UI persists note, manual trade and image',async()=>{
  await go('/journal?t=trades');await page.getByRole('button',{name:'Nuovo Trade',exact:true}).first().click();const d=page.getByRole('dialog');await d.waitFor();
  await d.locator('input.uppercase').fill('EURUSD');
  await d.getByPlaceholder('Es. Breakout su EUR/USD sessione di Londra').fill('Browser audit '+attemptId);
  await d.getByPlaceholder('Scrivi qui i dettagli del tuo trade, setup, entry, exit, emozioni...').fill('Synthetic browser persistence');
  const n=d.locator('input[type="number"]');await n.nth(0).fill('0');await n.nth(1).fill('1.1');await n.nth(2).fill('1.1');await n.nth(3).fill('1.09');
  await d.locator('input[type=file]').setInputFiles({name:'audit.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64')});
  await d.getByRole('button',{name:'Salva nel Diario',exact:true}).click();await d.waitFor({state:'hidden'});await page.reload();await dismiss(page);
  await page.getByText('Browser audit '+attemptId,{exact:true}).first().waitFor();
  const e=(await apiFromPage(page,'/api/journal')).body.find(e=>e.title==='Browser audit '+attemptId);entryId=e.id;assert.equal(e.manualTrade.profit,0);assert.equal(e.images.length,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM account_trades WHERE journal_entry_id=$1 AND user_id=$2',[entryId,uid])).rows[0].n,1);
 });
 await check('Journal edit restores structured fields, keeps zero and survives reload',async()=>{
  await go('/journal?t=trades');const title=page.getByText('Browser audit '+attemptId,{exact:true}).first();const card=title.locator('xpath=ancestor::div[contains(@class,"group")][1]');await card.hover();await card.getByRole('button',{name:'Modifica',exact:true}).click();
  const d=page.getByRole('dialog'),n=d.locator('input[type=number]');assert.equal(await n.nth(0).inputValue(),'0');assert.equal(await n.nth(1).inputValue(),'1.1');
  await n.nth(0).fill('25');await n.nth(2).fill('1.105');await d.getByRole('button',{name:'Salva nel Diario',exact:true}).click();await d.waitFor({state:'hidden'});await page.reload();
  const e=(await apiFromPage(page,'/api/journal/'+entryId)).body;assert.equal(e.manualTrade.profit,25);assert.equal(e.manualTrade.exitPrice,1.105);
 });
 await check('Journal modal keyboard focus remains inside and Escape cancels',async()=>{await go('/journal?t=trades');await page.getByRole('button',{name:'Nuovo Trade',exact:true}).first().click();await page.getByRole('dialog').waitFor();await page.waitForTimeout(300);for(let i=0;i<24;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>Boolean(document.activeElement?.closest('[role=dialog]'))));}await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});});
 await check('Checklist criterion persists and daily confirmation survives reload',async()=>{
  await go('/checklist');await page.getByPlaceholder('es. Ho controllato le news...').fill('Audit discipline '+attemptId);await page.getByRole('button',{name:'Aggiungi',exact:true}).click();await page.getByText('Audit discipline '+attemptId,{exact:true}).waitFor();
  const items=(await apiFromPage(page,'/api/checklist')).body;assert.ok(items.find(i=>i.text==='Audit discipline '+attemptId)?.id);
  await go('/');await page.getByRole('button',{name:'Apri checklist',exact:true}).click();const toggle=page.getByRole('button',{name:'Audit discipline '+attemptId,exact:true});await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'true');await go('/');await page.getByRole('button',{name:'Apri checklist',exact:true}).click();assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 });
 await check('Support ticket submitted through UI persists its initial message',async()=>{
  await go('/support');await page.getByPlaceholder('Oggetto della richiesta').fill('Browser support '+attemptId);await page.getByPlaceholder('Descrivi il problema nel dettaglio').fill('Synthetic support request');await page.getByRole('button',{name:'Invia richiesta',exact:true}).click();await page.getByText('Browser support '+attemptId,{exact:true}).first().waitFor();await page.reload();await page.getByText('Browser support '+attemptId,{exact:true}).first().waitFor();
  assert.equal((await db.query('SELECT count(*)::int n FROM support_tickets WHERE user_id=$1 AND subject=$2',[uid,'Browser support '+attemptId])).rows[0].n,1);
 });
 await check('Mobile navigation, journal form and touch layout',async()=>{
  await page.setViewportSize({width:390,height:844});await go('/');await page.locator('a[href="/journal"]').filter({visible:true}).first().click();await page.waitForURL('**/journal');await page.locator('a[href="/journal?t=trades"]').filter({visible:true}).first().click();await page.getByRole('button',{name:'Nuovo Trade',exact:true}).first().click();const d=page.getByRole('dialog');await d.waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:out+'/mobile-journal.png'});await page.keyboard.press('Escape');
  for(const path of ['/','/journal','/checklist','/settings','/support','/backtest','/chat']){await go(path);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);report.pages.push({path,viewport:'mobile',horizontalOverflow:overflow});assert.equal(overflow,false,path);await page.screenshot({path:out+'/mobile-'+(path==='/'?'home':path.slice(1))+'.png'});}
 });
 await check('Second real Clerk account cannot read first account journal or image',async()=>{
  const ctxB=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT'});const pb=await ctxB.newPage();try{await signIn(pb,USER_B);await completeOnboarding(pb,['XAUUSD']);assert.equal((await apiFromPage(pb,'/api/journal/'+entryId)).status,404);const e=(await apiFromPage(page,'/api/journal/'+entryId)).body;assert.equal((await apiFromPage(pb,e.images[0].url)).status,404);}finally{await ctxB.close();}
 });
 await check('Logout revokes access in the browser',async()=>{await page.evaluate(()=>window.Clerk.signOut());await page.waitForTimeout(500);assert.equal((await apiFromPage(page,'/api/settings')).status,401);});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failures,[]);
}finally{flush();await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
console.log('BROWSER',report.checks.length,'checks',report.checks.filter(x=>x.status==='failed').length,'failed');
