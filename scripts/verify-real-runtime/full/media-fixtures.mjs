import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {root,run} from './env.mjs';

/** A short synthetic tone; no microphone, account or external network access. */
export async function createSyntheticVoice(){
 const req=createRequire(root+'artifacts/trader-dashboard/package.json');
 const browser=await chromium.launch({headless:true,executablePath:req('puppeteer').executablePath(),args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage();
  const bytes=await page.evaluate(async()=>{
   const context=new AudioContext();const oscillator=context.createOscillator(),destination=context.createMediaStreamDestination();
   oscillator.frequency.value=440;oscillator.connect(destination);oscillator.start();await context.resume();
   const recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm'}),chunks=[];
   recorder.ondataavailable=e=>chunks.push(e.data);
   const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();await new Promise(r=>setTimeout(r,300));recorder.stop();await stopped;
   oscillator.stop();destination.stream.getTracks().forEach(t=>t.stop());await context.close();
   return Array.from(new Uint8Array(await new Blob(chunks,{type:'audio/webm'}).arrayBuffer()));
  });
  const buffer=Buffer.from(bytes);writeFileSync(run.output+'/synthetic-voice.webm',buffer);return buffer;
 }finally{await browser.close();}
}
