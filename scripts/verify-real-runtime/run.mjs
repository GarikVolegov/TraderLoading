// Real Clerk + real API/DB smoke. The caller must provision a disposable schema-only
// database and API on :3002; never direct this runner at the personal API on :3001.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
process.env.VERIFY_BASE_URL='http://127.0.0.1:5182';
process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${JSON.parse(readFileSync(root+'.local-logs/runtime-db.json')).name}`;
const {loadEnvLocal,clerkUserId,USER_A,signIn,completeOnboarding,apiFromPage,dismiss}=await import('../verify-usability/lib/common.mjs');
const env=loadEnvLocal();
assert.match(env.CLERK_SECRET_KEY,/^sk_test_/,'Only a Development Clerk instance is allowed');
const {name}=JSON.parse(readFileSync(root+'.local-logs/runtime-db.json'));
assert.match(name,/^tl_audit_\d+$/);
const req=createRequire(root+'artifacts/trader-dashboard/package.json');
const {chromium}=await import('playwright');const {Client}=await import('pg');
const db=new Client({host:'127.0.0.1',port:55432,user:'trader',password:'trader',database:name});await db.connect();
const uid=await clerkUserId(USER_A);
await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated runtime audit') ON CONFLICT(user_id) DO NOTHING",[uid]);
await db.query('DELETE FROM profile WHERE user_id=$1',[uid]);
await db.end();
process.env.VITE_CLERK_PUBLISHABLE_KEY=env.VITE_CLERK_PUBLISHABLE_KEY;
process.env.VITE_API_BASE='http://127.0.0.1:3002';process.env.PORT='5182';
const {createServer}=await import(pathToFileURL(req.resolve('vite')).href);
const server=await createServer({cacheDir:root+'.local-logs/real-runtime-vite',configFile:root+'artifacts/trader-dashboard/vite.config.ts',server:{host:'127.0.0.1',port:5182,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const out=root+'artifacts.local/verify-real-runtime/';mkdirSync(out,{recursive:true});
const report={at:new Date().toISOString(),checks:[],errors:[],failedRequests:[],pages:[]};
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome'});
 await page.addInitScript(()=>{localStorage.setItem('tl_language','it');sessionStorage.setItem('tl_review_prompt_shown','1');localStorage.setItem('tl_cookie_consent_v1','declined');});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&r.url().includes('/api/'))report.failedRequests.push({path:new URL(r.url()).pathname,status:r.status()});});
 await signIn(page,USER_A);await completeOnboarding(page,['EURUSD']);
 const responses=await page.evaluate(async()=>{
  const token=await window.Clerk.session.getToken();
  return Promise.all(Array.from({length:16},async()=>{const r=await fetch('/api/profile',{headers:{Authorization:'Bearer '+token}});return {status:r.status,id:(await r.json()).id};}));
 });
 assert.ok(responses.every(r=>r.status===200));assert.equal(new Set(responses.map(r=>r.id)).size,1);
 const verifyDb=new Client({host:'127.0.0.1',port:55432,user:'trader',password:'trader',database:name});await verifyDb.connect();
 assert.equal((await verifyDb.query('SELECT count(*)::int AS n FROM profile WHERE user_id=$1',[uid])).rows[0].n,1);await verifyDb.end();
 report.checks.push('Concurrent first access creates exactly one profile');
 const settings=await apiFromPage(page,'/api/settings');assert.equal(settings.status,200);assert.deepEqual(settings.body.selectedPairs,['EURUSD']);report.checks.push('Real Clerk session and settings persistence');
 for(const path of ['/','/journal','/checklist','/routine','/backtest','/wiki','/chat','/library','/missions','/milestones','/tornei','/broker','/clock','/settings','/support','/calendar','/news']){
  await page.goto(process.env.VERIFY_BASE_URL+path,{waitUntil:'domcontentloaded'});
  await page.getByText(/^(Caricamento risorse|Sincronizzazione dati|Inizializzazione frequenze audio)/).waitFor({state:'hidden',timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1200);await dismiss(page);
  const body=await page.locator('body').innerText();
  report.pages.push({path,text:body.slice(-700)});
  await page.screenshot({path:out+(path==='/'?'home':path.slice(1))+'.png'});
  console.log('VISIT',path,body.length);
 }

 // Exercise actual navigation, form submission and persistence, not just direct URLs.
 await page.goto(process.env.VERIFY_BASE_URL+'/');await dismiss(page);
 await page.locator('a[href="/journal"]').filter({visible:true}).first().click();
 await page.waitForURL('**/journal');
 await page.getByRole('button',{name:'Nuovo Trade',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 await dialog.locator('input.uppercase').fill('EURUSD');
 await dialog.getByPlaceholder('Es. Breakout su EUR/USD sessione di Londra').fill('Runtime audit trade');
 await dialog.getByPlaceholder('Scrivi qui i dettagli del tuo trade, setup, entry, exit, emozioni...').fill('Test isolato di persistenza');
 const numbers=dialog.locator('input[type="number"]');
 await numbers.nth(0).fill('-25');await numbers.nth(1).fill('1.1');await numbers.nth(2).fill('1.0975');await numbers.nth(3).fill('1.0975');
 await dialog.getByRole('button',{name:'Salva nel Diario',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.reload();await dismiss(page);
 await page.getByText('Runtime audit trade',{exact:true}).first().waitFor();
 const entries=await apiFromPage(page,'/api/journal');assert.equal(entries.status,200);
 assert.ok(entries.body.some(e=>e.title==='Runtime audit trade'));report.checks.push('Sidebar navigation and journal form persist a real trade');
 await page.goto(process.env.VERIFY_BASE_URL+'/checklist');await dismiss(page);
 await page.getByPlaceholder('es. Ho controllato le news...').fill('Audit: attendo il setup');
 await page.getByRole('button',{name:'Aggiungi',exact:true}).click();
 await page.getByText('Audit: attendo il setup',{exact:true}).waitFor();await page.reload();
 await page.getByText('Audit: attendo il setup',{exact:true}).waitFor();report.checks.push('Checklist criteria persist after reload');
 const ticket=await apiFromPage(page,'/api/support/tickets',{method:'POST',body:JSON.stringify({subject:'Isolated audit',body:'Test message'})});
 assert.equal(ticket.status,201);const ticketId=ticket.body.ticket.id;
 assert.equal((await apiFromPage(page,`/api/support/tickets/${ticketId}/messages`,{method:'POST',body:JSON.stringify({body:'Test reply'})})).status,201);
 const detail=await apiFromPage(page,`/api/support/tickets/${ticketId}`);assert.equal(detail.body.messages.length,2);
 report.checks.push('Support ticket creation, reply and retrieval persist');
 await page.setViewportSize({width:390,height:844});
 await page.goto(process.env.VERIFY_BASE_URL+'/');await dismiss(page);
 await page.locator('a[href="/journal"]').filter({visible:true}).first().click();await page.waitForURL('**/journal');
 await page.getByRole('button',{name:'Nuovo Trade',exact:true}).click();await dialog.waitFor();
 await page.screenshot({path:out+'mobile-journal-form.png'});report.checks.push('Mobile navigation and journal form open');
 assert.deepEqual(report.errors,[]);
 assert.deepEqual(report.failedRequests.filter(r=>r.status>=500),[], 'Unexpected backend failures');

} finally {writeFileSync(out+'report.json',JSON.stringify(report,null,2));await browser.close();await server.close();}
console.log(JSON.stringify({checks:report.checks,errors:report.errors,failedRequests:report.failedRequests}));
