// Real PostgreSQL integration with declared synthetic candles only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(root+'scripts/package.json');
const {Client}=require('pg');
const loader=require.resolve('tsx');
const stage=process.argv[2];
const start=Date.UTC(2024,5,3)/1000;
if(stage){
 const url=new URL(process.env.DATABASE_URL);
 assert.equal(url.hostname,'127.0.0.1'); assert.match(url.pathname,/^\/tl_audit_\d+$/);
 const {pool,closeDbPool}=await import('../../lib/db/src/index.ts');
 const {seedSymbol}=await import('../../artifacts/api-server/src/services/ingest/seed.ts');
 const {readAggregated,readCoverage,isRangeVerified,upsertCandles}=await import('../../artifacts/api-server/src/services/ingest/candleStore.ts');
 const {readReplayHistory}=await import('../../artifacts/api-server/src/services/replayHistory.ts');
 try{
  if(stage==='restart'){
   const stored=await pool.query('SELECT count(*)::int n FROM candle WHERE symbol=1 AND source=1');
   assert.equal(stored.rows[0].n,360);assert.equal(await isRangeVerified('EURUSD',start,start+21600,1),true);
   console.log('PASS candles and verified import ledger survive process restart');
  }else{
   let calls=0;
   const bars=Array.from({length:360},(_,i)=>({time:start+i*60,open:1+i/10000,high:1.001+i/10000,low:0.999+i/10000,close:1.0005+i/10000,volume:10}));
   const source={id:1,name:'dukascopy',supports:s=>s==='EURUSD',fetchRange:async()=>{calls++;return bars;}};
   const imported=await seedSymbol('EURUSD',start,start+21600,source,{resume:true});assert.equal(imported.written,360);
   const resumed=await seedSymbol('EURUSD',start,start+21600,source,{resume:true});assert.equal(resumed.skipped,true);assert.equal(calls,1);
   console.log('PASS durable import and source-verified resume');
   const h1=await readAggregated(1,3600,start,start+21600,{sourceId:1});assert.equal(h1.length,6);assert.equal(h1[0].open,bars[0].open);assert.equal(h1[0].close,bars[59].close);assert.equal(h1[0].high,bars[59].high);
   const partial=await readReplayHistory('EURUSD','H4',{anchorTime:start+150*60,replayTime:start+150*60,warmupBars:0,limit:3});
   assert.equal(partial.partialCandle.close,bars[149].close);assert.equal(partial.partialCandle.high,bars[149].high);assert.ok(partial.partialCandle.high<partial.candles[0].high);
   console.log('PASS SQL timeframe aggregation and no future prices in the forming candle');
   const latest=await readReplayHistory('EURUSD','M1',{limit:100});assert.equal(latest.candles.length,100);assert.equal(latest.availableTo,start+21600);
   const atEnd=await readReplayHistory('EURUSD','H4',{anchorTime:start+21600,replayTime:start+21600,warmupBars:10,limit:20});assert.equal(atEnd.availableTo,start+21600);assert.equal(atEnd.partialCandle.close,bars[359].close);
   await assert.rejects(readReplayHistory('EURUSD','M1',{anchorTime:start+21660}),/data|archivio|import/i);
   const beforeStart=await readReplayHistory('EURUSD','M1',{to:start,limit:100});assert.deepEqual(beforeStart.candles,[]);
   console.log('PASS stale default history, exact archive end, out-of-range selection and earliest backward page');
   await pool.query('DELETE FROM candle WHERE symbol=1 AND ts=$1',[bars[20].time]);
   const healed=await seedSymbol('EURUSD',start,start+21600,source,{resume:true});assert.equal(healed.skipped,undefined);assert.equal(calls,2);
   console.log('PASS a partially deleted imported range is repaired on resume');
   await pool.query('UPDATE candle SET source=4 WHERE symbol=1 AND ts=$1',[bars[30].time]);
   const canonical=await readAggregated(1,60,bars[30].time,bars[30].time+60,{sourceId:1});assert.deepEqual(canonical,[]);
   await seedSymbol('EURUSD',start,start+21600,source,{resume:true});assert.equal(calls,3);
   console.log('PASS replay excludes other quote feeds and restores canonical data');
   const badSource={...source,fetchRange:async()=>[{...bars[0],high:0.5}]};
   await assert.rejects(seedSymbol('EURUSD',start,start+21660,badSource),/Invalid/);
   const failure=await pool.query('SELECT status FROM candle_import_chunks WHERE symbol=1 AND from_ts=$1 AND to_ts=$2',[start,start+21660]);assert.equal(failure.rows[0].status,'failed');
   console.log('PASS invalid import never certifies a range');
   await seedSymbol('EURUSD',start,start+2*86400,source);
   const coverage=await readCoverage(1,1,start,start+2*86400);assert.equal(coverage.coverage.status,'partial');assert.deepEqual(coverage.coverage.missingDays,['2024-06-04']);
   console.log('PASS known weekday gaps remain partial after a successful download');
   await upsertCandles(1,1,1,[{...bars[0],time:start-60},{...bars[0],time:start+3*86400}]);
   const fullBounds=await readCoverage(1,1,start,start+2*86400);
   assert.equal(fullBounds.coverage.candleCount,360);assert.equal(fullBounds.firstTs,start-60);assert.equal(fullBounds.lastTs,start+3*86400);
   await pool.query('DELETE FROM candle WHERE symbol=1 AND ts=ANY($1::bigint[])',[[start-60,start+3*86400]]);
   console.log('PASS date bounds expose all persisted history independently of the coverage target');
  }
 }finally{await closeDbPool();}
}else{
 const name='tl_audit_'+Date.now();
 const admin=new Client({host:'127.0.0.1',port:55432,user:'trader',password:'trader',database:'postgres'});
 await admin.connect();await admin.query(`CREATE DATABASE ${name}`);
 const dbUrl=`postgres://trader:trader@127.0.0.1:55432/${name}`;
 try{
  const db=new Client({connectionString:dbUrl});await db.connect();
  await db.query(readFileSync(root+'lib/db/drizzle/0006_candle_warehouse.sql','utf8'));
  await db.query(readFileSync(root+'lib/db/drizzle/0035_candle_import_chunks.sql','utf8'));await db.end();
  const env={PATH:process.env.PATH,HOME:process.env.HOME,DATABASE_URL:dbUrl,CANDLE_WAREHOUSE:'1',NODE_ENV:'test'};
  for(const step of ['exercise','restart']){
   const child=spawnSync(process.execPath,['--import',loader,fileURLToPath(import.meta.url),step],{cwd:root,env,encoding:'utf8',timeout:60000});
   process.stdout.write(child.stdout??'');process.stderr.write(child.stderr??'');assert.equal(child.status,0,child.error?.message||step);
  }
  const out=root+'artifacts.local/backtest-history';mkdirSync(out,{recursive:true});
  const csvPath=out+'/synthetic-usoil.csv';
  writeFileSync(csvPath,'Time (UTC),Open,High,Low,Close,Volume\n03.06.2024 00:00:00.000,75,76,74,75.5,10\n03.06.2024 00:01:00.000,75.5,76,75,75.7,11\n');
  const cli=[ '--import',loader,root+'artifacts/api-server/src/ingest.ts','import','--symbols=USOIL','--source=dukascopy','--file='+csvPath];
  const imported=spawnSync(process.execPath,cli,{cwd:root,env,encoding:'utf8',timeout:60000});process.stdout.write(imported.stdout??'');process.stderr.write(imported.stderr??'');assert.equal(imported.status,0,imported.error?.message);
  const resumed=spawnSync(process.execPath,cli,{cwd:root,env,encoding:'utf8',timeout:60000});assert.equal(resumed.status,0,resumed.stderr);assert.match(resumed.stdout,/verified; skipped/);
  console.log('PASS CSV CLI import and retry without duplicated candles');
  writeFileSync(out+'/runtime-report.json',JSON.stringify({at:new Date().toISOString(),mode:'synthetic data in disposable PostgreSQL; no external requests',checks:10,result:'passed'},null,2));
 }finally{
  await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();
 }
}
