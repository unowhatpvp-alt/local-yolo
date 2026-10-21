#!/usr/bin/env node
/** Actual sustained Nano inference: diagnostic host memory, never phone/GPU telemetry. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {MODELS} from '../src/core/catalog.js';
import {sourceFingerprint} from './check-release-gate.mjs';
import {ensureValidationFixtures} from './fetch-yolo26-validation-fixtures.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),SELF=fileURLToPath(import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const snapshot=()=>{const m=process.memoryUsage();return {rssBytes:m.rss,heapUsedBytes:m.heapUsed,externalBytes:m.external,arrayBuffersBytes:m.arrayBuffers}};
const args=process.argv.slice(2),index=args.indexOf('--one');
const ROUND_COUNT=50;
async function one(id){
 const sourceFingerprintBefore=await sourceFingerprint(ROOT),model=MODELS.find(m=>m.id===id);assert(model&&model.size==='N');
 const {Canvas,loadImage}=await import('@napi-rs/canvas');globalThis.OffscreenCanvas=Canvas;
 const {YoloEngine}=await import('../src/core/engine.js');
 const content=await readFile(path.join(ROOT,model.testFixturePath));assert.equal(sha(content),model.sha256);assert.equal(content.length,model.bytes);
 const frameBytes=await Promise.all([0,1].map(t=>readFile(path.join(ROOT,`tests/fixtures/yolo26/video-frame-${t}.png`))));
 const frames=await Promise.all(frameBytes.map(b=>loadImage(b)));
 const engine=new YoloEngine();const startedAt=new Date().toISOString();const initialMemory=snapshot();
 const loaded=await engine.load(content,{...model,backend:'wasm'});assert.equal(loaded.backend,'WASM');
 let released=false;const originalRelease=engine.session.release.bind(engine.session);engine.session.release=async()=>{await originalRelease();released=true};
 const memory=[],counts=[],latencies=[];
 for(let i=0;i<ROUND_COUNT;i++){
  const result=await engine.infer(frames[i%frames.length],{confidence:.25,iou:.45});
  assert.equal(result.backend,'WASM');assert.equal(result.task,model.task);assert(result.items.every(x=>Number.isFinite(x.score)&&x.score>=0&&x.score<=1));
  counts.push(result.items.length);latencies.push(result.latency);
  // Native Canvas finalizers and real camera/worker scheduling need a task turn,
  // not an indefinitely chained sequence of already-resolved WASM promises.
  await new Promise(resolve=>setImmediate(resolve));
  if((i+1)%5===0){globalThis.gc?.();memory.push({completedInferences:i+1,...snapshot()})}
 }
 const beforeRelease=snapshot();await engine.dispose();await new Promise(resolve=>setImmediate(resolve));globalThis.gc?.();await new Promise(resolve=>setImmediate(resolve));
 assert(released);assert.equal(engine.session,null);assert.equal(engine.info,null);assert.equal(engine.canvas,null);assert.equal(engine.busy,false);
 const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]};
 const latter=memory.slice(Math.floor(memory.length/2)),rss=latter.map(s=>s.rssBytes),external=latter.map(s=>s.externalBytes);
 return {id,task:model.task,size:'N',sha256:model.sha256,sourceFingerprint:sourceFingerprintBefore,startedAt,completedAt:new Date().toISOString(),backend:'WASM',status:'observed',inferenceCount:ROUND_COUNT,frames:frameBytes.map((b,i)=>({timeSeconds:i,sha256:sha(b),width:frames[i].width,height:frames[i].height})),resultCounts:counts,latencyMs:{min:Math.min(...latencies),max:Math.max(...latencies),median:median(latencies)},initialMemory,samples:memory,beforeRelease,afterRelease:snapshot(),lifecycle:{releaseResolved:released,sessionCleared:engine.session===null,canvasCleared:engine.canvas===null},lateWindow:{sampleCount:latter.length,rssRangeBytes:Math.max(...rss)-Math.min(...rss),rssMedianBytes:median(rss),externalRangeBytes:Math.max(...external)-Math.min(...external),externalMedianBytes:median(external)},note:'These are 50 actual sequential inferences alternating two real decoded MP4 frames, with no overlapping inference and one setImmediate event-loop turn after each result. Host Node memory is sampled after requested GC. The actual predictions, including zero detections, are retained as counts; no physical camera or phone-memory claim is made.'};
}
if(index>=0){try{console.log('NANO_STRESS '+JSON.stringify(await one(args[index+1])))}catch(e){console.log('NANO_STRESS '+JSON.stringify({id:args[index+1],status:'fail',error:e.stack}));process.exitCode=1}}
else{
 await ensureValidationFixtures();const fingerprint=await sourceFingerprint(ROOT),validatorSha256=sha(await readFile(SELF));
 const report={schemaVersion:1,sourceFingerprint:fingerprint,run:{id:randomUUID(),environment:'node',backend:'WASM',startedAt:new Date().toISOString(),completedAt:null,validatorSha256,physicalDevice:false,nodeVersion:process.version},models:[]};
 for(const task of ['detect','segment','pose','classify','obb']){
  const id=`yolo26-${task}-n`,child=spawnSync(process.execPath,['--expose-gc',SELF,'--one',id],{cwd:ROOT,encoding:'utf8',timeout:180000,maxBuffer:1024*1024});
  const line=(child.stdout||'').split('\n').find(l=>l.startsWith('NANO_STRESS '));const row=line?JSON.parse(line.slice(12)):{id,status:'fail',error:child.error?.message||child.stderr||`Exit${child.status}`};if(child.status!==0&&row.status==='observed')row.status='fail';report.models.push(row);console.log(`${id}: ${row.status}${row.inferenceCount?` ${row.inferenceCount} actual inferences`:''}`);
 }
 report.run.completedAt=new Date().toISOString();report.sourceFingerprintAfter=await sourceFingerprint(ROOT);report.sourceChangedDuringRun=report.sourceFingerprintAfter!==fingerprint||report.models.some(r=>r.sourceFingerprint!==fingerprint)||sha(await readFile(SELF))!==validatorSha256;
 report.note='Diagnostic sustained execution and lifecycle observations only; allocator-retained RSS is not a memory-leak verdict or a physical-device compatibility pass.';
 await mkdir(path.join(ROOT,'docs/diagnostics'),{recursive:true});await writeFile(path.join(ROOT,'docs/diagnostics/nano-sustained-inference.json'),JSON.stringify(report,null,2)+'\n');
 if(report.sourceChangedDuringRun||report.models.some(m=>m.status!=='observed'))process.exitCode=1;
}
