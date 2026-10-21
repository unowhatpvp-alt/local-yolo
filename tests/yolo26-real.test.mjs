/** Optional local Nano smoke. The release matrix requires all25 and never skips. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ensureValidationFixtures} from '../scripts/fetch-yolo26-validation-fixtures.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const ready=await access(new URL('./fixtures/yolo26/yolo26n.onnx',import.meta.url)).then(()=>true,()=>false);
test('real YOLO26 Nano five-task import, image and decoded-video inference, rendering and release',{skip:!ready,timeout:180000},async()=>{
 await ensureValidationFixtures();
 for(const task of ['detect','segment','pose','classify','obb']){
  const id=`yolo26-${task}-n`;
  const r=spawnSync(process.execPath,['--expose-gc','scripts/validate-yolo26-matrix.mjs','--one',id],{cwd:root,encoding:'utf8',timeout:35000,maxBuffer:1024*1024});
  const line=(r.stdout||'').split('\n').find(s=>s.startsWith('YOLO26_RESULT '));assert(line,`${id}: no actual evidence: ${r.stderr||r.error}`);
  const row=JSON.parse(line.slice('YOLO26_RESULT '.length));assert.equal(row.status,'pass',row.error);assert.equal(r.status,0);assert.equal(row.wasmNode.backend,'WASM');assert(row.wasmNode.image.resultCount>0);assert.equal(row.wasmNode.video.frames.length,2);assert.equal(row.wasmNode.lifecycle.releaseResolved,true);assert.equal(row.wasmNode.lifecycle.releaseCallCount,3);assert(row.wasmNode.render.changedPixels>0);assert.equal(row.browserWasm.status,'pending');assert.equal(row.webgpu.status,'pending');
 }
});
