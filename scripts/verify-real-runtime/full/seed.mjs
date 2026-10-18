import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {connect,root,run} from './env.mjs';
const db=await connect();const users={};
try{
 await db.query("BEGIN");
 for(const table of ['sessions','profile','admin_user_subscriptions','admin_users','user_settings']){
  const {rows}=await db.query(`SELECT count(*)::int n FROM ${table}`);
  assert.equal(rows[0].n,0,`Refusing to seed a populated audit database: ${table}`);
 }
 for(const [name,plan] of [['a','pro'],['b','pro'],['free','free'],['admin','pro'],...Array.from({length:20},(_,i)=>['load'+i,'pro'])]){
  const id='audit_'+run.runId+'_'+name,sid=randomBytes(32).toString('hex');users[name]={id,sid};
  await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[sid,{user:{id,email:null,firstName:'Audit',lastName:name,profileImageUrl:null},access_token:'isolated-local-session'},new Date(Date.now()+86400000).toISOString()]);
  await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)',[id,'Audit '+run.runId+' '+name]);
  await db.query('INSERT INTO admin_user_subscriptions(user_id,plan,status) VALUES($1,$2,\'active\')',[id,plan]);
  await db.query("INSERT INTO user_settings(user_id,selected_pairs,onboarding_tutorial_completed_at) VALUES($1,$2,now())",[id,JSON.stringify(['EURUSD'])]);
 }
 await db.query("INSERT INTO admin_users(user_id,role,status) VALUES($1,'super_admin','active')",[users.admin.id]);
 await db.query('COMMIT');
 writeFileSync(root+'.local-logs/full-audit-users.json',JSON.stringify(users),{mode:0o600});
 console.log('Seeded isolated roles and 20 load identities');
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
