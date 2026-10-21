import { YoloEngine } from './engine.js';
const engine=new YoloEngine();
self.onmessage=async ({data})=>{
 const {id,type,args}=data;
 try{let value;
  if(type==='load')value=await engine.load(args.bytes,args.config);
  else if(type==='infer')value=await engine.infer(args.bitmap,args.options);
  else if(type==='dispose')value=await engine.dispose();
  else throw new Error('Unknown engine command');
  self.postMessage({id,value});
 }catch(error){self.postMessage({id,error:{name:error.name,message:error.message,stack:error.stack}})}
 finally{args.bitmap?.close()}
};
