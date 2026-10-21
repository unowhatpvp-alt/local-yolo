// Storage/cancellation regression only; this does not simulate YOLO inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';

test('cancellation during cached model hashing never reports ready or downloads again',async()=>{
  const bytes=Uint8Array.from([1,2,3,4]);
  const model={id:'cache-cancellation',status:'verified',url:'https://example.invalid/model.onnx',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  const entry={...model,blob:new Blob([bytes])};
  const originals=Object.fromEntries(['indexedDB','crypto','fetch'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const controller=new AbortController(),phases=[];
  let downloads=0;
  const database={transaction(){
    const tx={objectStore(){return {get(){
      const request={result:entry};
      queueMicrotask(()=>{request.onsuccess();queueMicrotask(()=>tx.oncomplete());});
      return request;
    }}}};
    return tx;
  }};
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){
    const request={result:database};queueMicrotask(()=>request.onsuccess());return request;
  }}});
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{async digest(...args){
    // Compute the actual digest, with an abort while WebCrypto is pending.
    const digest=webcrypto.subtle.digest(...args);controller.abort();return digest;
  }}}});
  Object.defineProperty(globalThis,'fetch',{configurable:true,value:async()=>{downloads++;throw new Error('Unexpected request');}});
  try {
    const {getModel}=await import('../src/core/model-cache.js?cache-cancellation-test');
    await assert.rejects(getModel(model,{signal:controller.signal,onProgress:update=>phases.push(update.phase)}),{name:'AbortError'});
    assert.deepEqual(phases,['cache']);assert.equal(downloads,0);
  } finally {
    for(const [name,descriptor] of Object.entries(originals))descriptor?Object.defineProperty(globalThis,name,descriptor):delete globalThis[name];
  }
});
