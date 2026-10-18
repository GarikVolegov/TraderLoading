import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {root,run,base,database,connect,auditExecutionId} from './env.mjs';
import {installResponseProvenance,responseProvenance} from './response-provenance.mjs';
process.env.VERIFY_BASE_URL=base;process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {ensureTestUser,signIn,completeOnboarding,apiFromPage,dismiss}=await import('../../verify-usability/lib/common.mjs');
const label=process.argv[2]||'after';assert.match(label,/^[a-z0-9-]+$/);
const out=run.output+'/browser-chat-sends-'+label;mkdirSync(out,{recursive:true});
const report={runId:run.runId,executionId:auditExecutionId,frontendBuild:JSON.parse(readFileSync(root+'.local-logs/runtime-api-process.json')).frontendBuild?.sha256,mode:'Actual production UI/Clerk/SQL; controlled precommit errors and held requests; no external recipients; retries in same SPA lifetime only',checks:[],requests:[],errors:[]};
const db=await connect(),emails=['verify.chat.sends.a+clerk_test@example.com','verify.chat.sends.b+clerk_test@example.com'],ids=[];
for(const email of emails){const id=await ensureTestUser(email);ids.push(id);await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated social boundary test') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[id]);}
const tag='chat-sends-'+Date.now(),content='Synthetic attachment '+tag,files=[],posts=[];let third;
const req=createRequire(root+'artifacts/trader-dashboard/package.json'),browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()}),contexts=[],pages=[];
let scenario=null;const requestScenarios=new WeakMap();
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
async function check(name,fn){scenario=name;try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,350));await pages[0].screenshot({path:out+'/failure-'+report.checks.length+'.png'}).catch(()=>{});}finally{scenario=null;flush();}}
async function go(page,path){await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.locator('nav[aria-label="Navigazione principale"]:visible').waitFor();await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id));await dismiss(page);}
async function conversation(page,peer){await go(page,'/chat?t=conversazioni&peer='+peer);await page.locator('input[type=file]').waitFor({state:'attached'});await page.waitForFunction(async()=>{const r=await fetch('/api/chat/key-backup');return r.ok&&(await r.json()).hasBackup;});}

try{
 for(let i=0;i<2;i++){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});contexts.push(ctx);
  await ctx.addInitScript(()=>{localStorage.setItem('tl_language','it');localStorage.setItem('tl_cookie_consent_v1','declined');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');});
  await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});const page=await ctx.newPage();pages.push(page);page.setDefaultTimeout(15000);installResponseProvenance(page);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>requestScenarios.set(r,scenario));page.on('response',r=>{if(r.url().startsWith(base+'/api/'))report.requests.push({scenario:requestScenarios.get(r.request()),method:r.request().method(),path:new URL(r.url()).pathname,status:r.status(),provenance:responseProvenance(r)});});
  await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;if(['/api/market/context','/api/calendar','/api/news','/api/news/macro','/api/tools/cot','/api/tools/volatility','/api/tools/sentiment'].includes(path))return route.fulfill({status:503,json:{error:'Synthetic unavailable market provider'}});return route.continue();});
  await signIn(page,emails[i]);await completeOnboarding(page,['EURUSD']);
 }
 for(const [i,page] of pages.entries()){const r=await apiFromPage(page,'/api/social/follow/'+ids[1-i],{method:'POST'});assert.ok([201,409].includes(r.status));}

 const page=pages[0],postPattern='**/api/chat/messages',uploadPattern='**/api/social/upload-file';
 const input=()=>page.getByRole('textbox',{name:'Scrivi un messaggio...',exact:true});
 const count=async(peer=ids[1])=>(await db.query('SELECT count(*)::int n FROM chat_messages WHERE sender_id=$1 AND receiver_id=$2',[ids[0],peer])).rows[0].n;
 const ready=async()=>{await page.waitForFunction(()=>{const el=document.querySelector('input[type=file]');return el&&!el.disabled;});};
 const pending=()=>page.getByRole('status').filter({hasText:'Invio dell’allegato non confermato.'});
 async function observeUpload(filename){const wait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/social/upload-file'&&r.request().method()==='POST');await page.locator('input[type=file]').setInputFiles({name:filename,mimeType:'text/plain',buffer:Buffer.from(content)});const r=await wait;assert.equal(r.status(),200);const data=await r.json();files.push(data.fileUrl);return data;}
 third=await ensureTestUser('verify.chat.sends.c+clerk_test@example.com');
 await db.query('INSERT INTO profile(user_id,name) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM profile WHERE user_id=$1)',[third,'Chat receiver '+tag]);
 for(const [f,t] of [[ids[0],third],[third,ids[0]]])await db.query('INSERT INTO follows(follower_id,following_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[f,t]);
 await conversation(pages[1],ids[0]);await conversation(page,ids[1]);await ready();
 await check('A delayed confirmation preserves the next text draft',async()=>{
  await conversation(page,ids[1]);await ready();const before=await count();let release,arrived;const held=new Promise(r=>arrived=r),gate=new Promise(r=>release=r);
  await page.route(postPattern,async route=>{arrived();await gate;await route.continue();},{times:1});
  try{await input().fill(tag+' first');await input().press('Enter');await held;await input().fill(tag+' next');const sent=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/chat/messages'&&r.request().method()==='POST');release();await sent;await page.getByText(tag+' first',{exact:true}).waitFor();report.nextDraftObserved=await input().inputValue();assert.equal(await input().inputValue(),tag+' next');assert.equal(await count(),before+1);}finally{release();await page.unroute(postPattern);}
 });
 await check('Repeated Enter during one pending send creates one message',async()=>{
  await conversation(page,ids[1]);await ready();const before=await count();let release,arrived;let requests=0;const held=new Promise(r=>arrived=r),gate=new Promise(r=>release=r);
  await page.route(postPattern,async route=>{requests++;arrived();await gate;await route.continue();});
  try{await input().fill(tag+' repeat');await input().press('Enter');await held;await input().press('Enter');await page.waitForTimeout(300);release();await page.getByText(tag+' repeat',{exact:true}).first().waitFor();await page.waitForTimeout(500);report.repeatObserved={requests,rows:await count()-before};assert.equal(requests,1);assert.equal(await count(),before+1);}finally{release();await page.unroute(postPattern);}
 });
 await check('An attachment save failure retries the same upload and reaches the recipient after reload',async()=>{
  await conversation(page,ids[1]);await ready();const before=await count(),filesBefore=(await db.query('SELECT count(*)::int n FROM chat_file_access WHERE owner_user_id=$1 AND peer_user_id=$2',ids)).rows[0].n;
  await page.route(postPattern,route=>route.fulfill({status:503,json:{error:'Synthetic precommit save failure'}}),{times:1});
  const fail=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/chat/messages'&&r.status()===503);const file=await observeUpload(tag+'.txt');await fail;
  assert.equal(await count(),before);report.attachmentObserved={fileUrl:file.fileUrl,messageRows:await count()-before};await pending().waitFor();await pending().getByText(tag+'.txt',{exact:true}).waitFor();
  const sent=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/chat/messages'&&r.request().method()==='POST'&&r.status()===201);await pending().getByRole('button',{name:'Riprova',exact:true}).click();await sent;await pending().waitFor({state:'detached'});
  assert.equal((await db.query('SELECT count(*)::int n FROM chat_file_access WHERE owner_user_id=$1 AND peer_user_id=$2',ids)).rows[0].n,filesBefore+1);assert.equal(await count(),before+1);
  await conversation(pages[1],ids[0]);await pages[1].getByText(tag+'.txt',{exact:true}).waitFor();assert.equal(await pages[1].locator('a[download="'+tag+'.txt"]').getAttribute('href'),file.fileUrl);
 });
 await check('Leaving during upload prevents a background send and keeps the file for its original peer',async()=>{
  await conversation(page,ids[1]);await ready();const before=await count(),otherBefore=await count(third);let release,arrived;const held=new Promise(r=>arrived=r),gate=new Promise(r=>release=r);
  await page.route(uploadPattern,async route=>{const r=await route.fetch();const data=await r.json();files.push(data.fileUrl);arrived();await gate;await route.fulfill({response:r});},{times:1});
  try{await page.locator('input[type=file]').setInputFiles({name:tag+'-switch.txt',mimeType:'text/plain',buffer:Buffer.from(content)});await held;await page.locator('a[href*="peer='+third+'"]').first().click();await page.waitForURL(url=>url.searchParams.get('peer')===third);release();await page.waitForTimeout(700);report.switchObserved={originalRows:await count()-before,otherRows:await count(third)-otherBefore};assert.equal(await count(),before);assert.equal(await count(third),otherBefore);
   await page.locator('a[href*="peer='+ids[1]+'"]').first().click();await pending().waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=status] button')).some(button=>button.textContent==='Riprova'&&!button.disabled));await pending().getByText(tag+'-switch.txt',{exact:true}).waitFor();await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:out+'/mobile-pending.png'});const sent=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/chat/messages'&&r.status()===201);await pending().getByRole('button',{name:'Riprova',exact:true}).click();await sent;assert.equal(await count(),before+1);assert.equal(await count(third),otherBefore);await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:out+'/mobile-after-retry.png'});
  }finally{release();await page.unroute(uploadPattern);}
 });
 assert.deepEqual(report.errors,[]);
}finally{
 for(const url of files){const key=url.split('/').at(-1),folder=url.includes('/post-images/')?'post-images':'chat-files';rmSync(root+'.local-logs/runtime-sandbox/'+database+'/uploads/'+folder+'/'+key,{force:true});if(folder==='chat-files')await db.query('DELETE FROM chat_file_access WHERE file_key=$1',[key]);}
 await db.query('DELETE FROM chat_messages WHERE sender_id=$1 AND (receiver_id=$2 OR receiver_id=$3)',[ids[0],ids[1],third||ids[1]]);await db.query('DELETE FROM posts WHERE id=ANY($1::int[])',[posts]);
 for(let i=0;i<contexts.length;i++){const path=out+'/actions-'+i+'.zip';await contexts[i].tracing.stop({path});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',path]);}
 await browser.close();await db.end();report.finishedAt=new Date().toISOString();flush();
}
if(report.checks.some(c=>c.status==='failed')||report.errors.length)process.exitCode=1;
