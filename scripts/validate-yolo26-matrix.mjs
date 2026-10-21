#!/usr/bin/env node
/** Actual ORT Web WASM evidence. Node/Canvas is never labelled browser or GPU. */
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {MODELS} from '../src/core/catalog.js';
import {ensureValidationFixtures} from './fetch-yolo26-validation-fixtures.mjs';
import classificationFixtures from './classification-fixtures.json' with {type:'json'};
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const SELF=fileURLToPath(import.meta.url);
const FIX=path.join(ROOT,'tests/fixtures/yolo26');
const OUT=path.join(ROOT,'docs/evidence/yolo26');
let REPORT=path.join(ROOT,'docs/model-validation-matrix.json');
const TASKS=['detect','segment','pose','classify','obb'];
const SIZES=['N','S','M','L','X'];
const args=process.argv.slice(2);
const option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]};
if(option('--report'))REPORT=path.resolve(ROOT,option('--report')); 
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const rounded=n=>Number(n.toFixed(3));
const VIDEO_URL='https://github.com/ultralytics/assets/releases/download/v0.0.0/solutions_ci_demo.mp4';
const IMAGE_PROVENANCE={
 bus:{path:path.join(ROOT,'tests/fixtures/bus.jpg'),url:'https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg',sha256:'c02019c4979c191eb739ddd944445ef408dad5679acab6fd520ef9d434bfbc63'},
 boats:{path:path.join(ROOT,'tests/fixtures/boats.jpg'),url:'https://github.com/ultralytics/assets/releases/download/v0.0.0/boats.jpg',sha256:'8c5ada657cf8110a9f8aaac954c1dd96cde0187315b581276c32b0d1863e756f'},
 classification:{path:path.join(FIX,'classification.jpg'),url:'https://github.com/ultralytics/assets/releases/download/v0.0.0/imagenet10.zip',archiveMember:'train/n01443537/n01443537_22323.JPEG',sha256:'d628b7c08a891ef4a5c8765a4f751d1db01adaa02149f291082e4f72f624b995',expectedLabel:'goldfish'}
};
function memory(){const m=process.memoryUsage();return {rssBytes:m.rss,heapUsedBytes:m.heapUsed,externalBytes:m.external,arrayBuffersBytes:m.arrayBuffers}}
async function fingerprint(){try{const gate=await import('./check-release-gate.mjs');return await gate.sourceFingerprint()}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;throw new Error('Release fingerprint utility is not ready; do not produce unbound validation evidence.')}}
function summarizeItem(item){return {label:item.label,classId:item.classId,score:rounded(item.score),...(item.box?{box:item.box}:{}),...(item.keypoints?{keypointCount:item.keypoints.length,visibleKeypoints:item.keypoints.filter(k=>k.score>=.35).length,keypoints:item.keypoints}:{}),...(item.polygon?{polygon:item.polygon}:{}),...(item.mask?{mask:{width:item.mask.width,height:item.mask.height,box:item.mask.box,nonZero:item.mask.data.reduce((n,v)=>n+(v>0),0),sha256:sha(item.mask.data)}}:{})}}
function validateResult(result,task,source,{nonempty=true}={}){
 assert.equal(result.task,task);assert.equal(result.backend,'WASM');assert(Number.isFinite(result.latency)&&result.latency>0);
 assert.equal(result.sourceWidth,source.width);assert.equal(result.sourceHeight,source.height);assert(Array.isArray(result.items));
 if(nonempty)assert(result.items.length>0,`${task}: no decoded result on real task fixture`);
 for(const item of result.items){
  assert(Number.isFinite(item.score)&&item.score>=0&&item.score<=1,'invalid decoded probability');
  assert(Number.isInteger(item.classId)&&item.classId>=0);assert.equal(typeof item.label,'string');
  if(item.box){for(const n of Object.values(item.box))assert(Number.isFinite(n));assert(item.box.width>=0&&item.box.height>=0);if(task!=='obb'){assert(item.box.x>=0&&item.box.y>=0);assert(item.box.x+item.box.width<=source.width+.1);assert(item.box.y+item.box.height<=source.height+.1)}}
  if(task==='pose'){assert.equal(item.keypoints?.length,17);for(const kp of item.keypoints){assert(Number.isFinite(kp.x)&&Number.isFinite(kp.y)&&Number.isFinite(kp.score));assert(kp.score>=0&&kp.score<=1)}}
  if(task==='segment'){assert(item.mask?.data instanceof Uint8Array);assert(item.mask.width>0&&item.mask.height>0);assert.equal(item.mask.data.length,item.mask.width*item.mask.height)}
  if(task==='obb'){assert.equal(item.polygon?.length,4);assert(item.polygon.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))}
 }
 if(nonempty&&task==='detect')assert(result.items.some(i=>i.label==='bus'),'Real bus fixture did not produce a bus');
 if(nonempty&&task==='pose')assert(result.items.some(i=>i.keypoints.some(k=>k.score>.5)),'No confident actual human keypoint');
 if(nonempty&&task==='segment')assert(result.items.some(i=>i.mask.data.some(v=>v>0)),'All instance masks were empty');
 if(nonempty&&task==='obb')assert(result.items.some(i=>i.label==='ship'),'Real aerial boats fixture did not produce a ship');
 return {latencyMs:rounded(result.latency),resultCount:result.items.length,samples:result.items.slice(0,3).map(summarizeItem)};
}
async function oneModel(id){
 const model=MODELS.find(m=>m.id===id&&m.series==='YOLO26');if(!model)throw new Error(`No planned YOLO26 manifest entry: ${id}`);
 const startedAt=new Date().toISOString(),executedFingerprint=await fingerprint(),validatorSha256=sha(await readFile(SELF));
 const {Canvas,loadImage}=await import('@napi-rs/canvas');globalThis.OffscreenCanvas=Canvas;globalThis.document={createElement:name=>{assert.equal(name,'canvas');return new Canvas(1,1)}};
 const {YoloEngine}=await import('../src/core/engine.js');
 const {inspectOnnx}=await import('../src/core/onnx-info.js');
 const {renderFrame}=await import('../src/core/render.js');
 const modelPath=path.resolve(ROOT,model.testFixturePath||`tests/fixtures/yolo26/${model.name.toLowerCase()}.onnx`);
 const bytes=await readFile(modelPath);assert.equal(bytes.length,model.bytes,'Pinned model byte size differs');assert.equal(sha(bytes),model.sha256,'Pinned model SHA256 differs');
 const graph=inspectOnnx(bytes);assert.equal(graph.metadata.task,model.task);assert.match(graph.metadata.description,/YOLO26/i,'ONNX metadata must identify genuine YOLO26');assert.equal(graph.externalData.length,0);
 assert.deepEqual(graph.inputs[0].dims,model.inputShape);assert.deepEqual(graph.outputs.map(o=>o.dims),model.outputShapes);
 const fixtureSpec=model.task==='obb'?IMAGE_PROVENANCE.boats:model.task==='classify'?IMAGE_PROVENANCE.classification:IMAGE_PROVENANCE.bus;
 const imageBytes=await readFile(fixtureSpec.path);if(fixtureSpec.sha256)assert.equal(sha(imageBytes),fixtureSpec.sha256);
 const image=await loadImage(imageBytes);
 const fixture={file:path.relative(ROOT,fixtureSpec.path),url:fixtureSpec.url,sha256:sha(imageBytes),width:image.width,height:image.height,...(fixtureSpec.archiveMember?{archiveMember:fixtureSpec.archiveMember}:{})};
 const engine=new YoloEngine();let releaseResolved=0;const initBefore=memory();const initStart=performance.now();
 let info=await engine.load(bytes,{...model,backend:'wasm'});const initializeMs=rounded(performance.now()-initStart);assert.equal(info.task,model.task);assert.equal(info.backend,'WASM');assert.equal(info.inputWidth,model.inputWidth);assert.equal(info.inputHeight,model.inputHeight);
 const wrapRelease=()=>{const session=engine.session,original=session.release.bind(session);session.release=async()=>{await original();releaseResolved++}};
 wrapRelease();
 let tensorStats=[];
 const originalRun=engine.session.run.bind(engine.session);engine.session.run=async(...inputs)=>{const outputs=await originalRun(...inputs);tensorStats=Object.entries(outputs).map(([name,t])=>{let min=Infinity,max=-Infinity,nonFinite=0,sum=0;for(const n of t.data){if(!Number.isFinite(n))nonFinite++;else{sum+=n;if(n<min)min=n;if(n>max)max=n}}assert.equal(nonFinite,0,`Actual ${name} contains non-finite values`);return {name,dims:[...t.dims],type:t.type,count:t.data.length,nonFinite,min,max,sum,sha256:sha(new Uint8Array(t.data.buffer,t.data.byteOffset,t.data.byteLength))}});return outputs};
 const options={confidence:model.task==='classify'?.001:.25,iou:.45};
 const result=await engine.infer(image,options);const imageEvidence={fixture,...validateResult(result,model.task,image),outputTensorStats:tensorStats};if(fixtureSpec.expectedLabel){assert.equal(result.items[0].label,fixtureSpec.expectedLabel);imageEvidence.expectedLabel=fixtureSpec.expectedLabel;imageEvidence.classificationSum=tensorStats[0].sum;assert(Math.abs(imageEvidence.classificationSum-1)<.001,'Classification probabilities must sum to one');}
 const beforeCanvas=new Canvas(1,1),afterCanvas=new Canvas(1,1);renderFrame(beforeCanvas,image,null,{maxDimension:640});renderFrame(afterCanvas,image,result,{maxDimension:640});
 const beforePixels=beforeCanvas.getContext('2d').getImageData(0,0,beforeCanvas.width,beforeCanvas.height).data,afterPixels=afterCanvas.getContext('2d').getImageData(0,0,afterCanvas.width,afterCanvas.height).data;
 let changedPixels=0;for(let i=0;i<beforePixels.length;i+=4)if(beforePixels[i]!==afterPixels[i]||beforePixels[i+1]!==afterPixels[i+1]||beforePixels[i+2]!==afterPixels[i+2])changedPixels++;
 assert(changedPixels>0,'Task renderer made no visible result pixels');
 await mkdir(OUT,{recursive:true});const png=afterCanvas.toBuffer('image/png');const renderPath=path.join(OUT,`${model.id}.png`);await writeFile(renderPath,png);
 const videoBytes=await readFile(path.join(FIX,'real-video.mp4'));
 const video={fixture:{file:'tests/fixtures/yolo26/real-video.mp4',url:VIDEO_URL,sha256:sha(videoBytes),bytes:videoBytes.length},decodedBy:'ffmpeg (real H.264 MP4 frames; browser playback is separate)',frames:[]};
 for(const time of [0,1]){const framePath=path.join(FIX,`video-frame-${time}.png`);const frameBytes=await readFile(framePath);const frame=await loadImage(frameBytes);const prediction=await engine.infer(frame,options);video.frames.push({timeSeconds:time,fixture:{sha256:sha(frameBytes),width:frame.width,height:frame.height},...validateResult(prediction,model.task,frame,{nonempty:false}),outputTensorStats:tensorStats})}
 let cropEvidence;
 if(model.task==='detect'){const crop={x:image.width/4,y:image.height/4,width:image.width/2,height:image.height/2};const prediction=await engine.infer(image,{...options,crop});assert(prediction.items.length>0);assert(prediction.items.every(i=>i.box.x>=crop.x-.1&&i.box.y>=crop.y-.1));cropEvidence={crop,resultCount:prediction.items.length,latencyMs:rounded(prediction.latency)}}
 let classificationAccuracy;
 if(model.task==='classify'){
  const examples=[];
  for(const entry of classificationFixtures){const content=await readFile(path.join(FIX,entry.file));assert.equal(sha(content),entry.sha256);const frame=await loadImage(content);const actual=await engine.infer(frame,{confidence:0,iou:.45});validateResult(actual,model.task,frame);const top=actual.items[0];assert(Math.abs(tensorStats[0].sum-1)<.001,'Held-out classification probabilities must sum to one');examples.push({fixture:{...entry,width:frame.width,height:frame.height},predictedClassId:top.classId,predictedLabel:top.label,confidence:top.score,correct:top.classId===entry.expectedClassId,latencyMs:rounded(actual.latency),top5:actual.items.map(summarizeItem),classificationSum:tensorStats[0].sum,outputTensorStats:tensorStats})}
  const correct=examples.filter(e=>e.correct).length;classificationAccuracy={status:'observed',sampleCount:examples.length,top1Correct:correct,top1Misses:examples.length-correct,examples,note:'These ten tiny held-out ImageNet10 images are a known-label diagnostic, not an ImageNet accuracy benchmark. Every observation, including misses, is retained. Compatibility requires valid probabilities and labels, exact source signatures, the primary known-label reference, and actual rendering/release; it does not promise 100% prediction accuracy.'};
 }
 const beforeRelease=memory();await engine.dispose();assert.equal(engine.session,null);assert.equal(engine.info,null);assert.equal(engine.canvas,null);assert.equal(engine.busy,false);globalThis.gc?.();const afterRelease=memory();
 const reloadRounds=[];
 if(model.size==='N')for(let round=1;round<=2;round++){const start=performance.now();info=await engine.load(bytes,{...model,backend:'wasm'});wrapRelease();const actual=await engine.infer(image,options);validateResult(actual,model.task,image);await engine.dispose();assert.equal(engine.session,null);globalThis.gc?.();reloadRounds.push({round,loadInferDisposeMs:rounded(performance.now()-start),resultCount:actual.items.length,memory:memory()})}
 assert.equal(releaseResolved,1+reloadRounds.length);
 return {id:model.id,name:model.name,task:model.task,size:model.size,sha256:model.sha256,bytes:bytes.length,status:'pass',sourceFingerprint:executedFingerprint,validatorSha256,startedAt,completedAt:new Date().toISOString(),source:{url:model.url,revision:model.revision,license:model.license,metadata:graph.metadata,producer:graph.producer},wasmNode:{status:'pass',backend:'WASM',initializeMs,input:graph.inputs,outputs:graph.outputs,image:imageEvidence,video,...(classificationAccuracy?{classificationAccuracy}:{}),...(cropEvidence?{digitalCrop:cropEvidence}:{}),render:{path:path.relative(ROOT,renderPath),sha256:sha(png),width:afterCanvas.width,height:afterCanvas.height,changedPixels,visualReview:'pending'},lifecycle:{releaseResolved:true,releaseCallCount:releaseResolved,sessionCleared:true,canvasCleared:true,reloadRounds,initBefore,beforeRelease,afterRelease,note:'Memory is process RSS/JS/ArrayBuffer telemetry, not GPU utilization. Allocators may retain released pages; each model is isolated in a fresh process.'}},browserWasm:{status:'pending'},webgpu:{status:'pending'}};
}
async function contactSheet(records){
 const {Canvas,loadImage}=await import('@napi-rs/canvas');const w=310,h=300,gap=12,header=46;
 const c=new Canvas(SIZES.length*(w+gap)+gap,TASKS.length*(h+header+gap)+gap);const x=c.getContext('2d');x.fillStyle='#111';x.fillRect(0,0,c.width,c.height);
 for(let row=0;row<TASKS.length;row++)for(let col=0;col<SIZES.length;col++){
  const id=`yolo26-${TASKS[row]}-${SIZES[col].toLowerCase()}`,record=records.find(m=>m.id===id);const left=gap+col*(w+gap),top=gap+row*(h+header+gap);x.fillStyle='#eee';x.font='16px sans-serif';x.fillText(`${TASKS[row]} · ${SIZES[col]} ${record?.status==='pass'?record.wasmNode.image.resultCount+' results':record?.status||'missing'}`,left+4,top+22);
  if(record?.status==='pass'){const image=await loadImage(path.join(ROOT,record.wasmNode.render.path));const ratio=Math.min(w/image.width,h/image.height);x.drawImage(image,left+(w-image.width*ratio)/2,top+header+(h-image.height*ratio)/2,image.width*ratio,image.height*ratio)}
 }
 const p=REPORT.endsWith('/model-validation-matrix.json')?path.join(ROOT,'docs/evidence/yolo26-matrix.png'):REPORT.replace(/\.json$/,'.png');await writeFile(p,c.toBuffer('image/png'));return path.relative(ROOT,p);
}
async function matrix(){
 await ensureValidationFixtures();
 const sourceFingerprint=await fingerprint();const runtime=JSON.parse(await readFile(path.join(ROOT,'node_modules/onnxruntime-web/package.json'),'utf8'));
 const planned=TASKS.flatMap(task=>SIZES.map(size=>`yolo26-${task}-${size.toLowerCase()}`));assert.equal(MODELS.filter(m=>m.series==='YOLO26').length,25,'Manifest must preserve all25 planned combinations');
 const selected=option('--ids','').split(',').filter(Boolean);const ids=selected.length?planned.filter(id=>selected.includes(id)):planned;
 const run={id:randomUUID(),environment:'node',backend:'WASM',runtimeVersion:runtime.version,startedAt:new Date().toISOString(),completedAt:null,command:process.argv.join(' '),validatorSha256:sha(await readFile(SELF)),physicalDevice:false,nodeVersion:process.version,os:`${os.platform()} ${os.arch()}`,cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,totalMemoryBytes:os.totalmem(),browserWasm:'not tested by this runner',webgpu:'not tested by this runner'};
 const report={schemaVersion:1,sourceFingerprint,run,plannedCount:25,executedCount:0,partial:ids.length!==25,models:planned.map(id=>({id,status:'pending',browserWasm:{status:'pending'},webgpu:{status:'pending'}}))};
 await mkdir(path.dirname(REPORT),{recursive:true});
 const save=async()=>writeFile(REPORT,JSON.stringify(report,null,2)+'\n');await save();
 for(const id of ids){
  const model=MODELS.find(m=>m.id===id);let record;
  const file=path.resolve(ROOT,model.testFixturePath||`tests/fixtures/yolo26/${model.name.toLowerCase()}.onnx`);
  try{await access(file);const child=spawnSync(process.execPath,['--expose-gc',SELF,'--one',id],{cwd:ROOT,encoding:'utf8',timeout:180000,maxBuffer:1024*1024});const marker=(child.stdout||'').split('\n').find(line=>line.startsWith('YOLO26_RESULT '));if(!marker)throw new Error(`Validation subprocess failed (${child.status}): ${child.error?.message||child.stderr||child.stdout}`);record=JSON.parse(marker.slice('YOLO26_RESULT '.length));if(child.status!==0&&record.status==='pass')throw new Error('Subprocess exited nonzero despite pass record');}
  catch(error){record={id,name:model.name,task:model.task,size:model.size,sha256:model.sha256,bytes:model.bytes,status:error.code==='ENOENT'?'missing':'fail',error:error.message,wasmNode:{status:'fail'},browserWasm:{status:'pending'},webgpu:{status:'pending'}}}
  report.models[planned.indexOf(id)]=record;report.executedCount++;await save();console.log(`${id}: ${record.status}${record.status==='pass'?` (${record.wasmNode.image.resultCount} image results, ${record.wasmNode.image.latencyMs}ms)`:` ${record.error}`}`);
 }
 report.run.completedAt=new Date().toISOString();report.sourceFingerprintAfter=await fingerprint();report.validatorSha256After=sha(await readFile(SELF));report.sourceChangedDuringRun=sourceFingerprint!==report.sourceFingerprintAfter||report.models.filter(m=>m.status==='pass').some(m=>m.sourceFingerprint!==sourceFingerprint)||report.validatorSha256After!==run.validatorSha256;report.contactSheet=await contactSheet(report.models);report.summary={pass:report.models.filter(m=>m.status==='pass').length,fail:report.models.filter(m=>m.status==='fail').length,missing:report.models.filter(m=>m.status==='missing').length,pending:report.models.filter(m=>m.status==='pending').length};await save();
 const csv=['id,task,size,status,bytes,sha256,initialize_ms,image_latency_ms,image_results,video_frames,release_resolved,browser_wasm,webgpu',...report.models.map(m=>[m.id,m.task||'',m.size||'',m.status,m.bytes||'',m.sha256||'',m.wasmNode?.initializeMs||'',m.wasmNode?.image?.latencyMs||'',m.wasmNode?.image?.resultCount??'',m.wasmNode?.video?.frames?.length??'',m.wasmNode?.lifecycle?.releaseResolved??'','pending','pending'].join(','))].join('\n')+'\n';await writeFile(REPORT.replace(/\.json$/,'.csv'),csv);
 console.log(JSON.stringify({summary:report.summary,partial:report.partial,sourceChangedDuringRun:report.sourceChangedDuringRun,report:path.relative(ROOT,REPORT),contactSheet:report.contactSheet}));
 if(report.partial||report.summary.pass!==25||report.sourceChangedDuringRun)process.exitCode=1;
}
if(args.includes('--one')){try{console.log('YOLO26_RESULT '+JSON.stringify(await oneModel(option('--one'))))}catch(error){const model=MODELS.find(m=>m.id===option('--one'));console.log('YOLO26_RESULT '+JSON.stringify({id:option('--one'),task:model?.task,size:model?.size,sha256:model?.sha256,status:'fail',error:error.stack||error.message,wasmNode:{status:'fail'},browserWasm:{status:'pending'},webgpu:{status:'pending'}}));process.exitCode=1}}
else await matrix();
