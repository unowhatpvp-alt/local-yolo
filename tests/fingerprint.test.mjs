import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {sourceFingerprint} from '../scripts/check-release-gate.mjs';

test('source evidence survives Git line-ending conversion but detects code and binary changes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'local-yolo-fingerprint-'));
 try{
  await mkdir(join(root,'src/core'),{recursive:true});
  await mkdir(join(root,'public/icons'),{recursive:true});
  await writeFile(join(root,'package.json'),'{"type":"module"}\n');
  await writeFile(join(root,'src/core/catalog.js'),'export const MODELS=[];\n');
  await writeFile(join(root,'index.html'),'<html>\n<body>YOLO</body>\n</html>\n');
  const lf=await sourceFingerprint(root);
  await writeFile(join(root,'index.html'),'<html>\r\n<body>YOLO</body>\r\n</html>\r\n');
  assert.equal(await sourceFingerprint(root),lf);
  await writeFile(join(root,'index.html'),'<html>\n<body>Changed</body>\n</html>\n');
  assert.notEqual(await sourceFingerprint(root),lf);
  await writeFile(join(root,'public/icons/test.png'),Buffer.from([137,80,13,10]));
  const binary=await sourceFingerprint(root);
  await writeFile(join(root,'public/icons/test.png'),Buffer.from([137,80,10]));
  assert.notEqual(await sourceFingerprint(root),binary);
 }finally{
  const rel=relative(resolve(tmpdir()),resolve(root));
  assert(rel.startsWith('local-yolo-fingerprint-')&&!rel.includes('..'));
  await rm(root,{recursive:true,force:true});
 }
});
