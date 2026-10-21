import './ui/styles.css';
import {getLanguage,setLanguage,translatePage} from './ui/i18n.js';
import {MODELS,TASKS,SERIES} from './core/catalog.js';
import {getModel,listCachedModels,deleteCachedModel,cacheUsage} from './core/model-cache.js';
import {EngineClient} from './core/engine-client.js';
import {MediaController,mediaErrorMessage} from './core/media.js';
import {renderFrame,saveFrame} from './core/render.js';
const $=id=>document.getElementById(id);
const storageGet=key=>{try{return localStorage.getItem(key)}catch{return null}};
const storageSet=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
const tx=(zh,en)=>getLanguage()==='en'?en:zh;
const state={source:'online',series:'YOLO11',task:'detect',size:'N',localTask:'auto',cached:[],model:null,info:null,mode:'camera',loading:false,running:false,busy:false,generation:0,lastResult:null,lastSnapshot:null,lastCrop:null,mirror:false,completions:[],theme:storageGet('local-yolo-theme')||'system',backend:storageGet('local-yolo-backend')||'auto'};
let engine=new EngineClient(),downloadController=null,installPrompt=null;
const snapshots=[document.createElement('canvas'),document.createElement('canvas')];
const media=new MediaController($('camera-video'),$('file-image'),{onEnded:()=>{stopLoop();message(tx('摄像头已断开，请重新选择。','Camera disconnected. Please choose a camera again.'));syncMedia()},onDeviceChange:()=>updateDevices()});
// The media controller reuses this hidden video for both camera and file playback.
const video=$('camera-video');
video.hidden=false;
video.addEventListener('timeupdate',()=>{const fmt=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;$('video-time').textContent=`${fmt(video.currentTime)} / ${fmt(Number.isFinite(video.duration)?video.duration:0)}`});
video.addEventListener('error',()=>{stopLoop();message(tx('无法解码该视频，请尝试浏览器支持的 MP4 或 WebM。','Cannot decode this video. Try a browser-supported MP4 or WebM.'))});
video.addEventListener('ended',()=>{stopLoop();syncMedia()});
function message(text,error=false){const banner=$('workbench-error');if(banner){banner.textContent=text;banner.hidden=!text;banner.classList.toggle('status-banner',!error)}$('stage-message').textContent=text;$('stage-message').classList.toggle('error',error);$('stage-message').hidden=!text}
function fail(error,where='load'){
 console.error(error);const text=error?.name==='MediaError'?mediaErrorMessage(error,getLanguage()):error?.message||String(error);
 if(where==='load'){$('load-error').textContent=text;$('load-error').hidden=false}else message(text,true);
}
function prettyBytes(n){return n?`${(n/1024/1024).toFixed(1)} MB`:'—'}
function button(text,chosen,fn,disabled=false,sub=''){
 const b=document.createElement('button');b.type='button';b.className='choice-button'+(chosen?' selected':'');b.setAttribute('aria-pressed',String(chosen));b.disabled=disabled;b.append(document.createTextNode(text));
 if(sub){const s=document.createElement('small');s.textContent=sub;b.append(s)}b.onclick=fn;return b;
}
function currentModel(){return MODELS.find(m=>m.series===state.series&&m.task===state.task&&m.size===state.size&&m.status==='verified')}
function renderPicker(){
 for(const [id,value] of [['source-online',state.source==='online'],['source-local',state.source==='local']]){$(id).setAttribute('aria-selected',String(value));$(id).classList.toggle('active',value)}
 $('online-panel').hidden=state.source!=='online';$('local-panel').hidden=state.source!=='local';
 $('series-options').replaceChildren(...SERIES.map(s=>{const name=typeof s==='string'?s:s.id;return button(name,state.series===name,()=>{state.series=name;renderPicker()},state.loading,name==='YOLO26'?tx('待验证','Unverified'):'')}));
 $('task-options').replaceChildren(...TASKS.map(t=>button(({detect:'Detection',segment:'Segmentation',pose:'Pose',classify:'Classification',obb:'OBB'})[t.id]||t.label,state.task===t.id,()=>{state.task=t.id;renderPicker()},state.loading,({detect:tx('目标检测','Object detection'),segment:tx('实例分割','Instance masks'),pose:tx('姿态估计','Keypoints'),classify:tx('图像分类','Image classification'),obb:tx('旋转框检测','Oriented boxes')})[t.id])));
 $('size-options').replaceChildren(...['N','S','M','L','X'].map(size=>{const ok=MODELS.some(m=>m.series===state.series&&m.task===state.task&&m.size===size&&m.status==='verified');return button(size,state.size===size,()=>{state.size=size;renderPicker()},!ok||state.loading,!ok?tx('待验证','Unverified'):tx('已验证','Verified'))}));
 $('local-task-options').replaceChildren(...[{id:'auto'},...TASKS].map(t=>button(t.id==='auto'?tx('自动检查','Auto inspect'):t.id,state.localTask===t.id,()=>{state.localTask=t.id;renderPicker()},state.loading)));
 const m=state.source==='online'?currentModel():null;
 $('model-name').textContent=state.source==='local'?($('local-model-input').files[0]?.name||tx('本地 ONNX','Local ONNX')):m?.name||tx('该组合尚未开放','This combination is not available');
 $('model-description').textContent=m?tx('固定版本 ONNX · 模型在你的设备上运行','Pinned ONNX export · Runs on your device'):tx('仅开放经过真实推理验证的模型组合。','Only models verified with real inference are enabled.');
 $('model-size').textContent=prettyBytes(state.source==='online'?m?.bytes:$('local-model-input').files[0]?.size);
 $('model-license').textContent=m?.license||'—';
 $('size-hint').textContent=tx('V1 仅开放已验证的 N 尺寸；其他尺寸正在验证。','V1 enables verified N exports; larger sizes await validation.');
 const sourceLink=$('model-source-link');if(sourceLink){sourceLink.hidden=!m;sourceLink.href=m?.source||'#'}
 $('model-cache-state').textContent=m&&state.cached.includes(m.id)?tx('已缓存 · 可离线加载','Cached · Available offline'):tx('首次使用需要下载','Downloads on first use');
 $('load-model').disabled=state.loading||(state.source==='online'?!m:!$('local-model-input').files.length);
 if(!state.loading)$('load-status').textContent=tx('准备好后，进入工作台。','Choose a model to open the workspace.');
}
async function refreshCache(){try{state.cached=await listCachedModels()}catch{state.cached=[]}renderPicker()}
function applyTheme(value){state.theme=value;storageSet('local-yolo-theme',value);const dark=value==='dark'||(value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';renderSettingsOptions()}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(state.theme==='system')applyTheme('system')});
function renderSettingsOptions(){
 if($('model-inspection'))$('model-inspection').textContent=state.info?JSON.stringify({task:state.info.task,format:state.info.format,inputs:state.info.inputs,outputs:state.info.outputs,fallbackReason:state.info.fallbackReason||undefined},null,2):tx('加载模型后可查看输入和输出。','Load a model to inspect its inputs and outputs.');
 $('language-options').replaceChildren(...[['zh','中文'],['en','English']].map(([id,name])=>button(name,getLanguage()===id,()=>{setLanguage(id);translatePage();renderPicker();renderSettingsOptions();syncMedia();updateModelInfo();refreshStorage()})));
 $('theme-options').replaceChildren(...[['system',tx('跟随系统','System')],['light',tx('浅色','Light')],['dark',tx('深色','Dark')]].map(([id,name])=>button(name,state.theme===id,()=>applyTheme(id))));
 $('backend-options').replaceChildren(...[['auto',tx('自动 · 优先 WebGPU','Auto · WebGPU first')],['wasm','WASM']].map(([id,name])=>button(name,state.backend===id,()=>{state.backend=id;storageSet('local-yolo-backend',id);renderSettingsOptions()})));
}
async function refreshStorage(){
 try{const usage=await cacheUsage();$('storage-status').textContent=`${prettyBytes(usage.usage)} / ${prettyBytes(usage.quota)} · ${usage.persistent?tx('持久存储已授权','Persistent storage granted'):tx('缓存可能被浏览器清理','Browser may evict cached files')}`;
 $('cache-list').replaceChildren(...usage.models.map(m=>{const row=document.createElement('div');row.className='cache-row';const text=document.createElement('span');text.textContent=`${m.name||m.id} · ${prettyBytes(m.bytes)}`;row.append(text,button(tx('删除','Remove'),false,async()=>{await deleteCachedModel(m.id);await refreshCache();await refreshStorage()}));return row}));
 }catch(e){$('storage-status').textContent=e.message}
}
async function loadModel(){
 if(state.loading)return;state.loading=true;renderPicker();$('load-error').hidden=true;$('load-progress').hidden=false;$('load-progress').value=0;
 downloadController=new AbortController();
 try{
  let bytes,config,name;
  if(state.source==='online'){
   config=currentModel();if(!config)throw new Error(tx('该模型组合尚未验证。','This model combination is not verified.'));name=config.name;
   bytes=await getModel(config,{signal:downloadController.signal,onProgress:p=>{
    $('load-progress').value=p.percent??0;$('load-status').textContent=({cache:tx('正在读取缓存…','Reading cache…'),download:tx('正在下载模型','Downloading model'),verify:tx('正在验证模型…','Verifying model…'),'cache-write':tx('正在保存模型缓存…','Saving model cache…'),ready:tx('模型下载完成','Model ready')})[p.phase]+(p.phase==='download'?` · ${prettyBytes(p.received)}${p.total?' / '+prettyBytes(p.total):''}`:'');
   }});
  }else{
   const file=$('local-model-input').files[0];if(!file)throw new Error(tx('请先选择 ONNX 文件。','Choose an ONNX file first.'));
   if(!file.name.toLowerCase().endsWith('.onnx'))throw new Error('Only .onnx files are supported.');
   bytes=new Uint8Array(await file.arrayBuffer());name=file.name;const raw=$('local-labels').value.trim();let labels;
   if(raw){if(raw.startsWith('[')){labels=JSON.parse(raw);if(!Array.isArray(labels)||!labels.every(v=>typeof v==='string'))throw new Error('Labels must be a JSON string array.')}else labels=raw.split(/\n|,/).map(v=>v.trim()).filter(Boolean)}
   config={task:state.localTask,labels};
  }
  $('load-status').textContent=tx('正在初始化推理引擎… 大型模型可能需要更久。','Initializing inference engine… Larger models may take longer.');
  const info=await engine.load(bytes,{...config,backend:state.backend});
  state.model={...config,name};state.info=info;state.lastResult=null;state.lastSnapshot=null;
  $('model-page').hidden=true;$('workbench').hidden=false;updateModelInfo();
  if(bytes.cacheWarning)message(bytes.cacheWarning);
  await setMode('camera');
 }catch(e){if(e.name!=='AbortError')fail(e)}
 finally{state.loading=false;downloadController=null;$('load-progress').hidden=true;await refreshCache()}
}
function updateModelInfo(){
 if(!state.info)return;$('current-model').hidden=false;$('switch-model').hidden=false;$('current-model').textContent=`${state.model.name} · ${state.info.inputWidth}×${state.info.inputHeight}`;
 $('backend-value').textContent=state.info.backend;
 const hasIou=state.info.iouApplicable;$('iou').disabled=!hasIou;$('iou-note').hidden=hasIou;
 $('iou-note').textContent=state.info.task==='classify'?tx('图像分类不使用 IoU。','IoU does not apply to classification.'):tx('端到端模型不使用额外 NMS。','End-to-end models do not use extra NMS.');
 const notice=$('runtime-notice');if(notice){notice.hidden=false;notice.textContent=tx('延迟 = 预处理 + 模型执行 + 后处理；FPS 按已完成推理统计。','Latency = preprocessing + model execution + postprocessing. FPS counts completed inferences.');}
}
function stopLoop(){state.running=false;state.generation++;state.completions=[];$('fps-value').textContent='—';$('run-status').textContent=tx('已暂停','Paused')}
function syncMedia(){
 const camera=state.mode==='camera',active=camera&&media.kind==='camera';
 $('stage-source-label').textContent=camera?tx('摄像头','Camera'):tx('本地文件','Local file');if(state.lastResult)$('result-summary').textContent=`${state.lastResult.items.length} ${tx('个结果','results')} · ${state.lastResult.task}`;
 $('camera-toggle').textContent=active?tx('停止摄像头','Stop camera'):tx('启动摄像头','Start camera');
 $('camera-toggle').hidden=!camera;$('camera-device-button').hidden=!camera;$('mirror-toggle').hidden=!camera;$('zoom-controls').hidden=!camera;$('camera-controls').hidden=!camera;
 $('video-controls').hidden=state.mode!=='file'||media.kind!=='video';
 $('video-play').textContent=video.paused?tx('播放','Play'):tx('暂停','Pause');
 const z=media.zoomInfo||{min:1,max:4,value:1,native:false};
 $('zoom-range').min=z.min??1;$('zoom-range').max=z.max??4;$('zoom-range').step=z.step??.1;$('zoom-range').value=z.value??1;
 $('zoom-label').textContent=`${Number(z.value??1).toFixed(1)}× · ${z.mode==='native'?tx('原生倍率','Native zoom'):tx('数字裁切','Digital crop')}`;
 $('zoom-shortcuts').replaceChildren(...[z.min??1,2,3].filter((v,i,a)=>v<=(z.max??4)&&v>=(z.min??1)&&a.indexOf(v)===i).map(v=>button(`${v}×`,false,()=>changeZoom(v))));
 $('run-status').textContent=state.running?tx('正在推理','Running'):tx('已暂停','Paused');$('save-image').disabled=!state.lastSnapshot;$('save-json').disabled=!state.lastResult;
}
async function updateDevices(){
 try{const devices=await media.listCameras();$('camera-device-menu').replaceChildren(...devices.map((d,i)=>button(d.label||`${tx('摄像头','Camera')} ${i+1}`,false,async()=>{$('camera-device-menu').hidden=true;await startCamera(d.deviceId)})));$('camera-device-button').disabled=!devices.length}
 catch(e){console.warn(e)}
}
async function startCamera(id){
 stopLoop();const generation=state.generation;message(tx('正在请求摄像头权限…','Requesting camera permission…'));
 try{await waitIdle();if(generation!==state.generation)return;await media.startCamera(id);if(generation!==state.generation||state.mode!=='camera'||!state.info)return;$('stage-empty').hidden=true;message('');await updateDevices();syncMedia();startLoop()}
 catch(e){if(generation!==state.generation)return;fail(e,'media');$('stage-empty').hidden=false;syncMedia()}
}
async function setMode(mode){
 stopLoop();await waitIdle();media.release();
 state.mode=mode;state.lastResult=null;state.lastSnapshot=null;$('overlay-canvas').hidden=true;$('stage-empty').hidden=false;
 for(const [id,value] of [['mode-camera',mode==='camera'],['mode-file',mode==='file']]){$(id).setAttribute('aria-selected',String(value));$(id).classList.toggle('active',value)}
 $('stage-source-label').textContent=mode==='camera'?tx('摄像头','Camera'):tx('本地文件','Local file');$('stage-empty-title').textContent=mode==='camera'?tx('实时视觉工作台','Live vision workspace'):tx('在本地识别你的文件','See your files locally');$('choose-file-empty').hidden=mode!=='file';
 $('camera-start').hidden=mode!=='camera';$('choose-file').hidden=mode!=='file';
 syncMedia();message(mode==='camera'?tx('允许摄像头访问后，即可开始实时检测。','Allow camera access to start live inference.'):tx('选择图片或视频。文件只在本机处理。','Choose an image or video. Files stay on this device.'));
 // After a successful model load, entering the default camera workspace requests access.
 if(mode==='camera'&&state.info)await startCamera();
}
async function waitIdle(){while(state.busy)await new Promise(resolve=>setTimeout(resolve,25))}
function sourceSize(source){return {width:source.videoWidth||source.naturalWidth||source.width,height:source.videoHeight||source.naturalHeight||source.height}}
async function inferFrame(generation=state.generation){
 if(state.busy||!state.info)return;
 const source=media.source;if(!source)return;const dims=sourceSize(source);if(!dims.width||!dims.height)return;
 if(source.tagName==='VIDEO'&&source.readyState<2)return;
 state.busy=true;
 try{
  const snapshot=snapshots.find(frame=>frame!==state.lastSnapshot);
  const scale=Math.min(1,1920/Math.max(dims.width,dims.height));snapshot.width=Math.round(dims.width*scale);snapshot.height=Math.round(dims.height*scale);snapshot.getContext('2d',{alpha:false}).drawImage(source,0,0,snapshot.width,snapshot.height);
  const rawCrop=media.getCrop();const crop=rawCrop?{x:rawCrop.x*scale,y:rawCrop.y*scale,width:rawCrop.width*scale,height:rawCrop.height*scale}:undefined;
  const result=await engine.infer(snapshot,{confidence:Number($('confidence').value),iou:Number($('iou').value),crop});
  if(generation!==state.generation)return;
  result.coordinateSpace={width:snapshot.width,height:snapshot.height,originalWidth:dims.width,originalHeight:dims.height,scale};state.lastResult=result;state.lastSnapshot=snapshot;state.lastCrop=crop;
  const now=performance.now();state.completions.push(now);state.completions=state.completions.filter(v=>now-v<2000);
  const n=state.completions.length;$('fps-value').textContent=n>1?((n-1)*1000/(now-state.completions[0])).toFixed(1):'—';$('latency-value').textContent=Number(result.latency).toFixed(0);
  drawLast();$('stage-empty').hidden=true;$('overlay-canvas').hidden=false;
  const summary=$('result-summary');if(summary){summary.hidden=false;summary.textContent=`${result.items.length} ${tx('个结果','results')} · ${result.task}`;}
  $('save-image').disabled=false;$('save-json').disabled=false;
 }catch(e){stopLoop();fail(e,'media')}
 finally{state.busy=false}
}
function drawLast(){if(state.lastSnapshot)renderFrame($('overlay-canvas'),state.lastSnapshot,state.lastResult,{showResults:$('show-results').checked,mirror:state.mode==='camera'&&state.mirror,crop:state.lastCrop})}
function startLoop(){if(state.running)return;state.running=true;$('run-status').textContent=tx('正在推理','Running');const generation=++state.generation;
 const tick=async()=>{if(!state.running||generation!==state.generation)return;if(!document.hidden&&!(media.kind==='video'&&video.paused))await inferFrame(generation);if(state.running&&generation===state.generation)requestAnimationFrame(tick)};requestAnimationFrame(tick)
}
async function loadMediaFile(file){
 if(!file)return;stopLoop();message(tx('正在读取文件…','Reading file…'));try{await waitIdle();const result=await media.loadFile(file);state.lastResult=null;$('stage-empty').hidden=true;syncMedia();message('');if(result.kind==='video'){await video.play();startLoop()}else await inferFrame()}
 catch(e){fail(e,'media');$('stage-empty').hidden=false}
}
async function changeZoom(value){try{await media.setZoom(Number(value));syncMedia();if(!state.running&&media.source)await inferFrame()}catch(e){fail(e,'media')}}
async function switchModel(){
 stopLoop();downloadController?.abort();await waitIdle();media.release();await engine.dispose();engine=new EngineClient();state.info=null;state.model=null;state.lastResult=null;state.lastSnapshot=null;$('latency-value').textContent='—';$('backend-value').textContent='—';$('workbench').hidden=true;$('model-page').hidden=false;$('current-model').hidden=true;$('switch-model').hidden=true;await refreshCache()
}
function downloadJson(){if(!state.lastResult)return;const blob=new Blob([JSON.stringify({model:state.model.name,backend:state.info.backend,capturedAt:new Date().toISOString(),...state.lastResult},null,2)],{type:'application/json'});const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download='local-yolo-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
async function toggleFullscreen(){
 const stage=$('stage');
 if(document.fullscreenElement){await document.exitFullscreen();return}
 if(stage.classList.contains('fullscreen-fallback')){stage.classList.remove('fullscreen-fallback');document.body.classList.remove('stage-fullscreen');return}
 try{if(stage.requestFullscreen){await stage.requestFullscreen();return}}catch{}
 stage.classList.add('fullscreen-fallback');document.body.classList.add('stage-fullscreen');
}
$('source-online').onclick=()=>{state.source='online';renderPicker()};$('source-local').onclick=()=>{state.source='local';renderPicker()};
$('local-model-input').onchange=()=>{$('local-file-name').textContent=$('local-model-input').files[0]?.name||'';renderPicker()};$('load-model').onclick=loadModel;$('switch-model').onclick=switchModel;
$('theme-toggle').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
$('settings-open').onclick=()=>{renderSettingsOptions();refreshStorage();$('settings-dialog').showModal()};$('settings-close').onclick=()=>$('settings-dialog').close();$('settings-dialog').addEventListener('click',e=>{if(e.target===$('settings-dialog'))$('settings-dialog').close()});
$('cache-clear').onclick=async()=>{for(const id of await listCachedModels())await deleteCachedModel(id);await refreshCache();await refreshStorage()};
$('mode-camera').onclick=()=>setMode('camera');$('mode-file').onclick=()=>setMode('file');
$('camera-start').onclick=()=>startCamera();$('camera-toggle').onclick=async()=>{if(media.kind==='camera'){stopLoop();media.stopCamera();message(tx('摄像头已停止。','Camera stopped.'));syncMedia()}else await startCamera()};
$('camera-device-button').onclick=async()=>{await updateDevices();$('camera-device-menu').hidden=!$('camera-device-menu').hidden;$('camera-device-button').setAttribute('aria-expanded',String(!$('camera-device-menu').hidden))};
$('mirror-toggle').onclick=()=>{state.mirror=!state.mirror;$('mirror-toggle').setAttribute('aria-pressed',String(state.mirror));drawLast()};$('zoom-range').oninput=e=>changeZoom(e.target.value);$('fullscreen-toggle').onclick=toggleFullscreen;
$('choose-file').onclick=()=>$('file-input').click();$('choose-file-empty').onclick=()=>$('file-input').click();$('file-input').onchange=async()=>{await loadMediaFile($('file-input').files[0]);$('file-input').value=''};
$('video-play').onclick=async()=>{if(video.paused){await video.play();startLoop()}else{video.pause();stopLoop()}syncMedia()};
$('video-restart').onclick=async()=>{video.currentTime=0;await video.play();startLoop();syncMedia()};
for(const key of ['confidence','iou']){$(key).oninput=()=>{$(key+'-value').textContent=Number($(key).value).toFixed(2)};$(key).onchange=()=>{if(!state.running&&media.source)inferFrame()}}
$('show-results').onchange=drawLast;$('save-image').onclick=()=>saveFrame($('overlay-canvas'),'local-yolo-result.png');$('save-json').onclick=downloadJson;
const install=$('install-app');if(install&&/iPhone|iPad|iPod/.test(navigator.userAgent))install.hidden=false;if(install)install.onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;install.hidden=true}else message(tx('iPhone / iPad：在 Safari 分享菜单中选择“添加到主屏幕”。','iPhone / iPad: In Safari, choose Share → Add to Home Screen.'))};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;if(install)install.hidden=false});
window.addEventListener('appinstalled',()=>{installPrompt=null;if(install)install.hidden=true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopLoop();if(media.kind==='camera'){media.stopCamera();message(tx('应用进入后台，摄像头已停止。点击启动以继续。','Camera stopped while in background. Start it again to continue.'));syncMedia()}else video.pause()}});
window.addEventListener('pagehide',()=>{stopLoop();media.dispose();engine.dispose()});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
document.addEventListener('fullscreenchange',()=>{$('fullscreen-toggle').title=document.fullscreenElement?tx('退出全屏','Exit fullscreen'):tx('全屏','Fullscreen');$('fullscreen-toggle').setAttribute('aria-label',$('fullscreen-toggle').title)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('stage').classList.remove('fullscreen-fallback');document.body.classList.remove('stage-fullscreen')}});
const inspectionSection=document.createElement('section');inspectionSection.className='settings-section';const inspectionTitle=document.createElement('h3');inspectionTitle.textContent='ONNX · Inputs / Outputs';const inspection=document.createElement('pre');inspection.id='model-inspection';inspection.className='model-inspection';inspectionSection.append(inspectionTitle,inspection);$('settings-dialog').querySelector('.settings-body').append(inspectionSection);
translatePage();applyTheme(state.theme);refreshCache();syncMedia();
if('serviceWorker'in navigator&&!import.meta.env.DEV)navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL}).catch(e=>console.warn('Offline cache unavailable:',e));
