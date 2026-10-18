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
const USER_A='verify.replay+clerk_test@example.com';
const attemptId=run.runId+'-'+Date.now();
const out=run.output+'/browser-replay-'+(process.argv[2]||'after');mkdirSync(out,{recursive:true});
const report={runId:run.runId,mode:'production frontend + production API + Clerk Development',checks:[],pages:[],errors:[],failures:[]};
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
const _go=async(path)=>{await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id)&&document.body.innerText.length>100,null,{timeout:30000});await page.locator('a[href="/settings"]').first().waitFor({state:'attached'});await page.waitForTimeout(500);await dismiss(page);};
let session;
const candles=Array.from({length:600},(_,i)=>({time:1756684800+i*3600,open:1.1+i*0.00001,high:1.1001+i*0.00001,low:1.0999+i*0.00001,close:1.1+i*0.00001,volume:100}));
const state=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('traderloading:backtest-terminal:backtest-session-'+id)),session.id);
const enter=async()=>{await page.goto(base+`/backtest/${session.id}/replay`);await page.getByTestId('backtest-terminal').waitFor();await page.locator('.btm-clock-count').filter({hasText:'/'}).waitFor();await page.locator('.btm-center .btm-spin').waitFor({state:'hidden'});};
try{
 await signIn(page,USER_A);await completeOnboarding(page,['EURUSD']);
 const created=await apiFromPage(page,'/api/backtest/sessions',{method:'POST',body:JSON.stringify({name:'Replay audit '+attemptId,pair:'EUR/USD',timeframe:'H1'})});assert.equal(created.status,200);session=created.body;
 report.dataMode='Synthetic candle fixture in browser; real Clerk, API and isolated PostgreSQL for sessions and trades';
 await page.route('**/api/backtest/candles?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({candles,source:'synthetic-audit'})}));
 await page.route('**/api/backtest/candles/meta?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbol:'EURUSD',warehouseEnabled:false,warehouse:null})}));
 await check('Replay advances, plays, pauses and restores cursor after reload',async()=>{
  await enter();const before=await state();await page.getByRole('button',{name:'Avanti di una candela',exact:true}).click();assert.equal((await state()).cursorTime,before.cursorTime+3600);
  await page.getByRole('button',{name:'Play (Spazio)',exact:true}).click();await page.waitForTimeout(1600);await page.getByRole('button',{name:'Pausa (Spazio)',exact:true}).click();const cursor=(await state()).cursorTime;assert.ok(cursor>before.cursorTime+3600);await enter();assert.equal((await state()).cursorTime,cursor);
 });
 await check('Indicator toggle survives reload and chart renders',async()=>{
  const chip=page.locator('.btm-indstrip button[data-on]').nth(1);const before=await chip.getAttribute('data-on');await chip.click();assert.notEqual(await chip.getAttribute('data-on'),before);await enter();assert.notEqual(await page.locator('.btm-indstrip button[data-on]').nth(1).getAttribute('data-on'),before);assert.ok(await page.locator('.btm-chartwrap canvas').count()>0);
 });
 await check('Replay breakeven trade persists once through API and subsequent reload',async()=>{
  await page.getByRole('button',{name:'BUY',exact:true}).click();await page.getByRole('button',{name:'Chiudi a mercato (C)',exact:true}).waitFor();
  const saved=page.waitForResponse(r=>r.url().endsWith(`/api/backtest/sessions/${session.id}/trades`)&&r.request().method()==='POST');await page.getByRole('button',{name:'Chiudi a mercato (C)',exact:true}).click();assert.equal((await saved).status(),200);
  let trades=(await apiFromPage(page,`/api/backtest/sessions/${session.id}/trades`)).body;assert.equal(trades.length,1);assert.equal(trades[0].result,'breakeven');assert.equal(Number(trades[0].pips),0);
  await enter();trades=(await apiFromPage(page,`/api/backtest/sessions/${session.id}/trades`)).body;assert.equal(trades.length,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM backtest_trades WHERE session_id=$1',[session.id])).rows[0].n,1);
 });
 await check('Failed replay trade save remains local and retries once on session reload',async()=>{
  await page.route(`**/api/backtest/sessions/${session.id}/trades`,async route=>{if(route.request().method()==='POST')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic persistence outage'})});else await route.continue();});
  await page.getByRole('button',{name:'SELL',exact:true}).click();const failed=page.waitForResponse(r=>r.status()===503&&r.url().endsWith('/trades'));await page.getByRole('button',{name:'Chiudi a mercato (C)',exact:true}).click();await failed;
  assert.equal((await state()).trades.length,2);assert.equal((await apiFromPage(page,`/api/backtest/sessions/${session.id}/trades`)).body.length,1);
  await page.unroute(`**/api/backtest/sessions/${session.id}/trades`);const saved=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/trades'));await enter();assert.equal((await saved).status(),200);assert.equal((await apiFromPage(page,`/api/backtest/sessions/${session.id}/trades`)).body.length,2);
  await enter();assert.equal((await apiFromPage(page,`/api/backtest/sessions/${session.id}/trades`)).body.length,2);
 });
 await check('Mobile replay explains desktop requirement and provides working exit',async()=>{
  await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'Disponibile su desktop'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:out+'/mobile.png'});await page.getByRole('button',{name:'Torna al backtest',exact:true}).filter({visible:true}).click();await page.waitForURL('**/backtest');
 });
 assert.deepEqual(report.errors,[]);assert.ok(report.failures.every(x=>x.path.endsWith('/trades')&&x.status===503));
}finally{flush();await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
