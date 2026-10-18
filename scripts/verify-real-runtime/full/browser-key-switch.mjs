import {installResponseProvenance,responseProvenance} from './response-provenance.mjs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID,webcrypto} from 'node:crypto';
import {chromium} from 'playwright';
import {root,run,connect,base,database,auditExecutionId} from './env.mjs';
process.env.VERIFY_BASE_URL=base;
process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {signIn,ensureTestUser,completeOnboarding,mintTicket,loadEnvLocal}=await import('../../verify-usability/lib/common.mjs');
assert.match(loadEnvLocal().CLERK_SECRET_KEY,/^sk_test_/);
assert.equal((await fetch(base+'/api/healthz',{signal:AbortSignal.timeout(5000)})).status,200);
const out=run.output+'/browser-key-switch-'+(process.argv[2]||'after');mkdirSync(out,{recursive:true});
const report={runId:run.runId,executionId:auditExecutionId,attemptId:randomUUID(),executedAt:new Date().toISOString(),checks:[],requests:[],errors:[]};
const db=await connect();const emailA='verify.keyswitcha+clerk_test@example.com',emailB='verify.keyswitchb+clerk_test@example.com';
const uidA=await ensureTestUser(emailA),uidB=await ensureTestUser(emailB);
async function pair(){const p=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);return {privateKey:await webcrypto.subtle.exportKey('jwk',p.privateKey),publicKey:await webcrypto.subtle.exportKey('jwk',p.publicKey)};}
const keysA=await pair(),keysB=await pair();
for(const [uid,keys] of [[uidA,keysA],[uidB,keysB]]){
 await db.query('INSERT INTO user_public_keys(user_id,public_key_jwk) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET public_key_jwk=EXCLUDED.public_key_jwk',[uid,JSON.stringify(keys.publicKey)]);
 await db.query('INSERT INTO user_e2ee_key_backups(user_id,public_key_jwk,private_key_jwk) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET public_key_jwk=EXCLUDED.public_key_jwk,private_key_jwk=EXCLUDED.private_key_jwk',[uid,JSON.stringify(keys.publicKey),JSON.stringify(keys.privateKey)]);
 await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Isolated account switch audit') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'",[uid]);
}
const req=createRequire(root+'artifacts/trader-dashboard/package.json');const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',serviceWorkers:'block'});
await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
await ctx.addInitScript(()=>{localStorage.setItem('tl_language','it');sessionStorage.setItem('tl_review_prompt_shown','1');sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1','1');localStorage.setItem('tl_cookie_consent_v1','declined');});
const page=await ctx.newPage();installResponseProvenance(page);page.setDefaultTimeout(15000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base+'/api/chat/'))report.requests.push({path:new URL(r.url()).pathname,method:r.request().method(),status:r.status(),provenance:responseProvenance(r)});});
let release,held=false;const gate=new Promise(resolve=>{release=resolve;});let capturedResolve;const captured=new Promise(resolve=>{capturedResolve=resolve;});
try{
 await signIn(page,emailA);await completeOnboarding(page,['EURUSD']);
 await page.route('**/api/chat/key-backup',async route=>{if(!held&&route.request().method()==='GET'){held=true;const upstream=await route.fetch();const body=await upstream.json();assert.equal(body.userId,uidA);capturedResolve();await gate;await route.fulfill({response:upstream});}else await route.continue();});
 await page.evaluate(()=>{window.__auditKeySwitchSentinel='same document';window.history.pushState({},'', '/chat?t=messaggi');window.dispatchEvent(new PopStateEvent('popstate'));});
 await Promise.race([captured,new Promise((_,reject)=>setTimeout(()=>reject(new Error('A key backup request was not intercepted')),20000))]);
 await page.evaluate(async()=>{await window.Clerk.signOut({redirectUrl:'/sign-in'});});
 assert.equal(await page.evaluate(()=>window.__auditKeySwitchSentinel),'same document','Account switch must remain in the same document to exercise pending initialization');
 const ticketB=await mintTicket(uidB);
 await page.evaluate(async ticket=>{const result=await window.Clerk.client.signIn.create({strategy:'ticket',ticket});if(result.status!=='complete')throw new Error('Synthetic sign-in did not complete');await window.Clerk.setActive({session:result.createdSessionId});},ticketB);
 await page.waitForFunction(id=>window.Clerk?.user?.id===id,uidB,{timeout:20000});
 await completeOnboarding(page,['EURUSD']);
 await page.evaluate(()=>{window.history.pushState({},'', '/chat?t=messaggi');window.dispatchEvent(new PopStateEvent('popstate'));});
 await page.waitForTimeout(1200);
 release();await page.waitForTimeout(1800);
 assert.equal(await page.evaluate(()=>window.__auditKeySwitchSentinel),'same document');
 const published=JSON.parse((await db.query('SELECT public_key_jwk FROM user_public_keys WHERE user_id=$1',[uidB])).rows[0].public_key_jwk);
 const backup=JSON.parse((await db.query('SELECT public_key_jwk FROM user_e2ee_key_backups WHERE user_id=$1',[uidB])).rows[0].public_key_jwk);
 report.observation={sameDocumentAccountSwitch:true,publishedKeyEqualsAccountBBackup:published.x===backup.x&&published.y===backup.y,publishedKeyEqualsOldAccountA:published.x===keysA.publicKey.x&&published.y===keysA.publicKey.y};
 assert.equal(report.observation.publishedKeyEqualsAccountBBackup,true,'Delayed account A key initialization replaced account B published key');
 assert.equal(report.observation.publishedKeyEqualsOldAccountA,false);
 report.checks.push({name:'Delayed account A backup cannot publish its key for account B after SPA account switch',status:'passed'});
 console.log('PASS delayed key backup and same-document account switch preserve B keys');
}catch(e){report.checks.push({name:'Delayed account A backup cannot publish its key for account B after SPA account switch',status:'failed',error:e.message.slice(0,1200)});console.log('FAIL',e.message.slice(0,500));await page.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{release();writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await ctx.tracing.stop({path:out+'/actions.zip'});execFileSync('python3',[root+'scripts/verify-real-runtime/full/redact-traces.py',out+'/actions.zip']);await browser.close();await db.end();}
