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
const out=run.output+'/browser-extra';mkdirSync(out,{recursive:true});
const report={runId:run.runId,mode:'production frontend + production API + Clerk Development',checks:[],pages:[],errors:[],failures:[]};
const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const db=await connect();const uid=await ensureTestUser(USER_A),uidB=await ensureTestUser(USER_B);
for(const id of [uid,uidB])await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated browser audit') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[id]);
const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
await ctx.addInitScript(()=>{localStorage.setItem('tl_language','it');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');localStorage.setItem('tl_cookie_consent_v1','declined');});
const page=await ctx.newPage();page.setDefaultTimeout(12000);
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.status()>=500&&r.url().startsWith(base+'/api/'))report.failures.push({path:new URL(r.url()).pathname,status:r.status()});});
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const check=async(name,fn)=>{try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message.slice(0,1200)});console.log('FAIL',name,e.message.slice(0,500));await page.screenshot({path:out+'/failure-'+report.checks.length+'.png'}).catch(()=>{});await page.keyboard.press('Escape').catch(()=>{});}flush();};
const go=async(path)=>{await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id)&&document.body.innerText.length>100,null,{timeout:30000});await page.locator('a[href="/settings"]').first().waitFor({state:'attached'});await page.waitForTimeout(500);await dismiss(page);};
const png=()=>({name:'retry.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64')});
try{
 await signIn(page,USER_A);await completeOnboarding(page,['EURUSD']);
 await check('Archive failed save retains draft, retry creates exactly one note',async()=>{
  await go('/wiki');await page.getByRole('button',{name:'Aggiungi',exact:true}).click();const d=page.getByRole('dialog');await d.waitFor();
  const title='Archive retry '+attemptId;await d.getByPlaceholder('Titolo nota').fill(title);const body=d.locator('textarea');await body.fill('Content preserved after simulated outage');
  await page.route('**/api/wiki/sources/text',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic outage'})}),{times:1});
  await d.getByRole('button',{name:'Salva nota',exact:true}).click();await d.getByRole('alert').waitFor();assert.equal(await body.inputValue(),'Content preserved after simulated outage');assert.equal(await d.getByPlaceholder('Titolo nota').inputValue(),title);
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>Boolean(document.activeElement?.closest('[role=dialog]'))));}
  await d.getByRole('button',{name:'Salva nota',exact:true}).dblclick();await page.waitForFunction(()=>document.querySelector('[role=dialog] textarea')?.value==='');await page.keyboard.press('Escape');await page.reload();await dismiss(page);await page.getByText(title,{exact:true}).first().waitFor();
  const sources=(await apiFromPage(page,'/api/wiki/sources')).body;assert.equal(sources.filter(x=>x.title===title).length,1);
 });
 await check('Journal image failure retry does not duplicate entry or XP',async()=>{
  await go('/journal?t=trades');const xp=(await apiFromPage(page,'/api/profile')).body.xp;await page.getByRole('button',{name:'Nuovo Trade',exact:true}).first().click();const d=page.getByRole('dialog');await d.waitFor();const title='Journal retry '+attemptId;
  await d.getByPlaceholder('Es. Breakout su EUR/USD sessione di Londra').fill(title);await d.getByPlaceholder('Scrivi qui i dettagli del tuo trade, setup, entry, exit, emozioni...').fill('Retry image only');await d.locator('input[type=file]').setInputFiles(png());
  await page.route('**/api/journal/*/images',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic image outage'})}),{times:1});
  const failure=page.waitForResponse(r=>r.url().includes('/images')&&r.status()===503);await d.getByRole('button',{name:'Salva nel Diario',exact:true}).click();await failure;await page.waitForTimeout(300);assert.equal(await d.isVisible(),true);
  await d.getByRole('button',{name:'Salva nel Diario',exact:true}).click();await d.waitFor({state:'hidden'});await page.reload();const entries=(await apiFromPage(page,'/api/journal')).body.filter(e=>e.title===title);assert.equal(entries.length,1);assert.equal(entries[0].images.length,1);assert.equal((await apiFromPage(page,'/api/profile')).body.xp-xp,75);
 });
 await check('Journal page controls expose remaining entries with a bounded DOM',async()=>{
  await db.query("INSERT INTO journal_entries(user_id,title,content,trade_date,result) SELECT $1,'Page audit '||i::text,'','2026-10-02','none' FROM generate_series(1,30) i",[uid]);
  await go('/journal?t=trades');const nav=page.getByRole('navigation',{name:'Pagine del diario'});await nav.waitFor();const first=await page.locator('h3').allTextContents();await nav.getByRole('button',{name:'Pagina successiva'}).click();await page.waitForTimeout(700);assert.notDeepEqual(await page.locator('h3').allTextContents(),first);assert.ok((await page.getByText(/^Page audit \d+$/).count())<=24);await nav.getByRole('button',{name:'Pagina precedente'}).click();
 });
 await check('Backtest manual session and breakeven trade persist after reload',async()=>{
  await go('/backtest');await page.getByRole('button',{name:'Nuova Sessione',exact:true}).click();const title='Browser backtest '+attemptId;await page.getByPlaceholder('es. Strategia Breakout Londra').fill(title);await page.getByRole('button',{name:'Crea Sessione',exact:true}).click();await page.getByText(title,{exact:true}).first().waitFor();await page.getByText(title,{exact:true}).first().click();await page.getByRole('button',{name:'Manuale',exact:true}).click();await page.getByPlaceholder('1.08500').fill('1.1');await page.getByPlaceholder('1.09000').fill('1.1');await page.getByRole('button',{name:'Aggiungi Trade',exact:true}).click();await page.waitForTimeout(500);await page.reload();await dismiss(page);
  const sessions=(await apiFromPage(page,'/api/backtest/sessions')).body;const session=sessions.find(x=>x.name===title);assert.ok(session);const trades=(await apiFromPage(page,`/api/backtest/sessions/${session.id}/trades`)).body;assert.equal(trades.length,1);assert.equal(Number(trades[0].pips),0);assert.equal(trades[0].result,'breakeven');
 });
 await check('Routine resume, failed server confirmation and successful retry',async()=>{
  await go('/routine');await page.goto(base+'/routine?start=evening',{waitUntil:'domcontentloaded'});const d=page.getByRole('dialog');await d.waitFor();await d.getByRole('button',{name:'Soddisfatto'}).click();await d.getByRole('button',{name:'Avanti',exact:true}).click();await d.getByText('Bilancio trade',{exact:true}).waitFor();await page.reload();await go('/routine');await page.goto(base+'/routine?start=evening',{waitUntil:'domcontentloaded'});await d.getByText('Bilancio trade',{exact:true}).waitFor();await d.getByRole('button',{name:'Avanti',exact:true}).click();await d.getByText('Decompressione',{exact:true}).waitFor();
  // Real timer path (not synthetic completion state); this step lasts about 76 seconds.
  await d.getByRole('button',{name:'Continua →',exact:true}).waitFor({timeout:100000});await d.getByRole('button',{name:'Continua →',exact:true}).click();
  for(let i=0;i<3;i++){await d.getByRole('button',{name:'Avanti',exact:true}).click();await page.waitForTimeout(400);}
  await d.getByText('Rivedi la sessione',{exact:true}).waitFor();const before=(await db.query('SELECT count(*)::int n FROM routine_completions WHERE user_id=$1',[uid])).rows[0].n;
  await page.route('**/api/routines/completions',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic routine outage'})}),{times:1});await d.getByRole('button',{name:'Completa sessione',exact:true}).click();await d.getByRole('alert').waitFor();assert.equal((await db.query('SELECT count(*)::int n FROM routine_completions WHERE user_id=$1',[uid])).rows[0].n,before);
  await d.getByRole('button',{name:'Completa sessione',exact:true}).dblclick();await d.waitFor({state:'hidden'});assert.equal((await db.query('SELECT count(*)::int n FROM routine_completions WHERE user_id=$1',[uid])).rows[0].n,before+1);await page.reload();await page.getByText('Sessione completata oggi',{exact:true}).first().waitFor();
 });
 assert.deepEqual(report.errors,[]);
 assert.ok(report.failures.every(x=>x.status===503 && /\/wiki\/sources\/text|\/journal\/\d+\/images|\/routines\/completions/.test(x.path)),JSON.stringify(report.failures));
 report.expectedInjectedFailures=report.failures;
}finally{flush();await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
console.log('BROWSER EXTRA',report.checks.length,'checks',report.checks.filter(x=>x.status==='failed').length,'failed');
