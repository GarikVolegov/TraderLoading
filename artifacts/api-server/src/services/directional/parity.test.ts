import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inferModel, loadTrustedModel, validModel, verifyHistoricalReport, type ModelArtifact, type Probabilities } from "./model.js";
for(const profile of ["price","macro"]) {
  const root=new URL(`../../../../../tools/directional-model/fixtures/synthetic/${profile}/`,import.meta.url);
  const bytes=await readFile(new URL("EURUSD.json",root));
  const model=JSON.parse(bytes.toString()) as ModelArtifact;
  const parity=JSON.parse(await readFile(new URL("EURUSD.parity.json",root),"utf8")) as {modelSha256:string;vectors:{features:number[];probabilities:Probabilities}[]};
  assert.equal(createHash("sha256").update(bytes).digest("hex"),parity.modelSha256);
  assert.ok(validModel(model,"EURUSD"));
  for(const vector of parity.vectors) {
    const actual=inferModel(model,vector.features);
    for(const key of ["up","flat","down"] as const)assert.ok(Math.abs(actual[key]-vector.probabilities[key])<1e-12,`${profile} ${key} differs from sklearn`);
  }
  const report=JSON.parse(await readFile(new URL("EURUSD.validation.json",root),"utf8"));
  assert.equal(verifyHistoricalReport(model,report),null,"synthetic performance never establishes validation");
  assert.equal(verifyHistoricalReport(model,{...report,provenance:"historical_research"}),false,"valid report shape with failed gates remains unpublished");
  const priorDir=process.env.DIRECTIONAL_MODEL_DIR,priorHash=process.env.DIRECTIONAL_MODEL_SHA256_EURUSD;
  try {
    process.env.DIRECTIONAL_MODEL_DIR=root.pathname;process.env.DIRECTIONAL_MODEL_SHA256_EURUSD=parity.modelSha256;
    assert.equal(await loadTrustedModel("EURUSD"),null,"even pinned synthetic reports cannot publish percentages");
    process.env.DIRECTIONAL_MODEL_SHA256_EURUSD="a".repeat(64);
    assert.equal(await loadTrustedModel("EURUSD"),null,"modified artifact is rejected");
  } finally {
    if(priorDir===undefined)delete process.env.DIRECTIONAL_MODEL_DIR;else process.env.DIRECTIONAL_MODEL_DIR=priorDir;
    if(priorHash===undefined)delete process.env.DIRECTIONAL_MODEL_SHA256_EURUSD;else process.env.DIRECTIONAL_MODEL_SHA256_EURUSD=priorHash;
  }
}
console.log("Price and macro Python/TypeScript parity <1e-12; synthetic and untrusted artifacts rejected");
