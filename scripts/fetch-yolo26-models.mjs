/** Download only public pinned model bytes; never initialize or execute model code. */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { MODELS, MODEL_REVISIONS } from '../src/core/catalog.js';

export async function fileDigest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function downloadModel(model, { origin = 'https://unowhatpvp-alt.github.io', root = '.', force = false } = {}) {
  const path = resolve(root, model.testFixturePath);
  await mkdir(dirname(path), { recursive: true });
  if (!force) {
    try {
      if ((await stat(path)).size === model.bytes && await fileDigest(path) === model.sha256) {
        return { id: model.id, filename: model.filename, bytes: model.bytes, sha256: model.sha256, source: 'verified-local-file', revision: model.revision, url: model.url, passed: true };
      }
    } catch { /* missing/incomplete fixture is downloaded */ }
  }
  const response = await fetch(model.url, { credentials: 'omit', headers: { Origin: origin }, signal: AbortSignal.timeout(300000) });
  if (!response.ok || !response.body) throw new Error(`${model.id}: HTTP ${response.status}`);
  const cors = response.headers.get('access-control-allow-origin');
  if (cors !== '*' && cors !== origin) throw new Error(`${model.id}: CORS did not permit ${origin}: ${cors}`);
  const hash = createHash('sha256');
  let bytes = 0;
  const measure = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    if (bytes > model.bytes) { callback(new Error(`${model.id}: export exceeds pinned size`)); return; }
    hash.update(chunk); callback(null, chunk);
  }});
  const temporary = path + '.part';
  try {
    await pipeline(Readable.fromWeb(response.body), measure, createWriteStream(temporary));
    const sha256 = hash.digest('hex');
    if (bytes !== model.bytes || sha256 !== model.sha256) throw new Error(`${model.id}: downloaded size/SHA-256 mismatch`);
    await rename(temporary, path);
    return { id: model.id, filename: model.filename, url: model.url, http: response.status, cors, bytes, sha256, revision: model.revision, passed: true };
  } catch (error) { await rm(temporary, { force: true }); throw error; }
}
export async function downloadModels({ models = MODELS, concurrency = 3, force = false } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw new Error('Download concurrency must be between 1 and 3');
  const queue = [...models].sort((a, b) => ['N','S','M','L','X'].indexOf(a.size) - ['N','S','M','L','X'].indexOf(b.size));
  const results = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const model = queue.shift();
      let error;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await downloadModel(model, { force }); results.push(result);
          console.log(`Verified model ${model.name}: ${result.bytes} bytes${result.cors ? `, CORS ${result.cors}` : ' (local)'}`);
          error = null; break;
        } catch (failure) { error = failure; }
      }
      if (error) throw error;
    }
  }));
  await mkdir('tests/fixtures/yolo26', { recursive: true });
  await writeFile('tests/fixtures/yolo26/reproduced-download-evidence.json', JSON.stringify({ sources: MODEL_REVISIONS, recordedAt: new Date().toISOString(), models: results.sort((a,b) => a.id.localeCompare(b.id)) }, null, 2) + '\n');
  return results;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const unknown = args.filter(x => x !== '--force' && !/^--(?:size|task|concurrency)=/.test(x));
  if (unknown.length) throw new Error('Unknown options: ' + unknown.join(', '));
  const get = name => args.find(x => x.startsWith(`--${name}=`))?.split('=')[1];
  const size = get('size')?.toUpperCase(), task = get('task');
  const models = MODELS.filter(m => (!size || m.size === size) && (!task || m.task === task));
  if (!models.length) throw new Error('No models match the selected task/size');
  await downloadModels({ models, concurrency: Number(get('concurrency') || 3), force: args.includes('--force') });
}
