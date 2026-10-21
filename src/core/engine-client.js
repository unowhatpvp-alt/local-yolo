function cancelled(reason='Inference was cancelled.') {
 const error=reason instanceof Error?reason:new Error(reason);
 error.name='AbortError';return error;
}

export class EngineClient {
 constructor(){this.sequence=0;this.pending=new Map();this.worker=null;this.direct=null;this.generation=0;this.initializing=null}
 async init(){
  if(this.worker||this.direct)return;
  if(this.initializing)return this.initializing;
  const generation=this.generation;
  const initialize=async()=>{
   if(typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap==='function'){
    const worker=new Worker(new URL('./engine-worker.js',import.meta.url),{type:'module'});
    this.worker=worker;
    worker.onmessage=({data})=>{
     if(this.worker!==worker)return;
     const pending=this.pending.get(data.id);if(!pending)return;
     this.pending.delete(data.id);
     if(data.error){const error=new Error(data.error.message);error.name=data.error.name||'Error';pending.reject(error)}
     else pending.resolve(data.value);
    };
    worker.onerror=event=>{if(this.worker===worker)this.destroy(new Error(event.message||'Inference worker failed. Reload the model to restart.'))};
   }else{
    const {YoloEngine}=await import('./engine.js');
    if(generation!==this.generation)throw cancelled();
    this.direct=new YoloEngine();
   }
  };
  const promise=initialize();this.initializing=promise;
  try{await promise}finally{if(this.initializing===promise)this.initializing=null}
 }
 rpc(type,args,transfer=[]){
  const id=++this.sequence,worker=this.worker;
  return new Promise((resolve,reject)=>{
   if(!worker){reject(new Error('The inference worker is not running. Load a model first.'));return}
   this.pending.set(id,{resolve,reject});
   try{worker.postMessage({id,type,args},transfer)}catch(error){this.pending.delete(id);reject(error)}
  });
 }
 /** Load consumes the supplied bytes: its standalone ArrayBuffer is transferred
  * to the worker and may become detached. Persist/inspect bytes BEFORE calling.
  * A subarray or SharedArrayBuffer is copied to preserve unrelated data.
  */
 async load(bytes,config={}){
  const generation=this.generation;
  await this.init();
  if(generation!==this.generation)throw cancelled();
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(this.direct)return this.direct.load(data,config);
  const standalone=data.buffer instanceof ArrayBuffer&&data.byteOffset===0&&data.byteLength===data.buffer.byteLength;
  const owned=standalone?data:new Uint8Array(data);
  return this.rpc('load',{bytes:owned,config},[owned.buffer]);
 }
 async infer(source,options){
  if(this.direct)return this.direct.infer(source,options);
  const generation=this.generation;
  if(!this.worker)throw new Error('Load a model before inference.');
  const bitmap=await createImageBitmap(source);
  if(generation!==this.generation||!this.worker){bitmap.close();throw cancelled()}
  try{return await this.rpc('infer',{bitmap,options},[bitmap])}
  catch(error){bitmap.close();throw error}
 }
 // Termination is immediate even while ORT initializes a large model. Waiting
 // for a queued worker "dispose" RPC would make cancellation depend on init.
 destroy(reason='Inference was cancelled.'){
  ++this.generation;
  const error=reason instanceof Error?reason:cancelled(reason),worker=this.worker;this.worker=null;
  if(worker){worker.onmessage=null;worker.onerror=null;worker.terminate()}
  for(const pending of this.pending.values())pending.reject(error);
  this.pending.clear();
  const direct=this.direct;this.direct=null;
  if(direct)void direct.dispose().catch(()=>{});
  this.initializing=null;
 }
 cancel(reason){this.destroy(reason)}
 async dispose(){this.destroy('Inference session was disposed.')}
}
