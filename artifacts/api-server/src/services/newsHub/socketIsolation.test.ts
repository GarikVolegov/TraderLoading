import assert from "node:assert/strict";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { createNewsHubRuntime } from "./runtime.js";
import { attachNewsHubWebSocket } from "./socketServer.js";
import type { NewsEvent, NewsRefreshRequest, NewsResponse } from "./types.js";

const corpus = (request: NewsRefreshRequest): NewsResponse => ({
  articles:[{title:`Evidence for ${request.pairs} (${request.lang})`,summary:"Curated shared corpus",source:"Test",url:"https://example.test/shared",publishedAt:"2026-10-10T10:00:00Z",sentiment:"neutral",imageUrl:null}],
  sourceStatus:"partial",analysisStatus:"disabled",hasApiKey:false,source:"rss",fetchedAt:"2026-10-10T10:01:00Z",lang:request.lang,
  watchedPairs:(request.pairs ?? "").split(",").filter(Boolean).map(p=>`${p.slice(0,3)}/${p.slice(3)}`),
});
const runtime = createNewsHubRuntime({refreshIntervalMs:0,fetchSnapshot:async request=>{
  if(request.lang==="fr") throw new Error("Isolated source failure");
  return corpus(request);
}});
const server = createServer();
const ws = attachNewsHubWebSocket(server,runtime);
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
const address=server.address();assert.ok(address && typeof address === "object");
const clients: WebSocket[]=[];
const snapshots = (events:NewsEvent[]) => events.filter((event):event is Extract<NewsEvent,{type:"news_snapshot"}>=>event.type==="news_snapshot");
const settle = () => new Promise(resolve=>setTimeout(resolve,30));
const until = async (ready:()=>boolean) => {const deadline=Date.now()+3000;while(!ready()){if(Date.now()>deadline)throw new Error("Snapshot timeout");await settle();}};
async function connect(lang:string,pairs:string):Promise<NewsEvent[]> {
  const client = new WebSocket(`ws://127.0.0.1:${address && typeof address === "object" ? address.port : 0}/api/news/ws`);
  clients.push(client); const events:NewsEvent[]=[];
  client.on("message",message=>events.push(JSON.parse(String(message))));
  await new Promise<void>((resolve,reject)=>{client.once("open",resolve);client.once("error",reject);});
  client.send(JSON.stringify({type:"subscribe",pairs,lang}));
  await until(()=>snapshots(events).length===1);
  return events;
}
try {
  const italian=await connect("it","XAUUSD");
  const english=await connect("en","XAU/USD");
  assert.equal(snapshots(italian)[0].snapshot.lang,"it");
  assert.equal(snapshots(english)[0].snapshot.lang,"en");
  assert.deepEqual(snapshots(english)[0].snapshot.articles,corpus({pairs:"XAUUSD",lang:"en"}).articles,"socket preserves the shared accessor corpus");
  await runtime.refresh({pairs:"XAUUSD",lang:"it",force:true});
  await until(()=>snapshots(italian).length===2);
  assert.equal(snapshots(english).length,1,"another language never leaks into this subscription");
  await runtime.refresh({pairs:"EURUSD,XAUUSD",lang:"it",force:true});
  await settle();
  assert.equal(snapshots(italian).length,2,"superset scopes are not the subscribed exact watchlist");
  await assert.rejects(runtime.refresh({pairs:"XAUUSD",lang:"fr"}));await settle();
  assert.equal(italian.some(event=>event.type==="news_error"),false,"failure of an unrelated language is isolated too");
  assert.equal(english.some(event=>event.type==="news_error"),false);
  assert.equal([...italian,...english].some(event=>event.type==="news_article"),false,"raw articles cannot bypass the curated snapshot");
} finally { for(const client of clients)client.close();await ws.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.stop(); }
console.log("exact pair/language socket corpus, failure isolation and raw gate checks passed");
