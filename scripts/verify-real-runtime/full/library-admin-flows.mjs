import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {api,base,connect,root,run,database,auditExecutionId,recordAuditRequest,setAuditScenario} from './env.mjs';

const db=await connect(),label=process.argv[2]||'after',users=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json'));
assert.match(label,/^[a-z0-9-]+$/);
const report={runId:run.runId,executionId:auditExecutionId,label,checks:[]},tag='audit_library_'+Date.now();
const admin=users.admin.sid,member=users.a.sid,collectionIds=[],contentIds=[],files=[];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lP8AAAAASUVORK5CYII=','base64');
const uploadRoot=root+'.local-logs/runtime-sandbox/'+database+'/uploads/library-files';
async function ok(sid,path,method='GET',body,status=200){const r=await api(sid,path,method,body);assert.equal(r.status,status,method+' '+path+': '+JSON.stringify(r.data).slice(0,180));return r.data;}
async function check(name,fn){setAuditScenario(name);try{const evidence=await fn();report.checks.push({name,status:'passed',evidence});console.log('PASS',name);}catch(error){report.checks.push({name,status:'failed',error:error.message});console.log('FAIL',name,error.message.slice(0,350));}writeFileSync(run.output+'/library-admin-'+label+'.json',JSON.stringify(report,null,2));}
async function raw(sid,path,method='GET',body){const r=await fetch(base+'/api'+path,{method,headers:sid?{Cookie:'sid='+sid}:{},body,signal:AbortSignal.timeout(15000)});recordAuditRequest({method,path,status:r.status,authenticated:Boolean(sid)});return r;}
async function upload(name,type,bytes){const form=new FormData();form.set('file',new Blob([bytes],{type}),name);const r=await raw(admin,'/library/upload','POST',form);const data=await r.json();if(data.fileUrl)files.push(data.fileUrl);return{status:r.status,data};}
async function collection(body={}){const c=await ok(admin,'/library/collections','POST',{title:tag+' collection',published:false,...body},201);collectionIds.push(c.id);return c;}
async function content(body={}){const c=await ok(admin,'/library/contents','POST',{title:tag+' document',type:'document',published:false,...body},201);contentIds.push(c.id);return c;}
async function removeFault(){await db.query('DROP TRIGGER IF EXISTS audit_library_delete ON library_collections');await db.query('DROP TRIGGER IF EXISTS audit_library_log ON admin_audit_logs');await db.query('DROP FUNCTION IF EXISTS audit_library_fault()');}
async function invalid(method,path,body,ids){const r=await api(admin,path,method,body);if(r.status===201&&r.data?.id)ids.push(r.data.id);return r.status===400?null:{method,path,status:r.status};}
try{
 await check('Library anonymous and non-admin writes and unreferenced files are protected',async()=>{
  await ok(null,'/library/collections','POST',{title:tag},401);await ok(member,'/library/contents','POST',{title:tag},403);
  const file=await upload('private.txt','text/plain','Unreferenced synthetic library file');assert.equal(file.status,200);
  assert.equal((await raw(null,file.data.fileUrl.replace('/api',''))).status,404);assert.equal((await raw(member,file.data.fileUrl.replace('/api',''))).status,404);assert.equal((await raw(admin,file.data.fileUrl.replace('/api',''))).status,200);
  return{unreferencedFileAdminOnly:true};
 });
 await check('Library editor payload creates an ungrouped document with null collectionId',async()=>{
  const payload={collectionId:null,type:'document',title:tag+' ungrouped editor',description:'',bodyMarkdown:'Actual editor-shaped synthetic body',fileUrl:'',fileName:'',fileSize:0,mimeType:'',embedUrl:'',mindmap:null,tags:[],requiredLevel:0,orderIndex:0,published:false};
  const c=await content(payload);
  await ok(admin,'/library/contents/'+c.id,'PUT',{...payload,title:tag+' edited ungrouped'});
  await ok(admin,'/admin/content/items/'+c.id+'/publish','POST',{reason:'Synthetic editor publication'});
  const publicRead=await api(null,'/library/contents/'+c.id);
  assert.deepEqual({collectionId:c.collectionId,publicStatus:publicRead.status},{collectionId:null,publicStatus:200});
  assert.equal((await ok(admin,'/library/contents/'+c.id)).collectionId,null);
 });
 await check('Legacy zero collection IDs read as ungrouped without modifying stored rows',async()=>{
  const row=(await db.query("INSERT INTO library_contents(title,collection_id,published,required_level) VALUES($1,0,true,0) RETURNING id",[tag+' historical zero'])).rows[0];contentIds.push(row.id);
  assert.equal((await ok(null,'/library/contents/'+row.id)).collectionId,null);
  assert.equal((await db.query('SELECT collection_id FROM library_contents WHERE id=$1',[row.id])).rows[0].collection_id,0);
 });
 await check('Library collection mutations validate types levels and identifiers without publishing drafts',async()=>{
  const c=await collection(),errors=[];
  for(const body of [{title:{}},{title:tag,published:'false'},{title:tag,requiredLevel:1.5},{title:tag,requiredLevel:-1}]){const e=await invalid('POST','/library/collections',body,collectionIds);if(e)errors.push(e);}
  for(const body of [{title:' '},{published:'false'},{description:{}},{requiredLevel:1.5}]){const e=await invalid('PUT','/library/collections/'+c.id,body,collectionIds);if(e)errors.push(e);}
  const before=c,after=(await ok(admin,'/library/collections/'+c.id)).collection;
  for(const key of ['title','published','description','requiredLevel'])if(after[key]!==before[key])errors.push({field:key,changed:true});
  assert.deepEqual(errors,[]);
  for(const path of ['/library/collections/not-id','/library/collections/1.5'])await ok(admin,path,'DELETE',undefined,400);
 });
 await check('Library content mutations reject malformed fields and preserve the prior document',async()=>{
  const c=await content({bodyMarkdown:'Original synthetic body'}),errors=[];
  for(const body of [{title:{}},{title:tag,published:'false'},{title:tag,requiredLevel:1.5},{title:tag,type:'invalid'},{title:tag,tags:{invalid:true}},{title:tag,collectionId:2147483647}]){const e=await invalid('POST','/library/contents',body,contentIds);if(e)errors.push(e);}
  for(const body of [{title:' '},{bodyMarkdown:{}},{published:'false'},{requiredLevel:-1},{fileSize:1.5},{collectionId:2147483647}]){const e=await invalid('PUT','/library/contents/'+c.id,body,contentIds);if(e)errors.push(e);}
  const after=await ok(admin,'/library/contents/'+c.id);
  for(const key of ['title','published','bodyMarkdown','requiredLevel','fileSize'])if(after[key]!==c[key])errors.push({field:key,changed:true});
  assert.deepEqual(errors,[]);
  for(const path of ['/library/contents/not-id','/library/contents/1.5'])await ok(admin,path,'DELETE',undefined,400);
 });
 await check('Failed collection deletion preserves all child contents and retry deletes them once',async()=>{
  const c=await collection();await content({collectionId:c.id});await content({collectionId:c.id});
  try{
   await db.query(`CREATE FUNCTION audit_library_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id=${Number(c.id)} THEN RAISE EXCEPTION 'Synthetic library delete failure'; END IF; RETURN OLD; END $$`);
   await db.query('CREATE TRIGGER audit_library_delete BEFORE DELETE ON library_collections FOR EACH ROW EXECUTE FUNCTION audit_library_fault()');
   await ok(admin,'/library/collections/'+c.id,'DELETE',undefined,500);
   assert.equal((await db.query('SELECT count(*)::int n FROM library_contents WHERE collection_id=$1',[c.id])).rows[0].n,2);
  }finally{await removeFault();}
  await ok(admin,'/library/collections/'+c.id,'DELETE');assert.equal((await db.query('SELECT count(*)::int n FROM library_contents WHERE collection_id=$1',[c.id])).rows[0].n,0);
 });
 await check('Failed publication audit rolls back visibility and retry records one complete change',async()=>{
  const c=await content({bodyMarkdown:'Private unpublished synthetic body'});
  try{
   await db.query(`CREATE FUNCTION audit_library_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.target_type='library_content' AND NEW.target_id='${Number(c.id)}' THEN RAISE EXCEPTION 'Synthetic publication audit failure'; END IF; RETURN NEW; END $$`);
   await db.query('CREATE TRIGGER audit_library_log BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION audit_library_fault()');
   await ok(admin,'/admin/content/items/'+c.id+'/publish','POST',{reason:'Synthetic rollback test'},500);
   const published=(await db.query('SELECT published FROM library_contents WHERE id=$1',[c.id])).rows[0].published,publicRead=await api(null,'/library/contents/'+c.id);
   assert.deepEqual({published,publicStatus:publicRead.status},{published:false,publicStatus:404});
  }finally{await removeFault();}
  await ok(admin,'/admin/content/items/'+c.id+'/publish','POST',{reason:'Synthetic retry'});
  assert.equal((await ok(null,'/library/contents/'+c.id)).bodyMarkdown,'Private unpublished synthetic body');
  await ok(admin,'/admin/content/items/'+c.id+'/unpublish','POST',{reason:'Synthetic unpublish'});await ok(null,'/library/contents/'+c.id,'GET',undefined,404);
  assert.equal((await db.query("SELECT count(*)::int n FROM admin_audit_logs WHERE target_type='library_content' AND target_id=$1",[String(c.id)])).rows[0].n,2);
 });
 await check('Deleting one library document preserves the file used by another document',async()=>{
  const file=await upload('shared.txt','text/plain','Shared synthetic body');assert.equal(file.status,200);
  const one=await content({fileUrl:file.data.fileUrl,published:true}),two=await content({fileUrl:file.data.fileUrl,published:true});
  await ok(admin,'/library/contents/'+one.id,'DELETE');assert.equal((await raw(null,file.data.fileUrl.replace('/api',''))).status,200);
  await ok(admin,'/library/contents/'+two.id,'DELETE');assert.equal((await raw(admin,file.data.fileUrl.replace('/api',''))).status,404);assert.ok(!existsSync(uploadRoot+'/'+file.data.fileUrl.split('/').at(-1)));
 });
 await check('Collection deletion removes unreferenced uploaded file assets after the database commit',async()=>{
  const file=await upload('collection.txt','text/plain','Collection synthetic body');assert.equal(file.status,200);
  const c=await collection();await content({collectionId:c.id,fileUrl:file.data.fileUrl});await ok(admin,'/library/collections/'+c.id,'DELETE');
  assert.equal((await raw(admin,file.data.fileUrl.replace('/api',''))).status,404);assert.ok(!existsSync(uploadRoot+'/'+file.data.fileUrl.split('/').at(-1)));
 });
 await check('Library upload rejects image and PDF spoofing and serves a genuine raster safely',async()=>{
  const errors=[];
  for(const [name,type,bytes]of [['bad.png','image/png','<html>wrong format</html>'],['bad.pdf','application/pdf','MZ executable']]){const r=await upload(name,type,bytes);if(r.status!==415)errors.push({name,status:r.status});}
  const r=await upload('valid.png','image/png',png);assert.equal(r.status,200);const file=await raw(admin,r.data.fileUrl.replace('/api',''));assert.equal(file.status,200);assert.deepEqual(Buffer.from(await file.arrayBuffer()),png);assert.match(file.headers.get('cache-control')||'',/private/);assert.equal(file.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(errors,[]);
 });
}finally{
 await removeFault();
 if(contentIds.length)await db.query('DELETE FROM library_contents WHERE id=ANY($1::int[])',[contentIds]);
 if(collectionIds.length)await db.query('DELETE FROM library_collections WHERE id=ANY($1::int[])',[collectionIds]);
 for(const file of files)rmSync(uploadRoot+'/'+file.split('/').at(-1),{force:true});
 await db.end();writeFileSync(run.output+'/library-admin-'+label+'.json',JSON.stringify(report,null,2));
}
if(report.checks.some(x=>x.status==='failed'))process.exitCode=1;
