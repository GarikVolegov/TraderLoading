import assert from 'node:assert/strict';
import {loadEnvLocal} from '../verify-usability/lib/common.mjs';
import {readFileSync,openSync,mkdirSync,existsSync,writeFileSync,chmodSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createConnection} from 'node:net';
import {snapshotFrontend} from './frontend-snapshot.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const listening=await new Promise(resolve=>{
 const socket=createConnection({host:'127.0.0.1',port:3002});
 socket.once('connect',()=>{socket.destroy();resolve(true);});
 socket.once('error',()=>{socket.destroy();resolve(false);});
 socket.setTimeout(2000,()=>{socket.destroy();resolve(true);});
});
assert.equal(listening,false,'Audit port 3002 is occupied; refusing to overwrite process marker or logs');
const cfg=loadEnvLocal();const {name}=JSON.parse(readFileSync(root+'.local-logs/runtime-db.json'));
assert.match(name,/^tl_audit_\d+$/);assert.match(cfg.CLERK_SECRET_KEY,/^sk_test_/);
const cwd=root+'.local-logs/runtime-sandbox/'+name;mkdirSync(cwd,{recursive:true});
// Express sendFile rejects hidden path segments, including .local-logs.
// Keep served assets in the private audit artifact tree instead.
const frontend=snapshotFrontend(root+'artifacts/trader-dashboard/dist/public',root+'artifacts.local/runtime-frontends/'+name);
const keyPath=cwd+'/vault-key';if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32).toString('hex'),{mode:0o600});
const production=process.env.AUDIT_API_MODE==='production';
const candleWarehouse=process.env.AUDIT_CANDLE_WAREHOUSE==='1';
const env={PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:production?'production':'development',PORT:'3002',BASE_PATH:'/',DATABASE_URL:`postgres://trader:trader@127.0.0.1:55432/${name}`,UPLOADS_DIR:cwd+'/uploads',FRONTEND_DIST_DIR:frontend.directory,BROKER_VAULT_KEY:readFileSync(keyPath,'utf8'),CLERK_SECRET_KEY:cfg.CLERK_SECRET_KEY,CLERK_PUBLISHABLE_KEY:cfg.CLERK_PUBLISHABLE_KEY||cfg.VITE_CLERK_PUBLISHABLE_KEY,VITE_CLERK_PUBLISHABLE_KEY:cfg.VITE_CLERK_PUBLISHABLE_KEY};
const req=createRequire(root+'scripts/package.json');
env.CANDLE_WAREHOUSE=candleWarehouse?'1':'0';
const args=production?[root+'artifacts/api-server/dist/index.cjs']:['--import',req.resolve('tsx'),root+'artifacts/api-server/src/index.ts'];
const logPath=root+'.local-logs/runtime-api.log';
const fd=openSync(logPath,'w',0o600);chmodSync(logPath,0o600);
const child=spawn(process.execPath,args,{cwd,env,stdio:['ignore',fd,fd]});
writeFileSync(root+'.local-logs/runtime-api-process.json',JSON.stringify({pid:child.pid,database:name,mode:env.NODE_ENV,candleWarehouse,frontendBuild:frontend}),{mode:0o600});
process.on('SIGTERM',()=>child.kill('SIGTERM'));process.on('SIGINT',()=>child.kill('SIGINT'));
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
await new Promise(resolve=>child.on('exit',code=>{process.exitCode=code??1;resolve();}));
