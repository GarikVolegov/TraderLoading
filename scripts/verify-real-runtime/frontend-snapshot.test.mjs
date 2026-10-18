import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,cpSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {snapshotFrontend} from './frontend-snapshot.mjs';
const temporary=mkdtempSync(join(tmpdir(),'tl-snapshot-test-')),source=join(temporary,'source'),parent=join(temporary,'snapshots');
try{
 mkdirSync(source);writeFileSync(join(source,'index.html'),'build A');writeFileSync(join(source,'asset.js'),'version A');
 const first=snapshotFrontend(source,parent);writeFileSync(join(source,'asset.js'),'version B');
 assert.equal(readFileSync(join(first.directory,'asset.js'),'utf8'),'version A');
 const second=snapshotFrontend(source,parent);assert.notEqual(first.sha256,second.sha256);assert.equal(readFileSync(join(second.directory,'asset.js'),'utf8'),'version B');
 const count=readdirSync(parent).length;
 assert.throws(()=>snapshotFrontend(source,parent,{copy:(src,dst,options)=>{cpSync(src,dst,options);writeFileSync(join(src,'asset.js'),'concurrent build');}}),/changed during snapshot/);
 assert.equal(readdirSync(parent).length,count,'Failed copy must not leave a publishable snapshot');
 assert.throws(()=>snapshotFrontend(source,parent,{copy:(src,dst,options)=>{cpSync(src,dst,options);writeFileSync(join(dst,'asset.js'),'corrupt');}}),/differs from source/);
 assert.equal(readdirSync(parent).length,count);
 symlinkSync(join(source,'asset.js'),join(source,'link.js'));assert.throws(()=>snapshotFrontend(source,parent),/rejects symlinks/);
 console.log('PASS immutable build, distinct revisions, concurrent build rejection, corrupt copy rejection and symlink rejection');
}finally{rmSync(temporary,{recursive:true,force:true});}
