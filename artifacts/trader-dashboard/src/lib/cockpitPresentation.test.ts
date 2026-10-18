import assert from 'node:assert/strict';
import { cockpitImprovement } from './cockpitPresentation';
import type { ProcessState } from '../../../../contracts/trader-process';
const state={activeMethod:{id:'active'},improvement:null,sessions:[{state:'closed',methodVersionId:'active',day:'2026-10-10',closure:{correction:'old'}},{state:'closed',methodVersionId:'other',day:'2026-10-20',closure:{correction:'other version'}},{state:'closed',methodVersionId:'active',day:'2026-10-17',closure:{correction:'latest'}}]} as unknown as ProcessState;
assert.equal(cockpitImprovement(state)?.action,'latest');
assert.equal(cockpitImprovement({...state,improvement:{methodVersionId:'other',action:'wrong version'} as ProcessState['improvement']})?.action,'latest');
assert.equal(cockpitImprovement({...state,improvement:{methodVersionId:'active',action:'review priority',criterion:'check'} as ProcessState['improvement']})?.action,'review priority');
console.log('Cockpit improvement selects latest same-version correction and respects the current review');

assert.equal(cockpitImprovement({activeMethod:null,improvement:null,sessions:[]} as unknown as ProcessState),null);
