import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {root,run,base,database,connect,auditExecutionId,setAuditScenario} from './env.mjs';
import {installResponseProvenance,responseProvenance} from './response-provenance.mjs';
process.env.VERIFY_BASE_URL=base;process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {ensureTestUser,signIn,completeOnboarding,dismiss}=await import('../../verify-usability/lib/common.mjs');
const label=process.argv[2]||'after';assert.match(label,/^[a-z0-9-]+$/);
const out=run.output+'/browser-workspaces-'+label;mkdirSync(out,{recursive:true});
const frontendBuild=JSON.parse(readFileSync(root+'.local-logs/runtime-api-process.json')).frontendBuild?.sha256;
const report={runId:run.runId,executionId:auditExecutionId,frontendBuild,mode:'Production UI, real Clerk Development and internal APIs; market endpoints deliberately unavailable; local agenda persistence is device-only',checks:[],requests:[],errors:[]};
const db=await connect(),email='verify.workspaces+clerk_test@example.com',user=await ensureTestUser(email),tag='audit_agenda_'+Date.now();
await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated workspace regression') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[user]);
const req=createRequire(root+'artifacts/trader-dashboard/package.json'),browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
await ctx.addInitScript(()=>{localStorage.setItem('tl_language','it');localStorage.setItem('tl_cookie_consent_v1','declined');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');});
await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
const page=await ctx.newPage();page.setDefaultTimeout(12000);installResponseProvenance(page);let scenario;
page.on('pageerror',error=>report.errors.push(error.message));
page.on('response',r=>{if(r.url().startsWith(base+'/api/'))report.requests.push({scenario,path:new URL(r.url()).pathname,method:r.request().method(),status:r.status(),provenance:responseProvenance(r)});});
await page.route('**/api/**',route=>{
 const path=new URL(route.request().url()).pathname;
 if(['/api/market/context','/api/calendar','/api/news','/api/news/macro','/api/tools/cot','/api/tools/volatility','/api/tools/sentiment'].includes(path))return route.fulfill({status:503,json:{error:'Synthetic unavailable market provider'}});
 return route.continue();
});
const nav=()=>page.locator('nav[aria-label="Navigazione principale"]:visible');
const expected=['/','/journal','/backtest','/wiki','/chat'];
const futureDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+2*86400000));assert.match(futureDate,/^\d{4}-\d{2}-\d{2}$/);report.futureAgendaFixtureDate=futureDate;
const storageKey=`tl_account_v1:${encodeURIComponent(user)}:tl_calendar_manual_items_v1`;
const items=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'[]'),storageKey);
async function go(path){await page.goto(base+path,{waitUntil:'domcontentloaded'});await nav().waitFor();await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id));await page.waitForTimeout(700);await dismiss(page);}
async function stableNav(){const hrefs=await nav().locator('a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));assert.ok(expected.every(path=>hrefs.includes(path)),JSON.stringify(hrefs));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}
async function check(name,fn){scenario=name;setAuditScenario(name);try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(error){report.checks.push({name,status:'failed',error:error.message});console.log('FAIL',name,error.message.slice(0,300));await page.screenshot({path:out+'/failed-'+report.checks.length+'.png'}).catch(()=>{});}writeFileSync(out+'/report.json',JSON.stringify(report,null,2));}
const form=()=>page.locator('form').filter({hasText:'Planner manuale'});
async function agenda(){await go('/calendar');await form().waitFor();}
try{
 await signIn(page,email);await completeOnboarding(page,['EURUSD']);
 await check('Desktop global destinations stay stable while journal plan and review panels render',async()=>{
  for(const [path,label]of [['/journal?t=piano','Piano'],['/journal?t=revisione','Revisione']]){await go(path);await page.getByRole('button',{name:label,exact:true}).waitFor();await stableNav();assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');}
  await go('/journal?t=piano&vista=idee-obiettivi');await page.getByRole('button',{name:'Idee e obiettivi',exact:true}).waitFor();await stableNav();
 });
 await check('Legacy workspace links redirect with preserved pair context to populated local views',async()=>{
  for(const [path,target,query]of [['/news','/','vista=notizie'],['/clock','/','strumento=sessioni'],['/library','/wiki','t=unlocked'],['/calendar','/journal','vista=agenda'],['/tornei','/chat','t=competizioni'],['/broker','/journal','panel=conti']]){
   await go(path+'?pair=EURUSD');await page.waitForURL(url=>url.pathname===target&&url.search.includes(query));assert.equal(new URL(page.url()).searchParams.get('pair'),'EURUSD');await stableNav();
  }
 });
 await check('Agenda form controls have accessible names for keyboard and assistive technology',async()=>{
  await agenda();for(const name of ['Titolo','Inizio','Fine','Note','Tipo','Priorità'])assert.equal(await form().getByLabel(name,{exact:true}).count(),1,name+' needs an accessible label');
 });
 await check('Agenda rejects reversed times without saving and preserves the form draft',async()=>{
  await agenda();await form().locator('input').first().fill(tag);const times=form().locator('input[type="datetime-local"]');await times.nth(0).fill(futureDate+'T10:00');await times.nth(1).fill(futureDate+'T09:00');await form().getByRole('button',{name:'Aggiungi',exact:true}).click();await page.getByText('La fine deve essere successiva all’inizio.',{exact:true}).waitFor();assert.equal((await items()).length,0);assert.equal(await form().locator('input').first().inputValue(),tag);
 });
 await check('Agenda persists a valid item after reload under the authenticated account and deletes it',async()=>{
  await agenda();await form().locator('input').first().fill(tag);const times=form().locator('input[type="datetime-local"]');await times.nth(0).fill(futureDate+'T10:00');await times.nth(1).fill(futureDate+'T11:00');await form().getByRole('button',{name:'Aggiungi',exact:true}).click();await page.getByRole('heading',{name:tag,exact:true}).waitFor();assert.equal((await items()).length,1);await agenda();const row=page.locator('article').filter({has:page.getByRole('heading',{name:tag,exact:true})});await row.waitFor();await row.getByRole('button').click();await page.getByRole('heading',{name:tag,exact:true}).waitFor({state:'detached'});assert.equal((await items()).length,0);
 });
 await check('Agenda storage failure leaves the draft and prior storage unchanged and allows retry',async()=>{
  await agenda();await form().locator('input').first().fill(tag+'_retry');await form().locator('input[type="datetime-local"]').first().fill(futureDate+'T10:00');await page.evaluate(key=>{window.auditOriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Synthetic quota error','QuotaExceededError');return window.auditOriginalSetItem.call(this,k,v);};},storageKey);
  try{await form().getByRole('button',{name:'Aggiungi',exact:true}).click();await page.getByText('Impossibile salvare l’agenda su questo dispositivo. Riprova.',{exact:true}).waitFor();assert.equal((await items()).length,0);assert.equal(await form().locator('input').first().inputValue(),tag+'_retry');}finally{await page.evaluate(()=>{Storage.prototype.setItem=window.auditOriginalSetItem;delete window.auditOriginalSetItem;});}
  await form().getByRole('button',{name:'Aggiungi',exact:true}).click();await page.getByRole('heading',{name:tag+'_retry',exact:true}).waitFor();assert.equal((await items()).length,1);
 });
 await check('Mobile local tabs keep all five global destinations and keyboard navigation accessible',async()=>{
  await page.setViewportSize({width:390,height:844});await agenda();await stableNav();const tab=page.getByRole('button',{name:'Oggi',exact:true});await tab.focus();await tab.press('Enter');await page.getByRole('button',{name:'Routine e benessere',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('vista'),'oggi');await stableNav();await page.screenshot({path:out+'/mobile-plan.png'});
 });
 assert.deepEqual(report.errors,[]);
}finally{
 await page.evaluate(key=>localStorage.removeItem(key),storageKey).catch(()=>{});
 writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();
}
if(report.checks.some(check=>check.status==='failed')||report.errors.length)process.exitCode=1;
