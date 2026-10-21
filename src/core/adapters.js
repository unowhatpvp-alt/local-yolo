// Adapters for Ultralytics decoded YOLO26 and compatible YOLO11 ONNX exports.
// Raw heads require class-aware NMS. End-to-end rows retain native task extras.
// Each output is checked before decoding: incompatible graphs fail explicitly.
import {parseLabels} from './onnx-info.js';

export const COCO_LABELS = 'person|bicycle|car|motorcycle|airplane|bus|train|truck|boat|traffic light|fire hydrant|stop sign|parking meter|bench|bird|cat|dog|horse|sheep|cow|elephant|bear|zebra|giraffe|backpack|umbrella|handbag|tie|suitcase|frisbee|skis|snowboard|sports ball|kite|baseball bat|baseball glove|skateboard|surfboard|tennis racket|bottle|wine glass|cup|fork|knife|spoon|bowl|banana|apple|sandwich|orange|broccoli|carrot|hot dog|pizza|donut|cake|chair|couch|potted plant|bed|dining table|toilet|tv|laptop|mouse|remote|keyboard|cell phone|microwave|oven|toaster|sink|refrigerator|book|clock|vase|scissors|teddy bear|hair drier|toothbrush'.split('|');
export const DOTA_LABELS = 'plane|ship|storage tank|baseball diamond|tennis court|basketball court|ground track field|harbor|bridge|large vehicle|small vehicle|helicopter|roundabout|soccer ball field|swimming pool'.split('|');
const TASKS = ['detect','segment','pose','classify','obb'];
const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));

function checkedTensor(tensor) {
  if (!tensor || !['float32','float64'].includes(tensor.type)) throw new Error('Only decoded float32/float64 ONNX outputs are supported. Quantized or float16 output tensors require a separate adapter.');
  if (tensor.dims[0] !== 1) throw new Error('Only batch size 1 ONNX outputs are supported.');
}

export function createAdapter(outputs, metadata = {}, config = {}) {
  const entries = Object.entries(outputs);
  if (!entries.length) throw new Error('The model returned no tensors.');
  entries.forEach(([,t])=>checkedTensor(t));
  let task = config.task && config.task !== 'auto' ? config.task : metadata.task;
  const labelSource = config.labels?.length ? config.labels : metadata.names;
  let labels = parseLabels(labelSource);
  if (labelSource && !labels.length) throw new Error('Class names must be nonempty strings with consecutive class IDs starting at 0.');
  const primary = entries.find(([,t])=>t.dims.length === 3) || entries[0];
  const [outputName, tensor] = primary;
  const dims = tensor.dims;
  if (!task) {
    if (dims.length === 2) task = 'classify';
    else if (entries.some(([,t])=>t.dims.length === 4)) task = 'segment';
    else if (dims.length === 3 && dims[1] === 84) task = 'detect';
    else if (dims.length === 3 && dims[1] === 56) task = 'pose';
    else if (dims.length === 3 && dims[1] === 20) task = 'obb';
    else throw new Error(`Cannot safely infer the task from output [${dims}]. Select its task and provide class names. YOLOv5/objectness and arbitrary ONNX graphs are not automatically compatible.`);
  }
  if (!TASKS.includes(task)) throw new Error(`Unsupported task “${task}”. Supported tasks: ${TASKS.join(', ')}.`);
  if (metadata.task && metadata.task !== task) throw new Error(`Selected task ${task} conflicts with ONNX metadata task ${metadata.task}.`);
  if (task === 'classify') {
    if (entries.length !== 1 || dims.length !== 2 || dims[1] < 2) throw new Error(`Classification expects one [1, classes] probability output; received ${entries.map(([n,t])=>`${n}:[${t.dims}]`).join(', ')}.`);
    if (labels.length && labels.length !== dims[1]) throw new Error(`Class name count ${labels.length} does not match ${dims[1]} output classes.`);
    labels = labels.length ? labels : Array.from({length:dims[1]},(_,i)=>`Class ${i}`);
    return {task,format:'ultralytics-classification',outputName,labels,classes:dims[1],iouApplicable:false};
  }
  if (dims.length !== 3) throw new Error(`${task} expects a decoded 3D output. Received [${dims}].`);
  const prototypeEntry = entries.find(([,t])=>t.dims.length === 4);
  const masks = task === 'segment' ? prototypeEntry?.[1]?.dims[1] : 0;
  if (task === 'segment' && (!prototypeEntry || entries.length !== 2 || masks < 1 || masks > 256)) throw new Error('Segmentation expects decoded predictions plus one [1, mask_channels, H, W] prototype tensor.');
  if (task !== 'segment' && entries.length !== 1) throw new Error(`This ${task} adapter expects one decoded prediction tensor; auxiliary/training heads are unsupported.`);
  let kptShape=[17,3];
  if(task==='pose'&&metadata.kpt_shape) {
    try{kptShape=typeof metadata.kpt_shape==='string'?JSON.parse(metadata.kpt_shape):metadata.kpt_shape;}
    catch{throw new Error('Pose metadata kpt_shape is invalid JSON. Expected [keypoints, 2 or 3].');}
  }
  if (task === 'pose' && (!Array.isArray(kptShape) || kptShape.length !== 2 || !Number.isInteger(kptShape[0]) || kptShape[0] < 1 || kptShape[0] > 512 || ![2,3].includes(kptShape[1]))) throw new Error('Pose kpt_shape must be [keypoints, 2 or 3].');
  const extras = task === 'pose' ? kptShape[0] * kptShape[1] : task === 'segment' ? masks : task === 'obb' ? 1 : 0;
  // End-to-end rows are [x1,y1,x2,y2,confidence,class,extras]. Never
  // confuse [1,6,anchors] from a two-class raw detector with this layout.
  const explicitEnd=String(metadata.end2end).toLowerCase()==='true' || /['"]nms['"]\s*:\s*true/i.test(metadata.args || '') || config.format === 'end-to-end';
  const rawChannels=labels.length?4+labels.length+extras:null;
  const rowShape=dims[2]===6+extras;
  // A trustworthy class count disambiguates older exports without end2end
  // metadata. An explicit end2end flag must agree with the actual signature.
  if(explicitEnd&&!rowShape)throw new Error(`End-to-end ${task} metadata expects [1, rows, ${6+extras}], but the graph returned [${dims}]. Re-export with consistent head metadata.`);
  const endToEnd=rowShape&&(explicitEnd||rawChannels!==null&&dims[1]!==rawChannels);
  if (!endToEnd && (rawChannels!==null?dims[1]!==rawChannels:dims[1]>=dims[2])) throw new Error(`Unsupported prediction layout [${dims}]. Expected raw [1, ${rawChannels||'class/task channels'}, anchors] or end-to-end [1, rows, ${6+extras}]. YOLOv5/Objectness and arbitrary heads need their own adapter.`);
  const classes = endToEnd ? labels.length : dims[1] - 4 - extras;
  if (!endToEnd && (classes < 1 || classes > 10000)) throw new Error(`Invalid class channel count ${classes}.`);
  if (labels.length && !endToEnd && labels.length !== classes) throw new Error(`Output has ${dims[1]} channels but ${labels.length} class names and ${extras} task channels require ${4 + labels.length + extras}. Objectness/YOLOv5 and other head formats are unsupported.`);
  if (!labels.length) {
    if (task === 'detect' && classes === 80 || task === 'segment' && classes === 80) labels = COCO_LABELS;
    else if (task === 'obb' && classes === 15) labels = DOTA_LABELS;
    else if (task === 'pose' && classes === 1) labels = ['person'];
    else if (!endToEnd) throw new Error(`This custom ${task} output has ${classes} possible class channels but no class names. Supply the exact class names to distinguish a decoded Ultralytics export from incompatible objectness/YOLOv5 heads.`);
    else throw new Error('An end-to-end model without class metadata needs explicit class names.');
  }
  // OBB always carries center-x/center-y/width/height, including NMS-free rows.
  // Detect, segment and pose switch from raw xywh to end-to-end xyxy.
  return {task,outputName,prototypeName:prototypeEntry?.[0],masks,kptShape,classes:labels.length,labels,extras,boxFormat:task==='obb'||!endToEnd?'cxcywh':'xyxy',format:endToEnd?'ultralytics-end-to-end':'ultralytics-raw',iouApplicable:!endToEnd};
}

export function letterboxGeometry(sourceWidth, sourceHeight, inputWidth, inputHeight, crop) {
  const c = crop || {x:0,y:0,width:sourceWidth,height:sourceHeight};
  if (![c.x,c.y,c.width,c.height].every(Number.isFinite) || c.width <= 0 || c.height <= 0 || c.x < 0 || c.y < 0 || c.x+c.width > sourceWidth+.01 || c.y+c.height > sourceHeight+.01) throw new Error('The source crop is outside the media bounds.');
  const ratio = Math.min(inputWidth/c.width,inputHeight/c.height);
  const resizedWidth = Math.max(1,Math.round(c.width*ratio)),resizedHeight = Math.max(1,Math.round(c.height*ratio));
  return {sourceWidth,sourceHeight,inputWidth,inputHeight,crop:c,resizedWidth,resizedHeight,padX:Math.floor((inputWidth-resizedWidth)/2),padY:Math.floor((inputHeight-resizedHeight)/2),scaleX:resizedWidth/c.width,scaleY:resizedHeight/c.height};
}

export function sourcePoint(x,y,t,clip=true) {
  const px=(x-t.padX)/t.scaleX+t.crop.x, py=(y-t.padY)/t.scaleY+t.crop.y;
  return {x:clip?clamp(px,t.crop.x,t.crop.x+t.crop.width):px,y:clip?clamp(py,t.crop.y,t.crop.y+t.crop.height):py};
}

function sourceBox(box,t) {
  const a=sourcePoint(box.x,box.y,t),b=sourcePoint(box.x+box.width,box.y+box.height,t);
  return {x:a.x,y:a.y,width:Math.max(0,b.x-a.x),height:Math.max(0,b.y-a.y)};
}

export function boxIou(a,b) {
  const intersection=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  return intersection/(a.width*a.height+b.width*b.height-intersection+1e-9);
}

export function rotatedPolygon(cx,cy,width,height,angle) {
  const c=Math.cos(angle),s=Math.sin(angle);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:cx+x*width/2*c-y*height/2*s,y:cy+x*width/2*s+y*height/2*c}));
}

const cross=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
export function polygonArea(p) {
  return Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-a.y*b.x;},0))/2;
}
export function polygonIou(a,b) {
  let clipped=a;
  for (let i=0;i<b.length && clipped.length;i++) {
    const p=b[i],q=b[(i+1)%b.length],input=clipped;clipped=[];
    for(let j=0;j<input.length;j++) {
      const u=input[j],v=input[(j+1)%input.length],du=cross(p,q,u),dv=cross(p,q,v);
      if(du>=-1e-8) clipped.push(u);
      if((du>=0)!==(dv>=0)) {const fraction=du/(du-dv);clipped.push({x:u.x+(v.x-u.x)*fraction,y:u.y+(v.y-u.y)*fraction});}
    }
  }
  const intersection=clipped.length>=3?polygonArea(clipped):0;
  return intersection/(polygonArea(a)+polygonArea(b)-intersection+1e-9);
}

export function nonMaxSuppression(items,threshold,max=300,rotated=false) {
  const sorted=items.slice().sort((a,b)=>b.score-a.score).slice(0,3000),kept=[];
  for(const item of sorted) {
    if(!kept.some(other=>other.classId===item.classId && (rotated?polygonIou(other.polygon,item.polygon):boxIou(other.box,item.box))>threshold)) kept.push(item);
    if(kept.length>=max)break;
  }
  return kept;
}

function maskFor(item,prototype,adapter,t) {
  const [,channels,h,w]=prototype.dims,plane=w*h,coeff=item.coefficients;
  const box=sourceBox(item.box,t);
  // Reconstruct only the object's bounding region. A bounded display raster
  // avoids allocating source-resolution masks for every high-resolution frame.
  const factor=Math.min(1,384/Math.max(box.width,box.height));
  const width=Math.max(1,Math.ceil(box.width*factor)),height=Math.max(1,Math.ceil(box.height*factor));
  const logits=new Float32Array(plane);
  for(let c=0;c<channels;c++) {
    const coefficient=coeff[c];if(coefficient===0)continue;
    for(let p=0;p<plane;p++)logits[p]+=coefficient*prototype.data[c*plane+p];
  }
  const data=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const modelX=((box.x+(x+.5)/width*box.width-t.crop.x)*t.scaleX+t.padX)/t.inputWidth*w-.5;
    const modelY=((box.y+(y+.5)/height*box.height-t.crop.y)*t.scaleY+t.padY)/t.inputHeight*h-.5;
    const px=clamp(modelX,0,w-1),py=clamp(modelY,0,h-1),x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=px-x0,fy=py-y0;
    const logit=(logits[y0*w+x0]*(1-fx)+logits[y0*w+x1]*fx)*(1-fy)+(logits[y1*w+x0]*(1-fx)+logits[y1*w+x1]*fx)*fy;
    data[y*width+x]=logit>0?255:0;
  }
  return {data,width,height,box};
}

export function decodeOutputs(outputs,adapter,t,{confidence=.25,iou=.45}={}) {
  const tensor=outputs[adapter.outputName],data=tensor.data;
  if(adapter.task==='classify') {
    const items=Array.from(data,(score,classId)=>({classId,label:adapter.labels[classId],score}));
    // Ultralytics exports probabilities. Reject arbitrary logits instead of
    // silently pretending a classifier with different normalization is valid.
    if(items.some(x=>!Number.isFinite(x.score)||x.score<0||x.score>1.0001)||Math.abs(items.reduce((sum,item)=>sum+item.score,0)-1)>.001) throw new Error('Classification output is not a probability vector normalized to one. A logits adapter is required.');
    return items.sort((a,b)=>b.score-a.score).slice(0,5).filter(x=>x.score>=confidence);
  }
  const end=adapter.format==='ultralytics-end-to-end',rows=end?tensor.dims[1]:tensor.dims[2],columns=end?tensor.dims[2]:tensor.dims[1];
  const value=(r,c)=>data[end?r*columns+c:c*rows+r];
  const items=[];
  for(let r=0;r<rows;r++) {
    let classId=0,score=0;
    if(end){score=value(r,4);classId=value(r,5);if(!Number.isInteger(classId))continue;}
    else for(let c=0;c<adapter.classes;c++){const s=value(r,4+c);if(s>score){score=s;classId=c;}}
    if(!Number.isFinite(score)||score<confidence||score>1.0001||classId<0||classId>=adapter.classes)continue;
    const coords=[value(r,0),value(r,1),value(r,2),value(r,3)];
    if(!coords.every(Number.isFinite))continue;
    const box=adapter.boxFormat==='xyxy'?{x:coords[0],y:coords[1],width:coords[2]-coords[0],height:coords[3]-coords[1]}:{x:coords[0]-coords[2]/2,y:coords[1]-coords[3]/2,width:coords[2],height:coords[3]};
    if(box.width<=0||box.height<=0)continue;
    const item={box,classId,label:adapter.labels[classId],score};
    const start=end?6:4+adapter.classes;
    // Invalid task extras must not reach Canvas, exported coordinates or mask
    // reconstruction. The box/score checks above alone do not cover them.
    if(Array.from({length:adapter.extras},(_,i)=>value(r,start+i)).some(v=>!Number.isFinite(v)))continue;
    if(adapter.task==='pose')item.keypoints=Array.from({length:adapter.kptShape[0]},(_,i)=>({x:value(r,start+i*adapter.kptShape[1]),y:value(r,start+i*adapter.kptShape[1]+1),score:adapter.kptShape[1]===3?value(r,start+i*3+2):1}));
    if(adapter.task==='segment')item.coefficients=Array.from({length:adapter.masks},(_,i)=>value(r,start+i));
    if(adapter.task==='obb') {
      item.angle=value(r,start);
      item.polygon=rotatedPolygon(coords[0],coords[1],coords[2],coords[3],item.angle);
    }
    items.push(item);
  }
  const kept=end?items.sort((a,b)=>b.score-a.score).slice(0,300):nonMaxSuppression(items,iou,300,adapter.task==='obb');
  return kept.map(item=>{
    const result={...item,box:sourceBox(item.box,t)};
    if(item.keypoints)result.keypoints=item.keypoints.map(point=>({...sourcePoint(point.x,point.y,t,false),score:point.score}));
    if(item.polygon) {
      result.polygon=item.polygon.map(point=>sourcePoint(point.x,point.y,t,false));
      const xs=result.polygon.map(p=>p.x),ys=result.polygon.map(p=>p.y);
      result.box={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
    }
    if(item.coefficients) {
      result.mask=maskFor(item,outputs[adapter.prototypeName],adapter,t);
      delete result.coefficients;
    }
    return result;
  }).filter(item=>item.box.width>0&&item.box.height>0);
}
