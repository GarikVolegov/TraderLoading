// Run with tsx. Exercises the real transaction against the disposable audit DB.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {name}=JSON.parse(readFileSync(root+'.local-logs/runtime-db.json'));
assert.match(name,/^tl_audit_\d+$/);
process.env.DATABASE_URL=`postgres://trader:trader@127.0.0.1:55432/${name}`;
process.env.UPLOADS_DIR=root+'.local-logs/runtime-uploads';
const {getOrCreateProfile}=await import('../../artifacts/api-server/src/routes/profile.ts');
const {pool}=await import('../../lib/db/src/index.ts');
try {
 const users=['audit-concurrency-a','audit-concurrency-b'];
 await pool.query('DELETE FROM profile WHERE user_id=ANY($1)',[users]);
 const results=await Promise.all(users.map(user=>Promise.all(Array.from({length:24},()=>getOrCreateProfile(user)))));
 for(let i=0;i<users.length;i++) {
  assert.equal(new Set(results[i].map(p=>p.id)).size,1);
  const count=await pool.query('SELECT count(*)::int AS n FROM profile WHERE user_id=$1',[users[i]]);
  assert.equal(count.rows[0].n,1);
 }
 assert.notEqual(results[0][0].name,results[1][0].name);
 console.log('PASS 48 concurrent profile requests, one profile per identity and unique names');
} finally {await pool.end();}
