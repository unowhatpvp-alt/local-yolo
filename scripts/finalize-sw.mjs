import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function scan(dir){let out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())out.push(...await scan(p));else out.push(p)}return out}
const files=(await scan('dist')).filter(p=>!p.endsWith('/sw.js'));
const hash=createHash('sha256');for(const p of files)hash.update(await readFile(p));
const revision=hash.digest('hex').slice(0,12);
const shell=files.filter(p=>!p.includes('/ort/')&&!p.endsWith('.wasm')).map(p=>'./'+p.slice(5));
const code=`const VERSION='local-yolo-${revision}';
const SHELL=${JSON.stringify(shell)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)))});
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('local-yolo-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.href.startsWith(self.registration.scope))return;
 e.respondWith((async()=>{const cache=await caches.open(VERSION);const hit=await cache.match(e.request);if(hit)return hit;try{const r=await fetch(e.request);if(r.ok && (u.pathname.includes('/ort/')||u.pathname.includes('/assets/')))await cache.put(e.request,r.clone());return r}catch(err){if(e.request.mode==='navigate')return (await cache.match(new URL('index.html',self.registration.scope)))||Response.error();throw err}})())});`;
await writeFile('dist/sw.js',code);
console.log('Service worker shell:',shell.length,'files, revision',revision);
