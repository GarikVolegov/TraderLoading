import {readdirSync,readFileSync,existsSync,writeFileSync,copyFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {resolve,relative} from 'node:path';
import {root,run} from './env.mjs';
const inventory=[];
function visit(dir){for(const e of readdirSync(root+dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(e.isDirectory())visit(path);else if(e.name.endsWith('.ts')&&!e.name.includes('.test.')){const source=readFileSync(root+path,'utf8');for(const m of source.matchAll(/router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g))inventory.push({method:m[1].toUpperCase(),route:m[2],file:path,line:source.slice(0,m.index).split('\n').length});}}}
visit('artifacts/api-server/src/routes');
const requests=existsSync(run.output+'/api-requests.jsonl')?readFileSync(run.output+'/api-requests.jsonl','utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)):[];
const browser=JSON.parse(readFileSync(run.output+'/browser/report.json','utf8'));
assert.equal(browser.runId,run.runId,'Browser report belongs to another audit run');
const allowedReports={ 'api-flows.mjs':'api-flows.json','profile-flows.mjs':'profile-flows.json','market-tools.mjs':'market-tools-after.json','remaining-internal.mjs':'remaining-internal-after.json','domain-flows.mjs':'domain-flows-after.json','milestone-flows.mjs':'milestones-after.json','browser.mjs':'browser/report.json','admin-flows.mjs':'admin-flows-after.json','support-atomicity.mjs':'support-atomicity-after.json','misc-flows.mjs':'misc-flows-after.json','community-flows.mjs':'community-flows-after.json','social-flows.mjs':'social-flows-after.json','browser-admin.mjs':'browser-admin-after/report.json','browser-community.mjs':'browser-community-after/report.json','browser-push-preferences.mjs':'browser-push-after/report.json','browser-social.mjs':'browser-social-after/report.json','browser-settings.mjs':'browser-settings-after/report.json','browser-replay.mjs':'browser-replay-after/report.json','browser-extra.mjs':'browser-extra/report.json','browser-broker-pro-tornei.mjs':'browser-broker-pro-tornei-after/report.json' };
// Timestamped browser folders are selected by the reviewed finding, never by
// lexicographic newest-folder discovery that could reuse an unrelated attempt.
function reviewedAfterReport(indexName) {
 const index=JSON.parse(readFileSync(run.output+'/'+indexName,'utf8'));
 assert.equal(index.runId,run.runId,`Stale finding index: ${indexName}`);
 assert.ok(index.findings.every(f=>/corrected and reverified|corretta e riverificata/i.test(f.status||'')),`Unresolved finding cannot select an after report: ${indexName}`);
 const paths=[...new Set(index.findings.map(f=>f.evidenceAfter).filter(Boolean))];
 assert.equal(paths.length,1,`Expected one reviewed after report: ${indexName}`);
 const path=relative(resolve(run.output),resolve(root,paths[0]));
 assert.ok(path&&!path.startsWith('..')&&!path.startsWith('/'),'After report must be inside current audit output');
 const report=JSON.parse(readFileSync(run.output+'/'+path,'utf8'));
 assert.equal(report.executionId,index.afterExecutionId||index.executionId,`After report execution differs from reviewed finding: ${indexName}`);
 return path;
}
allowedReports['browser-referral.mjs']=reviewedAfterReport('referral-findings.json');
allowedReports['story-pending-review.mjs']=reviewedAfterReport('story-pending-findings.json');
allowedReports['browser-key-switch.mjs']='browser-key-switch-after/report.json';
allowedReports['crud-cleanup.mjs']='crud-cleanup-after.json';
allowedReports['library-admin-flows.mjs']='library-admin-after.json';
allowedReports['browser-library-editor.mjs']='browser-library-editor-after/report.json';
allowedReports['friends-global-flows.mjs']='friends-global-after.json';
allowedReports['chat-key-atomic.mjs']='chat-key-atomic-after.json';
allowedReports['chat-body-flows.mjs']='chat-body-after.json';
allowedReports['news-preferences-runtime.mjs']='news-preferences-runtime-after.json';
allowedReports['browser-news-preferences.mjs']='browser-news-preferences-navigation-regression/report.json';
allowedReports['broker-runtime-flows.mjs']='broker-runtime-current-20261010.json';
allowedReports['broker-restart.mjs']='broker-restart-after.json';
allowedReports['browser-workspaces.mjs']='browser-workspaces-stable-20261010/report.json';
allowedReports['milestone-runtime-flows.mjs']='milestone-runtime-after.json';
allowedReports['browser-milestone-editor.mjs']='browser-milestone-editor-after/report.json';
allowedReports['access-runtime-flows.mjs']='access-runtime-after.json';
allowedReports['tournament-certificates.mjs']='tournament-certificates-current-20261010.json';
allowedReports['voice-runtime-flows.mjs']='voice-runtime-current-20261010.json';
allowedReports['browser-voice.mjs']='browser-voice-stable-20261010/report.json';
allowedReports['replay-save.mjs']='replay-save-after.json';
allowedReports['replay-restart.mjs']='replay-restart-after.json';
allowedReports['candle-runtime.mjs']='candle-runtime-after.json';
allowedReports['browser-replay-runtime.mjs']='browser-replay-runtime-complete/report.json';
allowedReports['social-boundary-runtime.mjs']='social-boundary-after-private.json';
allowedReports['browser-social-boundary.mjs']='browser-social-boundary-complete/report.json';
allowedReports['browser-chat-sends.mjs']='browser-chat-sends-confirmation/report.json';
const reports=Object.fromEntries(Object.entries(allowedReports).map(([runner,path])=>[runner,JSON.parse(readFileSync(run.output+'/'+path,'utf8'))]));
for(const [name,report] of Object.entries(reports))assert.equal(report.runId,run.runId,`Stale report: ${name}`);
for(const [runner,report] of Object.entries(reports))for(const r of report.requests||[])requests.push({...r,path:r.path?.replace(/^\/api(?=\/)/,''),runId:run.runId,runner,source:'browser-report'});
// A passing after-report must not certify requests from a prior baseline process
// with identically named scenarios. API evidence is bound to one execution ID.
const excludedSimulations=[];
const tested=requests.filter(r=>{
 if(r.runId!==run.runId||!r.scenario||!(r.source==='browser-report'||Boolean(r.executionId)&&r.executionId===reports[r.runner]?.executionId))return false;
 const check=reports[r.runner]?.checks.find(c=>c.name===r.scenario&&c.status==='passed');
 if(!check)return false;
 // A browser response fulfilled locally proves the consumer UI, not the API.
 // Older mixed reports lack per-response provenance: conservatively exclude
 // their whole explicitly simulated scenario, including genuine background GETs.
 const legacyUnknownError=!r.provenance&&r.status>=500;
 const legacyReplayFixture=!r.provenance&&r.runner==='browser-replay.mjs'&&r.method==='GET'&&['/backtest/candles','/backtest/candles/meta'].includes(r.path);
 if(r.source==='browser-report'&&(r.provenance==='simulated'||!r.provenance&&/simulated/i.test(check.kind||'')||legacyUnknownError||legacyReplayFixture)){
  excludedSimulations.push({runner:r.runner,scenario:r.scenario,method:r.method,path:r.path,status:r.status,reason:legacyUnknownError?'Older browser error response lacks provenance':legacyReplayFixture?'Synthetic replay candles':'Browser fixture or older mixed simulated scenario'});return false;
 }
 return true;
});
function matches(route,path){return new RegExp('^'+route.split('/').map(x=>x.startsWith(':')?'[^/]+':x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'$').test(path);}
// A literal /journal/edge request cannot also prove /journal/:id. Within each
// router Express selects the first matching declaration; if multiple files match,
// leave evidence unattributed rather than guessing their mount order.
const attributed=new Map(inventory.map(i=>[i,[]]));
const ambiguous=[];
const declarationCount=new Map();
const declarationKey=i=>`${i.file}:${i.method}:${i.route}`;
for(const i of inventory)declarationCount.set(declarationKey(i),(declarationCount.get(declarationKey(i))||0)+1);
for(const r of tested){
 const firstByFile=new Map();
 for(const i of inventory)if(i.method===r.method&&matches(i.route,r.path)&&!firstByFile.has(i.file))firstByFile.set(i.file,i);
 if(firstByFile.size===1){
  const first=[...firstByFile.values()][0];
  if(declarationCount.get(declarationKey(first))===1)attributed.get(first).push(r);
  else ambiguous.push({method:r.method,path:r.path,scenario:r.scenario,reason:'Conditional duplicate declarations; active handler not inferred from source order'});
 }
 else if(firstByFile.size>1)ambiguous.push({method:r.method,path:r.path,scenario:r.scenario});
}
const rows=inventory.map((i,index)=>{const proof=attributed.get(i);return {...i,id:'API-'+String(index+1).padStart(3,'0'),status:proof.length?(proof.some(r=>r.status>=200&&r.status<300)?'verificata nel solo scenario indicato':'verificata solo protezione/indisponibilità'):'non verificabile in questa esecuzione',scenario:proof.length?[...new Set(proof.map(r=>r.scenario))].join('; '):`Esercitare ${i.method} ${i.route}: risultato, persistenza, permessi, input invalidi e retry`,limits:proof.length?(proof.some(r=>r.status>=200&&r.status<300)?'Copertura del percorso citato; non di tutte le varianti della funzione':'Solo rifiuti attesi/servizio assente: non prova di esecuzione riuscita della funzione'):'Scenario non ancora eseguito nel runtime: lavoro aperto, non impedimento esterno',httpStatuses:[...new Set(proof.map(r=>r.status))].join('/'),evidence:[...new Set(proof.map(r=>allowedReports[r.runner]))].join('; ')};});
writeFileSync(run.output+'/api-coverage.json',JSON.stringify({runId:run.runId,generatedAt:new Date().toISOString(),inventoryBasis:'router METHOD declarations; first match within file, cross-file ambiguities and browser simulations excluded; webhook/upgrade/cron listed separately',ambiguous,excludedSimulations,rows},null,2));
const columns=['id','method','route','status','scenario','limits','httpStatuses','evidence','file','line'];
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
writeFileSync(root+'docs/audit/api-coverage-2026-10-03.csv',[columns.join(','),...rows.map(r=>columns.map(c=>quote(r[c])).join(','))].join('\n')+'\n');
writeFileSync(run.output+'/ui-controls.json',JSON.stringify({runId:run.runId,scope:'Visible and hidden controls discovered on visited pages; inventory only, not functional coverage',pages:browser.pages},null,2));
for(const area of ['verify-operating-center','verify-pair-context']){const src=root+'artifacts.local/'+area+'/report.json';if(existsSync(src))copyFileSync(src,run.output+'/'+area+'.json');}
const count=rows.filter(r=>r.evidence).length;
console.log(JSON.stringify({inventoriedHandlers:rows.length,handlersObservedWithinPassingScenarios:count,remaining:rows.length-count,uiPages:browser.pages.length}));
