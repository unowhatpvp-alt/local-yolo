export class EngineClient {
 constructor(){this.sequence=0;this.pending=new Map();this.worker=null;this.direct=null}
 async init(){
  if(this.worker||this.direct)return;
  if(typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap==='function'){
   this.worker=new Worker(new URL('./engine-worker.js',import.meta.url),{type:'module'});
   this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(!p)return;this.pending.delete(data.id);data.error?p.reject(new Error(data.error.message)):p.resolve(data.value)};
   this.worker.onerror=e=>{for(const p of this.pending.values())p.reject(new Error(e.message||'Inference worker failed'));this.pending.clear();this.worker?.terminate();this.worker=null};
  }else{const {YoloEngine}=await import('./engine.js');this.direct=new YoloEngine()}
 }
 rpc(type,args,transfer=[]){const id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});try{this.worker.postMessage({id,type,args},transfer)}catch(e){this.pending.delete(id);reject(e)}})}
 async load(bytes,config){await this.init();if(this.direct)return this.direct.load(bytes,config);const copy=bytes.slice();return this.rpc('load',{bytes:copy,config},[copy.buffer])}
 async infer(source,options){if(this.direct)return this.direct.infer(source,options);const bitmap=await createImageBitmap(source);return this.rpc('infer',{bitmap,options},[bitmap])}
 async dispose(){if(this.direct){await this.direct.dispose();this.direct=null}if(this.worker){await this.rpc('dispose',{});this.worker.terminate();this.worker=null}}
}
