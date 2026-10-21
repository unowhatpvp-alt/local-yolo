import { mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
await mkdir('public/ort',{recursive:true});
for(const name of await readdir('node_modules/onnxruntime-web/dist')){
 if (/^ort-wasm.*\.(wasm|mjs)$/.test(name)) await copyFile(`node_modules/onnxruntime-web/dist/${name}`,`public/ort/${name}`);
}
for(const [path,title,desc] of [['studio','Studio','Advanced inference workspace'],['experimental-training','Minimal · Experimental training','Browser training experiments'],['studio/experimental-training','Studio · Experimental training','Advanced browser training experiments']]){
 await mkdir(`public/${path}`,{recursive:true});
 const back='../'.repeat(path.split('/').length);
 await writeFile(`public/${path}/index.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Local YOLO — ${title}</title><style>*{box-sizing:border-box}body{margin:0;background:#fafafa;color:#171717;font:16px system-ui;min-height:100svh;display:grid;place-items:center;padding:24px}main{max-width:560px}small{letter-spacing:.12em}h1{font-size:42px;letter-spacing:-.05em}p{color:#737373;line-height:1.8}a{display:inline-block;color:inherit;padding:14px 20px;border:1px solid #bbb;border-radius:10px;text-decoration:none;margin-top:24px}@media(prefers-color-scheme:dark){body{background:#111;color:#eee}}</style><main><small>LOCAL YOLO / ROADMAP</small><h1>${title}</h1><p>开发中 · In development</p><p>${desc}.<br>该入口已预留，功能尚未开放。<br>This workspace is reserved and is not available yet.</p><a href="${back}">返回 Minimal / Open Minimal ↗</a></main></html>`);
}
await writeFile('public/.nojekyll','');
