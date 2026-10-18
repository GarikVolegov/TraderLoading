import {installResponseProvenance,responseProvenance} from './response-provenance.mjs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {root,run,connect,base,database,auditExecutionId,setAuditScenario} from './env.mjs';
process.env.VERIFY_BASE_URL=base;
process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {signIn,ensureTestUser,completeOnboarding,dismiss,loadEnvLocal,apiFromPage}=await import('../../verify-usability/lib/common.mjs');
assert.match(loadEnvLocal().CLERK_SECRET_KEY,/^sk_test_/);
const out=run.output+'/browser-broker-pro-tornei-'+(process.argv[2]||'after');mkdirSync(out,{recursive:true});
const report={runId:run.runId,executionId:auditExecutionId,attemptId:randomUUID(),executedAt:new Date().toISOString(),mode:'Production frontend/API, Clerk Development, isolated synthetic users; simulated responses explicitly identified per scenario',limits:['No live broker profile synchronization, orders, Stripe sessions, on-chain mint, payment or real email delivery attempted.','FX Blue synchronization requires an actual public profile; missing API keys alone do not indicate it is unconfigured.'],checks:[],requests:[],errors:[]};
assert.equal((await fetch(base+'/api/healthz',{signal:AbortSignal.timeout(5000)})).status,200);
const db=await connect();const freeEmail='verify.brokerfree+clerk_test@example.com',proEmail='verify.brokerpro+clerk_test@example.com';
const freeId=await ensureTestUser(freeEmail),proId=await ensureTestUser(proEmail);
for(const [id,plan] of [[freeId,'free'],[proId,'pro']]){
 await db.query("DELETE FROM admin_users WHERE user_id=$1",[id]);
 await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,$2,'active','Isolated broker UI audit') ON CONFLICT(user_id) DO UPDATE SET plan=EXCLUDED.plan,status='active',reason=EXCLUDED.reason",[id,plan]);
}
let season=(await db.query("SELECT id,slug,status FROM tournament_seasons WHERE status='live' LIMIT 1")).rows[0];
if(!season)season=(await db.query("SELECT id,slug,status FROM tournament_seasons WHERE status='upcoming' ORDER BY starts_at LIMIT 1")).rows[0];
if(!season)season=(await db.query("INSERT INTO tournament_seasons(slug,label,starts_at,ends_at,status) VALUES($1,'Synthetic Browser Audit',now()-interval '1 day',now()+interval '1 day','live') RETURNING id,slug,status",['audit_browser_'+Date.now()])).rows[0];
report.fixture={seasonId:season.id,seasonSlug:season.slug,seasonStatus:season.status,users:'Dedicated Clerk test Free and Pro accounts with no admin role, no synchronized broker trades'};
const req=createRequire(root+'artifacts/trader-dashboard/package.json');const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
await ctx.addInitScript(()=>{try{localStorage.setItem('tl_language','it');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');localStorage.setItem('tl_cookie_consent_v1','declined');}catch{/* Sandboxed third-party frames do not have storage access. */}});
const page=await ctx.newPage();installResponseProvenance(page);page.setDefaultTimeout(10000);let scenario=null;
page.on('pageerror',e=>report.errors.push({scenario,message:e.message}));
page.on('response',r=>{if(r.url().startsWith(base+'/api/'))report.requests.push({scenario,path:new URL(r.url()).pathname,method:r.request().method(),status:r.status(),provenance:responseProvenance(r)});});
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const check=async(name,kind,fn)=>{if(process.env.AUDIT_SCENARIO_FILTER&&!new RegExp(process.env.AUDIT_SCENARIO_FILTER).test(name))return;scenario=name;setAuditScenario(name);try{await fn();report.checks.push({name,kind,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,kind,status:'failed',error:e.message.slice(0,1200)});console.log('FAIL',name,e.message.slice(0,500));await page.screenshot({path:out+'/failure-'+report.checks.length+'.png'}).catch(()=>{});}finally{await page.unrouteAll({behavior:'ignoreErrors'}).catch(()=>{});flush();scenario=null;setAuditScenario(null);}};
const button=name=>page.getByRole('button',{name,exact:true}).filter({visible:true}).first();
const go=async(path)=>{await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id),null,{timeout:30000});await page.waitForTimeout(700);await dismiss(page);};
const login=async(email)=>{if(await page.evaluate(()=>Boolean(window.Clerk?.user)))await page.evaluate(()=>window.Clerk.signOut({redirectUrl:'/sign-in'}));await signIn(page,email);await completeOnboarding(page,['EURUSD']);};
const unavailable='Abbonamento non disponibile al momento. Riprova più tardi.';
const fxInput=()=>page.locator('[role="tabpanel"]').getByPlaceholder('82364482 oppure https://www.fxblue.com/users/tuo-username');
const fxLabelInput=label=>page.locator('[role="tabpanel"] label').filter({hasText:label}).locator('..').locator('input');
try{
 await login(freeEmail);
 await check('Free broker gate and backend Pro authorization reject access','real isolated API',async()=>{
  await go('/broker');await page.getByText('Sblocca il Collegamento conto',{exact:true}).waitFor();await page.getByText(unavailable,{exact:true}).waitFor();
  assert.equal((await apiFromPage(page,'/api/brokers/profiles')).status,402);assert.equal(await page.getByRole('button',{name:'Passa a Pro',exact:true}).count(),0);
  assert.equal(await page.locator('[inert] [role="tabpanel"] input').first().evaluate(el=>Boolean(el.closest('[inert]'))),true);
 });
 await check('Free Pro page reports unavailable checkout and settings refresh preserves Free plan','real isolated API',async()=>{
  await go('/pro');await page.getByText(unavailable,{exact:true}).first().waitFor();assert.equal(await page.getByRole('button',{name:'Passa a Pro',exact:true}).count(),0);
  await go('/settings?section=abbonamento');const res=page.waitForResponse(r=>r.url().endsWith('/api/billing/me'));await button('Aggiorna stato').click();assert.equal((await res).status(),200);
  const data=await apiFromPage(page,'/api/billing/me');assert.equal(data.body.pro,false);assert.equal(data.body.checkoutAvailable,false);
 });
 await check('Tournament consent cancellation writes nothing and eligibility rejection is visible','real isolated API',async()=>{
  await go('/tornei');const before=report.requests.filter(x=>x.path==='/api/tornei/enroll').length;
  page.once('dialog',d=>d.dismiss());await button('Iscriviti al torneo').click();await page.waitForTimeout(300);assert.equal(report.requests.filter(x=>x.path==='/api/tornei/enroll').length,before);
  page.once('dialog',d=>d.accept());const response=page.waitForResponse(r=>r.url().endsWith('/api/tornei/enroll'));await button('Iscriviti al torneo').click();assert.equal((await response).status(),402);
  await page.getByText('Serve un conto reale sincronizzato per partecipare.',{exact:true}).waitFor();assert.equal((await db.query('SELECT count(*)::int n FROM tournament_enrollments WHERE user_id=$1',[freeId])).rows[0].n,0);
  await button('Percorso').click();await page.waitForResponse(r=>r.url().endsWith('/api/tornei/me')).catch(()=>{});await button('Arena').click();
 });
 await check('Tournament initial provider error shows an error and permits recovery','simulated /tornei/current 503 then real API',async()=>{
  await page.route('**/api/tornei/current',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic tournament outage'})}));
  await go('/tornei');await page.waitForTimeout(5000);await page.screenshot({path:out+'/tournament-error.png'});
  await page.getByRole('alert').filter({hasText:'Impossibile caricare i dati.'}).waitFor({timeout:1500});await page.unroute('**/api/tornei/current');await button('Riprova').click();await button('Iscriviti al torneo').waitFor();
 });
 await login(proEmail);
 await check('Manual Pro billing status persists and exposes no Stripe management actions','real isolated API',async()=>{
  await go('/pro');await page.getByText('Sei già Pro',{exact:true}).waitFor();await go('/settings?section=abbonamento');await page.getByText('Abilitato manualmente da admin',{exact:true}).filter({visible:true}).first().waitFor();
  const res=page.waitForResponse(r=>r.url().endsWith('/api/billing/me'));await button('Aggiorna stato').click();assert.equal((await res).status(),200);const status=(await apiFromPage(page,'/api/billing/me')).body;
  assert.equal(status.pro,true);assert.equal(status.manualOverride,true);assert.equal(status.canCancel,false);assert.equal(status.canResume,false);assert.equal(status.canViewInvoices,false);
 });
 await check('Broker missing measurement is not displayed as a real zero','real isolated API empty account list',async()=>{
  await go('/broker');assert.deepEqual((await apiFromPage(page,'/api/brokers/profiles')).body.profiles,[]);
  for(const label of ['Balance','Equity','Free margin','Daily P/L'])assert.equal(await page.getByText(label,{exact:true}).locator('..').locator('p').last().innerText(),'—');
 });
 await check('Broker form fields have accessible names and unavailable Back action is omitted','real frontend semantics',async()=>{
  await go('/broker');for(const label of ['Broker','Numero conto','Server broker','Username o URL profilo FX Blue'])assert.equal(await page.getByLabel(label,{exact:true}).count(),1,label+' needs a label association');
  assert.equal(await button('Indietro').count(),0,'No previous wizard step exists on the initial screen');
 });
 await check('Broker initial validation and invalid profile reject without provider network calls','real isolated API input rejection',async()=>{
  await go('/broker');assert.equal(await button('Prepara setup FX Blue').isDisabled(),true);assert.equal(await button('Collega profilo già sincronizzato').isDisabled(),true);
  const invalid='http://127.0.0.1/private';await fxInput().fill(invalid);const response=page.waitForResponse(r=>r.url().includes('/verify-profile'));await button('Collega profilo già sincronizzato').click();const rejected=await response;assert.equal(rejected.status(),400);assert.equal(await fxInput().inputValue(),invalid);await page.getByText((await rejected.json()).error,{exact:true}).first().waitFor();
 });
 await check('FX Blue setup intent and invalid verification retain profile input','real isolated API, no external profile fetch',async()=>{
  await go('/broker');await fxLabelInput('Numero conto').fill('audit_'+Date.now());await fxLabelInput('Server broker').fill('Synthetic-Audit-Server');const response=page.waitForResponse(r=>r.url().endsWith('/api/brokers/fxblue/setup-intents'));await button('Prepara setup FX Blue').click();assert.equal((await response).status(),201);
  assert.equal(await page.getByRole('link',{name:'Apri FX Blue Account Sync',exact:true}).getAttribute('href'),'https://diagnostics.fxblue.com/accountsync.aspx');await button('Ho completato il setup su FX Blue').click();
  const invalid='http://127.0.0.1/private';await page.locator('[role="tabpanel"] input').fill(invalid);const verify=page.waitForResponse(r=>r.url().includes('/verify-profile'));await button('Verifica dati FX Blue').click();assert.equal((await verify).status(),400);assert.equal(await page.locator('[role="tabpanel"] input').inputValue(),invalid);assert.equal(await page.getByText('Profilo FX Blue verificato',{exact:true}).count(),0);
 });
 await check('FX Blue waiting for synchronization cannot be described as verified','simulated offline verify response; real setup intent',async()=>{
  await go('/broker');await fxLabelInput('Numero conto').fill('audit_'+Date.now());await fxLabelInput('Server broker').fill('Synthetic-Audit-Server');await button('Prepara setup FX Blue').click();await button('Ho completato il setup su FX Blue').click();await page.locator('[role="tabpanel"] input').fill('audit-simulated-profile');
  await page.route('**/api/brokers/fxblue/setup-intents/*/verify-profile',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({intent:{id:'audit-simulated-intent',status:'waiting_for_sync',displayStatus:'In attesa del primo sync FX Blue.'},snapshot:{profileId:'audit-simulated-profile',status:'offline',kind:'fxblue-account-sync',brokerName:'Synthetic fixture',tradingEnabled:false,accounts:[],metrics:{balance:0,equity:0,margin:0,freeMargin:0,dailyProfit:0,currency:'USD'},positions:[],orders:[],lastUpdated:new Date().toISOString(),error:'In attesa del primo sync FX Blue.'}})}));
  const response=page.waitForResponse(r=>r.url().includes('/verify-profile'));await button('Verifica dati FX Blue').click();assert.equal((await response).status(),200);await page.waitForTimeout(300);await page.screenshot({path:out+'/fxblue-waiting.png'});
  assert.equal(await page.getByText('Profilo FX Blue verificato',{exact:true}).count(),0);await page.getByRole('alert').filter({hasText:'In attesa del primo sync FX Blue.'}).waitFor();assert.equal(await button('Verifica dati FX Blue').isEnabled(),true);
 });
 await check('Broker real zero stays zero and removing the last profile clears previous metrics and history','simulated broker service responses only',async()=>{
  const id='audit-simulated-profile';let removed=false;
  const profile={id,label:'Synthetic broker browser fixture',brokerName:'Synthetic fixture',kind:'fxblue-account-sync',providerKind:'fxblue-account-sync',accountId:'audit-account',environment:'demo',tradingEnabled:false,capabilities:{readAccount:true,readHistory:true,readPositions:true,placeOrders:false,closePositions:false},route:'fxblue_account_sync',health:'connected',connectionStatus:'connected',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  const snapshot={profileId:id,status:'connected',kind:'fxblue-account-sync',brokerName:profile.brokerName,tradingEnabled:false,accounts:[],metrics:{balance:0,equity:0,margin:0,freeMargin:0,dailyProfit:0,currency:'USD'},positions:[],orders:[],lastUpdated:new Date().toISOString()};
  await page.route('**/api/brokers/profiles**',async route=>{const path=new URL(route.request().url()).pathname;if(route.request().method()==='DELETE'){removed=true;return route.fulfill({status:204});}const body=path.endsWith('/snapshot')?snapshot:path.endsWith('/history')?[{id:'audit-deal',symbol:'AUDITPAIR',side:'buy',volume:1,profit:0,closedAt:new Date().toISOString(),source:'fxblue-account-sync'}]:{activeProfileId:removed?null:id,profiles:removed?[]:[profile]};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});
  await go('/broker');await page.getByText('Balance',{exact:true}).locator('..').getByText('0',{exact:true}).waitFor();await page.getByRole('tab',{name:'Account',exact:true}).click();await page.locator('[role="tabpanel"] button').last().click();await page.waitForTimeout(300);
  assert.equal(await page.getByText('Balance',{exact:true}).locator('..').locator('p').last().innerText(),'—');await page.getByRole('tab',{name:'Storico',exact:true}).click();assert.equal(await page.getByText('AUDITPAIR',{exact:true}).count(),0);
 });
 await check('Broker history failure is visible without a duplicate tab request or uncaught rejection','simulated broker service 503 responses only',async()=>{
  const id='audit-history-fixture';let historyCalls=0;const errorCount=report.errors.length;
  const snapshot={profileId:id,status:'connected',kind:'fxblue-account-sync',brokerName:'Synthetic fixture',tradingEnabled:false,accounts:[],metrics:{balance:0,equity:0,margin:0,freeMargin:0,dailyProfit:0,currency:'USD'},positions:[],orders:[],lastUpdated:new Date().toISOString()};
  await page.route('**/api/brokers/profiles**',route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/history')){historyCalls++;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic history outage"}'});}const body=path.endsWith('/snapshot')?snapshot:{activeProfileId:id,profiles:[]};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});
  await go('/broker');await page.getByText('Synthetic history outage',{exact:true}).waitFor();const before=historyCalls;await page.getByRole('tab',{name:'Storico',exact:true}).click();await page.waitForTimeout(500);assert.equal(historyCalls,before,'History is already loaded by the active-profile sync');assert.equal(report.errors.length,errorCount);report.historyRequests={beforeTab:before,afterTab:historyCalls};
 });
 await check('Delayed old broker refresh cannot restore a deleted account or its error','simulated delayed snapshot service responses only',async()=>{
  for(const oldFails of [false,true]){
   let removed=false,snapshotCalls=0,release;const gate=new Promise(r=>release=r);const id='audit-refresh-fixture';const profile={id,label:'Synthetic delayed refresh fixture',brokerName:'Synthetic fixture',kind:'fxblue-account-sync',providerKind:'fxblue-account-sync',accountId:'audit-account',environment:'demo',tradingEnabled:false,capabilities:{readAccount:true,readHistory:true,readPositions:true,placeOrders:false,closePositions:false},route:'fxblue_account_sync',health:'connected',connectionStatus:'connected',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   const snapshot={profileId:id,status:'connected',kind:'fxblue-account-sync',brokerName:profile.brokerName,tradingEnabled:false,accounts:[],metrics:{balance:1234,equity:1234,margin:0,freeMargin:1234,dailyProfit:0,currency:'USD'},positions:[],orders:[],lastUpdated:new Date().toISOString()};
   await page.route('**/api/brokers/profiles**',async route=>{const path=new URL(route.request().url()).pathname;if(route.request().method()==='DELETE'){removed=true;return route.fulfill({status:204});}if(path.endsWith('/snapshot')){const first=++snapshotCalls===1;if(first)await gate;if(first&&oldFails)return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic obsolete snapshot failure"}'});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)});}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/history')?[]:{activeProfileId:removed?null:id,profiles:removed?[]:[profile]})});});
   try{await go('/broker');await page.getByText('Balance',{exact:true}).locator('..').getByText('1,234',{exact:true}).waitFor();await page.getByRole('tab',{name:'Account',exact:true}).click();await page.locator('[role="tabpanel"] button').last().click();await page.waitForTimeout(300);assert.equal(await page.getByText('Balance',{exact:true}).locator('..').locator('p').last().innerText(),'—');release();await page.waitForTimeout(500);assert.equal(await page.getByText('Balance',{exact:true}).locator('..').locator('p').last().innerText(),'—','Obsolete response must not restore a deleted account');assert.equal(await page.getByText('Synthetic obsolete snapshot failure',{exact:true}).count(),0,'Obsolete failure must not overwrite successful refresh');}
   finally{release();await page.unroute('**/api/brokers/profiles**');}
  }
 });
 await check('Wallet invalid input, server outage, retry, reload and clear preserve truth','simulated PUT 503 then real persistence',async()=>{
  await go('/settings?section=abbonamento');const input=page.getByPlaceholder('0x…').filter({visible:true}).first();await input.fill('invalid');assert.equal(await button('Salva wallet').isDisabled(),true);await page.getByText('Indirizzo wallet non valido.',{exact:true}).waitFor();
  const address='0x'+('a'.repeat(40));await input.fill(address);await page.route('**/api/tornei/wallet',route=>route.request().method()==='PUT'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic wallet outage'})}):route.continue());const failed=page.waitForResponse(r=>r.url().endsWith('/api/tornei/wallet')&&r.request().method()==='PUT');await button('Salva wallet').click();assert.equal((await failed).status(),503);assert.equal(await input.inputValue(),address);
  assert.equal(await page.getByText('Indirizzo wallet non valido.',{exact:true}).count(),0,'A valid address must not be blamed for a server outage');
  await page.unroute('**/api/tornei/wallet');const saved=page.waitForResponse(r=>r.url().endsWith('/api/tornei/wallet')&&r.request().method()==='PUT');await button('Salva wallet').click();assert.equal((await saved).status(),200);await go('/settings?section=abbonamento');assert.equal(await page.getByPlaceholder('0x…').filter({visible:true}).first().inputValue(),address);assert.equal((await apiFromPage(page,'/api/tornei/wallet')).body.walletAddress,address);
  await page.getByPlaceholder('0x…').filter({visible:true}).first().fill('');const cleared=page.waitForResponse(r=>r.url().endsWith('/api/tornei/wallet')&&r.request().method()==='PUT');await button('Salva wallet').click();assert.equal((await cleared).status(),200);assert.equal((await apiFromPage(page,'/api/tornei/wallet')).body.walletAddress,null);
 });
 await check('Delayed wallet save cannot erase a newer draft and retry persists the new value','delayed real isolated API response',async()=>{
  await go('/settings?section=abbonamento');const input=page.getByPlaceholder('0x…').filter({visible:true}).first();const savedAddress='0x'+'c'.repeat(40),draftAddress='0x'+'d'.repeat(40);let release;const gate=new Promise(r=>release=r);let fetched;const started=new Promise(r=>fetched=r);
  await page.route('**/api/tornei/wallet',async route=>{if(route.request().method()!=='PUT')return route.continue();const response=await route.fetch();fetched();await gate;await route.fulfill({response});});
  try{await input.fill(savedAddress);const response=page.waitForResponse(r=>r.url().endsWith('/api/tornei/wallet')&&r.request().method()==='PUT');await button('Salva wallet').click();await started;await input.fill(draftAddress);release();assert.equal((await response).status(),200);await page.waitForTimeout(400);assert.equal(await input.inputValue(),draftAddress);assert.equal((await apiFromPage(page,'/api/tornei/wallet')).body.walletAddress,savedAddress);await page.unroute('**/api/tornei/wallet');const retry=page.waitForResponse(r=>r.url().endsWith('/api/tornei/wallet')&&r.request().method()==='PUT');await button('Salva wallet').click();assert.equal((await retry).status(),200);await go('/settings?section=abbonamento');assert.equal(await page.getByPlaceholder('0x…').filter({visible:true}).first().inputValue(),draftAddress);}
  finally{release();}
 });
 await check('Tournament mobile controls and wallet form fit the viewport','real isolated API mobile 390×844',async()=>{
  await page.setViewportSize({width:390,height:844});await go('/tornei');await button('Percorso').click();await button('Arena').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:out+'/mobile-tournament.png'});
  await go('/settings?section=abbonamento');await page.getByPlaceholder('0x…').filter({visible:true}).first().fill('0x'+'b'.repeat(40));await button('Salva wallet').click();await page.getByText('Wallet salvato.',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 });
 await check('Invoice retrieval failure is distinguished from an empty invoice list and retries','simulated Stripe status/invoices responses only',async()=>{
  await page.setViewportSize({width:1440,height:1000});const status=(await apiFromPage(page,'/api/billing/me')).body;
  await page.route('**/api/billing/me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...status,source:'stripe',manualOverride:false,canViewInvoices:true})}));await page.route('**/api/billing/invoices',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic invoice outage'})}));await go('/settings?section=abbonamento');await page.waitForTimeout(5000);await page.screenshot({path:out+'/invoice-error.png'});
  await page.getByRole('alert').filter({hasText:'Impossibile caricare i dati.'}).filter({visible:true}).first().waitFor({timeout:1500});await page.unroute('**/api/billing/invoices');await page.route('**/api/billing/invoices',route=>route.fulfill({status:200,contentType:'application/json',body:'{"invoices":[]}'}));await button('Riprova').click();await page.getByText('Nessuna fattura disponibile.',{exact:true}).filter({visible:true}).first().waitFor();
 });
 await login(freeEmail);
 await check('Second user cannot observe the Pro user wallet change','real isolated API user separation',async()=>{assert.notEqual((await apiFromPage(page,'/api/tornei/wallet')).body.walletAddress,'0x'+'b'.repeat(40));});
 await check('Checkout retry response from a closed dialog cannot override a newly opened request','simulated billing and failed checkout responses only',async()=>{
  const status=(await apiFromPage(page,'/api/billing/me')).body;await page.route('**/api/billing/me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...status,checkoutAvailable:true})}));
  let calls=0;let releaseOld,releaseNew;const oldGate=new Promise(r=>releaseOld=r),newGate=new Promise(r=>releaseNew=r);
  await page.route('**/api/billing/checkout-session',async route=>{const attempt=++calls;if(attempt===2)await oldGate;if(attempt>=3)await newGate;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Stripe not configured'})}).catch(()=>{});});
  try{await go('/pro');await button('Passa a Pro').click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Riprova',exact:true}).waitFor();await dialog.getByRole('button',{name:'Riprova',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role="dialog"] .animate-pulse'));await page.keyboard.press('Escape');await button('Passa a Pro').click();await page.waitForTimeout(200);assert.equal(calls,3);releaseOld();await page.waitForTimeout(400);assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Riprova',exact:true}).count(),0,'The previous dialog response must be ignored');}
  finally{releaseOld();releaseNew();}
 });
 assert.deepEqual(report.errors,[],'No uncaught browser errors are acceptable');
}finally{flush();await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
