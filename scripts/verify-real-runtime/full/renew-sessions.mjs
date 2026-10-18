import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {root,run,connect,auditExecutionId} from './env.mjs';
// Fixture setup only. This does not renew Clerk or personal sessions, nor change
// roles; use before a new audit phase, never during a revocation scenario.
const users=Object.values(JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json')));
assert.ok(users.length>0);
for(const user of users){assert.ok(user.id.startsWith('audit_'+run.runId+'_'));assert.equal(typeof user.sid,'string');assert.ok(user.sid.length>20);}
const db=await connect();
try{
 await db.query('BEGIN');
 for(const user of users)await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expire=excluded.expire',[user.sid,{user:{id:user.id},access_token:'isolated-local-session'},new Date(Date.now()+86400000)]);
 await db.query('COMMIT');
 writeFileSync(run.output+'/session-fixture-renewal.json',JSON.stringify({runId:run.runId,executionId:auditExecutionId,at:new Date().toISOString(),fixtureCount:users.length,scope:'Synthetic local audit sessions only; no roles, Clerk or personal data changed'},null,2));
 console.log('Renewed '+users.length+' synthetic local session fixtures');
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
