import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {api,base,connect,root,run,database,auditExecutionId,recordAuditRequest,setAuditScenario} from './env.mjs';

const db=await connect(),label=process.argv[2]||'after';
assert.match(label,/^[a-z0-9-]+$/);
const report={runId:run.runId,executionId:auditExecutionId,label,checks:[]};
const tag='audit_crud_'+Date.now(),existing=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json'));
async function actor(name){
 const id=tag+'_'+name,sid=randomBytes(32).toString('hex');
 await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[sid,{user:{id,email:null},access_token:'isolated-local-session'},new Date(Date.now()+86400000).toISOString()]);
 await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[id,id]);
 await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status) VALUES($1,'pro','active')",[id]);
 return{id,sid};
}
const a=await actor('a'),b=await actor('b');
async function ok(sid,path,method='GET',body,status=200){const r=await api(sid,path,method,body);assert.equal(r.status,status,method+' '+path+': '+JSON.stringify(r.data).slice(0,180));return r.data;}
async function check(name,fn){setAuditScenario(name);try{const evidence=await fn();report.checks.push({name,status:'passed',evidence});console.log('PASS',name);}catch(error){report.checks.push({name,status:'failed',error:error.message});console.log('FAIL',name,error.message.slice(0,300));}writeFileSync(run.output+'/crud-cleanup-'+label+'.json',JSON.stringify(report,null,2));}
async function raw(sid,path,method='GET',body){const r=await fetch(base+'/api'+path,{method,headers:sid?{Cookie:'sid='+sid}:{},body,signal:AbortSignal.timeout(15000)});recordAuditRequest({method,path,status:r.status,authenticated:Boolean(sid)});return r;}
try{
 await check('Journal price edit preserves omitted fees volume and exact trade timestamps',async()=>{
  const entry=await ok(a.sid,'/journal','POST',{title:'Preserved metadata',content:'Synthetic',tradeDate:'2026-10-04',result:'win',symbol:'EURUSD',direction:'buy',entryPrice:1.1,exitPrice:1.12,stopLoss:1.09,profit:20,volume:0.25,commission:-2,swap:-0.5,takeProfit:1.13,openTime:'2026-10-04T08:00:00.000Z',closeTime:'2026-10-04T09:15:00.000Z'},201);
  const row=()=>db.query("SELECT * FROM account_trades WHERE user_id=$1 AND source='manual' AND ticket=$2",[a.id,'manual-'+entry.id]);
  try{
   const before=(await row()).rows[0];assert.ok(before);
   const updated=await ok(a.sid,'/journal/'+entry.id,'PUT',{title:'Edited prices',content:'Synthetic edit',tradeDate:'2026-10-04',result:'breakeven',symbol:'EURUSD',direction:'buy',entryPrice:1.11,exitPrice:1.11,stopLoss:1.1,profit:0});
   assert.equal(updated.manualTrade.profit,0);const after=(await row()).rows[0];
   for(const field of ['volume','commission','swap','take_profit','open_time','close_time'])assert.deepEqual(after[field],before[field],field+' must persist');
   assert.equal(Number(after.entry_price),1.11);assert.equal((await ok(a.sid,'/journal/'+entry.id)).manualTrade.exitPrice,1.11);
   return{zeroProfit:true,preservedFields:['volume','commission','swap','takeProfit','openTime','closeTime']};
  }finally{await ok(a.sid,'/journal/'+entry.id,'DELETE');}
 });
 await check('Owner deletion removes journal entry manual trade image rows and local file',async()=>{
  const entry=await ok(a.sid,'/journal','POST',{title:'Disposable full trade',content:'Synthetic',tradeDate:'2026-10-04',result:'win',symbol:'EURUSD',direction:'buy',entryPrice:1.1,exitPrice:1.12,stopLoss:1.09,profit:20},201);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lP8AAAAASUVORK5CYII=','base64'),form=new FormData();form.set('image',new Blob([png],{type:'image/png'}),'synthetic.png');
  const upload=await raw(a.sid,'/journal/'+entry.id+'/images','POST',form);assert.equal(upload.status,200);const image=(await upload.json()).image;
  const file=root+'.local-logs/runtime-sandbox/'+database+'/uploads/'+image.url.split('/').at(-1);assert.ok(existsSync(file));
  const trade=()=>db.query("SELECT count(*)::int n FROM account_trades WHERE user_id=$1 AND source='manual' AND ticket=$2",[a.id,'manual-'+entry.id]);
  assert.equal((await trade()).rows[0].n,1);
  await ok(b.sid,'/journal/'+entry.id,'DELETE',undefined,404);assert.equal((await ok(a.sid,'/journal/'+entry.id)).images.length,1);
  await ok(a.sid,'/journal/'+entry.id,'DELETE');await ok(a.sid,'/journal/'+entry.id,'GET',undefined,404);await ok(a.sid,'/journal/'+entry.id,'DELETE',undefined,404);
  assert.equal((await trade()).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM journal_images WHERE entry_id=$1',[entry.id])).rows[0].n,0);assert.ok(!existsSync(file));assert.equal((await raw(a.sid,image.url.replace('/api',''))).status,404);
  return{entryRows:0,tradeRows:0,imageRows:0,fileRemoved:true};
 });
 await check('Published library collection update detail and list preserve draft and level gates',async()=>{
  const collection=await ok(existing.admin.sid,'/library/collections','POST',{title:'Public synthetic collection '+tag,published:true},201);
  try{
   const visible=await ok(existing.admin.sid,'/library/contents','POST',{title:'Public synthetic document',collectionId:collection.id,type:'document',bodyMarkdown:'Readable test body',published:true,requiredLevel:0},201);
   const locked=await ok(existing.admin.sid,'/library/contents','POST',{title:'Locked synthetic document',collectionId:collection.id,type:'document',bodyMarkdown:'Private level body',published:true,requiredLevel:999},201);
   await ok(existing.admin.sid,'/library/contents','POST',{title:'Draft synthetic document',collectionId:collection.id,type:'document',bodyMarkdown:'Unpublished body',published:false},201);
   await ok(existing.admin.sid,'/library/collections/'+collection.id,'PUT',{description:'Updated synthetic description'});
   const detail=await ok(null,'/library/collections/'+collection.id);assert.equal(detail.collection.description,'Updated synthetic description');assert.equal(detail.contents.length,2);assert.equal(detail.contents.find(x=>x.id===visible.id).bodyMarkdown,'Readable test body');assert.equal(detail.contents.find(x=>x.id===locked.id).bodyMarkdown,'');
   assert.ok((await ok(null,'/library/collections')).some(x=>x.id===collection.id));
   await ok(existing.admin.sid,'/library/collections/'+collection.id,'PUT',{published:false});await ok(a.sid,'/library/collections/'+collection.id,'GET',undefined,404);assert.equal((await ok(existing.admin.sid,'/library/collections/'+collection.id)).contents.length,3);
   return{publishedContents:2,draftExcluded:true,lockedBodyHidden:true};
  }finally{
   await ok(existing.admin.sid,'/library/collections/'+collection.id,'DELETE');
   await ok(existing.admin.sid,'/library/collections/'+collection.id,'GET',undefined,404);
   assert.equal((await db.query('SELECT count(*)::int n FROM library_contents WHERE collection_id=$1',[collection.id])).rows[0].n,0);
  }
 });
 await check('Public URL archive ingestion extracts real page text and remains owner scoped',async()=>{
  // Public, read-only retrieval; no paid provider or model involved.
  const source=await ok(a.sid,'/wiki/sources/url','POST',{url:'https://example.com',title:'Public example audit'},202);
  try{
   let saved;for(let i=0;i<100;i++){saved=(await ok(a.sid,'/wiki/sources')).find(x=>x.id===source.id);if(saved?.status==='ready')break;if(saved?.status==='error')throw Error(saved.error);await new Promise(r=>setTimeout(r,100));}
   assert.equal(saved?.status,'ready');assert.match(saved.extractedText,/Example Domain/i);assert.equal(saved.originalUrl,'https://example.com');assert.ok(!(await ok(b.sid,'/wiki/sources')).some(x=>x.id===source.id));
   return{publicSource:'https://example.com',processing:saved.status,extractedTextNonempty:true,otherUserCannotList:true};
  }finally{await ok(a.sid,'/wiki/sources/'+source.id,'DELETE');}
 });
 await check('Legacy account bridge is disabled in production for every operation',async()=>{
  for(const [method,path]of [['GET','/account/connections'],['POST','/account/connections'],['POST','/account/connections/isolated/activate'],['POST','/account/connections/isolated/test'],['DELETE','/account/connections/isolated']]){const data=await ok(a.sid,path,method,method==='POST'?{}:undefined,410);assert.match(data.error,/disabled in production/);}
  return{onlyGateVerified:true,activeLegacyHandlers:false};
 });
}finally{await db.end();writeFileSync(run.output+'/crud-cleanup-'+label+'.json',JSON.stringify(report,null,2));}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
