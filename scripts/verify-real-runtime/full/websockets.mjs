import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync,writeFileSync} from 'node:fs';import {randomBytes} from 'node:crypto';
import {root,run,base,connect,api} from './env.mjs';
const req=createRequire(root+'artifacts/api-server/package.json'),{WebSocket}=req('ws');const u=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json')),db=await connect(),checks=[],sockets=[];
const check=async(name,fn)=>{try{await fn();checks.push({name,status:'passed'});}catch(e){checks.push({name,status:'failed',error:e.message});}console.log(checks.at(-1));writeFileSync(run.output+'/websockets.json',JSON.stringify({runId:run.runId,checks},null,2));};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function open(sid,origin=base){return new Promise((resolve,reject)=>{const ws=new WebSocket(base.replace('http','ws')+'/api/social/ws',{headers:{...(sid?{Cookie:'sid='+sid}:{}),Origin:origin}});sockets.push(ws);ws.once('open',()=>resolve(ws));ws.once('error',reject);ws.once('unexpected-response',(_req,res)=>{ws.terminate();reject(new Error('HTTP '+res.statusCode));});});}
const nextEvent=ws=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('No websocket event')),3000);ws.once('message',data=>{clearTimeout(t);resolve(JSON.parse(String(data)));});});
let c,ch,wsA,wsB;const sid=randomBytes(32).toString('hex');
try{
 await check('WebSocket rejects anonymous clients and foreign origins',async()=>{await assert.rejects(open(null),/HTTP 401/);await assert.rejects(open(u.a.sid,'https://untrusted.invalid'),/HTTP 403/);});
 await check('Real stored session and database membership allow channel notifications',async()=>{
  c=(await api(u.a.sid,'/community','POST',{name:'Socket test '+Date.now(),isPublic:true})).data;ch=(await api(u.a.sid,`/community/${c.id}/channels`,'POST',{name:'socket',type:'text'})).data;
  assert.equal((await api(u.b.sid,`/community/${c.id}/join`,'POST',{})).status,200);
  await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[sid,{user:{id:u.b.id,email:null},access_token:'isolated'},new Date(Date.now()+86400000).toISOString()]);
  wsA=await open(u.a.sid);wsB=await open(sid);wsA.send(JSON.stringify({type:'subscribe',channelId:ch.id}));wsB.send(JSON.stringify({type:'subscribe',channelId:ch.id}));await delay(200);
  const event=nextEvent(wsB);assert.equal((await api(u.a.sid,`/community/channels/${ch.id}/messages`,'POST',{content:'Synthetic websocket message'})).status,201);assert.equal((await event).channelId,ch.id);
 });
 await check('Removed member stops receiving subscribed channel events',async()=>{assert.equal((await api(u.a.sid,`/community/${c.id}/members/${u.b.id}/ban`,'POST',{reason:'Audit'})).status,200);let received=false;wsB.on('message',()=>received=true);await api(u.a.sid,`/community/channels/${ch.id}/messages`,'POST',{content:'Private after removal'});await delay(300);assert.equal(received,false);});
 await check('Reconnection restores authorized subscriptions',async()=>{wsA.close();wsA=await open(u.a.sid);wsA.send(JSON.stringify({type:'subscribe',channelId:ch.id}));await delay(200);const event=nextEvent(wsA);await api(u.a.sid,`/community/channels/${ch.id}/messages`,'POST',{content:'After reconnect'});assert.equal((await event).channelId,ch.id);});
 await check('Suspended account cannot retain or open a WebSocket',async()=>{
  const closed=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Suspended socket stayed open')),20000);wsA.once('close',()=>{clearTimeout(t);resolve();});});
  try { await db.query("INSERT INTO admin_user_status(user_id,status,reason) VALUES($1,'suspended','Synthetic audit') ON CONFLICT(user_id) DO UPDATE SET status='suspended'",[u.a.id]);await closed;await assert.rejects(open(u.a.sid),/HTTP 401/); }
  finally { await db.query("UPDATE admin_user_status SET status='active' WHERE user_id=$1",[u.a.id]); }
 });
 await check('Revoked stored session closes existing socket within 20 seconds',async()=>{const closed=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Revoked socket stayed open')),20000);wsB.once('close',()=>{clearTimeout(t);resolve();});});await db.query('DELETE FROM sessions WHERE sid=$1',[sid]);await closed;await assert.rejects(open(sid),/HTTP 401/);});
}finally{for(const ws of sockets)ws.terminate();await db.query('DELETE FROM sessions WHERE sid=$1',[sid]);await db.end();}
if(checks.some(c=>c.status==='failed'))process.exitCode=1;
