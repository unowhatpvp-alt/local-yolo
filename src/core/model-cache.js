/** Model bytes only. Camera frames and imported media never enter this database. */
import {sha256 as sha256Fallback} from '@noble/hashes/sha2.js';
const DATABASE = 'local-yolo-models';
const VERSION = 1;
const STORE = 'models';
let opening;
const abortError = () => new DOMException('Download cancelled', 'AbortError');
const checkAbort = signal => { if (signal?.aborted) throw abortError(); };
function db() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable'));
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); opening = undefined; };
      resolve(request.result);
    };
    request.onerror = () => { opening = undefined; reject(request.error); };
    request.onblocked = () => { opening = undefined; reject(new Error('Model storage is blocked by another open tab')); };
  });
  return opening;
}
async function transaction(mode, operation) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    let result;
    const request = operation(tx.objectStore(STORE));
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(tx.error || request.error || new Error('Model storage transaction failed'));
  });
}
function emit(onProgress, phase, received, total, extra = {}) {
  onProgress?.({ phase, received, total, percent: total > 0 ? Math.min(100, received / total * 100) : null, ...extra });
}
async function sha256(bytes) {
  const digest=globalThis.crypto?.subtle ? new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)) : sha256Fallback(bytes);
  return Array.from(digest).map(x => x.toString(16).padStart(2, '0')).join('');
}
async function validBytes(bytes, model) {
  if (model.bytes && bytes.byteLength !== model.bytes) return false;
  return !model.sha256 || await sha256(bytes) === model.sha256;
}
/** An immutable id + revision + digest prevents accidentally using an older export. */
function matches(entry, model) {
  return entry && entry.url === model.url && entry.sha256 === model.sha256 && entry.bytes === model.bytes;
}
export async function getModel(model, { onProgress, signal } = {}) {
  if (!model?.url || model.status !== 'verified') throw new Error('This model export has not been verified for Local YOLO.');
  checkAbort(signal);
  let storageWarning = null;
  try {
    const entry = await transaction('readonly', store => store.get(model.id));
    if (matches(entry, model)) {
      emit(onProgress, 'cache', 0, model.bytes, { cached: true });
      const bytes = new Uint8Array(await entry.blob.arrayBuffer());
      checkAbort(signal);
      if (await validBytes(bytes, model)) {
        checkAbort(signal);
        emit(onProgress, 'ready', bytes.byteLength, bytes.byteLength, { cached: true });
        return bytes;
      }
      await deleteCachedModel(model.id);
      storageWarning = 'The saved model failed integrity verification and will be downloaded again.';
    }
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    storageWarning = 'Local model storage is unavailable; this download will remain in memory only.';
  }
  checkAbort(signal);
  emit(onProgress, 'download', 0, model.bytes || 0, { cached: false, warning: storageWarning });
  let response;
  try { response = await fetch(model.url, { signal, credentials: 'omit', mode: 'cors', cache: 'no-store' }); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Model download failed. Check your connection or import a compatible local ONNX file. ' + error.message);
  }
  if (!response.ok) throw new Error(`Model server returned HTTP ${response.status}. Try again later or import a local ONNX file.`);
  const total = model.bytes || Number(response.headers.get('Content-Length')) || 0;
  let bytes;
  if (response.body) {
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    try {
      while (true) {
        checkAbort(signal);
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (model.bytes && received > model.bytes) {
          await reader.cancel();
          throw new Error('The downloaded model is larger than the pinned verified export.');
        }
        chunks.push(value);
        emit(onProgress, 'download', received, total, { cached: false, warning: storageWarning });
      }
    } finally { reader.releaseLock(); }
    bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  } else bytes = new Uint8Array(await response.arrayBuffer());
  checkAbort(signal);
  emit(onProgress, 'verify', bytes.byteLength, total);
  if (!await validBytes(bytes, model)) throw new Error('Model integrity check failed: size or SHA-256 does not match the pinned export. Nothing was cached.');
  checkAbort(signal);
  try {
    emit(onProgress, 'cache-write', bytes.byteLength, total);
    const estimate = await globalThis.navigator?.storage?.estimate?.();
    if (estimate?.quota && estimate.quota - estimate.usage < bytes.byteLength * 1.05) {
      throw new Error('Not enough local model storage');
    }
    await transaction('readwrite', store => store.put({
      id: model.id, name: model.name, url: model.url, sha256: model.sha256,
      bytes: bytes.byteLength, blob: new Blob([bytes], { type: 'application/octet-stream' }), savedAt: new Date().toISOString()
    }));
  } catch {
    storageWarning = 'The model loaded, but could not be saved offline. Free browser storage and download it again to cache it.';
  }
  checkAbort(signal);
  if (storageWarning) Object.defineProperty(bytes, 'cacheWarning', { value: storageWarning });
  emit(onProgress, 'ready', bytes.byteLength, bytes.byteLength, { cached: false, warning: storageWarning });
  return bytes;
}
export async function listCachedModels() {
  try { return await transaction('readonly', store => store.getAllKeys()); }
  catch { return []; }
}
export async function deleteCachedModel(id) {
  await transaction('readwrite', store => store.delete(id));
}
export async function cacheUsage() {
  let entries = [];
  try { entries = await transaction('readonly', store => store.getAll()); } catch { /* private browsing may disable IndexedDB */ }
  let estimate = {};
  try { estimate = await globalThis.navigator?.storage?.estimate?.() || {}; } catch { /* no Storage API */ }
  let persistent = false;
  try { persistent = await globalThis.navigator?.storage?.persisted?.() || false; } catch { /* unsupported */ }
  return { usage: estimate.usage ?? null, quota: estimate.quota ?? null, persistent,
    modelBytes: entries.reduce((n, x) => n + x.bytes, 0),
    models: entries.map(({ id, name, bytes, savedAt }) => ({ id, name, bytes, savedAt })) };
}
