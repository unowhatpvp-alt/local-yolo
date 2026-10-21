// Compare genuine rectangular and standard-resolution classification exports.
// This is a reproducible diagnostic, not a claim of benchmark accuracy.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Canvas,loadImage} from '@napi-rs/canvas';
import * as ort from 'onnxruntime-web/webgpu';
import {inspectOnnx} from '../src/core/onnx-info.js';
globalThis.OffscreenCanvas=Canvas;
const {YoloEngine}=await import('../src/core/engine.js');
const fixtures=JSON.parse(await readFile('tests/fixtures/yolo26/classification-fixtures.json','utf8'));
const images=await Promise.all(fixtures.map(async f=>({...f,image:await loadImage(`tests/fixtures/yolo26/${f.file}`)})));
const nativeReferences=[
  {file:'tests/fixtures/bus.jpg',expectedLabels:['minibus','trolleybus','school_bus'],scope:'Official native-resolution bus scene; verify meaningful bus-family classification'},
  {file:'tests/fixtures/yolo26/classification.jpg',expectedLabels:['goldfish'],scope:'Original tiny labeled goldfish reference; preserve observed score'},
];
for(const reference of nativeReferences)reference.image=await loadImage(reference.file);
const directories=process.argv.slice(2).length?process.argv.slice(2):['tests/fixtures/yolo26-classify224'];
const evidence={recordedAt:new Date().toISOString(),scope:'10 labeled held-out ImageNet10 images; diagnostic only, not a validation-set benchmark',preprocessing:{square:'RGB center crop preserving aspect, resize to fixed square, NCHW float32 /255',rectangular:'RGB resize to exact exported H×W, NCHW float32 /255',reference:'https://github.com/ultralytics/ultralytics/blob/v8.4.100/ultralytics/data/augment.py'},rows:[]};
for(const directory of directories)for(const size of ['n','s','m','l','x']) {
  const name=`yolo26${size}-cls`,bytes=await readFile(`${directory}/${name}.onnx`),graph=inspectOnnx(bytes),engine=new YoloEngine();
  const row={directory,model:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),inputs:graph.inputs,outputs:graph.outputs,description:graph.metadata.description,version:graph.metadata.version,tests:[]};
  try {
    const info=await engine.load(bytes,{backend:'wasm'});
    for(const fixture of images) {
      const result=await engine.infer(fixture.image,{confidence:0});
      const top=result.items[0],top1=top.classId===fixture.expectedClassId,top5=result.items.some(i=>i.classId===fixture.expectedClassId);
      row.tests.push({file:fixture.file,expectedClassId:fixture.expectedClassId,expectedLabel:fixture.expectedLabel,top1,top5,actualTop1:{id:top.classId,label:top.label,score:Number(top.score.toFixed(6))},expectedInTop5:result.items.find(i=>i.classId===fixture.expectedClassId)?.score??null,latencyMs:Number(result.latency.toFixed(2))});
    }
    row.inputSize=[info.inputHeight,info.inputWidth];
    row.top1Correct=row.tests.filter(t=>t.top1).length;row.top5Correct=row.tests.filter(t=>t.top5).length;
    row.knownReferences=[];
    for(const reference of nativeReferences) {
      const result=await engine.infer(reference.image,{confidence:0});
      row.knownReferences.push({file:reference.file,scope:reference.scope,nativeWidth:reference.image.width,nativeHeight:reference.image.height,expectedLabels:reference.expectedLabels,top1Matches:reference.expectedLabels.includes(result.items[0].label),top5Matches:result.items.some(i=>reference.expectedLabels.includes(i.label)),top5:result.items.map(i=>({id:i.classId,label:i.label,score:Number(i.score.toFixed(6))}))});
    }
    // Optional independent official-PIL preprocessing comparison. Produce the
    // tensor with scripts/reference-classification-preprocess.py first.
    if(info.inputWidth===224&&info.inputHeight===224) {
      let reference;
      try{reference=await readFile('tests/fixtures/yolo26/classification-ref224-1.f32');}catch{/* PIL comparison not requested. */}
      if(reference) {
        const tensor=new ort.Tensor('float32',new Float32Array(reference.buffer.slice(reference.byteOffset,reference.byteOffset+reference.byteLength)),[1,3,224,224]);
        let outputs;
        try {
          outputs=await engine.session.run({[info.inputName]:tensor});
          const values=outputs[info.outputNames[0]].data;
          row.pilReferenceGoldfish=Array.from(values,(score,classId)=>({id:classId,label:info.labels[classId],score})).sort((a,b)=>b.score-a.score).slice(0,5);
        }finally{for(const output of Object.values(outputs||{}))output.dispose();tensor.dispose();}
      }
    }
    console.log(name,JSON.stringify({directory,inputSize:row.inputSize,top1:row.top1Correct,top5:row.top5Correct,goldfish:row.tests[1]}));
  }finally{await engine.dispose();}
  evidence.rows.push(row);
}
await mkdir('docs/diagnostics',{recursive:true});
const destination=directories.length===1&&directories[0].includes('224')?'docs/diagnostics/classification-224.json':'docs/diagnostics/classification-resolution-comparison.json';
await writeFile(destination,JSON.stringify(evidence,null,2)+'\n');
console.log('Saved',destination);
