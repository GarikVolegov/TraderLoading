import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync,writeFileSync} from 'node:fs';import {chromium} from 'playwright';
import {root,run,connect,base,database,api} from './env.mjs';
process.env.VERIFY_BASE_URL=base;process.env.VERIFY_DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${database}`;
const {signIn,ensureTestUser,completeOnboarding}=await import('../../verify-usability/lib/common.mjs');
const req=createRequire(root+'artifacts/trader-dashboard/package.json'),browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath()}),page=await browser.newPage(),db=await connect(),email='verify.revocation+clerk_test@example.com',uid=await ensureTestUser(email),admin=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json')).admin,checks=[],label=process.argv[2]||'after';
const check=async(name,fn)=>{try{await fn();checks.push({name,status:'passed'});}catch(e){checks.push({name,status:'failed',error:e.message});}console.log(checks.at(-1));writeFileSync(run.output+'/clerk-revocation-'+label+'.json',JSON.stringify({runId:run.runId,checks},null,2));};
try{
 await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3) ON CONFLICT(sid) DO UPDATE SET expire=excluded.expire',[admin.sid,{user:{id:admin.id},access_token:'isolated'},new Date(Date.now()+86400000).toISOString()]);
 await signIn(page,email);await completeOnboarding(page,['EURUSD']);const token=await page.evaluate(()=>window.Clerk.session.getToken());assert.ok(token);
 const status=async t=>(await fetch(base+'/api/settings',{headers:{Authorization:'Bearer '+t}})).status;
 await check('Clerk JWT works before administrator revocation',async()=>assert.equal(await status(token),200));
 await check('Administrator revocation rejects an already issued Clerk JWT immediately',async()=>{const r=await api(admin.sid,`/admin/users/${uid}/revoke-sessions`,'POST',{reason:'Isolated synthetic session revocation audit'});assert.equal(r.status,200);const after=await status(token);checks.push({name:"Observed post-revocation token HTTP status",status:"evidence",httpStatus:after});assert.equal(after,401);assert.ok(r.data.revokedSessions>=1);});
 await check('A newly authenticated Clerk session remains usable',async()=>{await page.evaluate(()=>window.Clerk.signOut()).catch(()=>{});await signIn(page,email);const fresh=await page.evaluate(()=>window.Clerk.session.getToken());assert.ok(fresh);assert.equal(await status(fresh),200);});
}finally{await page.evaluate(()=>window.Clerk?.signOut()).catch(()=>{});await browser.close();await db.end();}
if(checks.some(x=>x.status==='failed'))process.exitCode=1;
