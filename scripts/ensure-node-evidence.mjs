/** Preserve valid actual results; rerun the full matrix when source or artifacts changed. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint,validateReleaseEvidence} from './check-release-gate.mjs';
import {MODELS} from '../src/core/catalog.js';

/** Check only the Node portion of the unchanged release gate. Browser and PWA
 * evidence are verified separately before deployment, never inferred here. */
export function nodeEvidenceErrors({node,fingerprint,catalog=MODELS}){
 const errors=validateReleaseEvidence({fingerprint,catalog,node,browser:null,pwa:null}).errors
  .filter(error=>/^(Missing node evidence|node:|node-wasm|Node evidence|yolo26-.*\/node(?:\/|:)|yolo26-.*: (?:Node model record|measured session))/.test(error));
 const need=(condition,message)=>{if(!condition)errors.push(message);};
 need(node&&!node.simulated&&!node.mocked,'Simulated or mocked Node evidence cannot be reused.');
 need(node?.sourceFingerprint===fingerprint,'Node matrix source fingerprint must match the current application.');
 need(node?.partial===false,'Partial Node matrices cannot be reused.');
 need(node?.sourceChangedDuringRun===false,'Node matrix source must remain unchanged throughout the run.');
 need(node?.executedCount===25,'Node matrix must execute all 25 models.');
 need(node?.models?.length===25,'Node matrix must contain exactly 25 model records.');
 for(const row of node?.models||[]){
  need(row.status==='pass',`${row.id}: Node model record must pass.`);
  need(row.sourceFingerprint===fingerprint,`${row.id}: Node model record fingerprint must match the current application.`);
 }
 return errors;
}

export async function currentNodeEvidence(root=process.cwd()){
 const node=JSON.parse(await readFile(resolve(root,'docs/model-validation-matrix.json'),'utf8'));
 const fingerprint=await sourceFingerprint(root);
 assert.deepEqual(nodeEvidenceErrors({node,fingerprint}),[]);
 for(const row of node.models){
  // path.relative() records Windows separators on Windows. They must resolve
  // to the same checked-in PNG when the evidence is inspected on Linux CI.
  const image=row.wasmNode.render,bytes=await readFile(resolve(root,image.path.replace(/\\/g,'/')));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
  assert.equal(bytes.readUInt32BE(16),image.width);assert.equal(bytes.readUInt32BE(20),image.height);
 }
 return node.run.id;
}
function execute(script){
 const child=spawnSync(process.execPath,[script],{stdio:'inherit'});
 if(child.error)throw child.error;
 assert.equal(child.status,0,`${script} failed; no success evidence is substituted.`);
}
export async function ensureNodeEvidence(){
 try{console.log('VERIFIED_CURRENT_NODE_MATRIX',await currentNodeEvidence());}
 catch(error){
  console.log('RERUN_REQUIRED_NODE_MATRIX',error.message);
  execute('scripts/fetch-yolo26-models.mjs');
  execute('scripts/validate-yolo26-matrix.mjs');
  console.log('VERIFIED_RERUN_NODE_MATRIX',await currentNodeEvidence());
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await ensureNodeEvidence();
