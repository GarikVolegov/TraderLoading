import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {connect,root,run} from './env.mjs';
const marker=root+'.local-logs/replay-candle-fixture.json',stage=process.argv[2],db=await connect();
const start=Date.UTC(2024,5,3)/1000,count=4320,end=start+count*60;
try{
 if(stage==='prepare'){
  assert.equal(existsSync(marker),false,'Existing candle fixture must be reviewed before preparing another');
  assert.equal((await db.query('SELECT count(*)::int n FROM candle WHERE symbol=1')).rows[0].n,0,'EURUSD warehouse must be empty in the synthetic DB');
  await db.query('BEGIN');
  await db.query(readFileSync(root+'lib/db/drizzle/0035_candle_import_chunks.sql','utf8'));
  await db.query(`INSERT INTO candle(symbol,res,ts,open,high,low,close,volume,source)
    SELECT 1,1,$1::bigint+i*60,1.1,CASE WHEN i=605 THEN 1.105 ELSE 1.10001 END,1.09999,1.1,100,1 FROM generate_series(0,$2::int-1) i`,[start,count]);
  await db.query("INSERT INTO candle_ingestion_state(symbol,res,source,first_ts,last_ts,status) VALUES(1,1,1,$1,$2,'idle')",[start,end-60]);
  await db.query('COMMIT');
  writeFileSync(marker,JSON.stringify({runId:run.runId,start,end,count,mode:'Declared synthetic flat EURUSD M1 with one TP-touch bar; never personal data'}),{mode:0o600});
  console.log('Prepared '+count+' synthetic M1 candles in the isolated audit database');
 }else if(stage==='cleanup'){
  const fixture=JSON.parse(readFileSync(marker));assert.equal(fixture.runId,run.runId);assert.equal(fixture.start,start);assert.equal(fixture.end,end);
  await db.query('BEGIN');await db.query('DELETE FROM candle WHERE symbol=1 AND source=1 AND ts >= $1 AND ts < $2',[start,end]);await db.query('DELETE FROM candle_ingestion_state WHERE symbol=1 AND res=1 AND source=1 AND first_ts=$1',[start]);await db.query('COMMIT');unlinkSync(marker);console.log('Removed only this run synthetic candle fixture; audit schema retained');
 }else throw Error('Use prepare or cleanup');
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
