import {readFileSync,writeFileSync} from 'node:fs';
import {api,connect,root,run} from './env.mjs';
const u=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json'));const db=await connect();const output=[];
try{
 await db.query('DELETE FROM missions WHERE user_id=$1',[u.a.id]);
 const results=await Promise.all(Array.from({length:8},()=>api(u.a.sid,'/missions')));
 output.push({name:'parallel first mission reads',statuses:results.map(r=>r.status),count:(await db.query('SELECT count(*)::int n FROM missions WHERE user_id=$1',[u.a.id])).rows[0].n});
 const csv='ticket,symbol,direction,entryPrice,exitPrice,profit\nAUDIT-1,EURUSD,buy,1.1,1.11,10\nAUDIT-1,EURUSD,buy,1.1,1.11,10';
 output.push({name:'duplicate CSV tickets',...await api(u.a.sid,'/journal/import-csv','POST',{csv})});
}finally{await db.end();}
writeFileSync(run.output+'/extra-baseline.json',JSON.stringify(output,null,2));console.log(output);
