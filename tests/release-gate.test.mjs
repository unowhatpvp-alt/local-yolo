// Negative gate fixtures are structural inputs, not model outputs or inference evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REQUIRED_MODELS,validateReleaseEvidence} from '../scripts/check-release-gate.mjs';
import {MODELS} from '../src/core/catalog.js';
const fingerprint='a'.repeat(64);
const report=(environment)=>({schemaVersion:1,sourceFingerprint:fingerprint,run:{id:'negative-structure-test',environment,backend:'WASM',userAgent:'Structural fixture; never an actual browser run',startedAt:'2026-10-20T00:00:00Z',completedAt:'2026-10-20T00:01:00Z'},models:[]});
test('required set is fixed at all five tasks and five YOLO26 sizes',()=>{
 assert.equal(REQUIRED_MODELS.length,25);assert.equal(new Set(REQUIRED_MODELS).size,25);for(const task of ['detect','segment','pose','classify','obb'])for(const size of ['n','s','m','l','x'])assert(REQUIRED_MODELS.includes(`yolo26-${task}-${size}`));assert(!REQUIRED_MODELS.some(id=>id.startsWith('yolo11')));
});
test('missing actual evidence fails closed rather than inferring passes from model inventory',()=>{
 const result=validateReleaseEvidence({fingerprint,catalog:MODELS,node:null,browser:null,pwa:null});assert.equal(result.pass,false);assert(result.errors.some(x=>x.includes('Missing node evidence')));assert(result.errors.some(x=>x.includes('missing yolo26-detect-n')));assert(result.errors.some(x=>x.includes('PWA must be tested')));
});
test('reduced catalog and stale reports cannot satisfy the release gate',()=>{
 const node=report('node');node.sourceFingerprint='b'.repeat(64);const result=validateReleaseEvidence({fingerprint,catalog:MODELS.slice(0,5),node,browser:report('browser'),pwa:report('browser')});assert.equal(result.pass,false);assert(result.errors.some(x=>x.includes('reducing the set is forbidden')));assert(result.errors.some(x=>x.includes('evidence is stale')));
});
test('unavailable browser GPU and absent secure PWA evidence stay blockers',()=>{
 const node=report('node'),browser=report('browser');browser.models=MODELS.map(m=>({id:m.id,task:m.task,size:m.size,sha256:m.sha256,browserWasm:{status:'pending'},webgpu:{status:'environment-unavailable',reason:'No secure GPU environment'}}));const result=validateReleaseEvidence({fingerprint,catalog:MODELS,node,browser,pwa:report('browser')});assert.equal(result.pass,false);assert(result.errors.some(x=>x.includes('/webgpu: actual WebGPU pass required')));assert(result.errors.some(x=>x.includes('PWA must be tested')));
});
test('documented hardware absence still requires secure observations and real automatic WASM results',()=>{
 const node=report('node'),browser=report('browser');browser.models=MODELS.map(m=>({id:m.id,task:m.task,size:m.size,sha256:m.sha256,browserWasm:{status:'pending'},webgpu:{status:'environment-wasm-fallback',attempt:{secureContext:false,adapterAcquired:false,reason:'Structural negative fixture'},fallback:{status:'pending'}}}));
 const result=validateReleaseEvidence({fingerprint,catalog:MODELS,node,browser,pwa:report('browser')});assert.equal(result.pass,false);assert(result.errors.some(x=>x.includes('actual secure-browser capability')));assert(result.errors.some(x=>x.includes('environment-wasm-fallback: actual WASM pass required')));
});
test('development workflow cannot publish and production dispatch is guarded to main',async()=>{
 const development=await readFile(new URL('../.github/workflows/validate-v1.1.yml',import.meta.url),'utf8');assert(!/pages:\s*write|id-token:|environment:|deploy-pages@|upload-pages-artifact@/.test(development));assert.match(development,/contents: read/);
 const production=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');assert.equal((production.match(/if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/g)||[]).length,2);assert(production.indexOf('node scripts/check-release-gate.mjs')<production.indexOf('actions/upload-pages-artifact@'));assert.match(production,/needs: build/);
});
