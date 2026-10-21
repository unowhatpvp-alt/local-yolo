// Service-worker lifecycle unit tests. These do not claim actual PWA installation or browser offline validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServiceWorker} from '../scripts/pwa-template.mjs';
const scope='https://example.test/local-yolo/';
function harness({revision='123456789abc',shell=['./index.html','./studio/index.html'],failInstall=false,failPut=false}={}){
 const handlers={},stores=new Map();let offline=false,activated=0,claimed=0;
 const network=new Map([[scope+'index.html','app-v1'],[scope+'studio/index.html','studio-v1'],[scope+'ort/runtime.wasm','real-runtime-resource-test']]);
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);return {async addAll(urls){for(const url of urls){if(failInstall)throw new Error('HTTP404');const key=new URL(url,scope).href;if(!network.has(key))throw new Error('HTTP404 '+key);entries.set(key,new Response(network.get(key)))}},async match(key){const response=entries.get(typeof key==='string'?key:key.url);return response?.clone()},async put(key,response){if(failPut)throw new Error('QuotaExceeded');entries.set(key,response.clone())}}},async keys(){return [...stores.keys()]},async delete(name){return stores.delete(name)}};
 const self={registration:{scope},location:{origin:'https://example.test'},clients:{async claim(){claimed++}},skipWaiting(){activated++},addEventListener(type,fn){handlers[type]=fn}};
 const fetch=async request=>{if(offline)throw new Error('offline');const key=typeof request==='string'?request:request.url;return new Response(network.get(key)||'network-body')};
 vm.runInNewContext(createServiceWorker({revision,shell}),{self,caches,fetch,URL,Response});
 async function dispatch(type,event={}){let work,response;handlers[type]({...event,waitUntil(p){work=p},respondWith(p){response=p}});if(work)await work;return response?await response:undefined}
 return {dispatch,stores,network,offline(value){offline=value},get activated(){return activated},get claimed(){return claimed}};
}
test('precache excludes unsafe and invisible artifact paths',()=>{
 assert.throws(()=>createServiceWorker({revision:'123456789abc',shell:['./index.html','./.nojekyll']}),/safe visible/);
 assert.throws(()=>createServiceWorker({revision:'123456789abc',shell:['./index.html','./../escape']}),/safe visible/);
});
test('failed installation removes its partial cache',async()=>{const h=harness({failInstall:true});await assert.rejects(h.dispatch('install'),/404/);assert.equal(h.stores.size,0)});
test('cold offline app root and reserved route use their matching cached documents',async()=>{
 const h=harness();await h.dispatch('install');h.offline(true);
 const app=await h.dispatch('fetch',{request:{url:scope,method:'GET',mode:'navigate'}});assert.equal(await app.text(),'app-v1');
 const studio=await h.dispatch('fetch',{request:{url:scope+'studio/',method:'GET',mode:'navigate'}});assert.equal(await studio.text(),'studio-v1');
});
test('runtime resources cache lazily; storage failure does not replace successful network response',async()=>{
 const h=harness();await h.dispatch('install');const request={url:scope+'ort/runtime.wasm',method:'GET',mode:'cors'};const first=await h.dispatch('fetch',{request});assert.equal(await first.text(),'real-runtime-resource-test');h.offline(true);assert.equal(await (await h.dispatch('fetch',{request})).text(),'real-runtime-resource-test');
 const quota=harness({failPut:true});await quota.dispatch('install');assert.equal(await (await quota.dispatch('fetch',{request})).text(),'real-runtime-resource-test');
});
test('external requests, media uploads, and other origin scopes are not intercepted',async()=>{
 const h=harness();for(const request of [{url:'https://models.example/model.onnx',method:'GET',mode:'cors'},{url:scope+'media',method:'POST',mode:'cors'},{url:'https://example.test/other-app/file',method:'GET',mode:'cors'}])assert.equal(await h.dispatch('fetch',{request}),undefined);
});
test('waiting update requires explicit matching-version activation',async()=>{
 const h=harness();await h.dispatch('message',{data:'SKIP_WAITING'});await h.dispatch('message',{data:{type:'ACTIVATE_UPDATE',version:'wrong'}});assert.equal(h.activated,0);await h.dispatch('message',{data:{type:'ACTIVATE_UPDATE',version:'123456789abc'}});assert.equal(h.activated,1);
 let result;await h.dispatch('message',{data:{type:'GET_VERSION'},ports:[{postMessage(value){result=value}}]});assert.equal(result.version,'123456789abc');assert.equal(result.scope,scope);
});
test('activation deletes old caches only in this app scope',async()=>{
 const h=harness();h.stores.set(`local-yolo:${scope}:old`,new Map());h.stores.set('local-yolo:https://example.test/other/:old',new Map());await h.dispatch('install');await h.dispatch('activate');assert.equal(h.stores.has(`local-yolo:${scope}:old`),false);assert.equal(h.stores.has('local-yolo:https://example.test/other/:old'),true);assert.equal(h.claimed,1);
});
test('build finalizer rejects the historic hidden-file issue and produces deterministic revision',async()=>{
 const root=await mkdtemp(join(tmpdir(),'yolo-sw-'));
 try{await mkdir(join(root,'dist/assets'),{recursive:true});await writeFile(join(root,'dist/index.html'),'app');await writeFile(join(root,'dist/.nojekyll'),'');await writeFile(join(root,'dist/assets/app.js'),'module');const script=resolve('scripts/finalize-sw.mjs');execFileSync(process.execPath,[script],{cwd:root});const first=await readFile(join(root,'dist/sw.js'),'utf8');assert(!first.includes('.nojekyll'));execFileSync(process.execPath,[script],{cwd:root});assert.equal(await readFile(join(root,'dist/sw.js'),'utf8'),first)}finally{await rm(root,{recursive:true,force:true})}
});
