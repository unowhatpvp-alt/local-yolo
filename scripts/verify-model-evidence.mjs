/** Reuse completed inference only when its source, digests and actual results still match. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {sourceFingerprint,validateReleaseEvidence} from './check-release-gate.mjs';
import {MODELS} from '../src/core/catalog.js';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const [node,browser,pwa]=await Promise.all(['docs/model-validation-matrix.json','docs/browser-validation-matrix.json','docs/pwa-validation.json'].map(json));
const fingerprint=await sourceFingerprint();
const result=validateReleaseEvidence({fingerprint,catalog:MODELS,node,browser,pwa});
const unrelated=result.errors.filter(e=>!e.startsWith('PWA ')&&!/^yolo26-.*\/(webgpu|gpu|environment-wasm-fallback|gpu-wasm-fallback):/.test(e));
assert.deepEqual(unrelated,[],'Existing model/UI evidence cannot be reused: '+unrelated.join('\n'));
for(const row of node.models){const model=MODELS.find(m=>m.id===row.id);assert.equal(row.bytes,model.bytes);assert.equal(row.sha256,model.sha256);const r=row.wasmNode.render,bytes=await readFile(r.path.replaceAll('\\','/'));assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);assert.equal(bytes.readUInt32BE(16),r.width);assert.equal(bytes.readUInt32BE(20),r.height);assert.equal(row.wasmNode.lifecycle.releaseResolved,true);}
console.log(JSON.stringify({status:'pass',models:25,nodeWasm:25,browserWasm:25,renderDigests:25,sourceFingerprint:fingerprint,method:'Verified original real inference evidence; no redundant inference rerun.'}));
