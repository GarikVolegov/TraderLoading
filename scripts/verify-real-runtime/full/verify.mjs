import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {root,run,auditExecutionId} from './env.mjs';
import {fingerprintSources} from './source-fingerprint.mjs';
// Do not import the browser helpers here: @clerk/testing loads .env files and
// would make provider/database credentials available to the whole unit gate.
const publicLine=(existsSync(root+'.env.local')?readFileSync(root+'.env.local','utf8'):'').split(/\r?\n/).find(line=>/^(?:export\s+)?VITE_CLERK_PUBLISHABLE_KEY\s*=/.test(line));
const publicKey=process.env.VITE_CLERK_PUBLISHABLE_KEY||publicLine?.slice(publicLine.indexOf('=')+1).trim().replace(/^["']|["']$/g,'');
const childEnv=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','LC_CTYPE','PNPM_HOME','CI','SYSTEMROOT','ComSpec'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
childEnv.VITE_CLERK_PUBLISHABLE_KEY=publicKey;
const startedAt=new Date().toISOString(),before=fingerprintSources();
const directory=run.output+'/gates';mkdirSync(directory,{recursive:true});
const reportPath=directory+'/verify-'+auditExecutionId+'.json';
writeFileSync(reportPath,JSON.stringify({runId:run.runId,executionId:auditExecutionId,startedAt,status:'running',before},null,2));
const child=spawn('pnpm',['verify'],{cwd:root,stdio:'inherit',env:childEnv});
child.on('error',error=>{writeFileSync(reportPath,JSON.stringify({runId:run.runId,executionId:auditExecutionId,startedAt,finishedAt:new Date().toISOString(),status:'failed',error:error.message,before},null,2));console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{
 const after=fingerprintSources();
 const changed=[...new Set([...Object.keys(before.files),...Object.keys(after.files)])].filter(p=>before.files[p]!==after.files[p]);
 const passed=code===0&&changed.length===0;
 writeFileSync(reportPath,JSON.stringify({runId:run.runId,executionId:auditExecutionId,startedAt,finishedAt:new Date().toISOString(),status:passed?'passed':'failed',commandExitCode:code,sourceStable:changed.length===0,changed,before,after},null,2));
 if(changed.length)console.error('Audit verification source changed during execution; this gate is not certified:',changed.join(', '));
 console.log('Audit gate evidence:',reportPath);
 process.exitCode=passed?0:1;
});
