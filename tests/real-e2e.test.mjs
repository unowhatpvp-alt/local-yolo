// Supplementary genuine YOLO26 end-to-end exports, separate from the pinned
// online raw-head catalog. Source: prithivMLmods/YOLO26-ONNX at immutable
// c526dae7a5a5b4f1d79d704903b4406011da2716, AGPL-3.0, exported8.4.100.
// Input/output dimensions below come from actual ONNX signatures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const directory=new URL('./fixtures/yolo26-e2e/',import.meta.url);
const cases=[
  {suffix:'',task:'detect',width:640,height:640,shape:[1,300,6],hash:'00e2d1062178fca312fee35cf5fc9b9c783b3e5c9675d48b84929f69ee391807'},
  {suffix:'-seg',task:'segment',width:640,height:640,shape:[1,300,38],hash:'a49edf10356c0be2452c6f398c39c1284390f7506c322c9055d60974648f8852'},
  {suffix:'-pose',task:'pose',width:640,height:640,shape:[1,300,57],hash:'e179a0151931938003168042a0e385305509b3c9d76f475ca74bf66dfe19c287'},
  {suffix:'-obb',task:'obb',width:640,height:640,shape:[1,300,7],hash:'e5b56fd9efa3f7317498f5ad91cfef20b709d614614188e7f3563ab793b99a4e'},
  {suffix:'-cls',task:'classify',width:224,height:224,shape:[1,1000],hash:'1323630be528baebcaf4d831fde58853d9e70628a78aef898695dedcb070e2f8'},
];
// Reproduce independently without changing the online catalog:
// FETCH_E2E_FIXTURES=1 node --test tests/real-e2e.test.mjs
if(process.env.FETCH_E2E_FIXTURES==='1') {
  await mkdir(directory,{recursive:true});
  for(const c of cases) {
    const name=`yolo26n${c.suffix}`,file=new URL(`${name}.onnx`,directory);
    try{if(createHash('sha256').update(await readFile(file)).digest('hex')===c.hash)continue;}catch{/* Fetch missing/invalid fixture. */}
    const response=await fetch(`https://huggingface.co/prithivMLmods/YOLO26-ONNX/resolve/c526dae7a5a5b4f1d79d704903b4406011da2716/${name}/${name}.onnx`,{signal:AbortSignal.timeout(60000),credentials:'omit'});
    if(!response.ok)throw new Error(`E2E fixture ${name}: HTTP ${response.status}`);
    const bytes=new Uint8Array(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'),c.hash,`${name} download integrity`);
    await writeFile(file,bytes);
  }
  for(const [name,url,hash] of [
    ['bus.jpg','https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg','c02019c4979c191eb739ddd944445ef408dad5679acab6fd520ef9d434bfbc63'],
    ['boats.jpg','https://github.com/ultralytics/assets/releases/download/v0.0.0/boats.jpg','8c5ada657cf8110a9f8aaac954c1dd96cde0187315b581276c32b0d1863e756f'],
  ]) {
    const file=new URL(`./fixtures/${name}`,import.meta.url);
    try{if(createHash('sha256').update(await readFile(file)).digest('hex')===hash)continue;}catch{/* Fetch fixture. */}
    const response=await fetch(url,{signal:AbortSignal.timeout(60000),credentials:'omit'});
    if(!response.ok)throw new Error(`E2E image ${name}: HTTP ${response.status}`);
    const bytes=new Uint8Array(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,`${name} integrity`);
    await writeFile(file,bytes);
  }
}
let available=true;try{for(const c of cases)await access(new URL(`yolo26n${c.suffix}.onnx`,directory));}catch{available=false;}

test('genuine YOLO26 N end-to-end exports run all five tasks on real images',{skip:!available,timeout:180000},async()=>{
  const {Canvas,loadImage}=await import('@napi-rs/canvas');
  globalThis.OffscreenCanvas=Canvas;
  const {YoloEngine}=await import('../src/core/engine.js');
  const bus=await loadImage(fileURLToPath(new URL('./fixtures/bus.jpg',import.meta.url)));
  const boats=await loadImage(fileURLToPath(new URL('./fixtures/boats.jpg',import.meta.url)));
  const evidence=[];
  for(const c of cases) {
    const bytes=await readFile(new URL(`yolo26n${c.suffix}.onnx`,directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),c.hash);
    const engine=new YoloEngine();
    try {
      const info=await engine.load(bytes,{backend:'wasm'});
      assert.equal(info.task,c.task);assert.equal(info.inputWidth,c.width);assert.equal(info.inputHeight,c.height);
      assert.match(info.metadata.description,/YOLO26/);assert.deepEqual(info.outputs[0].dims,c.shape);
      assert.equal(info.format,c.task==='classify'?'ultralytics-classification':'ultralytics-end-to-end');
      assert.equal(info.iouApplicable,false);
      const result=await engine.infer(c.task==='obb'?boats:bus,{confidence:c.task==='classify'?.01:.25});
      assert(result.items.length>0,`${c.task} must return genuine nonempty predictions`);
      assert(result.items.every(i=>Number.isFinite(i.score)&&i.score>=0&&i.score<=1));
      if(c.task==='detect')assert(result.items.some(i=>i.label==='bus'));
      if(c.task==='segment')assert(result.items.some(i=>i.mask.data.some(v=>v===255)));
      if(c.task==='pose')assert(result.items.some(i=>i.keypoints.length===17&&i.keypoints.some(p=>p.score>.5)));
      if(c.task==='obb')assert(result.items.some(i=>i.label==='ship'&&i.polygon.length===4));
      evidence.push({task:c.task,shape:c.shape,count:result.items.length,top:result.items.slice(0,3).map(i=>({label:i.label,score:Number(i.score.toFixed(4))}))});
    }finally{await engine.dispose();}
  }
  console.log('REAL_YOLO26_E2E_EVIDENCE',JSON.stringify(evidence));
});
