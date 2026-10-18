import {installResponseProvenance,responseProvenance} from './response-provenance.mjs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {root,run,connect,base,database,api,auditExecutionId,setAuditScenario} from './env.mjs';
process.env.VERIFY_BASE_URL=base;
process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {signIn,ensureTestUser,completeOnboarding,dismiss,loadEnvLocal}=await import('../../verify-usability/lib/common.mjs');
assert.match(loadEnvLocal().CLERK_SECRET_KEY,/^sk_test_/);
const email='verify.adminui+clerk_test@example.com';
const out=run.output+'/browser-admin-'+(process.argv[2]||'after');mkdirSync(out,{recursive:true});
const report={runId:run.runId,executionId:auditExecutionId,attemptId:randomUUID(),executedAt:new Date().toISOString(),mode:'production frontend + production API + Clerk Development; isolated synthetic targets',checks:[],requests:[],errors:[],failures:[]};
assert.equal((await fetch(base+'/api/healthz',{signal:AbortSignal.timeout(5000)})).status,200,'Isolated API must be healthy before browser audit');
const db=await connect();const admin=await ensureTestUser(email);
await db.query("INSERT INTO admin_users(user_id,role,status) VALUES($1,'super_admin','active') ON CONFLICT(user_id) DO UPDATE SET role='super_admin',status='active'",[admin]);
await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated browser audit') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[admin]);
const target='audit_adminui_'+Date.now(),sid=randomUUID();
await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[sid,{user:{id:target,email:null,firstName:'Audit',lastName:'AdminUI'},access_token:'isolated-local-session'},new Date(Date.now()+86400000)]);
await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[target,'Audit AdminUI '+target]);
const subject='Admin UI ticket '+target;
const ticket=await api(sid,'/support/tickets','POST',{subject,body:'Synthetic support request'});assert.equal(ticket.status,201);const ticketId=ticket.data.ticket.id;
const otherSubject='Admin UI second ticket '+target;
const otherTicket=await api(sid,'/support/tickets','POST',{subject:otherSubject,body:'Synthetic second support request'});assert.equal(otherTicket.status,201);
const reviewText='Admin UI synthetic review '+target;
const review=await api(sid,'/reviews','POST',{rating:5,text:reviewText,consent:true});assert.equal(review.status,201);
const reviewId=(await db.query('SELECT id FROM testimonials WHERE user_id=$1',[target])).rows[0].id;
const req=createRequire(root+'artifacts/trader-dashboard/package.json');
const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
await ctx.addInitScript(()=>{localStorage.setItem('tl_language','it');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');localStorage.setItem('tl_cookie_consent_v1','declined');});
const page=await ctx.newPage();installResponseProvenance(page);page.setDefaultTimeout(10000);let scenario=null;
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith(base+'/api/')){report.requests.push({scenario,path:new URL(r.url()).pathname,method:r.request().method(),status:r.status(),provenance:responseProvenance(r)});if(r.status()>=500)report.failures.push({path:new URL(r.url()).pathname,status:r.status(),provenance:responseProvenance(r)});}});
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const check=async(name,fn)=>{scenario=name;setAuditScenario(name);try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message.slice(0,1200)});console.log('FAIL',name,e.message.slice(0,500));await page.screenshot({path:out+'/failure-'+report.checks.length+'.png'}).catch(()=>{});await page.unroute('**/api/**').catch(()=>{});}flush();scenario=null;setAuditScenario(null);};
const button=name=>page.getByRole('button',{name,exact:true}).filter({visible:true}).first();
const go=async(path)=>{await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id),null,{timeout:30000});await page.waitForTimeout(700);await dismiss(page);};
const action=async(path,name,status=200)=>{const response=page.waitForResponse(r=>r.url().endsWith('/api'+path)&&r.request().method()==='POST');await button(name).click();assert.equal((await response).status(),status);await page.waitForTimeout(300);};
const failOnce=async path=>page.route('**/api'+path,async route=>{if(route.request().method()==='POST')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic admin outage'})});else await route.continue();});
try{
 await signIn(page,email);await completeOnboarding(page,['EURUSD']);
 await check('Admin ticket reply retains failed draft then saves one message and status across reload',async()=>{
  await go('/admin/support/tickets');await page.getByRole('button',{name:new RegExp(subject)}).click();const text='Synthetic admin reply '+target;
  await page.getByPlaceholder('Scrivi una risposta').fill(text);await failOnce(`/admin/support/tickets/${ticketId}/reply`);await action(`/admin/support/tickets/${ticketId}/reply`,'Invia risposta',503);
  assert.equal(await page.getByPlaceholder('Scrivi una risposta').inputValue(),text);assert.equal((await db.query('SELECT count(*)::int n FROM support_ticket_messages WHERE ticket_id=$1 AND author_type=$2',[ticketId,'support'])).rows[0].n,0);
  await page.unroute('**/api'+`/admin/support/tickets/${ticketId}/reply`);await action(`/admin/support/tickets/${ticketId}/reply`,'Invia risposta',201);await page.getByText(text,{exact:true}).waitFor();
  assert.equal((await db.query('SELECT count(*)::int n FROM support_ticket_messages WHERE ticket_id=$1 AND author_type=$2',[ticketId,'support'])).rows[0].n,1);
  await action(`/admin/support/tickets/${ticketId}/status`,'Chiudi');assert.equal((await db.query('SELECT status FROM support_tickets WHERE id=$1',[ticketId])).rows[0].status,'closed');await page.reload();await page.getByRole('button',{name:new RegExp(subject)}).click();await page.getByText(text,{exact:true}).waitFor();await action(`/admin/support/tickets/${ticketId}/status`,'Riapri');assert.equal((await api(sid,`/support/tickets/${ticketId}`)).data.ticket.status,'open');
 });
 await check('Admin subscriptions invalid reason, failed draft, upgrade and downgrade persist',async()=>{
  await go('/admin/subscriptions');await page.getByLabel('User ID abbonamento',{exact:true}).fill(target);await page.getByLabel('Motivo modifica abbonamento',{exact:true}).fill('x');assert.equal(await button('Applica').isDisabled(),true);await page.getByLabel('Motivo modifica abbonamento',{exact:true}).fill('Synthetic audited update');await page.getByLabel('Piano abbonamento',{exact:true}).selectOption('pro');
  await failOnce(`/admin/subscriptions/${target}`);await action(`/admin/subscriptions/${target}`,'Applica',503);assert.equal(await page.getByLabel('User ID abbonamento',{exact:true}).inputValue(),target);await page.getByText('Aggiornamento non riuscito. Controlla piano, stato e motivo.',{exact:true}).waitFor();await page.unroute('**/api'+`/admin/subscriptions/${target}`);
  await action(`/admin/subscriptions/${target}`,'Applica');assert.equal((await db.query('SELECT plan FROM admin_user_subscriptions WHERE user_id=$1',[target])).rows[0].plan,'pro');await page.reload();await page.getByLabel('User ID abbonamento',{exact:true}).fill(target);await page.getByLabel('Piano abbonamento',{exact:true}).selectOption('free');await page.getByLabel('Motivo modifica abbonamento',{exact:true}).fill('Synthetic audited downgrade');await action(`/admin/subscriptions/${target}`,'Applica');assert.equal((await db.query('SELECT plan FROM admin_user_subscriptions WHERE user_id=$1',[target])).rows[0].plan,'free');
 });
 await check('Delayed ticket reply cannot clear the draft of another selected ticket',async()=>{
  await go('/admin/support/tickets');await page.getByRole('button',{name:new RegExp(subject)}).click();await page.getByPlaceholder('Scrivi una risposta').fill('Delayed synthetic reply');
  await page.route('**/api'+`/admin/support/tickets/${ticketId}/reply`,async route=>{await new Promise(resolve=>setTimeout(resolve,1500));await route.continue();});const response=page.waitForResponse(r=>r.url().endsWith(`/api/admin/support/tickets/${ticketId}/reply`)&&r.request().method()==='POST');await button('Invia risposta').click();await button('Elenco ticket').click();await page.getByRole('button',{name:new RegExp(otherSubject)}).click();await page.getByPlaceholder('Scrivi una risposta').fill('Draft belonging to the second ticket');assert.equal((await response).status(),201);await page.waitForTimeout(400);await page.unroute('**/api'+`/admin/support/tickets/${ticketId}/reply`);assert.equal(await page.getByPlaceholder('Scrivi una risposta').inputValue(),'Draft belonging to the second ticket');assert.equal((await db.query('SELECT count(*)::int n FROM support_ticket_messages WHERE ticket_id=$1 AND author_type=$2',[otherTicket.data.ticket.id,'support'])).rows[0].n,0);
 });
 await check('Admin user action server error is visible and preserves reason',async()=>{
  await go('/admin/users/'+target);await page.getByPlaceholder('Motivo obbligatorio per azioni admin').fill('Synthetic suspension test');await failOnce(`/admin/users/${target}/suspend`);await action(`/admin/users/${target}/suspend`,'Sospendi',503);await page.unroute('**/api'+`/admin/users/${target}/suspend`);assert.equal(await page.getByPlaceholder('Motivo obbligatorio per azioni admin').inputValue(),'Synthetic suspension test');await page.getByText('Synthetic admin outage',{exact:true}).waitFor();
 });
 await check('Admin user suspension and reactivation persist and gate owner access',async()=>{
  await go('/admin/users/'+target);await page.getByPlaceholder('Motivo obbligatorio per azioni admin').fill('Synthetic suspension test');await action(`/admin/users/${target}/suspend`,'Sospendi');assert.equal((await api(sid,'/profile')).status,401);await page.reload();await page.getByText('suspended',{exact:true}).first().waitFor();await page.getByPlaceholder('Motivo obbligatorio per azioni admin').fill('Synthetic reactivation test');await action(`/admin/users/${target}/reactivate`,'Riattiva');assert.equal((await api(sid,'/profile')).status,200);
 });
 await check('Admin review approve, public visibility, hide, republish and reject',async()=>{
  await go('/admin/reviews');let row=page.getByRole('row').filter({hasText:reviewText});await row.getByRole('button',{name:'Approva',exact:true}).click();await page.waitForTimeout(500);assert.equal((await db.query('SELECT published FROM testimonials WHERE id=$1',[reviewId])).rows[0].published,true);assert.ok((await api(null,'/public/testimonials')).data.testimonials.some(x=>x.id===reviewId));
  await button('Pubblicate').click();row=page.getByRole('row').filter({hasText:reviewText});await row.getByRole('button',{name:'Nascondi',exact:true}).click();await page.waitForTimeout(500);assert.equal((await db.query('SELECT published FROM testimonials WHERE id=$1',[reviewId])).rows[0].published,false);assert.ok(!(await api(null,'/public/testimonials')).data.testimonials.some(x=>x.id===reviewId));await row.getByText('Nascosta',{exact:true}).waitFor();await row.getByRole('button',{name:'Approva',exact:true}).click();await page.waitForTimeout(500);assert.equal((await db.query('SELECT published FROM testimonials WHERE id=$1',[reviewId])).rows[0].published,true);await page.getByPlaceholder('Motivo del rifiuto').fill('Synthetic review rejected');await row.getByRole('button',{name:'Rifiuta',exact:true}).click();await page.waitForTimeout(500);assert.equal((await db.query('SELECT status,published FROM testimonials WHERE id=$1',[reviewId])).rows[0].status,'rejected');
 });
 await check('Admin revoke sessions removes synthetic session and denies its reuse',async()=>{
  await go('/admin/users/'+target);assert.equal((await api(sid,'/profile')).status,200);await page.getByPlaceholder('Motivo obbligatorio per azioni admin').fill('Synthetic browser session revocation');await action(`/admin/users/${target}/revoke-sessions`,'Revoca sessioni');assert.equal((await db.query('SELECT count(*)::int n FROM sessions WHERE sid=$1',[sid])).rows[0].n,0);assert.equal((await api(sid,'/profile')).status,401);
 });
 await check('Admin mobile subscription controls stay within viewport',async()=>{await page.setViewportSize({width:390,height:844});await go('/admin/subscriptions');const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dimensions.scroll<=dimensions.width+2,JSON.stringify(dimensions));await page.getByLabel('User ID abbonamento',{exact:true}).fill(target);await page.getByLabel('Motivo modifica abbonamento',{exact:true}).fill('Synthetic mobile update');await action(`/admin/subscriptions/${target}`,'Applica');await page.screenshot({path:out+'/mobile-subscriptions.png'});});
 assert.deepEqual(report.errors,[]);assert.ok(report.failures.every(x=>x.status===503));
}finally{flush();await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
