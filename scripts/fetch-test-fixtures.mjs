import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MODELS} from '../src/core/catalog.js';
await mkdir('tests/fixtures',{recursive:true});
for(const m of MODELS.filter(m=>m.size==='N')){
 const path=`tests/fixtures/${m.name.toLowerCase()}.onnx`;
 try{const old=await readFile(path);if(createHash('sha256').update(old).digest('hex')===m.sha256)continue}catch{}
 const response=await fetch(m.url);if(!response.ok)throw new Error(`${m.id}: HTTP ${response.status}`);const bytes=new Uint8Array(await response.arrayBuffer());
 if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw new Error(`${m.id}: integrity mismatch`);
 await writeFile(path,bytes);console.log('Verified fixture:',m.name);
}
const images=[
 ['bus.jpg','https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg','c02019c4979c191eb739ddd944445ef408dad5679acab6fd520ef9d434bfbc63'],
 ['boats.jpg','https://github.com/ultralytics/assets/releases/download/v0.0.0/boats.jpg','8c5ada657cf8110a9f8aaac954c1dd96cde0187315b581276c32b0d1863e756f']
];
for(const [name,url,sha256]of images){
 const path=`tests/fixtures/${name}`;
 try{const bytes=await readFile(path);if(createHash('sha256').update(bytes).digest('hex')===sha256)continue}catch{}
 const r=await fetch(url);if(!r.ok)throw new Error(`Image fixture ${name}: HTTP ${r.status}`);
 const bytes=new Uint8Array(await r.arrayBuffer());
 if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error(`Image fixture ${name}: integrity mismatch`);
 await writeFile(path,bytes);
}
