import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {root,run,base,database,connect,auditExecutionId,setAuditScenario} from './env.mjs';
import {installResponseProvenance,responseProvenance} from './response-provenance.mjs';
process.env.VERIFY_BASE_URL=base;
process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {signIn,ensureTestUser,completeOnboarding,dismiss,apiFromPage}=await import('../../verify-usability/lib/common.mjs');
const label=process.argv[2]||'after';assert.match(label,/^[a-z0-9-]+$/);
const out=run.output+'/browser-library-editor-'+label;mkdirSync(out,{recursive:true});
const report={runId:run.runId,executionId:auditExecutionId,mode:'Real Clerk Development and isolated production API; only error response is simulated',checks:[],requests:[],errors:[]};
const email='verify.library.editor+clerk_test@example.com',admin=await ensureTestUser(email),db=await connect();
await db.query("INSERT INTO admin_users(user_id,role,status) VALUES($1,'content_manager','active') ON CONFLICT(user_id) DO UPDATE SET role='content_manager',status='active'",[admin]);
const req=createRequire(root+'artifacts/trader-dashboard/package.json'),browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
await ctx.addInitScript(()=>{localStorage.setItem('tl_language','it');localStorage.setItem('tl_cookie_consent_v1','declined');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');});
await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
const page=await ctx.newPage();installResponseProvenance(page);page.setDefaultTimeout(10000);
let scenario=null;const prefix='audit_library_ui_'+Date.now(),files=[];
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith(base+'/api/'))report.requests.push({scenario,path:new URL(r.url()).pathname,method:r.request().method(),status:r.status(),provenance:responseProvenance(r)});});
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const dialog=()=>page.getByRole('dialog').last(),save=()=>dialog().getByRole('button',{name:'Salva',exact:true}),cancel=()=>dialog().getByRole('button',{name:'Annulla',exact:true});
const open=async title=>{await page.getByRole('button',{name:'Contenuto',exact:true}).click();await dialog().getByPlaceholder('Titolo',{exact:true}).fill(title);};
const written=title=>db.query('SELECT * FROM library_contents WHERE title=$1 AND created_by=$2',[title,admin]).then(r=>r.rows);
const submit=async()=>{const response=page.waitForResponse(r=>r.url().endsWith('/api/library/contents')&&r.request().method()==='POST');await save().click();assert.equal((await response).status(),201);await dialog().waitFor({state:'hidden'});};
async function hold(path,method,fn){let release,entered;const wait=new Promise(r=>release=r),seen=new Promise(r=>entered=r);let requests=0;
 await page.route('**/api'+path,async route=>{if(route.request().method()!==method)return route.continue();requests++;entered();await wait;await route.fulfill({response:await route.fetch()});});
 try{await fn({seen,release,count:()=>requests});}finally{release();await page.waitForTimeout(500);await page.unroute('**/api'+path);}
}
async function check(name,fn){scenario=name;setAuditScenario(name);try{await page.goto(base+'/library',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Contenuto',exact:true}).waitFor();await dismiss(page);await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message.slice(0,1200)});console.log('FAIL',name,e.message.slice(0,500));await page.screenshot({path:out+'/failure-'+report.checks.length+'.png'}).catch(()=>{});}finally{await page.unroute('**/api/**');if(await dialog().count()){await page.keyboard.press('Escape');await page.waitForTimeout(300);}flush();scenario=null;setAuditScenario(null);}}
try{
 await signIn(page,email);await completeOnboarding(page,['EURUSD']);await page.goto(base+'/library',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Contenuto',exact:true}).waitFor();await dismiss(page);
 await check('Published library note is created in the editor and remains readable after reload',async()=>{
  const title=prefix+'_published';await open(title);await dialog().getByPlaceholder('Testo / note (opzionale)').fill('Synthetic editor body');await dialog().getByRole('checkbox').check();await submit();
  const rows=await written(title);assert.equal(rows.length,1);assert.equal(rows[0].collection_id,null);assert.equal(rows[0].published,true);
  const publicRead=await fetch(base+'/api/library/contents/'+rows[0].id);assert.equal(publicRead.status,200);assert.equal((await publicRead.json()).bodyMarkdown,'Synthetic editor body');
  await page.reload();const card=page.locator('.tl-panel').filter({has:page.getByRole('heading',{name:title,exact:true})});await card.getByRole('button',{name:'Apri',exact:true}).click();await dialog().getByText('Synthetic editor body',{exact:true}).waitFor();await page.keyboard.press('Escape');
 });
 await check('A pending library upload blocks save and closure until its real file URL is available',async()=>{
  const title=prefix+'_upload';await open(title);
  await hold('/library/upload','POST',async({seen,release})=>{
   await dialog().locator('input[type=file]').setInputFiles({name:'audit-note.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic uploaded note')});await seen;
   assert.equal(await save().isDisabled(),true,'Save must wait for upload');assert.equal(await cancel().isDisabled(),true,'Cancel must not lose a pending upload');await page.keyboard.press('Escape');assert.equal(await dialog().count(),1);
   release();await dialog().getByText('audit-note.txt',{exact:true}).waitFor();
  });
  await submit();const rows=await written(title);assert.equal(rows.length,1);assert.ok(rows[0].file_url);files.push(rows[0].file_url);assert.equal((await apiFromPage(page,rows[0].file_url)).status,200);
 });
 await check('Delayed library save freezes the submitted draft and prevents duplicate writes or premature closure',async()=>{
  const title=prefix+'_pending';await open(title);
  await hold('/library/contents','POST',async({seen,release,count})=>{
   await save().evaluate(button=>{button.click();button.click();});await seen;
   assert.equal(await dialog().getByPlaceholder('Titolo',{exact:true}).isDisabled(),true,'Submitted fields remain frozen');assert.equal(await cancel().isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await dialog().count(),1);
   release();await dialog().waitFor({state:'hidden'});assert.equal(count(),1);
  });assert.equal((await written(title)).length,1);
 });
 await check('Failed library save keeps the draft with an accessible error and a real retry persists it once',async()=>{
  const title=prefix+'_retry';await open(title);await dialog().getByPlaceholder('Testo / note (opzionale)').fill('Retry retained body');
  await page.route('**/api/library/contents',async route=>{if(route.request().method()==='POST')await route.fulfill({status:503,contentType:'application/json',json:{error:'Synthetic library outage'}});else await route.continue();});
  const response=page.waitForResponse(r=>r.url().endsWith('/api/library/contents')&&r.request().method()==='POST');await save().click();assert.equal((await response).status(),503);await page.waitForTimeout(400);
  assert.equal(await dialog().getByPlaceholder('Titolo',{exact:true}).inputValue(),title);assert.equal((await written(title)).length,0);assert.ok(await dialog().getByRole('alert').innerText());
  await page.unroute('**/api/library/contents');await submit();assert.equal((await written(title)).length,1);
 });
 await check('Library editor updates a saved note and delete removes it from both database and reloaded feed',async()=>{
  const title=prefix+'_published',edited=title+'_edited';const card=page.locator('.tl-panel').filter({has:page.getByRole('heading',{name:title,exact:true})});await card.locator('button').nth(0).click();
  await dialog().getByPlaceholder('Titolo',{exact:true}).fill(edited);const row=(await written(title))[0];const response=page.waitForResponse(r=>r.url().endsWith('/api/library/contents/'+row.id)&&r.request().method()==='PUT');await save().click();assert.equal((await response).status(),200);await dialog().waitFor({state:'hidden'});assert.equal((await written(edited))[0].body_markdown,'Synthetic editor body');
  const editedCard=page.locator('.tl-panel').filter({has:page.getByRole('heading',{name:edited,exact:true})});const deleted=page.waitForResponse(r=>r.url().endsWith('/api/library/contents/'+row.id)&&r.request().method()==='DELETE');await editedCard.locator('button').nth(1).click();assert.equal((await deleted).status(),200);assert.equal((await written(edited)).length,0);await page.reload();assert.equal(await page.getByRole('heading',{name:edited,exact:true}).count(),0);
 });
 await check('Mobile library editor fits the viewport and restores keyboard focus after cancellation',async()=>{
  await page.setViewportSize({width:390,height:844});await open(prefix+'_cancelled');const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+2);await dialog().screenshot({path:out+'/mobile-editor.png'});await cancel().click();await page.waitForFunction(()=>document.activeElement?.textContent?.includes('Contenuto'));assert.equal((await written(prefix+'_cancelled')).length,0);
 });assert.deepEqual(report.errors,[]);
}finally{
 const rows=(await db.query('DELETE FROM library_contents WHERE created_by=$1 AND title LIKE $2 RETURNING file_url',[admin,prefix+'%'])).rows;
 for(const file of [...files,...rows.map(r=>r.file_url)].filter(Boolean)){if(/^\/api\/uploads\/library-files\/lib-[a-zA-Z0-9_.-]+$/.test(file))rmSync(root+'.local-logs/runtime-sandbox/'+database+'/uploads/library-files/'+file.split('/').at(-1),{force:true});}
 flush();await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();
}
if(report.checks.some(c=>c.status==='failed'))process.exitCode=1;
