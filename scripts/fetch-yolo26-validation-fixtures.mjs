import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import classificationFixtures from './classification-fixtures.json' with {type:'json'};
import {findPython,ffmpegCommand} from './validation-tools.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const DIR=path.join(ROOT,'tests/fixtures/yolo26');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const VALIDATION_FIXTURES=Object.freeze([
 {file:'tests/fixtures/bus.jpg',url:'https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg',sha256:'c02019c4979c191eb739ddd944445ef408dad5679acab6fd520ef9d434bfbc63'},
 {file:'tests/fixtures/boats.jpg',url:'https://github.com/ultralytics/assets/releases/download/v0.0.0/boats.jpg',sha256:'8c5ada657cf8110a9f8aaac954c1dd96cde0187315b581276c32b0d1863e756f'},
 {file:'tests/fixtures/yolo26/real-video.mp4',url:'https://github.com/ultralytics/assets/releases/download/v0.0.0/solutions_ci_demo.mp4',bytes:270967,sha256:'a8b0df3073740f808aa0aca3cff7787140837bfa24e01c934ba2cca474fd03cc'},
 {file:'tests/fixtures/yolo26/imagenet10.zip',url:'https://github.com/ultralytics/assets/releases/download/v0.0.0/imagenet10.zip',bytes:72774,sha256:'d3ad04697510c5e8f757385ea1ba7e285c10e4bc8d8b8312ee8349523e454890'}
]);
const CLASSIFICATION={file:'classification.jpg',member:'train/n01443537/n01443537_22323.JPEG',sha256:'d628b7c08a891ef4a5c8765a4f751d1db01adaa02149f291082e4f72f624b995',expectedLabel:'goldfish'};
export async function ensureValidationFixtures(){
 let python;
 const extract=(script,...args)=>{
  python??=findPython();
  return spawnSync(python.command,[...python.prefix,'-c',script,...args],{encoding:'utf8',windowsHide:true});
 };
 await mkdir(DIR,{recursive:true});
 for(const f of VALIDATION_FIXTURES){const p=path.join(ROOT,f.file);try{const bytes=await readFile(p);if(digest(bytes)===f.sha256)continue}catch{}
  const r=await fetch(f.url);if(!r.ok)throw new Error(`Validation fixture ${f.file}: HTTP ${r.status}`);const bytes=new Uint8Array(await r.arrayBuffer());if(digest(bytes)!==f.sha256||(f.bytes&&bytes.length!==f.bytes))throw new Error(`Validation fixture ${f.file}: SHA/size mismatch`);await writeFile(p,bytes);
 }
 const classified=path.join(DIR,CLASSIFICATION.file);let existing;try{existing=await readFile(classified)}catch{}
 if(!existing||digest(existing)!==CLASSIFICATION.sha256){
  const script='import sys,zipfile; archive,member,out=sys.argv[1:]; data=zipfile.ZipFile(archive).read(member); open(out,"wb").write(data)';
  const r=extract(script,path.join(DIR,'imagenet10.zip'),CLASSIFICATION.member,classified);if(r.status!==0)throw new Error(`Cannot extract exact ImageNet fixture: ${r.stderr||r.error?.message}`);
 }
 if(digest(await readFile(classified))!==CLASSIFICATION.sha256)throw new Error('Classification fixture integrity mismatch');
 for(const fixture of classificationFixtures){const out=path.join(DIR,fixture.file);let bytes;try{bytes=await readFile(out)}catch{}
  if(!bytes||digest(bytes)!==fixture.sha256){const script='import sys,zipfile; archive,member,out=sys.argv[1:]; open(out,"wb").write(zipfile.ZipFile(archive).read(member))';const r=extract(script,path.join(DIR,'imagenet10.zip'),fixture.archiveMember,out);if(r.status!==0)throw new Error(`Cannot extract held-out classification fixture: ${r.stderr||r.error?.message}`)}
  if(digest(await readFile(out))!==fixture.sha256)throw new Error(`Classification fixture integrity mismatch: ${fixture.file}`);
 }

 for(const time of [0,1]){
  const out=path.join(DIR,`video-frame-${time}.png`);
  // Decode anew: these are frames from actual MP4 footage, not generated detections.
  const r=spawnSync(ffmpegCommand(),['-loglevel','error','-ss',String(time),'-i',path.join(DIR,'real-video.mp4'),'-frames:v','1',out,'-y'],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw new Error(`Cannot decode real video frame ${time}: ${r.stderr||r.error?.message}`);
 }
 return {video:VALIDATION_FIXTURES[2],classification:CLASSIFICATION};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){await ensureValidationFixtures();console.log('Real image/video validation fixtures passed SHA-256 verification.');}
