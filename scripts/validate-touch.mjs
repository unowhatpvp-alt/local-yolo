/** Actual Chromium touch emulation. No application/API/inference replacements. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {sourceFingerprint} from './check-release-gate.mjs';
import {ffmpegCommand} from './validation-tools.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const OUT=join(ROOT,'test-results/touch');
const URL=process.env.LOCAL_YOLO_TOUCH_URL||'http://127.0.0.1:5174/local-yolo/';
const fingerprint=await sourceFingerprint(ROOT);
const modulePath=process.env.LOCAL_YOLO_PLAYWRIGHT_MODULE;
assert(modulePath,'Set LOCAL_YOLO_PLAYWRIGHT_MODULE to the installed Playwright module.');
const {chromium}=await import(modulePath.startsWith('file:')?modulePath:pathToFileURL(resolve(modulePath)).href);
await mkdir(OUT,{recursive:true});
const report={schemaVersion:1,sourceFingerprint:fingerprint,status:'running',simulated:false,mocked:false,
 scope:'Actual trusted tap interactions in Playwright Chromium touch emulation. This is not a physical phone, iPhone Safari, iOS PWA or hardware touchscreen certification.',
 run:{id:randomUUID(),environment:'browser',startedAt:new Date().toISOString(),completedAt:null,url:URL,physicalDevice:false,touchEmulated:true},
 emulation:{viewport:{width:375,height:812},hasTouch:true,isMobile:true},checks:{},console:[]};
let browser,context,page,current='startup';
const save=async()=>{
 await writeFile(join(ROOT,'docs/touch-validation.json'),JSON.stringify(report,null,2)+'\n');
 await writeFile(join(OUT,'touch-validation.json'),JSON.stringify(report,null,2)+'\n');
};
const pass=async(name,observations)=>{
 report.checks[name]={status:'pass',observedAt:new Date().toISOString(),observations};
 console.log('ACTUAL_TOUCH_PASS',name,JSON.stringify(observations));await save();
};
async function exportJson(name){
 await page.locator('#results-menu-toggle').tap();
 const promised=page.waitForEvent('download');await page.locator('#save-json').tap();
 const download=await promised,target=join(OUT,name+'.json');await download.saveAs(target);
 await page.locator('#results-options-panel').waitFor({state:'hidden'});
 return JSON.parse(await readFile(target,'utf8'));
}
async function bottomMenu(trigger,menu,screenshot){
 await page.locator(trigger).tap();await page.locator(menu).waitFor({state:'visible'});
 await page.waitForFunction(selector=>getComputedStyle(document.querySelector(selector)).opacity==='1',menu);
 const observation=await page.locator(menu).evaluate(element=>{const b=element.getBoundingClientRect();return {top:b.top,bottom:b.bottom,width:b.width,height:b.height,viewportWidth:innerWidth,viewportHeight:innerHeight,position:getComputedStyle(element).position}});
 assert.equal(observation.position,'fixed');assert(observation.top>observation.viewportHeight*.4,JSON.stringify(observation));
 assert(observation.bottom<=observation.viewportHeight+1,JSON.stringify(observation));
 assert(observation.width<=observation.viewportWidth+1,JSON.stringify(observation));
 await page.screenshot({path:join(OUT,screenshot)});return observation;
}

try{
 browser=await chromium.launch({headless:true});report.run.browserVersion=browser.version();
 assert.match(browser.version(),/^156\./,'This regression requires the pinned Chromium 156 runner.');
 context=await browser.newContext({viewport:report.emulation.viewport,hasTouch:true,isMobile:true,locale:'en-US',acceptDownloads:true});
 page=await context.newPage();page.on('pageerror',error=>report.console.push({kind:'pageerror',message:error.stack||error.message}));
 await page.goto(URL);await page.locator('#load-model').waitFor({state:'visible'});
 report.run.userAgent=await page.evaluate(()=>navigator.userAgent);
 report.emulation.actual=await page.evaluate(()=>({width:innerWidth,height:innerHeight,maxTouchPoints:navigator.maxTouchPoints,coarsePointer:matchMedia('(pointer:coarse)').matches,secureContext:isSecureContext}));
 assert(report.emulation.actual.maxTouchPoints>0);assert(report.emulation.actual.coarsePointer);
 if(await page.locator('html').getAttribute('lang')!=='en')await page.locator('#language-toggle').tap();
 current='taskAndSizeBottomMenus';
 const taskMenu=await bottomMenu('#task-picker-button','#task-picker-menu','task-bottom-menu.png');
 await page.locator('#task-options > button').nth(1).tap();await page.locator('#task-picker-menu').waitFor({state:'hidden'});
 assert.match(await page.locator('#model-name').textContent(),/seg/i);
 const sizeMenu=await bottomMenu('#size-picker-button','#size-picker-menu','size-bottom-menu.png');
 await page.locator('#size-options > button').nth(2).tap();await page.locator('#size-picker-menu').waitFor({state:'hidden'});
 assert.match(await page.locator('#model-name').textContent(),/YOLO26m-seg/i);
 await page.locator('#task-picker-button').tap();await page.locator('#task-options > button').nth(0).tap();await page.locator('#task-picker-menu').waitFor({state:'hidden'});
 await page.locator('#size-picker-button').tap();await page.locator('#size-options > button').nth(0).tap();await page.locator('#size-picker-menu').waitFor({state:'hidden'});
 assert.equal(await page.locator('#model-name').textContent(),'YOLO26n');
 await pass(current,{taskMenu,sizeMenu,selectedIntermediate:'YOLO26m-seg',restored:'YOLO26n',interaction:'Trusted locator.tap, no synthetic DOM events.'});

 current='realImageInference';await page.locator('#load-model').tap();await page.locator('#workbench').waitFor({state:'visible',timeout:180000});
 await page.locator('#mode-file').tap();const bus=join(ROOT,'tests/fixtures/bus.jpg');await page.locator('#file-input').setInputFiles(bus);
 await page.waitForFunction(()=>/^[1-9]\d* /.test(document.querySelector('#result-summary').textContent),null,{timeout:120000});
 const image=await exportJson('real-bus-before-threshold');assert(image.items.some(item=>item.label==='bus'));assert(['WASM','WebGPU'].includes(image.backend));
 await page.screenshot({path:join(OUT,'real-image-touch.png')});
 await pass(current,{backend:image.backend,model:image.model,count:image.items.length,top:image.items.slice(0,3).map(({label,score})=>({label,score})),fixtureSha256:createHash('sha256').update(await readFile(bus)).digest('hex'),inputMethod:'Actual file input bytes after trusted file-mode tap.'});

 current='confidenceTapRerunsImage';const before=await page.locator('#confidence').inputValue(),bounds=await page.locator('#confidence').boundingBox();assert(bounds);
 await page.locator('#confidence').tap({position:{x:bounds.width-1,y:bounds.height/2}});
 await page.waitForFunction(()=>Number(document.querySelector('#confidence').value)>=.95&&document.querySelector('#result-summary').textContent.startsWith('0 '),null,{timeout:120000});
 const after=await page.locator('#confidence').inputValue(),high=await exportJson('real-bus-after-touch-threshold');
 assert(Number(after)>Number(before));assert.equal(high.items.length,0);
 await pass(current,{before:Number(before),after:Number(after),beforeCount:image.items.length,afterCount:high.items.length,interaction:'Trusted range.tap at the high end; real change handler reran the actual model.'});
 // Restore a useful confidence using another actual touch before the video.
 await page.locator('#confidence').tap({position:{x:bounds.width*.25,y:bounds.height/2}});
 await page.waitForFunction(()=>Number(document.querySelector('#confidence').value)<.5&&/^[1-9]\d* /.test(document.querySelector('#result-summary').textContent),null,{timeout:120000});

 current='videoFullscreenTouch';const source=join(ROOT,'tests/fixtures/yolo26/real-video.mp4'),videoFile=join(OUT,'real-video-30s.mp4');
 execFileSync(ffmpegCommand(),['-v','error','-stream_loop','-1','-i',source,'-t','30','-c','copy',videoFile,'-y'],{windowsHide:true});
 await page.locator('#file-input').setInputFiles(videoFile);
 await page.waitForFunction(()=>{const video=document.querySelector('#camera-video');return !video.paused&&video.currentTime>.3&&/^[1-9]\d* /.test(document.querySelector('#result-summary').textContent)},null,{timeout:120000});
 const videoResult=await exportJson('real-video-touch-results');
 assert(videoResult.items.length>0);assert.equal(videoResult.task,'detect');assert.equal(videoResult.sourceWidth,640);assert.equal(videoResult.sourceHeight,360);
 const playing=await page.locator('#camera-video').evaluate(video=>({currentTime:video.currentTime,duration:video.duration,paused:video.paused,width:video.videoWidth,height:video.videoHeight}));
 assert(playing.duration>=29);await page.locator('#fullscreen-toggle').tap();
 // Deliberately do not tap the stage first: a touch on the fullscreen button must allow idle fade.
 await page.waitForFunction(()=>document.body.classList.contains('is-fullscreen')&&getComputedStyle(document.querySelector('#stage-toolbar')).opacity==='0',null,{timeout:15000});
 const hidden=await page.locator('#stage-toolbar').evaluate(element=>({opacity:getComputedStyle(element).opacity,idle:element.classList.contains('is-idle'),focusVisible:!!element.querySelector(':focus-visible')}));
 await page.screenshot({path:join(OUT,'fullscreen-touch-hidden.png')});assert.equal(hidden.opacity,'0');
 await page.locator('#stage').tap();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#stage-toolbar')).opacity==='1',null,{timeout:10000});
 await page.screenshot({path:join(OUT,'fullscreen-touch-restored.png')});
 await page.locator('#fullscreen-exit').tap();
 await page.waitForFunction(()=>!document.fullscreenElement&&!document.querySelector('#stage').classList.contains('fullscreen-fallback')&&!document.body.classList.contains('is-fullscreen'),null,{timeout:10000});
 const layout=await page.evaluate(()=>({horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,verticalOverflow:document.documentElement.scrollHeight>document.documentElement.clientHeight,fullscreen:!!document.fullscreenElement,bodyFullscreen:document.body.classList.contains('is-fullscreen')}));
 assert.equal(layout.fullscreen,false);assert.equal(layout.bodyFullscreen,false);assert.equal(layout.horizontalOverflow,false);assert.equal(layout.verticalOverflow,false);
 await page.screenshot({path:join(OUT,'fullscreen-touch-exited.png')});
 await pass(current,{playing,actualVideoInference:{backend:videoResult.backend,count:videoResult.items.length,sourceWidth:videoResult.sourceWidth,sourceHeight:videoResult.sourceHeight,latencyMs:videoResult.latency,top:videoResult.items.slice(0,3).map(({label,score})=>({label,score}))},hidden,restoredOpacity:'1',exited:layout,noStageTapBeforeIdle:true,interaction:'Trusted fullscreen-toggle.tap -> idle opacity0 -> stage.tap -> opacity1 -> fullscreen-exit.tap.',sourceVideoSha256:createHash('sha256').update(await readFile(source)).digest('hex')});
 assert.deepEqual(report.console,[]);report.status='pass';
}catch(error){
 report.status='fail';report.checks[current]={status:'fail',error:error.stack||error.message,observedAt:new Date().toISOString()};
 console.error('ACTUAL_TOUCH_FAIL',current,error.stack||error.message);process.exitCode=1;
 if(page)await page.screenshot({path:join(OUT,'failure.png')}).catch(()=>{});
}finally{
 report.run.completedAt=new Date().toISOString();report.sourceFingerprintAfter=await sourceFingerprint(ROOT);
 report.sourceChangedDuringRun=report.sourceFingerprintAfter!==fingerprint;
 if(report.sourceChangedDuringRun){report.status='fail';process.exitCode=1;}
 await save();await context?.close();await browser?.close();
 console.log('ACTUAL_TOUCH_RESULT',JSON.stringify({status:report.status,checks:Object.fromEntries(Object.entries(report.checks).map(([name,value])=>[name,value.status])),sourceFingerprint:fingerprint,sourceChangedDuringRun:report.sourceChangedDuringRun}));
}
