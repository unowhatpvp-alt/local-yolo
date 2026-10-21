// Optional integration suite: fixture ONNX binaries are downloaded explicitly
// from catalog source URLs. No generated detections or mock sessions are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=new URL('./fixtures/',import.meta.url);
let fixtures=true;
try{await access(new URL('yolo11n.onnx',root));}catch{fixtures=false;}

test('real YOLO11 N five task ONNX models initialize and infer real images',{skip:!fixtures,timeout:180000},async()=>{
  const {Canvas,loadImage}=await import('@napi-rs/canvas');
  globalThis.OffscreenCanvas=Canvas;
  const {YoloEngine}=await import('../src/core/engine.js');
  const bus=await loadImage(fileURLToPath(new URL('bus.jpg',root)));
  const boats=await loadImage(fileURLToPath(new URL('boats.jpg',root)));
  const results=[];
  for(const [suffix,task,source] of [['','detect',bus],['-seg','segment',bus],['-pose','pose',bus],['-cls','classify',bus],['-obb','obb',boats]]) {
    const engine=new YoloEngine();
    try {
      const info=await engine.load(await readFile(new URL(`yolo11n${suffix}.onnx`,root)),{backend:'wasm'});
      assert.equal(info.task,task);assert.equal(info.inputWidth,640);assert.equal(info.inputHeight,480);
      const result=await engine.infer(source,{confidence:task==='classify'?.01:.25,iou:.45});
      assert(result.latency>0&&Number.isFinite(result.latency));
      assert(result.items.length>0,`${task}: expected real nonempty image result`);
      assert(result.items.every(item=>item.score>=0&&item.score<=1&&typeof item.label==='string'));
      if(task==='detect')assert(result.items.some(item=>item.label==='bus'));
      if(task==='segment')assert(result.items.some(item=>item.mask?.data.some(v=>v>0)));
      if(task==='pose')assert(result.items.some(item=>item.keypoints.length===17&&item.keypoints.some(k=>k.score>.5)));
      if(task==='obb')assert(result.items.some(item=>item.label==='ship'&&item.polygon.length===4));
      for(const item of result.items)if(item.box&&task!=='obb') {
        assert(item.box.x>=0&&item.box.y>=0);
        assert(item.box.x+item.box.width<=source.width+.1);
        assert(item.box.y+item.box.height<=source.height+.1);
      }
      results.push({task,format:info.format,input:[info.inputHeight,info.inputWidth],count:result.items.length,top:result.items.slice(0,3).map(i=>({label:i.label,score:Number(i.score.toFixed(4))})),latency:Number(result.latency.toFixed(1))});
      if(task==='detect') {
        const zoom=await engine.infer(source,{confidence:.25,crop:{x:source.width/4,y:source.height/4,width:source.width/2,height:source.height/2}});
        assert(zoom.items.length>0,'Digital crop should produce real detections');
        assert(zoom.items.every(i=>i.box.x>=source.width/4-.1&&i.box.y>=source.height/4-.1));
      }
    }finally{await engine.dispose();}
  }
  console.log('REAL_INFERENCE_EVIDENCE',JSON.stringify(results));
});
