import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const BASELINE_SHA='2cea0ebebd3399a77a2d649c44755e54ca0e16b0';
export const REQUIRED_MODELS=Object.freeze(['detect','segment','pose','classify','obb'].flatMap(task=>['n','s','m','l','x'].map(size=>`yolo26-${task}-${size}`)));
const HASH=/^[a-f0-9]{64}$/;
const APP_FILES=['index.html','package.json','package-lock.json','scripts/prepare.mjs','scripts/finalize-sw.mjs','scripts/pwa-template.mjs'];
async function filesUnder(root,dir){const out=[];try{for(const e of await readdir(join(root,dir),{withFileTypes:true})){if(e.name.startsWith('.'))continue;const p=`${dir}/${e.name}`;if(e.isDirectory())out.push(...await filesUnder(root,p));else out.push(p)}}catch(e){if(e.code!=='ENOENT')throw e}return out}
/** Application bytes plus immutable model metadata. Validation-state promotions do not change inference bytes. */
export async function sourceFingerprint(root=process.cwd()){
 root=resolve(root);const hash=createHash('sha256');
 const paths=[...APP_FILES,...await filesUnder(root,'src'),...await filesUnder(root,'public/icons') ,'public/manifest.webmanifest'].filter(p=>!['src/core/catalog.js','src/core/model-manifest.json'].includes(p));
 for(const path of [...new Set(paths)].sort()){try{const bytes=await readFile(join(root,path));hash.update(path+'\0');hash.update(bytes);hash.update('\0')}catch(e){if(e.code!=='ENOENT')throw e;hash.update(path+'\0MISSING\0')}}
 const {MODELS}=await import(pathToFileURL(join(root,'src/core/catalog.js')).href);
 const models=MODELS.map(m=>Object.fromEntries(['id','series','task','size','sha256','bytes','url','revision','inputShape','outputShapes','format'].map(k=>[k,m[k]??null]))).sort((a,b)=>a.id.localeCompare(b.id));
 hash.update('canonical-models\0'+JSON.stringify(models));return hash.digest('hex');
}
export function validateReleaseEvidence({fingerprint,catalog,node,browser,pwa}){
 const errors=[];const need=(ok,message)=>{if(!ok)errors.push(message)};
 const modelMap=new Map(catalog.map(m=>[m.id,m]));
 need(catalog.length===25&&new Set(catalog.map(m=>m.id)).size===25,'Online catalog must contain exactly the required 25 YOLO26 exports; reducing the set is forbidden.');
 for(const id of REQUIRED_MODELS)need(modelMap.has(id),`Catalog missing ${id}.`);
 for(const [name,report]of Object.entries({node,browser,pwa})){
  need(report&&typeof report==='object',`Missing ${name} evidence report.`);if(!report)continue;
  need(report.schemaVersion===1,`${name}: schemaVersion must be 1.`);need(report.sourceFingerprint===fingerprint,`${name}: evidence is stale or bound to a different application fingerprint.`);
  need(report.run&&typeof report.run.id==='string'&&report.run.id.length>4,`${name}: missing unique actual run id.`);
  need(Number.isFinite(Date.parse(report.run?.startedAt))&&Number.isFinite(Date.parse(report.run?.completedAt))&&Date.parse(report.run?.completedAt)>=Date.parse(report.run?.startedAt),`${name}: actual start/end timestamps required.`);
 }
 function models(report,label){const rows=report?.models||[];need(rows.length===25&&new Set(rows.map(r=>r.id)).size===25,`${label}: exactly 25 distinct actual model records required.`);const map=new Map(rows.map(r=>[r.id,r]));for(const id of REQUIRED_MODELS){const r=map.get(id),m=modelMap.get(id);need(r,`${label}: missing ${id}.`);if(r&&m){need(r.sha256===m.sha256&&HASH.test(r.sha256),`${label}/${id}: model digest does not match pinned catalog.`);need(r.task===m.task&&String(r.size).toUpperCase()===String(m.size).toUpperCase(),`${label}/${id}: model task/size does not match pinned catalog.`)}}return map}
 const nodeRows=models(node,'node-wasm'),browserRows=models(browser,'browser');
 need(node?.run?.environment==='node'&&node?.run?.backend==='WASM','Node evidence must identify actual Node WASM execution.');
 need(browser?.run?.environment==='browser'&&typeof browser?.run?.userAgent==='string'&&browser.run.userAgent.length>10,'Browser evidence must identify an actual browser user agent.');
 function image(record,task,label,{raw=false,allowEmpty=false,semantic=true}={}){
  need(record&&typeof record==='object',`${label}: missing actual image inference.`);if(!record)return;
  need(record.fixture&&HASH.test(record.fixture.sha256||''),`${label}: fixture SHA-256 required.`);
  need(Number.isFinite(record.fixture?.width)&&record.fixture.width>0&&Number.isFinite(record.fixture?.height)&&record.fixture.height>0,`${label}: actual fixture dimensions required.`);
  need(Number.isFinite(record.latencyMs)&&record.latencyMs>0,`${label}: measured positive inference latency required.`);
  need(Number.isInteger(record.resultCount)&&record.resultCount>=(allowEmpty?0:1),`${label}: valid real result count required.`);
  const samples=record.samples||[];need((record.resultCount===0?allowEmpty:samples.length>0)&&samples.length<=record.resultCount,`${label}: actual output samples required.`);
  for(const s of samples){need(typeof s.label==='string'&&s.label.length>0&&Number.isFinite(s.score)&&s.score>=0&&s.score<=1,`${label}: invalid real class/score sample.`);
   if(task!=='classify'){const b=s.box;need(b&&[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0,`${label}: source-coordinate box missing.`)}
   if(task==='segment')need(s.mask&&s.mask.width>0&&s.mask.height>0&&Number.isInteger(s.mask.nonZero)&&s.mask.nonZero>0&&s.mask.nonZero<=s.mask.width*s.mask.height,`${label}: actual nonempty mask statistics required.`);
   if(task==='pose')need(s.keypointCount===17&&s.visibleKeypoints>0,`${label}: actual 17-keypoint human pose required.`);
   if(task==='obb')need(Array.isArray(s.polygon)&&s.polygon.length===4&&s.polygon.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),`${label}: actual rotated polygon required.`);
  }
  if(semantic&&task==='detect')need(samples.some(s=>s.label==='bus'),`${label}: real bus fixture must identify a bus.`);
  if(semantic&&task==='obb')need(samples.some(s=>s.label==='ship'),`${label}: real aerial fixture must identify a ship.`);
  if(raw){const stats=record.outputTensorStats||[];const expected=modelMap.get(label.split('/')[0])?.outputShapes;need(JSON.stringify(stats.map(s=>s.dims))===JSON.stringify(expected),`${label}: actual output signatures differ from the pinned export.`);need(stats.length>0,`${label}: raw output tensor statistics required.`);for(const s of stats)need(Array.isArray(s.dims)&&s.dims.length>=2&&s.count>0&&s.nonFinite===0&&Number.isFinite(s.min)&&Number.isFinite(s.max)&&HASH.test(s.sha256||''),`${label}: invalid/unsupported raw output tensor evidence.`)}
 }
 function runtime(row,task,label,backend,raw=false){
  need(row?.status==='pass',`${label}: actual ${backend} pass required (pending, fail, unavailable and skipped do not pass).`);if(!row||row.status!=='pass')return;
  need(row.backend===backend,`${label}: actual backend must be ${backend}.`);image(row.image,task,`${label}/image`,{raw});
  need(HASH.test(row.video?.fixture?.sha256||''),`${label}: real video fixture digest required.`);const frames=row.video?.frames||[];need(frames.length>=2,`${label}: at least two decoded real video frame inferences required.`);for(const [i,frame]of frames.entries())image(frame,task,`${label}/video${i}`,{raw,allowEmpty:true,semantic:false});
 }
 for(const id of REQUIRED_MODELS){const task=id.split('-')[1],n=nodeRows.get(id),b=browserRows.get(id);runtime(n?.wasmNode,task,`${id}/node`,'WASM',true);runtime(b?.browserWasm,task,`${id}/browser-wasm`,'WASM');
  const gpu=b?.webgpu;
  if(n)need((n.sourceFingerprint||node?.sourceFingerprint)===fingerprint,`${id}: Node model record was tested against a different source fingerprint.`);
  if(b)need((b.sourceFingerprint||browser?.sourceFingerprint)===fingerprint,`${id}: browser model record was tested against a different source fingerprint.`);
  if(gpu?.status==='environment-wasm-fallback'){
   need(gpu.attempt?.secureContext===true&&gpu.attempt?.adapterAcquired===false&&typeof gpu.attempt?.reason==='string'&&gpu.attempt.reason.length>5,`${id}/gpu: unavailable hardware requires an actual secure-browser capability observation; it is not a WebGPU pass.`);
   runtime(gpu.fallback,task,`${id}/environment-wasm-fallback`,'WASM');
  }else if(gpu?.status==='unsupported-operator-fallback'){
   need(gpu.attempt?.navigatorGpu===true&&gpu.attempt?.adapterAcquired===true&&['initialization','inference'].includes(gpu.attempt?.phase)&&typeof gpu.attempt?.error==='string'&&/operator|kernel|unsupported|not implemented/i.test(gpu.attempt.error),`${id}/gpu: operator fallback requires a genuine GPU adapter and observed operator/kernel error.`);
   runtime(gpu.fallback,task,`${id}/gpu-wasm-fallback`,'WASM');
  }else runtime(gpu,task,`${id}/webgpu`,'WebGPU');
  need(n?.wasmNode?.lifecycle?.releaseResolved===true&&n.wasmNode.lifecycle.sessionCleared===true,`${id}: measured session release evidence required.`);
 }
 const browserChecks=['modelSelection25','modelSwitching','downloadProgress','cacheRecognition','cachedReload','localOnnxImport','imageExport','jsonExport','videoPauseReplay','fileReplacementCleanup','responsivePhone','responsiveTablet','permissionDeniedOrUnavailable','noMediaNetworkRequests'];
 for(const id of browserChecks)need(browser?.checks?.[id]?.status==='pass'&&Array.isArray(browser.checks[id].observations)&&browser.checks[id].observations.length>0,`Browser check ${id}: actual observations and pass required.`);
 need(pwa?.run?.environment==='browser'&&pwa?.secureContext===true,'PWA must be tested in a real secure browser context.');
 const pwaChecks=['manifest','serviceWorkerInstalled','offlineColdStart','cachedModelOfflineInference','cacheDeletion','updateWaiting','oldTabConsistency','activateNewVersion','noVersionMix','storageFailureRecovery','subpathResources'];
 for(const id of pwaChecks)need(pwa?.checks?.[id]?.status==='pass'&&Array.isArray(pwa.checks[id].observations)&&pwa.checks[id].observations.length>0,`PWA check ${id}: actual secure-browser observations and pass required.`);
 for(const name of ['iPhoneSafariInstall','physicalCamera','cameraSwitching','nativeZoom','backgroundResume','physicalFullscreen']){const check=pwa?.deviceChecks?.[name];need(check&&((check.status==='unverified'&&Array.isArray(check.steps)&&check.steps.length>0)||(check.status==='pass'&&typeof check.device==='string'&&Array.isArray(check.observations)&&check.observations.length>0)),`Device check ${name}: actual device observations or explicit unverified status with reproduction steps required.`)}
 for(const report of [node,browser,pwa])need(!report?.simulated&&!report?.mocked,'Simulated or mocked inference cannot satisfy release evidence.');
 return {pass:errors.length===0,errors,requiredModels:[...REQUIRED_MODELS],sourceFingerprint:fingerprint};
}
async function readJson(root,path){try{return JSON.parse(await readFile(join(root,path),'utf8'))}catch{return null}}
export async function checkReleaseGate(root=process.cwd()){
 const {MODELS}=await import(pathToFileURL(join(resolve(root),'src/core/catalog.js')).href);
 return validateReleaseEvidence({fingerprint:await sourceFingerprint(root),catalog:MODELS,node:await readJson(root,'docs/model-validation-matrix.json'),browser:await readJson(root,'docs/browser-validation-matrix.json'),pwa:await readJson(root,'docs/pwa-validation.json')});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--fingerprint'))console.log(await sourceFingerprint());
 else{const result=await checkReleaseGate();console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1}
}
