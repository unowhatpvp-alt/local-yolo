/** Real CI browser validation. No inference, browser capability or cache mocks. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp,mkdtemp,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {resolve,join,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {sourceFingerprint,validateReleaseEvidence} from './check-release-gate.mjs';
import {MODELS} from '../src/core/catalog.js';
import {resolveInside,ffmpegCommand} from './validation-tools.mjs';
import {validateUi} from './browser-ui-checks.mjs';

const ROOT=process.cwd(),OUT=resolve('test-results/browser-release');
await mkdir(OUT,{recursive:true});
const fingerprint=await sourceFingerprint();
let baseline=JSON.parse(await readFile('docs/browser-validation-matrix.json','utf8'));
const previousPwa=JSON.parse(await readFile('docs/pwa-validation.json','utf8'));
const previousNode=JSON.parse(await readFile('docs/model-validation-matrix.json','utf8'));
const priorErrors=validateReleaseEvidence({fingerprint,catalog:MODELS,node:previousNode,browser:baseline,pwa:previousPwa}).errors;
const separateUiEvidence=e=>/^(PWA |pwa:|Browser check )/.test(e);
const reusableWasm=baseline.sourceFingerprint===fingerprint&&priorErrors.every(e=>separateUiEvidence(e)||/^yolo26-.*\/(webgpu|gpu|environment-wasm-fallback|gpu-wasm-fallback):/.test(e));
const reusableBackend=reusableWasm&&baseline.backendCompatibilityRun&&priorErrors.every(separateUiEvidence);
assert.equal(previousNode.sourceFingerprint,fingerprint,'Run the complete current-source Node model matrix before browser validation.');
await writeFile(join(OUT,'previous-browser-validation-matrix.json'),JSON.stringify(baseline,null,2)+'\n');
await writeFile(join(OUT,'previous-pwa-validation.json'),JSON.stringify(previousPwa,null,2)+'\n');
// This config labels newly executed tests; old reports keep their original fingerprint.
await writeFile('tests/browser-run-config.json',JSON.stringify({schemaVersion:1,sourceFingerprint:fingerprint,frozenAt:new Date().toISOString(),requiredModels:MODELS.map(m=>m.id),scope:'Actual fresh browser execution for this frozen application.'},null,2)+'\n');
const playwrightModule=process.env.LOCAL_YOLO_PLAYWRIGHT_MODULE||join(tmpdir(),'local-yolo-browser-qa/node_modules/playwright/index.mjs');
const {chromium}=await import(playwrightModule.startsWith('file:')?playwrightModule:pathToFileURL(resolve(playwrightModule)).href);
const checks=['manifest','serviceWorkerInstalled','offlineColdStart','cachedModelOfflineInference','cacheDeletion','updateWaiting','oldTabConsistency','activateNewVersion','noVersionMix','storageFailureRecovery','subpathResources'];
const report={schemaVersion:1,sourceFingerprint:fingerprint,secureContext:false,status:'running',run:{id:randomUUID(),environment:'browser',kind:'Actual Chromium on browser-trusted localhost; not an iPhone',os:process.platform,startedAt:new Date().toISOString(),completedAt:null,url:'http://127.0.0.1:4175/local-yolo/',physicalDevice:false},checks:Object.fromEntries(checks.map(id=>[id,{status:'pending',observations:[]}])),deviceChecks:previousPwa.deviceChecks,staticVerification:JSON.parse(await readFile('docs/build-verification.json','utf8'))};
const errors=[],consoleMessages=[],requests=[],viewports=[];
async function save(){await writeFile('docs/pwa-validation.json',JSON.stringify(report,null,2)+'\n');await writeFile(join(OUT,'pwa-validation.json'),JSON.stringify(report,null,2)+'\n');}
async function passed(id,...observations){report.checks[id]={status:'pass',observations,observedAt:new Date().toISOString()};console.log('ACTUAL_PWA_PASS',id,JSON.stringify(observations));await save();}
const candidate=resolve('dist'),oldRoot=await mkdtemp(join(tmpdir(),'local-yolo-prior-build-'));
await cp(candidate,join(oldRoot,'dist'),{recursive:true});
const oldIndex=join(oldRoot,'dist/index.html');
await writeFile(oldIndex,(await readFile(oldIndex,'utf8')).replace('<head>','<head><!-- local-yolo-previous-validation-build -->'));
execFileSync(process.execPath,[resolve('scripts/finalize-sw.mjs')],{cwd:oldRoot,windowsHide:true});
const getRevision=async root=>(await readFile(join(root,'sw.js'),'utf8')).match(/const VERSION='([a-f0-9]{12})'/)[1];
const prior=join(oldRoot,'dist'),priorRevision=await getRevision(prior),candidateRevision=await getRevision(candidate);
assert.notEqual(priorRevision,candidateRevision);
let serving=prior;
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');if(!url.pathname.startsWith('/local-yolo/')){res.writeHead(404).end();return}const rel=decodeURIComponent(url.pathname.slice('/local-yolo/'.length));const path=resolveInside(serving,rel+(url.pathname.endsWith('/')?'index.html':''));assert((await stat(path)).isFile());res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));}catch{res.writeHead(404).end('Not found')}});
await new Promise(r=>server.listen(4175,'127.0.0.1',r));
const vite=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','4173','--strictPort'],{cwd:ROOT,stdio:['ignore','pipe','pipe'],windowsHide:true});
let viteLog='';vite.stdout.on('data',b=>{viteLog+=b});vite.stderr.on('data',b=>{viteLog+=b});
vite.on('error',error=>{viteLog+='\n'+error.message});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let browser,context;
async function controllerVersion(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const c=new MessageChannel();const timer=setTimeout(()=>reject(Error('SW version timeout')),10000);c.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data.version)};navigator.serviceWorker.controller.postMessage({type:'GET_VERSION'},[c.port2]);}));}
async function ready(page){await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:60000});}
async function load(page){await page.locator('#load-model').click();await page.locator('#workbench').waitFor({state:'visible',timeout:180000});}
async function results(page){await page.waitForFunction(()=>/\d+/.test(document.querySelector('#result-summary').textContent),null,{timeout:60000});}
async function image(page){await page.locator('#mode-file').click();await page.locator('#file-input').setInputFiles(resolve('tests/fixtures/bus.jpg'));await results(page);}
async function exportResults(page,label){await page.locator('#results-menu-toggle').click();const promised=page.waitForEvent('download');await page.locator('#save-json').click();const download=await promised;const file=join(OUT,label+'.json');await download.saveAs(file);const value=JSON.parse(await readFile(file,'utf8'));await page.locator('#results-options-panel').waitFor({state:'hidden'});return value;}
async function observeViewport(page,width,height){await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForFunction(()=>parseFloat(document.documentElement.style.getPropertyValue('--visual-height'))===Math.round(visualViewport?.height||innerHeight));const observation=await page.evaluate(()=>{const r=document.documentElement;return {width:innerWidth,height:innerHeight,scrollHeight:r.scrollHeight,clientHeight:r.clientHeight,visualHeight:visualViewport?.height,cssVisualHeight:r.style.getPropertyValue('--visual-height'),horizontalOverflow:r.scrollWidth>r.clientWidth,verticalOverflow:r.scrollHeight>r.clientHeight,canvasFit:getComputedStyle(document.querySelector('#overlay-canvas')).objectFit,smallTargets:[...document.querySelectorAll('button,input,a[href],summary')].filter(e=>{const b=e.getBoundingClientRect();if(e.closest('[hidden],.sr-only')||!e.getClientRects().length||b.bottom<0||b.top>innerHeight)return false;for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false}return b.width<44||b.height<44}).map(e=>e.id||e.tagName)};});viewports.push(observation);await page.screenshot({path:join(OUT,`viewport-${width}x${height}.png`)});assert.equal(observation.horizontalOverflow,false,JSON.stringify(observation));assert.equal(observation.verticalOverflow,false,JSON.stringify(observation));assert.equal(observation.canvasFit,'contain');assert.deepEqual(observation.smallTargets,[]);return observation;}
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4173/local-yolo/')).ok)break}catch{}await delay(100);if(i===99)throw Error('Validation server did not start: '+viteLog)}
 browser=await chromium.launch({headless:true});
 context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',serviceWorkers:'allow',acceptDownloads:true});
 context.on('page',page=>{page.on('pageerror',e=>errors.push({url:page.url(),message:e.stack||e.message}));page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleMessages.push({type:m.type(),text:m.text(),url:page.url()})});page.on('request',r=>requests.push({url:r.url(),method:r.method()}));});
 // Reuse only current, complete evidence. A changed application executes all 25 twice.
 if(!reusableWasm||!reusableBackend){
  const matrix=await context.newPage();let matrixBackend='wasm';
  await matrix.exposeFunction('__recordActualRender',async({modelId,sha256,png})=>{assert(/^yolo26-(detect|segment|pose|classify|obb)-[nsmlx]$/.test(modelId));const bytes=Buffer.from(png.split(',')[1],'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),sha256);const directory=join(OUT,'renders',matrixBackend);await mkdir(directory,{recursive:true});await writeFile(join(directory,modelId+'.png'),bytes);console.log('ACTUAL_MODEL_RENDER_CAPTURED',matrixBackend,modelId,sha256);});
  await matrix.goto('http://127.0.0.1:4173/local-yolo/tests/browser-harness.html');
  const execute=async(button,backend)=>{
   await matrix.waitForFunction(id=>!document.querySelector(id).disabled,button);
   await matrix.locator(button).click();
   await matrix.waitForFunction(backend=>{try{const r=JSON.parse(document.querySelector('#evidence-json').value);return r.run.requestedBackend===backend&&!!r.run.completedAt}catch{return false}},backend,{timeout:1800000});
   const result=JSON.parse(await matrix.locator('#evidence-json').inputValue());
   assert.equal(result.sourceFingerprint,fingerprint);assert.equal(result.executedCount,25);assert.equal(result.partial,false);assert.equal(result.run.stopped,false);
   return result;
  };
  if(!reusableWasm){
   const wasm=await execute('#run-wasm','WASM');
   await writeFile(join(OUT,'actual-browser-wasm-matrix.json'),JSON.stringify(wasm,null,2)+'\n');
   for(const row of wasm.models){assert.equal(row.browserWasm.status,'pass',row.id+': '+JSON.stringify(row.browserWasm));assert.equal(row.browserWasm.backend,'WASM');assert.equal(row.browserWasm.video.frames.length,2);assert(row.browserWasm.image.resultCount>0);}
   baseline=wasm;
   // Harness UI observations start pending; old observations never receive a new fingerprint.
   await writeFile('docs/browser-validation-matrix.json',JSON.stringify(baseline,null,2)+'\n');
  }
  matrixBackend='auto';const auto=await execute('#run-gpu','WebGPU');
  await writeFile(join(OUT,'actual-auto-backend-matrix.json'),JSON.stringify(auto,null,2)+'\n');
  for(const row of auto.models){assert(['pass','environment-wasm-fallback','unsupported-operator-fallback'].includes(row.webgpu.status),row.id+': '+JSON.stringify(row.webgpu));const actual=row.webgpu.status==='pass'?row.webgpu:row.webgpu.fallback;assert.equal(actual.status,'pass');assert.equal(actual.video.frames.length,2);assert(actual.image.resultCount>0);const old=baseline.models.find(r=>r.id===row.id);assert(old);old.webgpu=row.webgpu;old.backendCompatibilitySourceRun=auto.run.id;}
  baseline.previousBrowserWasmRun=baseline.browserWasmRun||baseline.previousBrowserWasmRun||baseline.run;baseline.backendCompatibilityRun=auto.run;baseline.run={...auto.run,backend:'WASM plus actual automatic-backend compatibility; original WASM run retained'};
  await writeFile('docs/browser-validation-matrix.json',JSON.stringify(baseline,null,2)+'\n');await matrix.close();
 }else{report.backendEvidenceReusedFromRun=baseline.backendCompatibilityRun.id;console.log('REUSED_VERIFIED_AUTO_BACKEND_MODELS',25,baseline.backendCompatibilityRun.id)}
 const page=await context.newPage();await page.goto(report.run.url);await ready(page);
 const ui=await validateUi({page,context,out:join(OUT,'ui'),baseUrl:report.run.url,models:MODELS});
 baseline.checks=ui.checks;
 baseline.uiRun={startedAt:ui.startedAt,completedAt:ui.completedAt,regressions:ui.regressions,environment:ui.scope};
 await writeFile('docs/browser-validation-matrix.json',JSON.stringify(baseline,null,2)+'\n');
 assert.notEqual(ui.status,'fail',ui.failure);for(const [id,regression]of Object.entries(ui.regressions))assert.equal(regression.status,'pass',id);
 await page.setViewportSize({width:390,height:844});
 const environment=await page.evaluate(()=>({secureContext:isSecureContext,navigatorGpu:!!navigator.gpu,userAgent:navigator.userAgent}));assert(environment.secureContext);report.secureContext=true;report.run.userAgent=environment.userAgent;report.environment=environment;report.revisions={prior:priorRevision,candidate:candidateRevision,method:'Two real finalized production artifacts; prior differs by an HTML-only validation marker. No inference code differs.'};
 const manifest=await page.evaluate(async()=>{const response=await fetch(document.querySelector('link[rel=manifest]').href);return response.json()});assert.equal(manifest.display,'standalone');assert.equal(new URL(manifest.scope,report.run.url).pathname,'/local-yolo/');await passed('manifest',{name:manifest.name,display:manifest.display,scope:manifest.scope,icons:manifest.icons});
 assert.equal(await controllerVersion(page),priorRevision);await passed('serviceWorkerInstalled',{controller:await page.evaluate(()=>navigator.serviceWorker.controller.scriptURL),version:priorRevision,secureContext:true});
 await load(page);await image(page);const online=await exportResults(page,'online-real-detection');assert(online.items.some(i=>i.label==='bus'));assert(['WASM','WebGPU'].includes(online.backend));report.onlineInference={task:online.task,backend:online.backend,count:online.items.length,sourceWidth:online.sourceWidth,sourceHeight:online.sourceHeight};
 for(const [w,h]of [[375,650],[375,812],[390,844],[844,390],[768,1024],[1280,900]])await observeViewport(page,w,h);
 baseline.checks.responsivePhone={status:'pass',observations:viewports.filter(v=>v.width<768||v.height<500)};
 baseline.checks.responsiveTablet={status:'pass',observations:viewports.filter(v=>v.width===768)};
 await page.setViewportSize({width:390,height:844});await context.setOffline(true);await page.close();const cold=await context.newPage();await cold.goto(report.run.url);await ready(cold);await cold.waitForFunction(()=>document.querySelector('#model-cache-state').textContent.includes('Cached'));await passed('offlineColdStart',{freshPage:true,allPreviousAppPagesClosed:true,networkOffline:true,controllerVersion:await controllerVersion(cold),title:await cold.title()});
 await load(cold);await image(cold);const offline=await exportResults(cold,'offline-real-detection');assert(offline.items.some(i=>i.label==='bus'));assert(['WASM','WebGPU'].includes(offline.backend));assert.equal(offline.items.length,online.items.length);await passed('cachedModelOfflineInference',{cachedModel:'yolo26-detect-n',backend:offline.backend,realBusResults:offline.items.length,networkOffline:true,coldSession:true});
 await cold.locator('#confidence').press('End');await cold.locator('#confidence').press('Tab');await cold.waitForFunction(()=>document.querySelector('#result-summary').textContent.startsWith('0 '));const high=await exportResults(cold,'confidence-99');assert.equal(high.items.length,0);await cold.locator('#confidence').press('Home');await cold.locator('#confidence').press('Tab');await cold.waitForFunction(()=>/^[1-9]\d* /.test(document.querySelector('#result-summary').textContent));report.confidence={status:'pass',highThreshold:.99,highResults:high.items.length,lowThreshold:.01,lowSummary:await cold.locator('#result-summary').textContent()};
 await context.setOffline(false);
 // Real local ONNX, not a replacement model or fake output.
 await cold.locator('#switch-model').click();await cold.locator('#source-local').click();await cold.locator('#local-model-input').setInputFiles(resolve('tests/fixtures/yolo26/yolo26n.onnx'));await load(cold);await image(cold);const local=await exportResults(cold,'local-onnx-real-detection');assert(local.items.some(i=>i.label==='bus'));report.localImport={status:'pass',model:local.model,count:local.items.length};
 const longVideo=join(OUT,'real-control-video.mp4');
 execFileSync(ffmpegCommand(),['-v','error','-stream_loop','14','-i','tests/fixtures/yolo26/real-video.mp4','-c','copy',longVideo,'-y'],{windowsHide:true});
 await cold.locator('#file-input').setInputFiles(longVideo);
 await cold.waitForFunction(()=>document.querySelector('#camera-video').currentTime>.3&&!document.querySelector('#camera-video').paused);
 await cold.locator('#video-play').click();const pauseTime=await cold.locator('#camera-video').evaluate(v=>v.currentTime);await delay(250);assert(Math.abs(await cold.locator('#camera-video').evaluate(v=>v.currentTime)-pauseTime)<.1);
 await cold.locator('#video-restart').click();await cold.waitForFunction(()=>!document.querySelector('#camera-video').paused);
 await cold.locator('#fullscreen-toggle').click();
 await cold.waitForFunction(()=>getComputedStyle(document.querySelector('#stage-toolbar')).opacity==='0',null,{timeout:15000});await cold.screenshot({path:join(OUT,'fullscreen-phone.png')});
 await cold.locator('#camera-video').click();await cold.waitForFunction(()=>getComputedStyle(document.querySelector('#stage-toolbar')).opacity==='1');
 await cold.locator('#fullscreen-exit').click();
 // Fullscreen API completion and fullscreenchange are asynchronous after the click.
 await cold.waitForFunction(()=>!document.fullscreenElement&&!document.querySelector('#stage').classList.contains('fullscreen-fallback')&&!document.body.classList.contains('is-fullscreen'));
 assert.equal(await cold.locator('body').evaluate(e=>e.classList.contains('is-fullscreen')),false);
 report.videoFullscreen={status:'pass',pauseTime,autoType:'video',fadeOpacity:0,wakeOpacity:1,independentExit:true,scope:'CI Chromium, not native iPhone fullscreen'};
 baseline.checks.videoPauseReplay={status:'pass',observations:[report.videoFullscreen]};
 await writeFile('docs/browser-validation-matrix.json',JSON.stringify(baseline,null,2)+'\n');
 await cold.locator('#settings-open').click();await cold.locator('#cache-clear').click();await cold.waitForFunction(()=>document.querySelector('#cache-list').textContent==='');assert.equal(await cold.locator('#cache-list').textContent(),'');await passed('cacheDeletion','Actual UI cache-clear removed all IndexedDB model entries.');await cold.locator('#settings-close').click();
 const oldTab=await context.newPage();await oldTab.goto(report.run.url);await ready(oldTab);assert((await oldTab.content()).includes('local-yolo-previous-validation-build'));
 serving=candidate;await cold.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});await cold.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting,null,{timeout:60000});assert.equal(await controllerVersion(cold),priorRevision);await passed('updateWaiting',{activeVersion:priorRevision,waitingVersion:candidateRevision,explicitActivationRequired:true});
 await oldTab.reload();assert((await oldTab.content()).includes('local-yolo-previous-validation-build'));assert.equal(await controllerVersion(oldTab),priorRevision);await passed('oldTabConsistency','Existing tab reload keeps the old cached document and old controller while update waits.');
 await cold.locator('#settings-open').click();await cold.locator('#app-update').click();await cold.waitForFunction(()=>!document.documentElement.innerHTML.includes('local-yolo-previous-validation-build'),null,{timeout:60000});await ready(cold);assert.equal(await controllerVersion(cold),candidateRevision);await passed('activateNewVersion',{version:candidateRevision,actualAppUpdateButton:true,priorMarkerGone:true});
 const cacheKeys=await cold.evaluate(()=>caches.keys());const appKeys=cacheKeys.filter(k=>k.startsWith('local-yolo:'+report.run.url+':'));assert.deepEqual(appKeys,['local-yolo:'+report.run.url+':'+candidateRevision]);await passed('noVersionMix',{currentVersion:candidateRevision,cacheKeys:appKeys,oldCacheRemoved:true});await oldTab.close();
 const resources=await cold.evaluate(async()=>{const names=await caches.keys();return (await Promise.all(names.map(async n=>(await(await caches.open(n)).keys()).map(r=>r.url)))).flat()});assert(resources.every(u=>new URL(u).pathname.startsWith('/local-yolo/')));await passed('subpathResources',{scope:'/local-yolo/',cachedResourceCount:resources.length,allUnderScope:true});
 // Force a real browser quota condition; do not replace IndexedDB or return fake API results.
 const cdp=await context.newCDPSession(cold),origin=new URL(report.run.url).origin;
 await cdp.send('Storage.overrideQuotaForOrigin',{origin,quotaSize:1});
 // An existing IndexedDB may retain previously reserved quota. Remove only
 // this isolated test context's model database, then open it afresh under quota.
 await cdp.send('Storage.clearDataForOrigin',{origin,storageTypes:'indexeddb'});
 await cold.reload();await ready(cold);
 // Chromium deliberately reports a privacy-preserving estimate to web pages.
 // Verify the actual enforced override through CDP, then exercise the real write.
 const quota=await cdp.send('Storage.getUsageAndQuota',{origin});
 const reportedEstimate=await cold.evaluate(()=>navigator.storage.estimate());
 report.storageFailureAttempt={quota,reportedEstimate,modelState:await cold.locator('#model-cache-state').textContent()};await save();
 assert.equal(quota.overrideActive,true);assert.equal(quota.quota,1);
 await load(cold);await image(cold);const memory=await exportResults(cold,'quota-memory-only-real-detection');assert(memory.items.some(i=>i.label==='bus'));
 const warning=await cold.locator('#toast').textContent();
 report.storageFailureAttempt.after={warning,quota:await cdp.send('Storage.getUsageAndQuota',{origin})};await save();
 assert.match(warning,/could not be saved|memory only|storage is unavailable/i);
 await cdp.send('Storage.overrideQuotaForOrigin',{origin});await cold.locator('#switch-model').click();await load(cold);await cold.locator('#settings-open').click();
 await cold.waitForFunction(()=>document.querySelector('#cache-list').textContent.includes('YOLO26n'));
 assert.match(await cold.locator('#cache-list').textContent(),/YOLO26n/);await cold.locator('#settings-close').click();
 await passed('storageFailureRecovery',{method:'Actual Chromium CDP quota override and fresh isolated IndexedDB; no API replacement',quota:quota.quota,overrideActive:quota.overrideActive,reportedEstimate,memoryOnlyBusResults:memory.items.length,warning,cacheRestoredAfterQuotaReset:true});
 // Keep the static server responsive while a separate real touch context runs.
 await new Promise((resolve,reject)=>{
  const touch=spawn(process.execPath,['scripts/validate-touch.mjs'],{cwd:ROOT,stdio:'inherit',windowsHide:true,timeout:180000,
   env:{...process.env,LOCAL_YOLO_PLAYWRIGHT_MODULE:playwrightModule,LOCAL_YOLO_TOUCH_URL:report.run.url}});
  touch.on('error',reject);touch.on('close',code=>code===0?resolve():reject(new Error(`Actual touch validation exited ${code}`)));
 });
 assert.equal(errors.length,0,JSON.stringify(errors));assert(!requests.some(r=>r.method!=='GET'),'Only GET model/static/media fixture requests are expected.');report.console={uncaughtPageErrors:errors,observedMessages:consoleMessages};report.network={requests:requests.length,nonGetRequests:0};report.viewports=viewports;report.status='pass';
}catch(error){report.status='fail';report.failure=error.stack||error.message;console.error('ACTUAL_BROWSER_VALIDATION_FAILED',report.failure);process.exitCode=1;}
finally{report.run.completedAt=new Date().toISOString();report.console??={uncaughtPageErrors:errors,observedMessages:consoleMessages};report.viewports=viewports;await save();await writeFile(join(OUT,'vite.log'),viteLog);await context?.close();await browser?.close();vite.kill('SIGTERM');await new Promise(r=>server.close(r));assert.equal(await sourceFingerprint(),fingerprint,'Application changed during browser validation.');console.log('ACTUAL_BROWSER_RELEASE_RESULT',JSON.stringify({status:report.status,checks:Object.fromEntries(Object.entries(report.checks).map(([k,v])=>[k,v.status])),sourceFingerprint:fingerprint}));}
