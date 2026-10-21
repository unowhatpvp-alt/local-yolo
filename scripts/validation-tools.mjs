/** Development-only filesystem and process helpers for real validation. */
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export function resolveInside(root, requestPath, paths=path) {
 const base=paths.resolve(root),file=paths.resolve(base,requestPath),rel=paths.relative(base,file);
 if(!rel||rel==='..'||rel.startsWith('..'+paths.sep)||paths.isAbsolute(rel)) {
  throw new Error('Validation resource escapes its build directory.');
 }
 return file;
}

export function findPython({env=process.env,platform=process.platform,run=spawnSync}={}) {
 const configured=env.LOCAL_YOLO_PYTHON||env.PYTHON;
 const candidates=configured?[[configured,[]]]:platform==='win32'?
  [['python',[]],['py',['-3']],['python3',[]]]:[['python3',[]],['python',[]]];
 const failures=[];
 for(const [command,prefix]of candidates) {
  const result=run(command,[...prefix,'-c','import sys; assert sys.version_info.major == 3'],{encoding:'utf8',windowsHide:true});
  if(!result.error&&result.status===0)return {command,prefix};
  failures.push(`${command}: ${result.error?.message||result.stderr||`exit ${result.status}`}`);
 }
 throw new Error('Python 3 is required to extract the exact validation fixtures. '+failures.join('; '));
}

export function ffmpegCommand(env=process.env) {
 return env.LOCAL_YOLO_FFMPEG||'ffmpeg';
}
