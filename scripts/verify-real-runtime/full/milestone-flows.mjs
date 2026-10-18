import {auditExecutionId as executionId} from './env.mjs';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {api,connect,root,run,base} from './env.mjs';
import {setAuditScenario} from './env.mjs';
const u=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json')),db=await connect(),label=process.argv[2]||'after',checks=[];
async function check(name,fn){setAuditScenario(name);try{await fn();checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,300));}writeFileSync(run.output+'/milestones-'+label+'.json',JSON.stringify({runId:run.runId,executionId,checks},null,2));}
try{
 for(const x of [u.a,u.b,u.admin])await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3) ON CONFLICT(sid) DO UPDATE SET expire=excluded.expire',[x.sid,{user:{id:x.id},access_token:'isolated'},new Date(Date.now()+86400000).toISOString()]);
 await check('DB content admin can manage milestones; normal user cannot',async()=>{assert.equal((await api(u.a.sid,'/milestones/999','PUT',{title:'Forbidden'})).status,403);assert.equal((await api(u.admin.sid,'/milestones/999','PUT',{title:'Synthetic locked reward',description:'LOCKED REWARD',skills:['Synthetic']})).status,200);assert.equal((await api(u.admin.sid,'/milestones/admin/status')).data.isAdmin,true);});
 await check('Milestone unreached level does not disclose files',async()=>{await db.query("INSERT INTO level_milestone_files(level,file_name,file_url,mime_type) VALUES(999,'Secret.pdf','/api/uploads/milestone-files/test-secret.pdf','application/pdf')");const r=await api(u.a.sid,'/milestones/999');assert.equal(r.status,200);assert.deepEqual(r.data.files,[]);});
 await check('Milestone upload and direct download enforce earned level',async()=>{const form=new FormData();form.set('file',new Blob(['Synthetic reward document'],{type:'text/plain'}),'audit.txt');const r=await fetch(base+'/api/milestones/999/files',{method:'POST',headers:{Cookie:'sid='+u.admin.sid},body:form});assert.equal(r.status,201);const file=await r.json();assert.equal((await fetch(base+file.fileUrl)).status,404);assert.equal((await fetch(base+file.fileUrl,{headers:{Cookie:'sid='+u.a.sid}})).status,404);assert.equal((await fetch(base+file.fileUrl,{headers:{Cookie:'sid='+u.admin.sid}})).status,200);assert.equal((await api(u.admin.sid,`/milestones/files/${file.id}`,'DELETE')).status,200);});
 await check('Certificate backfill is idempotent under concurrent requests',async()=>{const rs=await Promise.all(Array.from({length:8},()=>api(u.b.sid,'/milestones/certificates/me')));assert.ok(rs.every(r=>r.status===200));const dup=await db.query('SELECT level,count(*) FROM level_certificates WHERE user_id=$1 GROUP BY level HAVING count(*)>1',[u.b.id]);assert.equal(dup.rowCount,0);});
}finally{await db.end();}
if(checks.some(x=>x.status==='failed'))process.exitCode=1;
