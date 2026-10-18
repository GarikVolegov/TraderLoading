import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {writeFileSync} from 'node:fs';import {performance} from 'node:perf_hooks';import {chromium} from 'playwright';
import {root,run,base,database,connect} from './env.mjs';
process.env.VERIFY_BASE_URL=base;process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {ensureTestUser,signIn,completeOnboarding,dismiss}=await import('../../verify-usability/lib/common.mjs');const req=createRequire(root+'artifacts/trader-dashboard/package.json'),db=await connect(),email='verify.perf+clerk_test@example.com',uid=await ensureTestUser(email),label=process.argv[2]||'baseline';
const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});page.setDefaultTimeout(30000);
await page.addInitScript(()=>{localStorage.setItem('tl_language','it');localStorage.setItem('tl_cookie_consent_v1','declined');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');sessionStorage.setItem('tl_review_prompt_shown','1');localStorage.setItem('tl_checked_sessions_'+new Date().toISOString().slice(0,10),JSON.stringify(['Asiatica','Londinese','New York','Conferma Vol.']));});
const report={runId:run.runId,label,samples:[]},flush=()=>writeFileSync(run.output+'/browser-performance-'+label+'.json',JSON.stringify(report,null,2));
try{
 await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status) VALUES($1,'pro','active') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[uid]);
 await signIn(page,email);await completeOnboarding(page,['EURUSD']);const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
 for(const rows of [100,1000,10000]){
  await db.query('DELETE FROM journal_entries WHERE user_id=$1',[uid]);await db.query("INSERT INTO journal_entries(user_id,title,content,trade_date,result) SELECT $1,'Synthetic Perf '||i,repeat('Audit ',20),'2026-10-01','none' FROM generate_series(1,$2::int) i",[uid,rows]);
  const repeats=label==='baseline'?1:13;
  for(let sample=0;sample<repeats;sample++){
   const cold=sample<3;await cdp.send('Network.setCacheDisabled',{cacheDisabled:cold});if(cold)await cdp.send('Network.clearBrowserCache');
   const started=performance.now();await page.goto(base+'/journal?t=trades',{waitUntil:'domcontentloaded'});await page.getByText(/^Synthetic Perf \d+$/).first().waitFor();const usable=performance.now()-started;
   await dismiss(page);const click=performance.now();await page.getByRole('button',{name:'Nuovo Trade',exact:true}).first().click();await page.getByRole('dialog').waitFor();const clickMs=performance.now()-click;await page.keyboard.press('Escape');
   const metrics=(await cdp.send('Performance.getMetrics')).metrics;const memory=metrics.find(x=>x.name==='JSHeapUsedSize')?.value;
   const nodes=await page.locator('*').count();const cards=await page.getByText(/^Synthetic Perf \d+$/).count();
   report.samples.push({rows,sample,cold,usableMs:usable,clickMs,nodes,cards,heapBytes:memory});flush();console.log(report.samples.at(-1));
   assert.ok(cards>0);
  }
 }
}finally{flush();await browser.close();await db.end();}
