import assert from 'node:assert/strict';
import {readFileSync,appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
export const root=fileURLToPath(new URL('../../../',import.meta.url));
export const run=JSON.parse(readFileSync(root+'.local-logs/full-audit-run.json'));
export const database=JSON.parse(readFileSync(root+'.local-logs/runtime-db.json')).name;
assert.match(database,/^tl_audit_\d+$/);
export const base='http://127.0.0.1:3002';
export const auditExecutionId=randomUUID();
export async function connect(){const db=new Client({host:'127.0.0.1',port:55432,user:'trader',password:'trader',database});await db.connect();await db.query("SET TIME ZONE 'UTC'");return db;}
let scenario = null;
export function setAuditScenario(name) { scenario = name; }
export function recordAuditRequest({method,path,status,authenticated}){appendFileSync(run.output+'/api-requests.jsonl',JSON.stringify({runId:run.runId,executionId:auditExecutionId,runner:process.argv[1]?.split('/').at(-1),at:new Date().toISOString(),scenario,method,path:path.split('?')[0],authenticated,status})+'\n');}
export async function api(sid,path,method='GET',body){const r=await fetch(base+'/api'+path,{method,headers:{...(sid?{Cookie:'sid='+sid}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});recordAuditRequest({method,path,status:r.status,authenticated:Boolean(sid)});const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}return {status:r.status,data};}
