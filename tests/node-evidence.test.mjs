// Invalid structural fixtures exercise rejection paths only. They are never
// written as reports, run as models, or presented as successful inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MODELS} from '../src/core/catalog.js';
import {nodeEvidenceErrors} from '../scripts/ensure-node-evidence.mjs';

const fingerprint='a'.repeat(64);
function invalidMatrix(){
 return {schemaVersion:1,sourceFingerprint:fingerprint,partial:false,sourceChangedDuringRun:false,executedCount:25,
  run:{id:'negative-structure-only',environment:'node',backend:'WASM',startedAt:'2026-10-20T00:00:00Z',completedAt:'2026-10-20T00:01:00Z'},
  models:MODELS.map(model=>({id:model.id,task:model.task,size:model.size,sha256:model.sha256,status:'pass',sourceFingerprint:fingerprint,
   // A top-level status alone cannot turn this failed runtime into evidence.
   wasmNode:{status:'fail',backend:'WASM',lifecycle:{releaseResolved:true,sessionCleared:true}}
  }))};
}
const errorsFor=node=>nodeEvidenceErrors({node,fingerprint});

test('importing Node evidence utilities never starts validation or downloads',()=>{
 const script=new URL('../scripts/ensure-node-evidence.mjs',import.meta.url).href;
 const child=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(script)}); console.log('IMPORTED_ONLY');`],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),'IMPORTED_ONLY');
});

test('a failed runtime cannot hide behind top-level model passes',()=>{
 const errors=errorsFor(invalidMatrix());
 assert(errors.some(error=>error.startsWith('yolo26-detect-n/node: actual WASM pass required')));
});

test('an incorrect actual output signature is retained as a blocking Node error',()=>{
 const node=invalidMatrix();
 node.models[0].wasmNode={status:'pass',backend:'WASM',image:{
  fixture:{sha256:'b'.repeat(64),width:640,height:480},latencyMs:1,resultCount:1,
  samples:[{label:'bus',score:.9,box:{x:1,y:1,width:10,height:10}}],
  outputTensorStats:[{dims:[1,1],count:1,nonFinite:0,min:0,max:1,sha256:'c'.repeat(64)}]
 }};
 assert(errorsFor(node).some(error=>error==='yolo26-detect-n/node/image: actual output signatures differ from the pinned export.'));
});

test('simulated and mocked Node reports are explicitly rejected',()=>{
 for(const flag of ['simulated','mocked']){
  const node=invalidMatrix();node[flag]=true;
  assert(errorsFor(node).includes('Simulated or mocked Node evidence cannot be reused.'));
 }
});

test('stale report and per-model fingerprints are both rejected',()=>{
 const node=invalidMatrix();node.sourceFingerprint='d'.repeat(64);node.models[0].sourceFingerprint='e'.repeat(64);
 const errors=errorsFor(node);
 assert(errors.some(error=>error==='node: evidence is stale or bound to a different application fingerprint.'));
 assert(errors.includes('yolo26-detect-n: Node model record fingerprint must match the current application.'));
});

test('partial execution and source changes cannot be reused as a complete matrix',()=>{
 const node=invalidMatrix();node.partial=true;node.executedCount=24;node.sourceChangedDuringRun=true;
 const errors=errorsFor(node);
 assert(errors.includes('Partial Node matrices cannot be reused.'));
 assert(errors.includes('Node matrix must execute all 25 models.'));
 assert(errors.includes('Node matrix source must remain unchanged throughout the run.'));
});
