import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { downloadModels } from './fetch-yolo26-models.mjs';

// All 25 requested YOLO26 task × size exports, sequentially streamed by at most
// three concurrent downloads. Reuses local files only after SHA-256 validation.
await downloadModels();
await mkdir('tests/fixtures', { recursive: true });
const images = [
  ['bus.jpg', 'https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg', 'c02019c4979c191eb739ddd944445ef408dad5679acab6fd520ef9d434bfbc63'],
  ['boats.jpg', 'https://github.com/ultralytics/assets/releases/download/v0.0.0/boats.jpg', '8c5ada657cf8110a9f8aaac954c1dd96cde0187315b581276c32b0d1863e756f']
];
for (const [name, url, sha256] of images) {
  const path = `tests/fixtures/${name}`;
  try { if (createHash('sha256').update(await readFile(path)).digest('hex') === sha256) continue; } catch { /* download */ }
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Image fixture ${name}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error(`Image fixture ${name}: integrity mismatch`);
  await writeFile(path, bytes);
}
