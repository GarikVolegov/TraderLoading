import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {api,connect,run,auditExecutionId,setAuditScenario} from './env.mjs';
const label=process.argv[2]||'after';assert.match(label,/^[a-z0-9-]+$/);
const db=await connect(),tag='audit_news_runtime_'+Date.now(),one=tag+'_a',two=tag+'_b',sidA=randomUUID(),sidB=randomUUID();
const report={runId:run.runId,executionId:auditExecutionId,label,scope:'Real production API, synthetic identities and database snapshot; no live news/provider freshness assertion',checks:[]};
for(const [id,sid]of [[one,sidA],[two,sidB]]){await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[id,id]);await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[sid,{user:{id},access_token:'isolated-local-session'},new Date(Date.now()+86400000)]);}
const path=run.output+'/news-preferences-runtime-'+label+'.json',key='url:https://example.test/'+tag;
async function ok(sid,url,method='GET',body,status=200){const r=await api(sid,url,method,body);assert.equal(r.status,status,url+': '+JSON.stringify(r.data).slice(0,100));return r.data;}
async function check(name,fn){setAuditScenario(name);try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(error){report.checks.push({name,status:'failed',error:error.message});console.log('FAIL',name,error.message.slice(0,500));}writeFileSync(path,JSON.stringify(report,null,2));}
async function unavailable(table,fn){assert.ok(['news_preferences','news_feedback'].includes(table));const renamed='audit_unavailable_'+table;await db.query(`ALTER TABLE ${table} RENAME TO ${renamed}`);try{await fn();}finally{await db.query(`ALTER TABLE ${renamed} RENAME TO ${table}`);}}
let oldSnapshot;const pair=process.env.AUDIT_NEWS_PAIR||'EURCAD';assert.ok(['EURCAD','CADJPY','AUDNZD'].includes(pair));const cacheKey='official-evidence-v10:'+ [pair.slice(0,3),pair.slice(3)].sort().join(',')+':it';report.syntheticPair=pair;
try{
 await check('News preferences and feedback deny anonymous reads and isolate two authenticated users',async()=>{await ok(null,'/news/preferences','GET',undefined,401);await ok(null,'/news/feedback','GET',undefined,401);await ok(sidA,'/news/preferences','PUT',{keywords:['Synthetic private topic'],profile:tag});assert.deepEqual(await ok(sidB,'/news/preferences'),{keywords:[],profile:''});await ok(sidA,'/news/feedback','POST',{articleKey:key,source:'Synthetic',vote:1});const a=await ok(sidA,'/news/feedback'),b=await ok(sidB,'/news/feedback?userId='+one);assert.ok(a.feedback.some(v=>v.articleKey===key&&v.vote===1));assert.deepEqual(b.feedback,[]);});
 await check('Invalid preference and vote writes preserve saved data',async()=>{await ok(sidA,'/news/feedback','POST',{articleKey:key,source:'Synthetic',vote:1});await ok(sidA,'/news/preferences','PUT',{keywords:['valid'],profile:tag});for(const body of [{keywords:{}},{profile:[]},[],{keywords:['ok',3]}])await ok(sidA,'/news/preferences','PUT',body,400);assert.equal((await ok(sidA,'/news/preferences')).profile,tag);for(const vote of ['1',2,null])await ok(sidA,'/news/feedback','POST',{articleKey:key,vote},400);assert.equal((await db.query('SELECT vote FROM news_feedback WHERE user_id=$1 AND article_key=$2',[one,key])).rows[0].vote,1);});
 await check('Feedback repeated and concurrent writes store one owner record and restore zero',async()=>{const replies=await Promise.all(Array.from({length:12},()=>api(sidA,'/news/feedback','POST',{articleKey:key,source:'Synthetic',vote:1})));assert.ok(replies.every(r=>r.status===200));assert.equal((await db.query('SELECT count(*)::int n FROM news_feedback WHERE user_id=$1 AND article_key=$2',[one,key])).rows[0].n,1);await ok(sidA,'/news/feedback','POST',{articleKey:key,source:'Synthetic',vote:0});assert.equal((await ok(sidA,'/news/feedback')).feedback.find(v=>v.articleKey===key).vote,0);});
 await check('A failed preferences read reports unavailability instead of empty defaults and recovers',async()=>{await unavailable('news_preferences',async()=>{await ok(sidA,'/news/preferences','GET',undefined,503);});assert.equal((await ok(sidA,'/news/preferences')).profile,tag);});
 await check('A failed feedback read reports unavailability and preserves the prior vote',async()=>{await unavailable('news_feedback',async()=>{await ok(sidA,'/news/feedback','GET',undefined,503);});assert.equal((await ok(sidA,'/news/feedback')).feedback.find(v=>v.articleKey===key).vote,0);});
 await check('Downvotes beyond 500 saved decisions still hide an article from the real feed handler',async()=>{
  oldSnapshot=(await db.query('SELECT * FROM news_snapshots WHERE cache_key=$1',[cacheKey])).rows[0];
  await db.query('DELETE FROM news_feedback WHERE user_id=$1',[two]);
  await db.query("INSERT INTO news_feedback(user_id,article_key,source,vote) SELECT $1,$2||g,'Synthetic',1 FROM generate_series(1,501)g",[two,tag+'_older_']);
  await ok(sidB,'/news/feedback','POST',{articleKey:key,source:'Synthetic',vote:-1});
  const payload={articles:[{title:tag+' synthetic corpus',summary:'Synthetic stored snapshot, not live market data',source:'Synthetic',url:key.slice(4),publishedAt:new Date().toISOString(),sentiment:'neutral',imageUrl:null}],fetchedAt:new Date().toISOString(),hasApiKey:false,source:'audit-fixture'};
  await db.query('INSERT INTO news_snapshots(cache_key,payload,fetched_at,updated_at) VALUES($1,$2,now(),now()) ON CONFLICT(cache_key) DO UPDATE SET payload=$2,fetched_at=now(),updated_at=now()',[cacheKey,payload]);
  const publicFeed=await ok(null,'/news?pairs='+pair+'&lang=it');assert.equal(publicFeed.source,'audit-fixture','Test must read the seeded snapshot');assert.ok(publicFeed.articles.some(a=>a.url===key.slice(4)));
  const personal=await ok(sidB,'/news?pairs='+pair+'&lang=it');assert.equal(personal.source,'audit-fixture');assert.ok(!personal.articles.some(a=>a.url===key.slice(4)),'Latest downvote beyond the old 500-row cutoff must apply');
 });
}finally{
 if(oldSnapshot)await db.query('UPDATE news_snapshots SET payload=$2,fetched_at=$3,updated_at=$4 WHERE cache_key=$1',[cacheKey,oldSnapshot.payload,oldSnapshot.fetched_at,oldSnapshot.updated_at]);else await db.query('DELETE FROM news_snapshots WHERE cache_key=$1 AND payload->>\'source\'=\'audit-fixture\'',[cacheKey]);
 await db.query('DELETE FROM news_feedback WHERE user_id=ANY($1::text[])',[[one,two]]);await db.query('DELETE FROM news_preferences WHERE user_id=ANY($1::text[])',[[one,two]]);await db.query('DELETE FROM sessions WHERE sid=ANY($1::text[])',[[sidA,sidB]]);await db.query('DELETE FROM profile WHERE user_id=ANY($1::text[])',[[one,two]]);await db.end();writeFileSync(path,JSON.stringify(report,null,2));
}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
