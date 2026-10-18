import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {createFixtures} from '../verify-operating-center/fixtures.mjs';
import {WORKSPACE_TOOLS} from '../../artifacts/trader-dashboard/src/lib/workspaceTools.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(root+'artifacts/trader-dashboard/package.json');
const {createServer}=await import(pathToFileURL(require.resolve('vite')).href);
process.env.VITE_CLERK_PUBLISHABLE_KEY='pk_test_aXNvbGF0ZWQuZXhhbXBsZSQ=';
process.env.PORT='5191';
const server=await createServer({cacheDir:root+'.local-logs/design-vite',configFile:root+'artifacts/trader-dashboard/vite.config.ts',server:{host:'127.0.0.1',port:5191,strictPort:true},resolve:{alias:[{find:'@clerk/react',replacement:root+'scripts/verify-trader-process/clerk-fixture.js'}]}});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:require('puppeteer').executablePath()});
const out=root+'artifacts.local/design-unification/';await mkdir(out,{recursive:true});
const cases=[['landing','/it'],['cockpit','/'],['method','/method'],['journal','/journal?t=registro'],['sessions','/journal?t=sessioni'],['recap','/journal?t=recap'],['backtest','/backtest'],['xp','/chat?t=competizioni&vista=xp'],['tournaments','/chat?t=competizioni&vista=torneo'],['social','/chat'],['settings','/settings'],['pro','/pro'],['support','/support'],['privacy','/privacy'],['about','/it/about'],['styleguide','/styleguide'],...WORKSPACE_TOOLS.map(x=>['tool-'+x.id,x.href])];
const results=[],errors=[];
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date());
const state={methods:[],activeMethod:null,methodDraft:null,session:null,sessions:[],evidence:[],improvement:null,contextSnapshots:{},progressByVersion:{},pendingReviews:[],reviews:[],progress:{phase:'define',nextAction:'define_method',checks:[],canAdvance:false,report:{eligibleSamples:0,incompleteSamples:0,expectancyR:null,drawdownR:null,adherencePct:null,closedSessions:0,amounts:[]}},guidance:{nextAction:'define_method'}};
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'it-IT',timezoneId:'Europe/Rome',reducedMotion:'reduce'});
const fixtures=createFixtures();
const fulfill=(route,data)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
await context.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='s.tradingview.com')return route.fulfill({contentType:'text/html',body:'<html><body style="background:#0a1019;color:#a0b0c5;font:12px sans-serif">Isolated chart fixture</body></html>'});
 if(u.hostname!=='127.0.0.1')return route.abort();
 if(u.pathname==='/api/process')return fulfill(route,state);
 if(u.pathname.startsWith('/api/process/'))return fulfill(route,[]);
 if(u.pathname==='/api/tornei/current')return fulfill(route,{season:{id:1,slug:'design-audit',label:'Design audit',status:'live',startsAt:today+'T00:00:00Z',endsAt:new Date(Date.now()+86400000*14).toISOString(),settledAt:null},enrolled:false,totalPlayers:3,progress:.4});
 if(u.pathname==='/api/tornei/standings')return fulfill(route,{board:[1,2,3].map((id)=>({id,displayName:['Audit Alpha','Audit Beta','Audit Gamma'][id-1],avatarUrl:null,rCum:6-id,discIndex:90-id,score:90-id,division:'argento',rank:id,prevRank:id,trades:12,dq:false,dqReason:null,me:false})),dq:[],me:null,total:3});
 if(u.pathname==='/api/tornei/wallet')return fulfill(route,{walletAddress:null,mintEnabled:false});
 if(u.pathname==='/api/tornei/me')return fulfill(route,{standing:null,nextDivision:null,prizes:[],certificates:[]});
 if(u.pathname==='/api/tornei/hall')return fulfill(route,{entries:[]});
 if(u.pathname==='/api/leaderboard')return fulfill(route,[1,2,3].map((rank)=>({id:rank,userId:'fixture-'+rank,name:['Audit Alpha','Audit Beta','Audit Gamma'][rank-1],avatarUrl:null,xp:1000-rank*100,level:3,levelName:'Trader',streak:0,totalTrades:0,rank})));
 if(u.pathname.startsWith('/api/journal/recap'))return fulfill(route,{period:'weekly',from:today,to:today,stats:{totalTrades:0},items:[]});
 if(u.pathname==='/api/community'||u.pathname==='/api/friends/requests'||u.pathname==='/api/friends/sent-requests')return fulfill(route,[]);
 if(u.pathname==='/api/social/feed')return fulfill(route,{posts:[],nextCursor:null});
 if(u.pathname==='/api/public/stats')return fulfill(route,{traders:0,trades:0,pairs:0,rating:null});
 if(u.pathname==='/api/public/testimonials')return fulfill(route,{testimonials:[]});
 if(u.pathname.startsWith('/api/'))return fixtures.handle(route);
 return route.continue();
});
await context.routeWebSocket('**/api/**',ws=>ws.close());
await context.addInitScript(()=>{localStorage.setItem('tl_language','it');localStorage.setItem('tl_cookie_consent_v1','declined');});
const page=await context.newPage();page.on('pageerror',e=>errors.push({url:page.url(),message:e.message}));
try{
 for(const [name,path] of cases){
  await page.goto('http://127.0.0.1:5191'+path,{waitUntil:'networkidle'});
  await page.getByText(/^(Caricamento risorse|Sincronizzazione dati|Inizializzazione frequenze audio)/).waitFor({state:'hidden',timeout:20000});
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.getByText('Something went wrong',{exact:true}).count(),0,`${name} error boundary`);
  for(const width of [375,768,1440]){
   await page.setViewportSize({width,height:1000});
   const metrics=await page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement);
    const h=document.querySelector('h1');
    const width=document.documentElement.scrollWidth;
    return {width,viewport:innerWidth,background:css.getPropertyValue('--background').trim(),accent:css.getPropertyValue('--primary').trim(),font:getComputedStyle(document.body).fontFamily,heading:h?getComputedStyle(h).fontFamily:null,text:document.body.innerText.slice(0,220),overflow:[...document.querySelectorAll('main *,[role=main] *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&getComputedStyle(e).position!=='fixed'&&!e.closest('[class*=overflow-x],[class*=overflow-auto],.ck-topbar nav');}).slice(0,6).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className:'svg'}))};
   });
   assert.ok(metrics.width<=width,`${name} page overflow at ${width}: ${JSON.stringify(metrics)}`);
   await page.screenshot({path:out+name+'-'+width+'.png',fullPage:true});
   await page.screenshot({path:out+name+'-'+width+'-viewport.png',fullPage:false});
   results.push({name,path,width,...metrics});
  }
  console.log('PASS design',name);
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
 await writeFile(out+'report.json',JSON.stringify({createdAt:new Date().toISOString(),scope:'isolated UI fixtures; no personal data or external writes',routes:cases.length,results,errors,unknownAPI:[...fixtures.state.unknown]},null,2));
 console.log(`Design review: ${cases.length} routes × 3 widths, zero page errors`);
}finally{await browser.close();await server.close();}
