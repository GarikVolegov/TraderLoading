import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {api,connect,run,root,database,setAuditScenario,auditExecutionId} from './env.mjs';

const label=process.argv[2]||'after';assert.match(label,/^(baseline|after)$/);
const report={runId:run.runId,auditExecutionId,label,checks:[],observations:{}};
const db=await connect(),tag='audit_timestamps_'+Date.now(),sid=randomBytes(32).toString('hex');
await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[sid,{user:{id:tag,email:null},access_token:'isolated-local-session'},new Date(Date.now()+86400000).toISOString()]);
await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[tag,tag]);
const check=async(name,fn)=>{setAuditScenario(name);try{await fn();report.checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,300));}writeFileSync(run.output+'/timestamps-'+label+'.json',JSON.stringify(report,null,2));};
try{
 report.observations.databaseDefaultTimeZone=(await db.query('SHOW TimeZone')).rows[0].TimeZone;
 await check('API default-created timestamp represents the actual creation instant',async()=>{
  const started=Date.now(),r=await api(sid,'/quotes','POST',{text:'Synthetic clock probe'}),finished=Date.now();assert.equal(r.status,201);
  const actual=Date.parse(r.data.createdAt);report.observations.defaultCreated={createdAt:r.data.createdAt,startedAt:new Date(started).toISOString(),finishedAt:new Date(finished).toISOString(),offsetFromRequestMs:actual-started};
  assert.ok(actual>=started-1000&&actual<=finished+1000,'Default timestamp offset from request: '+(actual-started)+'ms');
 });
 await check('Explicit Date write preserves its instant and Europe Rome trading day',async()=>{
  const started=Date.now(),r=await api(sid,'/routines/completions','POST',{routineId:tag,routineTitle:'Timestamp probe',template:'morning',answers:{focus:'Patient'}}),finished=Date.now();assert.equal(r.status,201);
  const row=(await db.query("SELECT to_char(completed_at,'YYYY-MM-DD\"T\"HH24:MI:SS.MS') wall_time,completion_date FROM routine_completions WHERE id=$1",[r.data.id])).rows[0];
  const actual=Date.parse(row.wall_time+'Z');report.observations.explicitDate={wallTime:row.wall_time,offsetFromRequestMs:actual-started,completionDate:row.completion_date};assert.ok(actual>=started-1000&&actual<=finished+1000);
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(started));assert.equal(r.data.completionDate,day);assert.equal(row.completion_date,day);
 });
 await check('Pool enforces UTC against DSN timezone and preserves other startup options',async()=>{
  // Node22 can load this type-only TS module; no import of the application's
  // default DB pool and no environment/credentials from .env.local are used.
  const {createPgPoolConfig}=await import(root+'lib/db/src/poolConfig.ts');const req=createRequire(root+'lib/db/package.json'),{Pool}=req('pg');
  const url=new URL(`postgres://trader:trader@127.0.0.1:55432/${database}`);url.searchParams.set('options','-c statement_timeout=1500 -c TimeZone=Europe/Rome');
  const pool=new Pool(createPgPoolConfig({DATABASE_URL:url.toString()}));
  try{
   const rows=await Promise.all([pool.query('SHOW TimeZone'),pool.query('SHOW statement_timeout')]);const timeZone=rows[0].rows[0].TimeZone,timeout=rows[1].rows[0].statement_timeout;report.observations.configuredPool={timeZone,statementTimeout:timeout};assert.equal(timeZone,'UTC');assert.equal(timeout,'1500ms');
  }finally{await pool.end();}
 });
}finally{await db.end();writeFileSync(run.output+'/timestamps-'+label+'.json',JSON.stringify(report,null,2));}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
