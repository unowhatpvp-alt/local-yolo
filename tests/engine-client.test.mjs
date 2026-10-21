// Transport/lifecycle tests only. This does not mock or claim YOLO inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EngineClient} from '../src/core/engine-client.js';

test('large standalone model buffers transfer ownership without a second copy',async()=>{
 const original={Worker:globalThis.Worker,OffscreenCanvas:globalThis.OffscreenCanvas,createImageBitmap:globalThis.createImageBitmap};
 const workers=[];
 class Transport {
  constructor(){workers.push(this);this.messages=[];this.terminated=false}
  postMessage(message,transfer){this.messages.push(structuredClone(message,{transfer}))}
  terminate(){this.terminated=true}
 }
 Object.assign(globalThis,{Worker:Transport,OffscreenCanvas:function(){},createImageBitmap:async()=>{}});
 try{
  const client=new EngineClient(),bytes=new Uint8Array(1024);
  bytes[0]=42;
  const loaded=client.load(bytes);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  const worker=workers[0],request=worker.messages[0];
  assert.equal(bytes.byteLength,0,'standalone source buffer must be transferred, not copied');
  assert.equal(request.args.bytes.byteLength,1024);assert.equal(request.args.bytes[0],42);
  worker.onmessage({data:{id:request.id,value:{transport:'ack'}}});
  await loaded;await client.dispose();assert(worker.terminated);
 }finally{Object.assign(globalThis,original)}
});

test('subarray loading preserves unrelated bytes and cancel rejects pending initialization promptly',async()=>{
 const original={Worker:globalThis.Worker,OffscreenCanvas:globalThis.OffscreenCanvas,createImageBitmap:globalThis.createImageBitmap};
 const workers=[];
 class Transport {
  constructor(){workers.push(this);this.messages=[];this.terminated=false}
  postMessage(message,transfer){this.messages.push(structuredClone(message,{transfer}))}
  terminate(){this.terminated=true}
 }
 Object.assign(globalThis,{Worker:Transport,OffscreenCanvas:function(){},createImageBitmap:async()=>{}});
 try{
  const client=new EngineClient(),whole=Uint8Array.from([1,2,3,4]),view=whole.subarray(1,3);
  const loading=client.load(view);
  const rejection=assert.rejects(loading,{name:'AbortError'});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.deepEqual([...whole],[1,2,3,4]);assert.deepEqual([...workers[0].messages[0].args.bytes],[2,3]);
  client.cancel();await rejection;
  assert.equal(client.pending.size,0);assert.equal(client.worker,null);assert(workers[0].terminated);
  // A fresh worker can initialize after cancellation without retaining old RPCs.
  const again=client.load(new Uint8Array(16));
  const disposed=assert.rejects(again,{name:'AbortError'});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  await client.dispose();await disposed;assert.equal(workers.length,2);
 }finally{Object.assign(globalThis,original)}
});
