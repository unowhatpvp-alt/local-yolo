import * as ort from 'onnxruntime-web/webgpu';
import {inspectOnnx} from './onnx-info.js';
import {createAdapter,decodeOutputs,letterboxGeometry} from './adapters.js';

const now=()=>performance.now();
const BASE_URL=import.meta.env?.BASE_URL || '/local-yolo/';
if(typeof location!=='undefined')ort.env.wasm.wasmPaths=new URL(`${BASE_URL}ort/`,location.origin).href;
// GitHub Pages cannot provide COOP/COEP response headers. Single-thread WASM
// works without SharedArrayBuffer and avoids silently broken thread workers.
ort.env.wasm.numThreads=1;
ort.env.wasm.proxy=false;

function releaseOutputs(outputs) {
  for(const tensor of Object.values(outputs || {}))try{tensor.dispose();}catch{/* Some CPU tensor versions dispose synchronously. */}
}

function getSourceSize(source) {
  const width=source.videoWidth||source.naturalWidth||source.width;
  const height=source.videoHeight||source.naturalHeight||source.height;
  if(!(width>0&&height>0))throw new Error('The image/video frame is not ready or has no dimensions.');
  return {width,height};
}

function inputDimensions(signature,metadata,config) {
  if(signature.elemType!==1)throw new Error(`Input “${signature.name}” uses ONNX type ${signature.elemType}; this version accepts float32 input only. Export a float32 ONNX model.`);
  const dims=signature.dims;
  if(dims.length!==4)throw new Error(`Input [${dims}] is not NCHW image input. Expected [1,3,height,width].`);
  if(typeof dims[0]==='number'&&dims[0]!==1)throw new Error(`Input batch size ${dims[0]} is unsupported; export batch=1.`);
  if(dims[1]!==3)throw new Error(`Input channel dimension is ${dims[1]}. Only RGB NCHW [1,3,H,W] is supported (NHWC/grayscale are not compatible).`);
  let size=[];try{size=JSON.parse(metadata.imgsz || '[]');}catch{/* use explicit size/default below */}
  const height=typeof dims[2]==='number'&&dims[2]>0?dims[2]:config.inputSize||size[0]||640;
  const width=typeof dims[3]==='number'&&dims[3]>0?dims[3]:config.inputSize||size[1]||height;
  if(![height,width].every(v=>Number.isInteger(v)&&v>=16&&v<=4096))throw new Error(`Input size ${width}×${height} exceeds this browser adapter's supported 16–4096 pixel range.`);
  return {height,width,dims:[1,3,height,width]};
}

/**
 * A session owns exactly one inference at a time. Results use original source
 * pixels, including digital crop offsets. Latency measures preprocessing +
 * session.run + CPU postprocessing, excluding presentation and scheduling.
 */
export class YoloEngine {
  constructor(){this.session=null;this.info=null;this.adapter=null;this.busy=false;this.pending=null;this.canvas=null;this.generation=0;}

  async load(input,config={}) {
    await this.dispose();
    const generation=++this.generation;
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
    const graph=inspectOnnx(bytes);
    if(graph.externalData.length)throw new Error(`This ONNX graph requires external weight file(s): ${graph.externalData.slice(0,6).join(', ')}. Single-file import cannot resolve them. Re-export with external_data=False or combine the weights first.`);
    if(graph.inputs.length!==1)throw new Error(`The graph has ${graph.inputs.length} inputs (${graph.inputs.map(x=>x.name).join(', ')}). This adapter expects a single RGB image input.`);
    const metadata={...graph.metadata,...config.metadata};
    const dimensions=inputDimensions(graph.inputs[0],metadata,config);
    const tryGpu=config.backend!=='wasm'&&typeof navigator!=='undefined'&&!!navigator.gpu;
    const backends=tryGpu?['webgpu','wasm']:['wasm'];
    const failures=[];
    for(const backend of backends) {
      let session,outputs,warmup;
      try {
        session=await ort.InferenceSession.create(bytes,{executionProviders:[backend],graphOptimizationLevel:'all',logSeverityLevel:3});
        if(generation!==this.generation)throw new Error('Model loading was cancelled.');
        warmup=new ort.Tensor('float32',new Float32Array(dimensions.width*dimensions.height*3).fill(114/255),dimensions.dims);
        outputs=await session.run({[session.inputNames[0]]:warmup});
        if(generation!==this.generation)throw new Error('Model loading was cancelled.');
        const adapter=createAdapter(outputs,metadata,config);
        this.adapter=adapter;this.session=session;
        this.info={task:adapter.task,inputWidth:dimensions.width,inputHeight:dimensions.height,inputName:session.inputNames[0],outputNames:[...session.outputNames],backend:backend==='webgpu'?'WebGPU':'WASM',labels:adapter.labels,format:adapter.format,iouApplicable:adapter.iouApplicable,metadata,inputs:graph.inputs,outputs:graph.outputs,fallbackReason:failures.join(' | ')};
        return this.info;
      } catch(error) {
        if(session)await session.release().catch(()=>{});
        failures.push(`${backend.toUpperCase()}: ${String(error.message||error)}`);
        if(generation!==this.generation)throw error;
      } finally {releaseOutputs(outputs);warmup?.dispose();}
    }
    throw new Error(`Model initialization failed. ${failures.join(' | ')}`);
  }

  async infer(source,options={}) {
    if(!this.session||!this.info)throw new Error('Load a compatible ONNX model first.');
    if(this.busy)throw new Error('An inference is already running; wait for it to finish.');
    this.busy=true;
    this.pending=this.run(source,options);
    try{return await this.pending;}finally{this.busy=false;this.pending=null;}
  }

  async run(source,options) {
    const start=now(),session=this.session,info=this.info;
    const {width:sourceWidth,height:sourceHeight}=getSourceSize(source);
    const transform=letterboxGeometry(sourceWidth,sourceHeight,info.inputWidth,info.inputHeight,options.crop);
    if(!this.canvas) {
      if(typeof OffscreenCanvas!=='undefined')this.canvas=new OffscreenCanvas(info.inputWidth,info.inputHeight);
      else if(typeof document!=='undefined')this.canvas=document.createElement('canvas');
      else throw new Error('Image preprocessing requires a browser Canvas or OffscreenCanvas.');
    }
    const canvas=this.canvas;
    if(canvas.width!==info.inputWidth)canvas.width=info.inputWidth;
    if(canvas.height!==info.inputHeight)canvas.height=info.inputHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('Canvas 2D image preprocessing is unavailable.');
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    const crop=transform.crop;
    if(info.task==='classify') {
      // Ultralytics classify_transforms: square inputs preserve aspect and
      // center-crop; rectangular exported inputs resize to their exact shape.
      if(info.inputWidth===info.inputHeight) {
        const edge=Math.min(crop.width,crop.height);
        context.drawImage(source,crop.x+(crop.width-edge)/2,crop.y+(crop.height-edge)/2,edge,edge,0,0,canvas.width,canvas.height);
      } else context.drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
    } else {
      context.fillStyle='rgb(114,114,114)';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(source,crop.x,crop.y,crop.width,crop.height,transform.padX,transform.padY,transform.resizedWidth,transform.resizedHeight);
    }
    let pixels;
    try{pixels=context.getImageData(0,0,canvas.width,canvas.height).data;}catch(error){throw new Error(`Cannot read image pixels. Use a local file or same-origin media. ${error.message}`);}
    const plane=canvas.width*canvas.height,inputData=new Float32Array(plane*3);
    for(let p=0;p<plane;p++){inputData[p]=pixels[p*4]/255;inputData[p+plane]=pixels[p*4+1]/255;inputData[p+plane*2]=pixels[p*4+2]/255;}
    const tensor=new ort.Tensor('float32',inputData,[1,3,canvas.height,canvas.width]);
    let outputs;
    try {
      outputs=await session.run({[info.inputName]:tensor});
      const items=decodeOutputs(outputs,this.adapter,transform,options);
      return {task:info.task,items,latency:now()-start,sourceWidth,sourceHeight,crop:transform.crop,backend:info.backend,format:info.format,iouApplicable:info.iouApplicable};
    }finally{releaseOutputs(outputs);tensor.dispose();}
  }

  async dispose() {
    ++this.generation;
    if(this.pending)await this.pending.catch(()=>{});
    const session=this.session;
    this.session=null;this.info=null;this.adapter=null;
    if(session)await session.release();
    if(this.canvas){this.canvas.width=1;this.canvas.height=1;this.canvas=null;}
  }
}
