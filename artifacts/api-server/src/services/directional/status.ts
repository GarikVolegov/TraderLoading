import { loadTrustedModel, evaluateValidation, DIRECTIONAL_PAIRS } from "./model.js";
import { readValidationSamples } from "../marketIntelligence.js";
export type DirectionalModelState={pair:string;horizon:"4h";state:"unvalidated"|"validated";version:string|null;reason:string|null;samples:number;probabilities:null};
export async function directionalModelStates(pairs:string):Promise<DirectionalModelState[]> {
  const selected=[...new Set(pairs.split(",").map(p=>p.replace(/\//g,"").trim().toUpperCase()).filter(p=>DIRECTIONAL_PAIRS.includes(p as typeof DIRECTIONAL_PAIRS[number])))];
  return Promise.all(selected.map(async pair=>{
    const base:DirectionalModelState={pair,horizon:"4h",state:"unvalidated",version:null,reason:"model_unvalidated",samples:0,probabilities:null};
    try {
      const model=await loadTrustedModel(pair);if(!model)return base;
      const result=evaluateValidation(model,await readValidationSamples(pair,model));
      return {...base,state:result.passed?"validated":"unvalidated",version:model.version,reason:result.passed?null:"validation_pending",samples:result.samples};
    } catch{return {...base,reason:"storage_unavailable"};}
  }));
}
