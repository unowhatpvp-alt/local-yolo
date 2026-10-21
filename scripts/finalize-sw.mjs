import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServiceWorker} from './pwa-template.mjs';
async function scan(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.'))continue;const path=`${dir}/${entry.name}`;if(entry.isDirectory())out.push(...await scan(path));else out.push(path)}return out}
const files=(await scan('dist')).filter(path=>!path.endsWith('/sw.js')).sort();
const hash=createHash('sha256');for(const path of files){hash.update(path+'\0');hash.update(await readFile(path));hash.update('\0')}
const revision=hash.digest('hex').slice(0,12);
const shell=files.filter(path=>!path.includes('/ort/')&&!path.endsWith('.wasm')).map(path=>'./'+path.slice(5));
await writeFile('dist/sw.js',createServiceWorker({revision,shell}));
console.log('Service worker shell:',shell.length,'files, revision',revision);
