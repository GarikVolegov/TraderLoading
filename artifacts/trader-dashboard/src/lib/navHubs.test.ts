import assert from "node:assert/strict";
import { ROOT_ITEMS, rootDestination } from "./navHubs";
assert.deepEqual(ROOT_ITEMS.map(item => [item.id,item.href]), [["today","/"],["method","/method"],["journal","/journal"]]);
for (const [path,destination] of Object.entries({"/":"today","/method":"method","/backtest":"backtest","/backtest/42/replay":"backtest","/tools":"backtest","/checklist":"method","/journal":"journal","/broker":"journal","/news":"resources","/clock":"resources","/dashboard/widgets":"resources","/calendar":"resources","/routine":"resources","/missions":"resources","/wiki":"resources","/library":"resources","/chat":"social","/tornei":"social","/milestones":"resources"})) assert.equal(rootDestination(path),destination,path);
for(const vista of ["mercati","notizie","strumenti"]) {assert.equal(rootDestination("/",`?vista=${vista}&pair=EURUSD`),"resources");assert.equal(rootDestination(`/?vista=${vista}`),"resources");}
assert.equal(rootDestination("/","?layout=edit"),"resources");assert.equal(rootDestination("/","?vista=unknown"),"today");
assert.equal(rootDestination("/journal","?t=piano&vista=oggi"),"today");assert.equal(rootDestination("/journal","?t=piano&vista=agenda"),"resources");
assert.equal(rootDestination("/journal","?t=revisione&kind=four_week"),"journal");assert.equal(rootDestination("/settings"),"resources");assert.equal(rootDestination("/journal-other"),undefined);
console.log("four process destinations preserve explicit legacy contexts");
