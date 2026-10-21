import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdapter,decodeOutputs,letterboxGeometry,sourcePoint,nonMaxSuppression,polygonIou,rotatedPolygon} from '../src/core/adapters.js';
import {inspectOnnx,parseLabels} from '../src/core/onnx-info.js';

test('letterbox restores original pixels and digital crop offsets without stretching',()=>{
  const t=letterboxGeometry(1920,1080,640,480,{x:480,y:270,width:960,height:540});
  assert.deepEqual(sourcePoint(t.padX,t.padY,t),{x:480,y:270});
  const bottom=sourcePoint(t.padX+t.resizedWidth,t.padY+t.resizedHeight,t);
  assert.equal(bottom.x,1440);assert.equal(bottom.y,810);
  assert.throws(()=>letterboxGeometry(1920,1080,640,480,{x:-1,y:0,width:10,height:10}),/outside/);
});

test('class-aware NMS keeps distinct classes and rotated IoU respects angle',()=>{
  const a={classId:0,score:.9,box:{x:0,y:0,width:10,height:10}};
  const b={classId:0,score:.8,box:{x:1,y:1,width:10,height:10}};
  const c={...b,classId:1};
  assert.deepEqual(nonMaxSuppression([b,c,a],.45),[a,c]);
  const x=rotatedPolygon(0,0,20,2,0),y=rotatedPolygon(0,0,20,2,Math.PI/2);
  assert(polygonIou(x,x)>.999);assert(polygonIou(x,y)<.1);
});

test('two-class raw output [1,6,N] is not confused with NMS rows',()=>{
  const tensor={type:'float32',dims:[1,6,100],data:new Float32Array(600)};
  const adapter=createAdapter({out:tensor},{task:'detect',names:"{0: 'a', 1: 'b'}"});
  assert.equal(adapter.format,'ultralytics-raw');assert.equal(adapter.classes,2);
  assert.throws(()=>createAdapter({out:tensor},{task:'detect',names:"{0: 'a'}"}),/Objectness/);
  assert.throws(()=>createAdapter({out:{type:'float32',dims:[1,85,8400],data:new Float32Array(85*8400)}},{},{task:'detect'}),/no class names/);
});

test('unsupported logits, ambiguous outputs and truncation fail with useful errors',()=>{
  assert.throws(()=>inspectOnnx(new Uint8Array(4)),/too small/);
  assert.throws(()=>createAdapter({out:{type:'float32',dims:[1,30,100],data:new Float32Array(3000)}}),/Cannot safely infer/);
  const out={type:'float32',dims:[1,2],data:Float32Array.from([2,-1])};
  const a=createAdapter({out},{task:'classify'});
  assert.throws(()=>decodeOutputs({out},a,null),/not a probability/);
  assert.deepEqual(parseLabels("{0: 'person', 1: 'traffic light'}"),['person','traffic light']);
  assert.deepEqual(parseLabels('{"0":"a","1":"b"}'),['a','b']);
});

test('raw output boxes and pose keypoints map to the same uncropped source frame',()=>{
  const t=letterboxGeometry(1600,900,640,480);
  const data=new Float32Array(56*100);
  const put=(c,v)=>data[c*100]=v;
  put(0,320);put(1,240);put(2,160);put(3,240);put(4,.9);
  for(let i=0;i<17;i++){put(5+i*3,320);put(6+i*3,240);put(7+i*3,.8);}
  const tensor={type:'float32',dims:[1,56,100],data};
  const adapter=createAdapter({out:tensor},{task:'pose',names:"{0:'person'}",kpt_shape:'[17,3]'});
  const items=decodeOutputs({out:tensor},adapter,t);
  assert.equal(items.length,1);assert.equal(items[0].box.x,600);assert.equal(items[0].box.y,150);
  assert.equal(items[0].keypoints[0].x,800);assert.equal(items[0].keypoints[0].y,450);
});

test('segmentation raster occupies the original source box after letterbox and crop',()=>{
  const t=letterboxGeometry(800,400,640,480,{x:200,y:100,width:400,height:200});
  const data=new Float32Array(6*100);
  for(const [c,v] of [[0,320],[1,240],[2,160],[3,160],[4,.9],[5,1]])data[c*100]=v;
  const out={type:'float32',dims:[1,6,100],data};
  const proto={type:'float32',dims:[1,1,4,4],data:new Float32Array(16).fill(1)};
  const adapter=createAdapter({out,proto},{task:'segment',names:"{0:'object'}"});
  const items=decodeOutputs({out,proto},adapter,t);
  assert.equal(items.length,1);
  assert.deepEqual(items[0].mask.box,{x:350,y:150,width:100,height:100});
  assert(items[0].mask.data.every(v=>v===255));
});

test('end-to-end OBB rows retain center xywh geometry instead of detection xyxy',()=>{
  const tensor={type:'float32',dims:[1,1,7],data:Float32Array.from([320,240,160,80,.9,0,Math.PI/2])};
  const adapter=createAdapter({out:tensor},{task:'obb',end2end:'True',names:"{0:'ship'}",head:'OBB26'});
  assert.equal(adapter.format,'ultralytics-end-to-end');assert.equal(adapter.iouApplicable,false);
  const result=decodeOutputs({out:tensor},adapter,letterboxGeometry(640,480,640,480));
  assert.equal(result.length,1);assert.equal(result[0].polygon.length,4);
  assert(Math.abs(result[0].box.width-80)<.001);assert(Math.abs(result[0].box.height-160)<.001);
  assert(Math.abs(result[0].box.x-280)<.001);assert(Math.abs(result[0].box.y-160)<.001);
});

test('end-to-end pose and segmentation decode task extras for small max_det',()=>{
  const pose={type:'float32',dims:[1,1,9],data:Float32Array.from([100,100,200,200,.9,0,150,150,.8])};
  const a=createAdapter({out:pose},{task:'pose',names:"{0:'person'}",end2end:'true',kpt_shape:'[1,3]'});
  const t=letterboxGeometry(640,480,640,480),items=decodeOutputs({out:pose},a,t);
  assert.deepEqual(items[0].box,{x:100,y:100,width:100,height:100});
  assert.equal(items[0].keypoints[0].x,150);
  const out={type:'float32',dims:[1,1,7],data:Float32Array.from([100,100,200,200,.9,0,1])};
  const proto={type:'float32',dims:[1,1,4,4],data:new Float32Array(16).fill(1)};
  const b=createAdapter({out,proto},{task:'segment',names:"{0:'object'}",end2end:'True'});
  assert(decodeOutputs({out,proto},b,t)[0].mask.data.every(v=>v===255));
});

test('inconsistent end-to-end flags, malformed pose shapes and fractional classes are rejected',()=>{
  assert.throws(()=>createAdapter({out:{type:'float32',dims:[1,84,8400],data:new Float32Array(84*8400)}},{task:'detect',end2end:'True'}),/consistent head metadata/);
  assert.throws(()=>createAdapter({out:{type:'float32',dims:[1,56,100],data:new Float32Array(5600)}},{task:'pose',kpt_shape:'bad'}),/invalid JSON/);
  const out={type:'float32',dims:[1,1,6],data:Float32Array.from([10,10,20,20,.9,.4])};
  const adapter=createAdapter({out},{task:'detect',end2end:'True',names:"{0:'person'}"});
  assert.equal(decodeOutputs({out},adapter,letterboxGeometry(100,100,640,640)).length,0);
});
