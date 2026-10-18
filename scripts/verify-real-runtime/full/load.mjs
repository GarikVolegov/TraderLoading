import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {connect,root,run,api} from './env.mjs';
const users=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json'));
const proc=JSON.parse(readFileSync(root+'.local-logs/runtime-api-process.json'));
assert.equal(proc.mode,'production');
const label=process.argv[2]||'baseline',report={runId:run.runId,label,datasets:[],loads:[]};
const db=await connect();
const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor(xs.length*p))];
try{
 for(const n of [100,1000,10000]){
  const uid=users.load0.id;await db.query('DELETE FROM journal_entries WHERE user_id=$1',[uid]);
  await db.query("INSERT INTO journal_entries(user_id,title,content,trade_date,result) SELECT $1,'Synthetic '||i,repeat('Audit ',20),'2026-10-01','none' FROM generate_series(1,$2::int) i",[uid,n]);
  const samples=[];let bytes=0;
  for(let i=0;i<10;i++){const t=performance.now(),r=await api(users.load0.sid,'/journal');assert.equal(r.status,200);assert.equal(r.data.length,n);samples.push(performance.now()-t);bytes=Buffer.byteLength(JSON.stringify(r.data));}
  report.datasets.push({rows:n,p50:percentile(samples,.5),p95:percentile(samples,.95),bytes});console.log('DATASET',report.datasets.at(-1));
 }
 for(let i=1;i<20;i++){await db.query('DELETE FROM journal_entries WHERE user_id=$1',[users['load'+i].id]);await db.query("INSERT INTO journal_entries(user_id,title,content,trade_date,result) SELECT $1,'Synthetic '||i,repeat('Audit ',20),'2026-10-01','none' FROM generate_series(1,1000) i",[users['load'+i].id]);}
 for(const concurrency of [1,5,20]){
  // Each phase has a fresh per-user rate-limit budget; never raise production limits.
  const phaseUsers=[];
  for(let i=0;i<concurrency;i++){
   const id=`audit_load_${label}_${Date.now()}_${concurrency}_${i}`,sid=randomBytes(32).toString('hex');phaseUsers.push({id,sid});
   await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[sid,{user:{id,email:null,firstName:'Load',lastName:String(i)},access_token:'isolated-local-session'},new Date(Date.now()+86400000).toISOString()]);
   await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[id,id]);
   await db.query('INSERT INTO user_settings(user_id,selected_pairs) VALUES($1,$2)',[id,JSON.stringify(['EURUSD'])]);
  }
  const times=[],errors=[],resources=[];let requests=0;const started=Date.now(),until=started+300000;
  const monitor=setInterval(()=>{try{const [cpu,rss]=execFileSync('ps',['-p',String(proc.pid),'-o','%cpu=,rss='],{encoding:'utf8'}).trim().split(/\s+/).map(Number);resources.push({at:Date.now()-started,cpu,rssKb:rss});}catch{/* process exit recorded by API failures */}},10000);
  await Promise.all(Array.from({length:concurrency},async(_,i)=>{let step=0;const user=phaseUsers[i];while(Date.now()<until){const t=performance.now();try{const r=step++%5===4?await api(user.sid,'/settings','PUT',{maxDailyLoss:100+step%10}):await api(user.sid,step%2?'/profile':'/settings');requests++;if(r.status!==200)errors.push(r.status);times.push(performance.now()-t);}catch(e){errors.push(e.name);}await new Promise(r=>setTimeout(r,300));}}));
  clearInterval(monitor);report.loads.push({concurrency,durationMs:Date.now()-started,requests,p50:percentile(times,.5),p95:percentile(times,.95),errors,resources});
  writeFileSync(run.output+'/load-'+label+'.json',JSON.stringify(report,null,2));console.log('LOAD',concurrency,'p95',report.loads.at(-1).p95,'errors',errors.length);
 }
}finally{await db.end();writeFileSync(run.output+'/load-'+label+'.json',JSON.stringify(report,null,2));}

assert.ok(report.loads.every(x=>x.errors.length===0),'Unexpected load errors; inspect this run report');
