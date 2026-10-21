import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {resolveInside,findPython,ffmpegCommand} from '../scripts/validation-tools.mjs';

test('validation static resources stay inside POSIX and Windows build directories',()=>{
 for(const [paths,root,expected]of [[path.posix,'/tmp/prior/dist','/tmp/prior/dist/assets/app.js'],[path.win32,'C:\\qa\\prior\\dist','C:\\qa\\prior\\dist\\assets\\app.js']]) {
  assert.equal(resolveInside(root,'assets/app.js',paths),expected);
  for(const requested of ['..','../dist-other/app.js','assets/../../outside.js'])assert.throws(()=>resolveInside(root,requested,paths),/escapes/);
 }
 assert.throws(()=>resolveInside('C:\\qa\\dist','D:\\other\\app.js',path.win32),/escapes/);
 assert.throws(()=>resolveInside('C:\\qa\\dist','..\\dist-other\\app.js',path.win32),/escapes/);
});

test('Python selection handles Windows launcher fallback and explicit paths with spaces',()=>{
 const calls=[];
 const found=findPython({env:{},platform:'win32',run:(command,args,options)=>{
  calls.push({command,args,options});return command==='python'?{status:9009,stderr:'not installed'}:{status:0};
 }});
 assert.deepEqual(found,{command:'py',prefix:['-3']});
 assert.deepEqual(calls[1].args.slice(0,2),['-3','-c']);
 assert.equal(calls[1].options.windowsHide,true);
 const configured=findPython({env:{PYTHON:'C:\\Python Tools\\python.exe'},run:(command)=>{assert.equal(command,'C:\\Python Tools\\python.exe');return {status:0};}});
 assert.equal(configured.command,'C:\\Python Tools\\python.exe');
 assert.throws(()=>findPython({env:{PYTHON:'missing-python'},run:()=>({error:new Error('ENOENT')})}),/Python 3 is required/);
});

test('FFmpeg executable can be supplied without shell interpolation',()=>{
 assert.equal(ffmpegCommand({}),'ffmpeg');
 assert.equal(ffmpegCommand({LOCAL_YOLO_FFMPEG:'C:\\QA Tools\\ffmpeg.exe'}),'C:\\QA Tools\\ffmpeg.exe');
});
