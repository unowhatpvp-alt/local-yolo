import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MediaController,mediaErrorMessage} from '../src/core/media.js';
import {renderFrame} from '../src/core/render.js';
import {getModel} from '../src/core/model-cache.js';
import {MODELS} from '../src/core/catalog.js';

class FakeMedia extends EventTarget {
 constructor(){super();this.readyState=2;this.videoWidth=1280;this.videoHeight=720;this.naturalWidth=640;this.naturalHeight=480;this.complete=true;this.paused=true;this.attributes={}}
 setAttribute(k,v){this.attributes[k]=v}
 removeAttribute(k){delete this.attributes[k];if(k==='src')this.src=''}
 pause(){this.paused=true}
 async play(){this.paused=false}
 load(){}
}
function environment(mediaDevices){
 const nav=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices,userAgent:'Unit-test Desktop',platform:'Linux',maxTouchPoints:0}});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{}}});
 return ()=>{nav?Object.defineProperty(globalThis,'navigator',nav):delete globalThis.navigator;storage?Object.defineProperty(globalThis,'localStorage',storage):delete globalThis.localStorage};
}
function track({native=false}={}){const t=new EventTarget();t.stopped=0;t.settings={deviceId:'usb-test',zoom:1};t.stop=()=>{t.stopped++};t.getSettings=()=>t.settings;t.getCapabilities=()=>native?{zoom:{min:1,max:3,step:.1}}:{};t.applyConstraints=async opts=>{t.settings.zoom=opts.advanced[0].zoom};return t}
function stream(t){return {getTracks:()=>[t],getVideoTracks:()=>[t]}}

test('camera release stops tracks and digital crop remains source-aligned',async()=>{
 const devices=new EventTarget();const t=track();devices.getUserMedia=async()=>stream(t);devices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'usb-test',label:'USB'}];
 const restore=environment(devices);const media=new MediaController(new FakeMedia(),new FakeMedia());
 try{await media.startCamera();assert.equal(media.kind,'camera');assert.equal(media.zoomInfo.mode,'digital');await media.setZoom(2);assert.deepEqual(media.getCrop(),{x:320,y:180,width:640,height:360});media.release();assert.equal(t.stopped,1);assert.equal(media.source,null);assert.equal(media.video.srcObject,null)}finally{media.dispose();restore()}
});

test('native zoom constraints preserve full source crop',async()=>{
 const devices=new EventTarget();const t=track({native:true});devices.getUserMedia=async()=>stream(t);devices.enumerateDevices=async()=>[];
 const restore=environment(devices);const media=new MediaController(new FakeMedia(),new FakeMedia());
 try{await media.startCamera();await media.setZoom(9);assert.equal(t.settings.zoom,3);assert.equal(media.zoomInfo.mode,'native');assert.deepEqual(media.getCrop(),{x:0,y:0,width:1280,height:720})}finally{media.dispose();restore()}
});

test('camera permission failure is actionable in both languages',async()=>{
 const devices=new EventTarget();devices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')};
 const restore=environment(devices);const media=new MediaController(new FakeMedia(),new FakeMedia());
 try{await assert.rejects(media.startCamera(),e=>{assert.equal(e.code,'permission');assert.match(mediaErrorMessage(e,'zh'),/权限被拒绝/);assert.match(mediaErrorMessage(e,'en'),/denied/);return true});assert.equal(media.source,null)}finally{media.dispose();restore()}
});

test('cancelled camera acquisition releases a late stream',async()=>{
 const devices=new EventTarget();let finish;const t=track();devices.getUserMedia=()=>new Promise(r=>{finish=r});
 const restore=environment(devices);const media=new MediaController(new FakeMedia(),new FakeMedia());
 try{const pending=media.startCamera();media.release();finish(stream(t));await assert.rejects(pending,e=>e.code==='cancelled');assert.equal(t.stopped,1);assert.equal(media.stream,null)}finally{media.dispose();restore()}
});

test('device change continues across release and stops after final dispose',async()=>{
 const devices=new EventTarget();let changes=0;devices.enumerateDevices=async()=>[];
 const restore=environment(devices);const media=new MediaController(new FakeMedia(),new FakeMedia(),{onDeviceChange:()=>changes++});
 try{media.release();devices.dispatchEvent(new Event('devicechange'));await new Promise(r=>setImmediate(r));assert.equal(changes,1);media.dispose();devices.dispatchEvent(new Event('devicechange'));await new Promise(r=>setImmediate(r));assert.equal(changes,1)}finally{media.dispose();restore()}
});

test('crop and mirror are applied once to actual overlay geometry',()=>{
 const rectangles=[];const draws=[];
 const canvas={width:0,height:0};const ctx={canvas,save(){},restore(){},translate(){},scale(){},drawImage(...args){draws.push(args)},strokeRect(...args){rectangles.push(args)},measureText(){return {width:40}},fillRect(){},fillText(){}};canvas.getContext=()=>ctx;
 const source={width:1280,height:720};
 renderFrame(canvas,source,{task:'detect',sourceWidth:1280,sourceHeight:720,items:[{classId:0,label:'person',score:.9,box:{x:400,y:220,width:100,height:80}}]},{crop:{x:320,y:180,width:640,height:360},mirror:true});
 assert.deepEqual([canvas.width,canvas.height],[640,360]);assert.deepEqual(draws[0].slice(1),[320,180,640,360,0,0,640,360]);assert.deepEqual(rectangles,[[460,40,100,80]]);
});

const fixture=await readFile(new URL('./fixtures/yolo26/yolo26n.onnx',import.meta.url)).catch(()=>null);
test('real pinned ONNX bytes survive streaming and SHA-256 integrity verification',{skip:!fixture},async()=>{
 const originalFetch=globalThis.fetch;const model={...MODELS.find(m=>m.task==='detect'&&m.size==='N'),status:'verified'};
 globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){for(let i=0;i<fixture.length;i+=137111)controller.enqueue(new Uint8Array(fixture.subarray(i,i+137111)));controller.close()}}));
 try{const stages=[];const bytes=await getModel(model,{onProgress:p=>stages.push(p.phase)});assert.deepEqual(bytes,new Uint8Array(fixture));assert.ok(stages.includes('verify'));assert.ok(stages.includes('ready'));assert.ok(bytes.cacheWarning)}finally{globalThis.fetch=originalFetch}
});

test('corrupt real ONNX bytes fail integrity before model initialization',{skip:!fixture},async()=>{
 const originalFetch=globalThis.fetch;const damaged=Uint8Array.from(fixture);damaged[damaged.length-1]^=1;const model={...MODELS.find(m=>m.task==='detect'&&m.size==='N'),status:'verified'};
 globalThis.fetch=async()=>new Response(damaged);
 try{await assert.rejects(getModel(model),/integrity check failed/)}finally{globalThis.fetch=originalFetch}
});

test('an aborted download does not make a network request',async()=>{
 const originalFetch=globalThis.fetch;let requested=false;globalThis.fetch=async()=>{requested=true;throw new Error('unexpected')};const controller=new AbortController();controller.abort();
 try{await assert.rejects(getModel({...MODELS[0],status:'verified'},{signal:controller.signal}),e=>e.name==='AbortError');assert.equal(requested,false)}finally{globalThis.fetch=originalFetch}
});

test('switching uploaded images releases prior blob URLs without storing media',async()=>{
 const devices=new EventTarget();const restore=environment(devices);const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
 let next=0;const revoked=[];URL.createObjectURL=()=>`blob:test-${++next}`;URL.revokeObjectURL=url=>revoked.push(url);
 const media=new MediaController(new FakeMedia(),new FakeMedia());
 try{const first=new File([new Uint8Array([0xff,0xd8,0xff])],'first.jpg',{type:'image/jpeg'});const second=new File([new Uint8Array([0xff,0xd8,0xff])],'second.jpg',{type:'image/jpeg'});await media.loadFile(first);assert.equal(media.kind,'image');await media.loadFile(second);assert.deepEqual(revoked,['blob:test-1']);assert.equal(media.objectURL,'blob:test-2');media.release();assert.deepEqual(revoked,['blob:test-1','blob:test-2']);assert.equal(media.source,null)}finally{media.dispose();URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;restore()}
});

test('camera hardware disconnect releases stream and notifies UI',async()=>{
 const devices=new EventTarget();const t=track();devices.getUserMedia=async()=>stream(t);devices.enumerateDevices=async()=>[];
 const restore=environment(devices);let ended=0;const media=new MediaController(new FakeMedia(),new FakeMedia(),{onEnded:()=>ended++});
 try{await media.startCamera();t.dispatchEvent(new Event('ended'));assert.equal(ended,1);assert.equal(t.stopped,1);assert.equal(media.source,null)}finally{media.dispose();restore()}
});
