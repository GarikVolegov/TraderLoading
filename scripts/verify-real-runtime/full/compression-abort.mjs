import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer,request} from 'node:http';
import zlib from 'node:zlib';
import {writeFileSync} from 'node:fs';
import {root,run,auditExecutionId} from './env.mjs';
const label=process.argv[2]||'after';assert.match(label,/^[a-z0-9-]+$/);
const req=createRequire(root+'artifacts/api-server/package.json'),express=req('express'),compression=req('compression');
const report={runId:run.runId,executionId:auditExecutionId,label,libraryVersion:req('compression/package.json').version,mode:'Actual installed compression middleware with the app threshold; isolated ephemeral HTTP server, synthetic streaming responses, no app/database/provider requests',checks:[]},streams=[],timers=new Set();
const original=Object.getOwnPropertyDescriptor(zlib,'createGzip');
Object.defineProperty(zlib,'createGzip',{...original,value:(...args)=>{const stream=original.value(...args);streams.push(stream);return stream;}});
const app=express();app.use(compression({threshold:1024}));
app.get('/slow',(_request,response)=>{response.type('json');const timer=setInterval(()=>{response.write('x'.repeat(8192));response.flush();},5);timers.add(timer);response.on('close',()=>{clearInterval(timer);timers.delete(timer);});});
const server=createServer(app);
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
 for(let n=0;n<12;n++)await new Promise((resolve,reject)=>{
  const client=request({host:'127.0.0.1',port,path:'/slow',agent:false,headers:{'Accept-Encoding':'gzip'}},response=>{assert.equal(response.headers['content-encoding'],'gzip');response.once('data',()=>{response.destroy();client.destroy();resolve();});});
  client.setTimeout(3000,()=>client.destroy(new Error('Synthetic compression test timeout')));client.on('error',reject);client.end();
 });
 await new Promise(resolve=>setTimeout(resolve,150));report.streamsCreated=streams.length;report.destroyedAfterAbort=streams.filter(s=>s.destroyed).length;
 assert.equal(streams.length,12,'Each request must create an actual gzip stream');assert.equal(report.destroyedAfterAbort,12,'Aborted responses must release all native compression streams');
 report.checks.push({name:'Premature client close destroys every gzip stream',status:'passed'});console.log('PASS',report.libraryVersion,report.destroyedAfterAbort+'/'+report.streamsCreated);
}catch(error){report.checks.push({name:'Premature client close destroys every gzip stream',status:'failed',error:error.message});process.exitCode=1;console.log('FAIL',report.libraryVersion,report.destroyedAfterAbort+'/'+report.streamsCreated,error.message);}
finally{
 for(const timer of timers)clearInterval(timer);for(const stream of streams)stream.destroy();Object.defineProperty(zlib,'createGzip',original);
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));writeFileSync(run.output+'/compression-abort-'+label+'.json',JSON.stringify(report,null,2));
}
