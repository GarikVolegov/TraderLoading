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
const out=run.output+'/browser-social-boundary-'+label;mkdirSync(out,{recursive:true});
const report={runId:run.runId,executionId:auditExecutionId,frontendBuild:JSON.parse(readFileSync(root+'.local-logs/runtime-api-process.json')).frontendBuild?.sha256,mode:'Actual production UI, Clerk Development, API and SQL; only market outages simulated',checks:[],requests:[],errors:[]};
const db=await connect(),emails=['verify.social.boundary.a+clerk_test@example.com','verify.social.boundary.b+clerk_test@example.com'],ids=[];
for(const email of emails){const id=await ensureTestUser(email);ids.push(id);await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated social boundary test') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[id]);}
const tag='boundary-'+Date.now(),content='Synthetic attachment '+tag,files=[],messages=[],posts=[];
const req=createRequire(root+'artifacts/trader-dashboard/package.json'),browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()}),contexts=[],pages=[];
let scenario=null;const requestScenarios=new WeakMap();
const flush=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
async function check(name,fn){scenario=name;try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,350));await pages[0].screenshot({path:out+'/failure-'+report.checks.length+'.png'}).catch(()=>{});}finally{scenario=null;flush();}}
async function go(page,path){await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.locator('nav[aria-label="Navigazione principale"]:visible').waitFor();await page.waitForFunction(()=>Boolean(window.Clerk?.user?.id));await dismiss(page);}
async function conversation(page,peer){await go(page,'/chat?t=conversazioni&peer='+peer);await page.locator('input[type=file]').waitFor({state:'attached'});await page.waitForFunction(async()=>{const r=await fetch('/api/chat/key-backup');return r.ok&&(await r.json()).hasBackup;});}
async function attachment(filename,mimeType,buffer){
 await pages[0].waitForFunction(()=>{const input=document.querySelector('input[type=file]');return input&&!input.disabled;});
 const upload=pages[0].waitForResponse(r=>r.url().includes('/social/upload-')&&r.request().method()==='POST');
 const sent=pages[0].waitForResponse(r=>new URL(r.url()).pathname==='/api/chat/messages'&&r.request().method()==='POST');
 await pages[0].locator('input[type=file]').setInputFiles({name:filename,mimeType,buffer});
 const response=await upload;assert.equal(response.status(),200);const data=await response.json(),url=data.fileUrl||data.imageUrl;files.push(url);
 const message=await sent;assert.equal(message.status(),201);const row=await message.json();if(row.id)messages.push(row.id);
 return url;
}
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
 await check('Social profile card keeps public name XP posts and modal keyboard focus after private fields are removed',async()=>{
  const own=await apiFromPage(pages[1],'/api/profile'),name=own.body.name;
  const posted=await apiFromPage(pages[1],'/api/social/posts',{method:'POST',body:JSON.stringify({content:tag})});assert.equal(posted.status,201);posts.push(posted.body.id);
  await go(pages[0],'/chat?t=social');const card=pages[0].locator('div.bg-card\\/60').filter({has:pages[0].getByText(tag,{exact:true})});await card.getByRole('button').filter({hasText:name}).click();
  const dialog=pages[0].getByRole('dialog',{name,exact:true});await dialog.waitFor();await dialog.getByText(tag,{exact:true}).waitFor();
  for(let i=0;i<8;i++){await pages[0].keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));}
  await pages[0].keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  const profile=await apiFromPage(pages[0],'/api/social/profile/'+ids[1]);assert.equal(profile.status,200);assert.equal(Object.hasOwn(profile.body.profile,'walletAddress'),false);
 });
 await check('Private file sent through the composer reaches the recipient after reload and downloads actual bytes',async()=>{
  await conversation(pages[0],ids[1]);await conversation(pages[1],ids[0]);await conversation(pages[0],ids[1]);
  const filename=tag+'.txt',url=await attachment(filename,'text/plain',Buffer.from(content));
  await conversation(pages[1],ids[0]);await pages[1].getByText(filename,{exact:true}).waitFor();
  const actual=pages[1].locator('a[download="'+filename+'"]');assert.equal(await actual.getAttribute('href'),url);
  const got=pages[1].waitForEvent('download');await actual.click();const download=await got;await download.saveAs(out+'/attachment.txt');assert.equal(readFileSync(out+'/attachment.txt','utf8'),content);
  const rows=(await db.query('SELECT ciphertext FROM chat_messages WHERE id=ANY($1::int[])',[messages])).rows;assert.ok(rows.length>0);assert.ok(rows.every(r=>!r.ciphertext.includes(filename)&&!r.ciphertext.includes(content)));
 });
 await check('Unavailable peer key keeps the text draft blocks attachment upload and retries without reload',async()=>{
  const pattern='**/api/chat/keys/'+ids[1],handler=route=>route.fulfill({status:404,json:{error:'Synthetic peer has not activated chat'}});
  await pages[0].route(pattern,handler);
  try{
   await conversation(pages[0],ids[1]);const input=pages[0].getByRole('textbox',{name:'Scrivi un messaggio...',exact:true});await input.fill(tag+' draft');
   const before=(await db.query('SELECT count(*)::int n FROM chat_messages WHERE sender_id=$1 AND receiver_id=$2',[ids[0],ids[1]])).rows[0].n;
   await input.press('Enter');await pages[0].waitForTimeout(200);
   const after=(await db.query('SELECT count(*)::int n FROM chat_messages WHERE sender_id=$1 AND receiver_id=$2',[ids[0],ids[1]])).rows[0].n;
   report.unavailableKeyObserved={draftPreserved:await input.inputValue()===tag+' draft',messagesWritten:after-before};
   assert.equal(await input.inputValue(),tag+' draft');assert.equal(after,before);assert.equal(await pages[0].locator('input[type=file]').isDisabled(),true);
   const status=pages[0].getByRole('status').filter({hasText:'Chat non pronta.'}).filter({has:pages[0].getByRole('button',{name:'Riprova',exact:true})});await status.waitFor();
   // Provenance wraps route handlers. Remove this exact URL registration,
   // rather than passing an original handler that Playwright never registered.
   await pages[0].unroute(pattern);await status.getByRole('button',{name:'Riprova',exact:true}).click();await pages[0].waitForFunction(()=>{const input=document.querySelector('input[type=file]');return input&&!input.disabled;});
   const sent=pages[0].waitForResponse(r=>new URL(r.url()).pathname==='/api/chat/messages'&&r.request().method()==='POST');await input.press('Enter');const response=await sent;assert.equal(response.status(),201);messages.push((await response.json()).id);await pages[0].getByText(tag+' draft',{exact:true}).waitFor();
  }finally{await pages[0].unroute(pattern);}
 });
 await check('Private image uses participant access and still renders for the recipient on mobile after reload',async()=>{
  await conversation(pages[0],ids[1]);
  const encoded=await pages[0].evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=32;c.getContext('2d').fillRect(0,0,32,32);return c.toDataURL('image/png').split(',')[1];});
  const url=await attachment(tag+'.png','image/png',Buffer.from(encoded,'base64'));
  const anonymous=await fetch(base+url,{signal:AbortSignal.timeout(10000)});report.privateImageObserved={path:url,anonymousStatus:anonymous.status};assert.equal(anonymous.status,401,'Private DM image readable without login');assert.match(url,/^\/api\/uploads\/chat-files\//);
  await pages[1].setViewportSize({width:390,height:844});await conversation(pages[1],ids[0]);
  const image=pages[1].locator('img[src="'+url+'"]');await image.waitFor();await image.evaluate(el=>el.decode());assert.equal(await image.evaluate(el=>el.naturalWidth),32);assert.equal(await pages[1].evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await pages[1].screenshot({path:out+'/private-image-mobile.png'});
 });
 assert.deepEqual(report.errors,[]);
}finally{
 for(const url of files){const key=url.split('/').at(-1),folder=url.includes('/post-images/')?'post-images':'chat-files';rmSync(root+'.local-logs/runtime-sandbox/'+database+'/uploads/'+folder+'/'+key,{force:true});if(folder==='chat-files')await db.query('DELETE FROM chat_file_access WHERE file_key=$1',[key]);}
 await db.query('DELETE FROM chat_messages WHERE id=ANY($1::int[])',[messages]);await db.query('DELETE FROM posts WHERE id=ANY($1::int[])',[posts]);
 for(let i=0;i<contexts.length;i++){const path=out+'/actions-'+i+'.zip';await contexts[i].tracing.stop({path});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',path]);}
 await browser.close();await db.end();report.finishedAt=new Date().toISOString();flush();
}
if(report.checks.some(c=>c.status==='failed')||report.errors.length)process.exitCode=1;
