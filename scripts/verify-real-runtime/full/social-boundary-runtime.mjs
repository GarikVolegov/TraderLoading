import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {api,base,connect,database,root,run,auditExecutionId,setAuditScenario,recordAuditRequest} from './env.mjs';

const label=process.argv[2]||'after';assert.match(label,/^[a-z0-9-]+$/);
const marker=JSON.parse(readFileSync(root+'.local-logs/runtime-api-process.json'));
assert.equal(marker.database,database);assert.equal(marker.mode,'production');
const db=await connect(),tag='audit_social_boundary_'+Date.now();
const actors=['owner','peer','outsider'].map(name=>({id:tag+'_'+name,sid:randomUUID(),name:tag+' '+name}));
const [a,b,c]=actors,ids=actors.map(u=>u.id),communities=[],files=[];
const filesDir=root+'.local-logs/runtime-sandbox/'+database+'/uploads/chat-files';
const output=run.output+'/social-boundary-'+label+'.json';
const report={runId:run.runId,executionId:auditExecutionId,startedAt:new Date().toISOString(),mode:'Actual isolated production API and PostgreSQL; synthetic actors/files; no push recipients or external providers',checks:[]};
async function check(name,fn){setAuditScenario(name);try{const evidence=await fn();report.checks.push({name,status:'passed',evidence});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,300));}writeFileSync(output,JSON.stringify(report,null,2));}
async function ok(user,path,method='GET',body,status=200){const r=await api(user?.sid,path,method,body);assert.equal(r.status,status,method+' '+path);return r.data;}
async function upload(user,filename,content='Synthetic private file',recipient=b.id,status=200,mime='text/plain'){
 const form=new FormData();form.set('file',new Blob([content],{type:mime}),filename);if(recipient!==null)form.set('toUserId',recipient);
 const r=await fetch(base+'/api/social/upload-file',{method:'POST',headers:user?{Cookie:'sid='+user.sid}:{},body:form,signal:AbortSignal.timeout(15000)});
 recordAuditRequest({method:'POST',path:'/social/upload-file',status:r.status,authenticated:Boolean(user)});
 const data=await r.json();if(data.fileUrl)files.push(data.fileUrl.split('/').at(-1));assert.equal(r.status,status,filename);return data;
}
async function download(user,path,status=200){
 const r=await fetch(base+path,{headers:user?{Cookie:'sid='+user.sid}:{},signal:AbortSignal.timeout(15000)});
 recordAuditRequest({method:'GET',path:path.replace(/^\/api/,''),status:r.status,authenticated:Boolean(user)});
 assert.equal(r.status,status,path);return {headers:Object.fromEntries(r.headers),text:await r.text()};
}
const disk=()=>existsSync(filesDir)?readdirSync(filesDir).sort():[];
const fileCount=async()=>Number((await db.query('SELECT count(*)::int n FROM chat_file_access WHERE owner_user_id=ANY($1::text[])',[ids])).rows[0].n);
async function createCommunity(){const community=await ok(a,'/community','POST',{name:tag,isPublic:false},201);communities.push(community.id);const detail=await ok(a,'/community/'+community.id);return detail;}
try{
 for(const u of actors){await db.query('INSERT INTO profile(user_id,name,wallet_address,years_experience,last_active_date) VALUES($1,$2,$3,7,$4)',[u.id,u.name,'0x'+'12'.repeat(20),'2024-01-01']);await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)',[u.sid,{user:{id:u.id}},new Date(Date.now()+86400000)]);}
 await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status) VALUES($1,'pro','active')",[a.id]);
 await check('Social profile exposes public fields only and never account wallet or activity metadata',async()=>{
  await ok(null,'/social/profile/'+a.id,'GET',undefined,401);await ok(b,'/social/profile/'+tag+'_missing','GET',undefined,404);
  const profile=await ok(b,'/social/profile/'+a.id);report.profileKeysObserved=Object.keys(profile.profile).sort();
  assert.equal(profile.profile.name,a.name);assert.equal(profile.profile.userId,a.id);assert.equal(profile.isOwnProfile,false);
  for(const field of ['walletAddress','lastActiveDate','updatedAt'])assert.equal(Object.hasOwn(profile.profile,field),false,'Private profile field exposed: '+field);
  const own=await ok(a,'/social/profile/'+a.id);assert.equal(own.isOwnProfile,true);
  assert.equal((await db.query('SELECT wallet_address FROM profile WHERE user_id=$1',[a.id])).rows[0].wallet_address,'0x'+'12'.repeat(20));
  return {publicProfileKeys:Object.keys(profile.profile).sort(),walletStillStoredForOwner:true};
 });
 await check('Follow counts and mutual status persist without duplicate rows on repeated requests',async()=>{
  await ok(a,'/social/follow/'+b.id,'POST',{},201);await ok(a,'/social/follow/'+b.id,'POST',{},409);
  let viewed=await ok(a,'/social/profile/'+b.id);assert.equal(viewed.followersCount,1);assert.equal(viewed.isFollowing,true);assert.equal(viewed.isMutual,false);
  await ok(b,'/social/follow/'+a.id,'POST',{},201);viewed=await ok(a,'/social/profile/'+b.id);assert.equal(viewed.isMutual,true);assert.equal(viewed.followingCount,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM follows WHERE follower_id=$1 AND following_id=$2',[a.id,b.id])).rows[0].n,1);
 });
 await check('Private attachments download for both participants and deny anonymous outsider traversal and missing file',async()=>{
  const file=await upload(a,'audit.txt'),row=(await db.query('SELECT * FROM chat_file_access WHERE file_key=$1',[file.fileUrl.split('/').at(-1)])).rows[0];
  assert.equal(row.owner_user_id,a.id);assert.equal(row.peer_user_id,b.id);
  for(const user of [a,b]){const r=await download(user,file.fileUrl);assert.equal(r.text,'Synthetic private file');assert.match(r.headers['cache-control'],/private.*no-store/);assert.match(r.headers['content-disposition'],/^attachment/);assert.equal(r.headers['x-content-type-options'],'nosniff');}
  await download(null,file.fileUrl,401);await download(c,file.fileUrl,404);await download(a,'/api/uploads/chat-files/missing.txt',404);await download(a,'/api/uploads/chat-files/'+encodeURIComponent('../private.txt'),404);
 });
 await check('Rejected attachments leave disk and access rows unchanged',async()=>{
  const before=disk(),rows=await fileCount();
  for(const filename of ['active.html','script.js','payload.exe','vector.svg'])await upload(a,filename,'Synthetic blocked content',b.id,400);
  await upload(a,'missing-recipient.txt','No peer',null,400);await upload(a,'stranger.txt','Not a mutual contact',c.id,400);await upload(null,'anonymous.txt','No login',b.id,401);
  assert.deepEqual(disk(),before);assert.equal(await fileCount(),rows);
 });
 if(label==='after-private')await check('Private images validate MIME and bytes and render inline only for conversation participants',async()=>{
  const before=disk(),rows=await fileCount();
  await upload(a,'spoofed.png','<html>Not an image</html>',b.id,415,'image/png');assert.deepEqual(disk(),before);assert.equal(await fileCount(),rows);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
  const file=await upload(a,'valid.png',png,b.id,200,'image/png');
  for(const user of [a,b]){const r=await download(user,file.fileUrl);assert.equal(r.headers['content-type'],'image/png');assert.equal(r.headers['content-disposition'],'inline');assert.match(r.headers['cache-control'],/private.*no-store/);}
  await download(null,file.fileUrl,401);await download(c,file.fileUrl,404);
  const renamed=await upload(a,'renamed.png','<html>Plain download</html>');const r=await download(b,renamed.fileUrl);assert.match(r.headers['content-disposition'],/^attachment/);
 });
 await check('Attachment database failure removes temporary file and retry stores one accessible file',async()=>{
  const before=disk(),rows=await fileCount();
  const functionName='audit_file_fault_'+Date.now();
  await db.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.owner_user_id='${a.id}' THEN RAISE EXCEPTION 'Synthetic attachment ACL fault'; END IF; RETURN NEW; END $$`);
  await db.query(`CREATE TRIGGER ${functionName} BEFORE INSERT ON chat_file_access FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
  try{await upload(a,'retry.txt','Retry file',b.id,500);assert.deepEqual(disk(),before);assert.equal(await fileCount(),rows);}finally{await db.query(`DROP TRIGGER IF EXISTS ${functionName} ON chat_file_access`);await db.query(`DROP FUNCTION IF EXISTS ${functionName}()`);}
  const file=await upload(a,'retry.txt','Retry file');assert.equal((await download(b,file.fileUrl)).text,'Retry file');assert.equal(await fileCount(),rows+1);
 });
 await check('Channel context remains private and resolution never grants a paid entitlement',async()=>{
  const detail=await createCommunity(),channel=detail.channels.find(x=>x.type==='text');
  const path='/community/channels/'+channel.id+'/context';
  await ok(null,path,'GET',undefined,401);await ok(c,path,'GET',undefined,404);assert.deepEqual(await ok(a,path),{channelId:channel.id,communityId:detail.id});
  await db.query("INSERT INTO community_members(community_id,user_id,role) VALUES($1,$2,'member')",[detail.id,b.id]);
  assert.deepEqual(await ok(b,path),{channelId:channel.id,communityId:detail.id});
  await ok(a,'/community/channels/'+channel.id+'/pricing','PATCH',{priceCents:500,accessModel:'one_time'});
  assert.deepEqual(await ok(b,path),{channelId:channel.id,communityId:detail.id});await ok(b,'/community/channels/'+channel.id+'/messages','GET',undefined,402);
  await db.query('INSERT INTO community_bans(community_id,user_id,banned_by) VALUES($1,$2,$3)',[detail.id,b.id,a.id]);await ok(b,path,'GET',undefined,404);
  await db.query('DELETE FROM community_bans WHERE community_id=$1 AND user_id=$2',[detail.id,b.id]);await db.query('DELETE FROM community_members WHERE community_id=$1 AND user_id=$2',[detail.id,b.id]);await ok(b,path,'GET',undefined,404);
 });
 await check('Channel context validates the database integer range before querying',async()=>{
  const idsToCheck=['0','-1','1junk','01','2147483648','9007199254740991'];
  const results=[];for(const id of idsToCheck){const r=await api(a.sid,'/community/channels/'+id+'/context');results.push({id,status:r.status});}
  report.channelInputObserved=results;assert.ok(results.every(r=>r.status===400),JSON.stringify(results));
  await ok(a,'/community/channels/2147483647/context','GET',undefined,404);
 });
 await check('Mobile logout revokes only its synthetic session and repeat logout is harmless',async()=>{
  await ok(a,'/mobile-auth/logout','POST',{});await ok(a,'/social/profile/'+b.id,'GET',undefined,401);await ok(a,'/mobile-auth/logout','POST',{});
  await ok(b,'/social/profile/'+b.id);assert.equal((await db.query('SELECT count(*)::int n FROM sessions WHERE sid=$1',[a.sid])).rows[0].n,0);
 });
}finally{
 // Cleanup uses exact synthetic IDs only. The owner's session may be revoked.
 for(const id of communities){await db.query('DELETE FROM community_channel_entitlements WHERE community_id=$1',[id]);await db.query('DELETE FROM community_bans WHERE community_id=$1',[id]);await db.query('DELETE FROM community_members WHERE community_id=$1',[id]);await db.query('DELETE FROM community_roles WHERE community_id=$1',[id]);await db.query('DELETE FROM community_channels WHERE community_id=$1',[id]);await db.query('DELETE FROM communities WHERE id=$1',[id]);}
 for(const key of files)rmSync(filesDir+'/'+key,{force:true});
 await db.query('DELETE FROM chat_file_access WHERE owner_user_id=ANY($1::text[])',[ids]);await db.query('DELETE FROM follows WHERE follower_id=ANY($1::text[]) OR following_id=ANY($1::text[])',[ids]);
 for(const u of actors){await db.query('DELETE FROM sessions WHERE sid=$1',[u.sid]);await db.query('DELETE FROM login_access WHERE user_id=$1',[u.id]);await db.query('DELETE FROM admin_user_subscriptions WHERE user_id=$1',[u.id]);await db.query('DELETE FROM profile WHERE user_id=$1',[u.id]);}
 await db.end();report.finishedAt=new Date().toISOString();writeFileSync(output,JSON.stringify(report,null,2));
}
if(report.checks.some(c=>c.status==='failed'))process.exitCode=1;
