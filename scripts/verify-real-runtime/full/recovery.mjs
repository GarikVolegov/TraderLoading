import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {Client} from 'pg';
import {root,run,database,connect,api} from './env.mjs';
const users=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json')),db=await connect();
const checks=[],check=async(name,fn)=>{try{await fn();checks.push({name,status:'passed'});}catch(e){checks.push({name,status:'failed',error:e.message});}console.log(checks.at(-1));writeFileSync(run.output+'/recovery.json',JSON.stringify({runId:run.runId,checks},null,2));};
try{
 await check('A terminated audit database connection recovers without touching personal connections',async()=>{await db.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[database]);let r;for(let i=0;i<10;i++){r=await api(users.a.sid,'/settings');if(r.status===200)break;await new Promise(r=>setTimeout(r,200));}assert.equal(r.status,200);});
 await check('Mission credit failure rolls back completion and allows retry',async()=>{
  const u=users.b;await db.query('DELETE FROM missions WHERE user_id=$1',[u.id]);const mission=(await api(u.sid,'/missions')).data[0];
  try{
   await db.query(`CREATE OR REPLACE FUNCTION audit_reject_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id = '${u.id}' AND NEW.xp<>OLD.xp THEN RAISE EXCEPTION 'synthetic audit credit failure'; END IF; RETURN NEW; END $$`);
   await db.query('CREATE TRIGGER audit_reject_credit BEFORE UPDATE ON profile FOR EACH ROW EXECUTE FUNCTION audit_reject_credit()');
   const failed=await api(u.sid,'/missions/'+mission.id+'/complete','POST');assert.equal(failed.status,500);
   assert.equal((await db.query('SELECT completed FROM missions WHERE id=$1',[mission.id])).rows[0].completed,false);
  }finally{await db.query('DROP TRIGGER IF EXISTS audit_reject_credit ON profile');await db.query('DROP FUNCTION IF EXISTS audit_reject_credit()');}
  assert.equal((await api(u.sid,'/missions/'+mission.id+'/complete','POST')).status,200);
 });
 await check('Synthetic database backup restores durable row counts',async()=>{
  const bin=process.env.AUDIT_PG_BIN||'/Users/gazz/Applications/Postgres.app/Contents/Versions/16/bin';
  const backup=run.output+'/synthetic-database.dump',restoreName='tl_audit_restore_'+Date.now();assert.match(restoreName,/^tl_audit_restore_\d+$/);
  const tables=['profile','journal_entries','account_trades','missions','support_tickets','support_ticket_messages','community_members'];
  const counts={};for(const t of tables)counts[t]=(await db.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
  const exec=(cmd,args)=>{const r=spawnSync(bin+'/'+cmd,args,{env:{...process.env,PGPASSWORD:'trader'},encoding:'utf8'});assert.equal(r.status,0,r.error?.message||r.stderr);};
  exec('pg_dump',['-h','127.0.0.1','-p','55432','-U','trader','-d',database,'--format=custom','--no-owner','--no-privileges','--exclude-table-data=public.sessions','-f',backup]);chmodSync(backup,0o600);
  await db.query(`CREATE DATABASE ${restoreName}`);
  const restored=new Client({host:'127.0.0.1',port:55432,user:'trader',password:'trader',database:restoreName});
  try{exec('pg_restore',['-h','127.0.0.1','-p','55432','-U','trader','-d',restoreName,'--no-owner','--no-privileges','--exit-on-error',backup]);await restored.connect();for(const t of tables)assert.equal((await restored.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n,counts[t],t);assert.equal((await restored.query('SELECT count(*)::int n FROM sessions')).rows[0].n,0);}
  finally{await restored.end();await db.query(`DROP DATABASE ${restoreName}`);}
 });
}finally{await db.end();}
if(checks.some(x=>x.status==='failed'))process.exitCode=1;
