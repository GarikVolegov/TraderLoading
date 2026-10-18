import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync,mkdtempSync,mkdirSync,cpSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

function manifest(directory){
 const files={};
 function visit(relative=''){
  for(const entry of readdirSync(join(directory,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const name=relative?relative+'/'+entry.name:entry.name;
   if(entry.isDirectory())visit(name);
   else{assert.ok(entry.isFile(),'Frontend snapshot rejects symlinks or special files');files[name]=createHash('sha256').update(readFileSync(join(directory,name))).digest('hex');}
  }
 }
 visit();assert.ok(files['index.html'],'A complete frontend build must include index.html');
 return{sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}

/** Each API process owns an immutable copy, independent of later Vite builds. */
export function snapshotFrontend(source,parent,{copy=cpSync}={}){
 const before=manifest(source);mkdirSync(parent,{recursive:true,mode:0o700});
 const directory=mkdtempSync(join(parent,'build-'));
 try{
  const target=join(directory,'public');copy(source,target,{recursive:true});
  const copied=manifest(target),after=manifest(source);
  assert.equal(after.sha256,before.sha256,'Frontend build changed during snapshot; retry after build completion');
  assert.equal(copied.sha256,before.sha256,'Frontend snapshot differs from source build');
  const evidence={at:new Date().toISOString(),sha256:copied.sha256,fileCount:Object.keys(copied.files).length,files:copied.files};
  writeFileSync(join(directory,'manifest.json'),JSON.stringify(evidence,null,2),{mode:0o600});
  return{directory:target,manifestPath:join(directory,'manifest.json'),sha256:evidence.sha256};
 }catch(error){rmSync(directory,{recursive:true,force:true});throw error;}
}
