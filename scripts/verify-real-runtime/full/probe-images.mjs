import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {root,run,base,api} from './env.mjs';
const u=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json'));
const e=await api(u.a.sid,'/journal','POST',{title:'Image isolation',content:'',tradeDate:'2026-10-02',result:'none'});assert.equal(e.status,201);
const checks=[];
for(const [name,type,data] of [['valid.png','image/png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64')],['active.svg','image/svg+xml','<svg xmlns="http://www.w3.org/2000/svg" onload="document.body.dataset.audit=1"/>'],['spoof.png','image/png','<html>Executable payload masquerading as image</html>']]){
 const form=new FormData();form.set('image',new Blob([data],{type}),name);
 const r=await fetch(base+'/api/journal/'+e.data.id+'/images',{method:'POST',headers:{Cookie:'sid='+u.a.sid},body:form});
 const payload=await r.json();let other=null;
 if(payload.image)other=(await fetch(base+payload.image.url,{headers:{Cookie:'sid='+u.b.sid}})).status;
 checks.push({name,status:r.status,otherUserReadStatus:other});
}
writeFileSync(run.output+'/image-probe-'+(process.argv[2]||'baseline')+'.json',JSON.stringify(checks,null,2));console.log(checks);
