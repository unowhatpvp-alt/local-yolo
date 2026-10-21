/** One cache per build and application scope. No media, model bytes or remote requests are intercepted. */
export function createServiceWorker({revision,shell}){
 if(!/^[a-f0-9]{12}$/.test(revision))throw new Error('A deterministic twelve-hex build revision is required.');
 if(!Array.isArray(shell)||!shell.includes('./index.html')||shell.some(p=>!p.startsWith('./')||p.split('/').some(v=>v==='..'||v.startsWith('.' )&&v!=='.')))throw new Error('Precache must contain index.html and safe visible app-relative resources only.');
 return `const VERSION='${revision}';
const SHELL=${JSON.stringify(shell)};
const PREFIX='local-yolo:'+self.registration.scope+':';
const CACHE=PREFIX+VERSION;
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{try{const cache=await caches.open(CACHE);await cache.addAll(SHELL)}catch(error){await caches.delete(CACHE);throw error}})());
});
// A waiting update does not replace an active version until the app explicitly requests it.
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE'&&event.data.version===VERSION)self.skipWaiting();if(event.data?.type==='GET_VERSION')event.ports?.[0]?.postMessage({version:VERSION,scope:self.registration.scope})});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim()})())});
function keyFor(request,url){const key=new URL(url.href);key.search='';if(request.mode==='navigate'&&key.pathname.endsWith('/'))key.pathname+='index.html';return key.href}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),key=keyFor(event.request,url),hit=await cache.match(key);if(hit)return hit;
  try{const response=await fetch(event.request);if(response.ok&&(url.pathname.includes('/ort/')||url.pathname.includes('/assets/')))try{await cache.put(key,response.clone())}catch{/* Quota/cache failure must not break a usable network response. */}return response}
  catch(error){if(event.request.mode==='navigate'){const fallback=await cache.match(new URL('index.html',self.registration.scope).href);if(fallback)return fallback}throw error}
 })());
});
`;
}
