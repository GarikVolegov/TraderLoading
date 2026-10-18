import assert from 'node:assert/strict';
import {readFileSync,copyFileSync,chmodSync,openSync,closeSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createConnection} from 'node:net';

const root=fileURLToPath(new URL('../../',import.meta.url));
const markerPath=root+'.local-logs/runtime-api-process.json';
const initial=JSON.parse(readFileSync(markerPath));
const database=JSON.parse(readFileSync(root+'.local-logs/runtime-db.json')).name;
assert.match(database,/^tl_audit_\d+$/);
assert.equal(initial.database,database);assert.equal(initial.mode,'production');
const command=execFileSync('ps',['-p',String(initial.pid),'-o','command='],{encoding:'utf8'}).trim();
assert.ok(command.endsWith(root+'artifacts/api-server/dist/index.cjs'),'Refusing to stop an unexpected process');
const archive=root+'.local-logs/runtime-api-before-restart-'+Date.now()+'.log';
copyFileSync(root+'.local-logs/runtime-api.log',archive);chmodSync(archive,0o600);
process.kill(initial.pid,'SIGTERM');
async function listening(){return await new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port:3002});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>{socket.destroy();resolve(false);});socket.setTimeout(500,()=>{socket.destroy();resolve(true);});});}
for(let n=0;n<40&&await listening();n++)await new Promise(r=>setTimeout(r,250));
assert.equal(await listening(),false,'Audit port must close before launching replacement');
const fd=openSync(root+'.local-logs/runtime-restart-launch.log','a',0o600);chmodSync(root+'.local-logs/runtime-restart-launch.log',0o600);
const launcher=spawn(process.execPath,[root+'scripts/verify-real-runtime/start-api.mjs'],{cwd:root,env:{...process.env,AUDIT_API_MODE:'production'},stdio:['ignore',fd,fd],detached:true});
launcher.unref();closeSync(fd);
let ready=false;
for(let n=0;n<60;n++){
 try{const next=JSON.parse(readFileSync(markerPath));if(next.pid!==initial.pid&&next.mode==='production'&&next.database===database){const r=await fetch('http://127.0.0.1:3002/api/auth/user',{signal:AbortSignal.timeout(1000)});const frontend=await fetch('http://127.0.0.1:3002/',{signal:AbortSignal.timeout(1000)});if(r.ok&&(await r.json()).user===null&&frontend.ok&&(await frontend.text()).includes('<html')){ready=true;break;}}}catch{/* Marker and HTTP readiness may lag the launcher. */}
 await new Promise(r=>setTimeout(r,250));
}
assert.ok(ready,'Replacement audit API did not become ready');
console.log('Isolated production API restarted and ready; personal API and database untouched');
