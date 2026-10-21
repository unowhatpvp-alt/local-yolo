import './ui/styles.css';
import {getLanguage, setLanguage, translatePage} from './ui/i18n.js';
import {MODELS, TASKS} from './core/catalog.js';
import {getModel, listCachedModels, deleteCachedModel, cacheUsage} from './core/model-cache.js';
import {EngineClient} from './core/engine-client.js';
import {MediaController, mediaErrorMessage} from './core/media.js';
import {renderFrame, saveFrame} from './core/render.js';

// Minimal owns presentation and scheduling. Task adapters and NMS remain in core.
const DEFAULT_IOU = 0.45;
const $ = id => document.getElementById(id);
const tx = (zh, en) => getLanguage() === 'zh' ? zh : en;
const saved = key => { try { return localStorage.getItem(key); } catch { return null; } };
const remember = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const bytesText = value => Number.isFinite(value) ? (value / 1048576).toFixed(1) + ' MB' : '—';
const setText = (id, text) => { if ($(id)) $(id).textContent = text; };
const show = (id, visible) => { if ($(id)) $(id).hidden = !visible; };
const listen = (id, event, callback) => $(id)?.addEventListener(event, callback);
const state = {
  task: 'detect', size: 'N', source: 'online', localTask: 'auto',
  cached: [], info: null, model: null, loading: false, loadEpoch: 0,
  mode: 'camera', modeEpoch: 0, cameraEpoch: 0,
  running: false, busy: false, generation: 0, completions: [],
  result: null, frame: null, crop: null, mirror: saved('local-yolo-mirror') === 'true',
  theme: saved('local-yolo-theme') || 'system',
  backend: saved('local-yolo-backend') || 'auto',
  fullscreen: false, cameraStarting: false, fileName: '', zoomTarget: null,
  stageNotice: null, stageError: false,
};
let engine = new EngineClient();
let downloadController;
let installPrompt;
let updateRegistration;
let updateApproved = false;
let idleTimer;
let frameRequest;
let zoomChanging = false;
const frames = [document.createElement('canvas'), document.createElement('canvas')];
const video = $('camera-video');
const media = new MediaController(video, $('file-image'), {
  onEnded() {
    stopLoop();
    show('stage-empty', true);
    setPhase('stopped');
    stageMessage(() => tx('摄像头已断开，请重新启动。', 'Camera disconnected. Start it again.'), true);
    syncMedia();
  },
  onDeviceChange: updateDevices,
});
video.hidden = false;
video.setAttribute('aria-hidden', 'true');
video.tabIndex = -1;

function setPhase(phase) {
  document.body.dataset.phase = phase;
  $('stage')?.setAttribute('aria-busy', String(phase === 'camera-starting'));
}

function errorText(error) {
  return error?.name === 'MediaError' ? mediaErrorMessage(error, getLanguage()) :
    error?.message || String(error);
}

function loadMessage(text, error = false) {
  setText(error ? 'load-error' : 'load-status', text);
  if (error) { setText('load-status', ''); show('load-error', Boolean(text)); }
}

function stageMessage(text, error = false) {
  state.stageNotice = typeof text === 'function' ? text : () => text;
  state.stageError = error;
  const message = state.stageNotice();
  $('stage-message').removeAttribute('data-i18n');
  setText('stage-message', message);
  const banner = $('workbench-error');
  if (banner) {
    banner.textContent = error ? message : '';
    banner.hidden = !error || !$('stage-empty').hidden;
  }
  $('stage')?.classList.toggle('has-error', error);
}

function notify(text) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.hidden = true; }, 4200);
}

function enterPage(id) {
  show('model-page', id === 'model-page');
  show('workbench', id === 'workbench');
  const element = $(id);
  element.classList.remove('is-entering');
  requestAnimationFrame(() => element.classList.add('is-entering'));
  document.body.classList.toggle('in-workbench', id === 'workbench');
}

function option(label, detail, selected, callback, disabled = false) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'menu-option';
  element.setAttribute('role', 'menuitemradio');
  element.setAttribute('aria-checked', String(selected));
  element.disabled = disabled;
  const title = document.createElement('span');
  title.textContent = label;
  element.append(title);
  if (detail) {
    const note = document.createElement('small');
    note.textContent = detail;
    element.append(note);
  }
  element.addEventListener('click', callback);
  return element;
}

const menuPairs = [
  ['task-picker-button', 'task-picker-menu'],
  ['size-picker-button', 'size-picker-menu'],
  ['camera-menu-toggle', 'camera-options-panel'],
  ['results-menu-toggle', 'results-options-panel'],
  ['camera-device-button', 'camera-device-menu'],
];
const menuTimers = new Map();
function closeMenu(triggerId, menuId, restoreFocus = false) {
  const menu = $(menuId);
  if (!menu || menu.hidden) return;
  menu.classList.remove('is-open');
  $(triggerId)?.setAttribute('aria-expanded', 'false');
  clearTimeout(menuTimers.get(menuId));
  menuTimers.set(menuId, setTimeout(() => { menu.hidden = true; syncPickerScrim(); }, 130));
  if (restoreFocus) $(triggerId)?.focus();
}
function syncPickerScrim() {
  show('picker-scrim', ['task-picker-menu', 'size-picker-menu'].some(id => $(id)?.classList.contains('is-open')));
}
function closeMenus(except) {
  for (const pair of menuPairs) if (pair[1] !== except) closeMenu(...pair);
}
function toggleMenu(triggerId, menuId) {
  const menu = $(menuId);
  if (!menu) return;
  if (!menu.hidden && menu.classList.contains('is-open')) {
    closeMenu(triggerId, menuId);
    return;
  }
  if (menuId !== 'camera-device-menu') closeMenus(menuId);
  clearTimeout(menuTimers.get(menuId));
  menu.hidden = false;
  $(triggerId)?.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => { menu.classList.add('is-open'); syncPickerScrim(); });
  wakeControls();
}

function selectedModel() {
  return MODELS.find(model => model.task === state.task && model.size === state.size);
}

async function changeSelection(task, size) {
  if (state.loading) return;
  if (state.info) await chooseAnotherModel();
  state.task = task;
  state.size = size;
  state.source = 'online';
  show('local-panel', false);
  $('source-local')?.setAttribute('aria-expanded', 'false');
  closeMenus();
  renderPicker();
}

function renderPicker() {
  const model = selectedModel();
  const task = TASKS.find(item => item.id === state.task);
  setText('task-picker-label', task?.label || state.task);
  setText('size-picker-label', state.size);
  $('task-picker-button').disabled = state.loading;
  $('size-picker-button').disabled = state.loading;
  $('task-options').replaceChildren(...TASKS.map(item => option(
    item.label, getLanguage() === 'zh' ? item.labelZh : '',
    item.id === state.task, () => changeSelection(item.id, state.size), state.loading,
  )));
  $('size-options').replaceChildren(...['N', 'S', 'M', 'L', 'X'].map((size, index) => {
    const candidate = MODELS.find(item => item.task === state.task && item.size === size);
    const names = ['Nano', 'Small', 'Medium', 'Large', 'XLarge'];
    const detail = (index === 0 ? tx('推荐 · ', 'Recommended · ') : '') + names[index] +
      (candidate?.status === 'verified' ? '' : tx(' · 验证中', ' · Validation pending'));
    return option(size, detail, size === state.size, () => changeSelection(state.task, size),
      state.loading || !candidate || candidate.status !== 'verified');
  }));
  $('local-task-options').replaceChildren(...[{id: 'auto', label: tx('自动检查', 'Auto inspect')}, ...TASKS]
    .map(item => option(item.label, '', item.id === state.localTask, () => {
      state.localTask = item.id;
      renderPicker();
    }, state.loading)));
  const localFile = $('local-model-input').files[0];
  const local = state.source === 'local';
  setText('model-name', local ? localFile?.name || tx('本地 ONNX', 'Local ONNX') : model?.name || 'YOLO26');
  setText('model-size', bytesText(local ? localFile?.size : model?.bytes));
  const cached = !local && state.cached.includes(model?.id);
  setText('model-cache-state', local ? tx('仅在此设备上读取', 'Read only on this device') :
    cached ? tx('已缓存', 'Cached') : tx('首次使用时下载', 'Downloads on first use'));
  setText('load-model-label', state.loading ? tx('请稍候', 'Please wait') :
    local ? tx('加载本地模型', 'Load local model') :
    cached ? tx('启动', 'Start') : tx('下载并启动', 'Download & start'));
  $('load-model').disabled = state.loading || (local ? !localFile : model?.status !== 'verified');
  show('load-cancel', state.loading);
  $('source-local').disabled = state.loading;
  $('local-model-input').disabled = state.loading;
  $('local-labels').disabled = state.loading;
  setText('local-file-name', localFile?.name || '');
  const large = !local && ['M', 'L', 'X'].includes(state.size);
  show('memory-note', large);
  setText('memory-note', tx(
    '这个模型更占内存，手机可能较慢或加载失败。Nano 更适合实时使用。',
    'This model needs more memory and may be slow or fail on a phone. Nano is better for live use.',
  ));
  setText('model-license', model?.license || '');
  if ($('model-source-link')) { $('model-source-link').href = model?.source || '#'; $('model-source-link').hidden = local; }
  show('model-license', !local);
}

async function refreshCache() {
  state.cached = await listCachedModels();
  renderPicker();
}

function appearance(theme) {
  state.theme = theme;
  remember('local-yolo-theme', theme);
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111111' : '#fafafa');
  renderSettings();
}

function language(language) {
  setLanguage(language);
  translatePage();
  renderPicker();
  renderSettings();
  syncMedia();
  if (state.stageNotice) stageMessage(state.stageNotice, state.stageError);
}

function renderSettings() {
  setText('language-label', getLanguage() === 'zh' ? 'EN' : '中');
  $('language-toggle')?.setAttribute('aria-label', tx('切换为英文', 'Switch to Chinese'));
  $('language-options')?.replaceChildren(...[['zh', '中文'], ['en', 'English']].map(([value, label]) =>
    option(label, '', getLanguage() === value, () => language(value))));
  $('theme-options')?.replaceChildren(...[
    ['system', tx('跟随系统', 'System')], ['light', tx('浅色', 'Light')], ['dark', tx('深色', 'Dark')],
  ].map(([value, label]) => option(label, '', state.theme === value, () => appearance(value))));
  $('backend-options')?.replaceChildren(...[
    ['auto', tx('自动 · 优先 WebGPU', 'Auto · WebGPU first')], ['wasm', 'WASM'],
  ].map(([value, label]) => option(label, '', state.backend === value, () => {
    state.backend = value;
    remember('local-yolo-backend', value);
    renderSettings();
  })));
  setText('session-info', state.info ? state.info.backend + ' · ' +
    state.info.inputWidth + '×' + state.info.inputHeight + ' · ' + state.info.format :
    tx('模型尚未加载', 'No model loaded'));
  setText('model-inspection', state.info ? JSON.stringify({
    task: state.info.task, inputs: state.info.inputs, outputs: state.info.outputs,
    backend: state.info.backend, fallbackReason: state.info.fallbackReason || undefined,
  }, null, 2) : '');
  show('model-inspection', Boolean(state.info));
  show('model-inspection-details', Boolean(state.info));
  show('session-info', Boolean(state.info));
}

async function refreshStorage() {
  const usage = await cacheUsage();
  const rows = usage.models.map(model => {
    const row = document.createElement('div');
    row.className = 'cache-row';
    const label = document.createElement('span');
    label.textContent = model.name + ' · ' + bytesText(model.bytes);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = tx('删除', 'Remove');
    remove.addEventListener('click', async () => {
      try { await deleteCachedModel(model.id); await refreshCache(); await refreshStorage(); }
      catch (error) { notify(errorText(error)); }
    });
    row.append(label, remove);
    return row;
  });
  $('cache-list')?.replaceChildren(...rows);
  setText('storage-status', tx('模型缓存 ', 'Model cache ') + bytesText(usage.modelBytes) +
    (Number.isFinite(usage.quota) ? ' · ' + tx('可用总配额 ', 'Origin quota ') + bytesText(usage.quota) : '') +
    tx('。浏览器可能清理缓存。', '. Browser storage may be evicted.'));
}

function parsedLabels() {
  const raw = $('local-labels').value.trim();
  if (!raw) return undefined;
  if (raw.startsWith('[')) {
    const labels = JSON.parse(raw);
    if (!Array.isArray(labels) || !labels.every(value => typeof value === 'string')) {
      throw new Error(tx('类别名称必须是字符串数组。', 'Class names must be a JSON string array.'));
    }
    return labels;
  }
  return raw.split(/\n|,/).map(value => value.trim()).filter(Boolean);
}

function progress(update) {
  show('load-progress', true);
  const bar = $('load-progress');
  if (Number.isFinite(update.percent)) bar.value = update.percent;
  else bar.removeAttribute('value');
  const names = {
    cache: tx('读取缓存', 'Reading cache'), download: tx('下载模型', 'Downloading model'),
    verify: tx('校验文件', 'Checking integrity'), 'cache-write': tx('保存缓存', 'Saving cache'),
    ready: tx('下载完成', 'Download complete'),
  };
  loadMessage((names[update.phase] || '') + (update.phase === 'download' ?
    ' · ' + bytesText(update.received) + (update.total ? ' / ' + bytesText(update.total) : '') : ''));
}

async function loadModel() {
  if (state.loading) return;
  const epoch = ++state.loadEpoch;
  state.loading = true;
  setPhase('download');
  show('load-error', false);
  show('load-progress', false);
  renderPicker();
  closeMenus();
  downloadController = new AbortController();
  try {
    let bytes, config, name;
    if (state.source === 'local') {
      const file = $('local-model-input').files[0];
      if (!file || !file.name.toLowerCase().endsWith('.onnx')) {
        throw new Error(tx('请选择 .onnx 文件。', 'Choose a .onnx file.'));
      }
      loadMessage(tx('读取 ONNX 文件', 'Reading ONNX file'));
      bytes = new Uint8Array(await file.arrayBuffer());
      config = {task: state.localTask, labels: parsedLabels()};
      name = file.name;
    } else {
      config = selectedModel();
      if (config?.status !== 'verified') throw new Error(tx('这个组合还未通过验证。', 'This model has not passed validation.'));
      name = config.name;
      bytes = await getModel(config, {onProgress: progress, signal: downloadController.signal});
    }
    if (epoch !== state.loadEpoch) return;
    const warning = bytes.cacheWarning;
    setPhase('initializing');
    loadMessage(tx('正在初始化', 'Initializing'));
    const info = await engine.load(bytes, {...config, backend: state.backend});
    if (epoch !== state.loadEpoch) return;
    state.model = {...config, name};
    state.info = info;
    state.task = info.task;
    state.loading = false;
    loadMessage('');
    state.frame = state.result = null;
    setText('current-model', name);
    show('current-model', true);
    show('switch-model', true);
    enterPage('workbench');
    renderPicker();
    renderSettings();
    if (warning) notify(warning);
    await setMode('camera');
  } catch (error) {
    if (epoch === state.loadEpoch && error.name !== 'AbortError') {
      loadMessage(errorText(error), true);
      setPhase('choose');
    }
  } finally {
    if (epoch === state.loadEpoch) {
      state.loading = false;
      downloadController = undefined;
      show('load-progress', false);
      renderPicker();
      await refreshCache();
    }
  }
}

async function cancelLoad() {
  state.loadEpoch++;
  downloadController?.abort();
  engine.cancel?.();
  await engine.dispose().catch(() => {});
  engine = new EngineClient();
  state.loading = false;
  setPhase('choose');
  loadMessage(tx('已取消', 'Cancelled'));
  show('load-progress', false);
  renderPicker();
}

function stopLoop() {
  state.running = false;
  state.generation++;
  cancelAnimationFrame(frameRequest);
  state.completions.length = 0;
  setText('fps-value', '—');
  wakeControls();
}

function waitIdle() {
  return state.busy ? new Promise(resolve => {
    const poll = () => state.busy ? setTimeout(poll, 20) : resolve();
    poll();
  }) : Promise.resolve();
}

function resetResult() {
  state.frame = state.result = state.crop = null;
  show('overlay-canvas', false);
  show('stage-empty', true);
  setText('latency-value', '—');
  setText('result-summary', '');
}

function syncMedia() {
  setText('backend-value', state.info?.backend || '—');
  setText('confidence-value', Math.round(Number($('confidence').value) * 100) + '%');
  $('confidence').setAttribute('aria-valuetext', $('confidence-value').textContent);
  const camera = state.mode === 'camera';
  const active = camera && media.kind === 'camera';
  for (const [id, selected] of [['mode-camera', camera], ['mode-file', !camera]]) {
    $(id)?.setAttribute('aria-pressed', String(selected));
    $(id)?.classList.toggle('active', selected);
  }
  $('stage')?.classList.toggle('camera-active', active);
  $('stage')?.classList.toggle('video-active', media.kind === 'video');
  show('camera-toggle', camera);
  show('camera-menu-toggle', camera);
  show('camera-start', camera);
  show('choose-file', !camera);
  show('choose-file-empty', !camera);
  show('video-controls', media.kind === 'video');
  setText('camera-toggle-label', active ? tx('停止', 'Stop') : tx('启动', 'Start'));
  $('camera-toggle')?.setAttribute('aria-label', active ? tx('停止摄像头', 'Stop camera') : tx('启动摄像头', 'Start camera'));
  $('camera-toggle').title = $('camera-toggle').getAttribute('aria-label');
  $('camera-toggle')?.setAttribute('aria-pressed', String(active));
  $('camera-toggle')?.classList.toggle('is-active', active);
  $('camera-toggle').querySelector('use').setAttribute('href', active ? '#icon-stop' : '#icon-camera');
  setText('video-play-label', video.paused ? tx('播放', 'Play') : tx('暂停', 'Pause'));
  $('video-play')?.setAttribute('aria-label', video.paused ? tx('播放', 'Play') : tx('暂停', 'Pause'));
  $('video-play').title = $('video-play').getAttribute('aria-label');
  $('video-play').querySelector('use').setAttribute('href', video.paused ? '#icon-play' : '#icon-pause');
  if ($('mirror-toggle')) $('mirror-toggle').checked = state.mirror;
  if ($('mirror-toggle')) $('mirror-toggle').disabled = !active;
  if ($('zoom-range')) $('zoom-range').disabled = !active;
  const zoom = media.zoomInfo;
  $('zoom-range').min = zoom.min;
  $('zoom-range').max = zoom.max;
  $('zoom-range').step = zoom.step;
  if (!zoomChanging) $('zoom-range').value = zoom.value;
  setText('zoom-label', Number(zoom.value).toFixed(1) + '×');
  setText('zoom-type', zoom.mode === 'native' ? tx('原生倍率', 'Native zoom') : tx('数字裁切', 'Digital crop'));
  const shortcuts = [...new Set([zoom.min, 2, 4, zoom.max])]
    .filter(value => value >= zoom.min && value <= zoom.max);
  $('zoom-shortcuts')?.replaceChildren(...shortcuts.map(value => {
    const item = option(Number(value).toFixed(value % 1 ? 1 : 0) + '×', '', value === zoom.value,
      () => changeZoom(value), !active);
    return item;
  }));
  $('save-image').disabled = !state.frame;
  $('save-json').disabled = !state.result;
  $('results-menu-toggle')?.setAttribute('aria-label', tx('检测结果和导出', 'Results and export'));
  setText('file-name', state.fileName);
  setText('stage-empty-title', camera ? tx('打开摄像头', 'Open your camera') : tx('选择图片或视频', 'Choose an image or video'));
  setText('stage-source-label', camera ? tx('摄像头', 'Camera') : tx('本地文件', 'Local file'));
  if (state.result) setText('result-summary', state.result.items.length + ' ' + tx('个结果', 'results'));
  renderSettings();
}

async function updateDevices() {
  const devices = await media.listCameras().catch(() => []);
  const usable = devices.filter(device => device.deviceId);
  const button = $('camera-device-button');
  if (button) button.disabled = media.kind !== 'camera' || usable.length < 2;
  const menu = $('camera-device-menu');
  if (menu) menu.replaceChildren(...usable.map((device, index) => option(
    device.label || tx('摄像头 ', 'Camera ') + (index + 1), '',
    device.deviceId === media.deviceId, async () => {
      closeMenu('camera-device-button', 'camera-device-menu');
      await startCamera(device.deviceId);
    })));
  setText('camera-device-count', usable.length ?
    String(usable.length) + tx(' 台可用', ' available') :
    tx('启动后读取设备', 'Available after permission'));
}

async function startCamera(deviceId) {
  if (document.hidden || state.mode !== 'camera' || !state.info) return;
  stopLoop();
  const epoch = ++state.cameraEpoch;
  state.cameraStarting = true;
  setPhase('camera-starting');
  stageMessage(() => tx('正在打开摄像头', 'Opening camera'));
  try {
    await waitIdle();
    if (epoch !== state.cameraEpoch) return;
    await media.startCamera(deviceId);
    if (epoch !== state.cameraEpoch || state.mode !== 'camera' || !state.info) return;
    if (document.hidden) { media.stopCamera(); return; }
    show('stage-empty', false);
    stageMessage('');
    setPhase('ready');
    await updateDevices();
    if (epoch !== state.cameraEpoch || document.hidden || media.kind !== 'camera') return;
    startLoop();
  } catch (error) {
    if (epoch !== state.cameraEpoch || error.code === 'cancelled') return;
    setPhase('stopped');
    show('stage-empty', true);
    stageMessage(() => errorText(error), true);
  } finally {
    if (epoch === state.cameraEpoch) state.cameraStarting = false;
    syncMedia();
  }
}

async function setMode(mode) {
  const epoch = ++state.modeEpoch;
  state.cameraEpoch++;
  state.cameraStarting = false;
  stopLoop();
  media.release();
  await waitIdle();
  if (epoch !== state.modeEpoch) return;
  state.mode = mode;
  state.fileName = '';
  resetResult();
  closeMenus();
  stageMessage(() => mode === 'camera' ? tx('画面只在设备上处理。', 'Your video stays on this device.') :
    tx('图片和视频会自动识别。', 'Images and videos are recognized automatically.'));
  syncMedia();
  await updateDevices();
  if (mode === 'camera' && state.info) {
    if (document.hidden) {
      setPhase('stopped');
      stageMessage(() => tx('点击启动摄像头继续。', 'Tap Start to open the camera.'));
    } else await startCamera();
  }
}

function dimensions(source) {
  return {width: source.videoWidth || source.naturalWidth || source.width,
    height: source.videoHeight || source.naturalHeight || source.height};
}

async function inferFrame(generation = state.generation) {
  if (state.busy || !state.info || !media.source) return;
  const source = media.source;
  const original = dimensions(source);
  if (!original.width || !original.height || (source.tagName === 'VIDEO' && source.readyState < 2)) return;
  state.busy = true;
  try {
    // Never reuse the completed presentation buffer while its next inference is pending.
    const frame = frames.find(candidate => candidate !== state.frame);
    const scale = Math.min(1, 1920 / Math.max(original.width, original.height));
    frame.width = Math.round(original.width * scale);
    frame.height = Math.round(original.height * scale);
    const scaleX = frame.width / original.width;
    const scaleY = frame.height / original.height;
    frame.getContext('2d', {alpha: false}).drawImage(source, 0, 0, frame.width, frame.height);
    const sourceCrop = media.getCrop();
    const crop = {
      x: sourceCrop.x * scaleX, y: sourceCrop.y * scaleY,
      width: sourceCrop.width * scaleX, height: sourceCrop.height * scaleY,
    };
    const result = await engine.infer(frame, {
      confidence: Number($('confidence').value), iou: DEFAULT_IOU, crop,
    });
    if (generation !== state.generation) return;
    result.coordinateSpace = {
      width: frame.width, height: frame.height,
      originalWidth: original.width, originalHeight: original.height, scale, scaleX, scaleY,
    };
    state.frame = frame;
    state.result = result;
    state.crop = crop;
    const now = performance.now();
    state.completions.push(now);
    state.completions = state.completions.filter(time => now - time < 2000);
    const count = state.completions.length;
    setText('fps-value', count > 1 ?
      ((count - 1) * 1000 / (now - state.completions[0])).toFixed(1) : '—');
    setText('latency-value', Number(result.latency).toFixed(0));
    setText('result-summary', result.items.length + ' ' + tx('个结果', 'results'));
    drawFrame();
    show('stage-empty', false);
    show('overlay-canvas', true);
    $('save-image').disabled = false;
    $('save-json').disabled = false;
  } catch (error) {
    stopLoop();
    stageMessage(() => errorText(error), true);
  } finally {
    state.busy = false;
  }
}

function drawFrame() {
  if (state.frame) renderFrame($('overlay-canvas'), state.frame, state.result, {
    showResults: true,
    mirror: state.mode === 'camera' && state.mirror, crop: state.crop,
  });
}

function startLoop() {
  if (state.running) return;
  state.running = true;
  const generation = ++state.generation;
  const tick = async () => {
    if (!state.running || generation !== state.generation) return;
    if (!document.hidden && !(media.kind === 'video' && video.paused)) await inferFrame(generation);
    if (state.running && generation === state.generation) frameRequest = requestAnimationFrame(tick);
  };
  frameRequest = requestAnimationFrame(tick);
  wakeControls();
}

async function loadFile(file) {
  if (!file || !state.info) return;
  stopLoop();
  const epoch = ++state.modeEpoch;
  state.cameraEpoch++;
  stageMessage(() => tx('正在读取文件', 'Reading file'));
  try {
    await waitIdle();
    if (epoch !== state.modeEpoch || !state.info || state.mode !== 'file') return;
    resetResult();
    const info = await media.loadFile(file);
    if (epoch !== state.modeEpoch || !state.info || state.mode !== 'file') return;
    state.fileName = file.name;
    stageMessage('');
    syncMedia();
    if (info.kind === 'video') {
      if (document.hidden) stageMessage(() => tx('视频已暂停，点击播放继续。', 'Video paused. Tap Play to continue.'));
      else await playVideo({epoch});
    } else await inferFrame();
  } catch (error) {
    if (epoch === state.modeEpoch && error.code !== 'cancelled') {
      show('stage-empty', true);
      stageMessage(() => errorText(error), true);
    }
  }
}

async function playVideo({epoch = state.modeEpoch, restart = false} = {}) {
  if (epoch !== state.modeEpoch || !state.info || state.mode !== 'file' || media.kind !== 'video' || document.hidden) return;
  try {
    if (restart) video.currentTime = 0;
    await video.play();
    if (epoch !== state.modeEpoch || !state.info || state.mode !== 'file' || media.kind !== 'video') return;
    if (document.hidden) { video.pause(); return; }
    startLoop();
  } catch (error) {
    if (epoch === state.modeEpoch && error.name !== 'AbortError') {
      stopLoop();
      stageMessage(() => errorText(error), true);
    }
  } finally {
    if (epoch === state.modeEpoch) syncMedia();
  }
}

async function changeZoom(value) {
  state.zoomTarget = Number(value);
  if (zoomChanging || media.kind !== 'camera') return;
  zoomChanging = true;
  try {
    while (state.zoomTarget !== null && media.kind === 'camera') {
      const target = state.zoomTarget;
      state.zoomTarget = null;
      await media.setZoom(target);
      setText('zoom-label', Number(media.zoomInfo.value).toFixed(1) + '×');
    }
    if (!state.running && media.source) await inferFrame();
  } catch (error) {
    stageMessage(() => errorText(error), true);
  } finally {
    zoomChanging = false;
    syncMedia();
  }
}

async function chooseAnotherModel() {
  state.modeEpoch++;
  state.cameraEpoch++;
  state.cameraStarting = false;
  stopLoop();
  media.release();
  await waitIdle();
  await engine.dispose();
  engine = new EngineClient();
  state.info = state.model = null;
  resetResult();
  if (state.fullscreen) await exitFullscreen();
  enterPage('model-page');
  show('current-model', false);
  show('switch-model', false);
  show('workbench-error', false);
  setPhase('choose');
  await refreshCache();
}

function exportJson() {
  if (!state.result) return;
  const content = {model: state.model.name, backend: state.info.backend,
    capturedAt: new Date().toISOString(), ...state.result};
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], {type: 'application/json'}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'local-yolo-results.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  closeMenus();
}

function wakeControls() {
  clearTimeout(idleTimer);
  $('stage-toolbar')?.classList.remove('is-idle');
  if (!state.fullscreen || !state.running) return;
  idleTimer = setTimeout(() => {
    const interacting = menuPairs.some(pair => $(pair[1])?.classList.contains('is-open')) ||
      $('stage-toolbar')?.contains(document.activeElement);
    if (!interacting) $('stage-toolbar')?.classList.add('is-idle');
  }, 2600);
}

function fullscreenChanged() {
  state.fullscreen = Boolean(document.fullscreenElement || $('stage').classList.contains('fullscreen-fallback'));
  document.body.classList.toggle('is-fullscreen', state.fullscreen);
  show('fullscreen-exit', state.fullscreen);
  $('fullscreen-toggle')?.setAttribute('aria-label', state.fullscreen ?
    tx('退出全屏', 'Exit fullscreen') : tx('全屏', 'Fullscreen'));
  wakeControls();
}

async function exitFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  $('stage').classList.remove('fullscreen-fallback');
  fullscreenChanged();
}

async function toggleFullscreen() {
  if (state.fullscreen) return exitFullscreen();
  closeMenus();
  try {
    if ($('stage').requestFullscreen) {
      await $('stage').requestFullscreen();
      fullscreenChanged();
      return;
    }
  } catch {}
  $('stage').classList.add('fullscreen-fallback');
  fullscreenChanged();
}

function resizeViewport() {
  document.documentElement.style.setProperty('--visual-height',
    Math.round(window.visualViewport?.height || window.innerHeight) + 'px');
}

for (const [trigger, menu] of menuPairs) {
  listen(trigger, 'click', async () => {
    if (trigger === 'camera-menu-toggle' || trigger === 'camera-device-button') await updateDevices();
    toggleMenu(trigger, menu);
  });
}
document.addEventListener('pointerdown', event => {
  for (const [trigger, menu] of menuPairs) {
    if (!$(trigger)?.contains(event.target) && !$(menu)?.contains(event.target) &&
      !(menu === 'camera-options-panel' && $('camera-device-menu')?.contains(event.target))) {
      closeMenu(trigger, menu);
    }
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    for (const pair of menuPairs) closeMenu(...pair, true);
    if (state.fullscreen) exitFullscreen();
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const pair = menuPairs.find(([trigger, menu]) => $(trigger) === event.target ||
    (!$(menu)?.hidden && $(menu)?.contains(event.target)));
  if (!pair) return;
  event.preventDefault();
  const [trigger, menu] = pair;
  if ($(menu).hidden) toggleMenu(trigger, menu);
  const items = [...$(menu).querySelectorAll('button:not(:disabled)')];
  const current = items.indexOf(document.activeElement);
  let next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
    (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
  items[next]?.focus();
});
listen('load-model', 'click', loadModel);
listen('load-cancel', 'click', cancelLoad);
listen('switch-model', 'click', chooseAnotherModel);
listen('source-local', 'click', () => {
  const opening = $('local-panel').hidden;
  show('local-panel', opening);
  $('source-local').setAttribute('aria-expanded', String(opening));
  state.source = opening ? 'local' : 'online';
  renderPicker();
});
listen('local-model-input', 'change', renderPicker);
listen('source-online', 'click', () => { state.source = 'online'; show('local-panel', false); $('source-local').setAttribute('aria-expanded', 'false'); renderPicker(); });
listen('picker-scrim', 'click', () => closeMenus());
listen('camera-options-close', 'click', () => closeMenu('camera-menu-toggle', 'camera-options-panel', true));
for (const control of document.querySelectorAll('[data-close-picker]')) control.addEventListener('click', () => closeMenus());
listen('language-toggle', 'click', () => language(getLanguage() === 'zh' ? 'en' : 'zh'));
listen('theme-toggle', 'click', () => appearance(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') appearance('system');
});
listen('settings-open', 'click', () => {
  closeMenus(); renderSettings(); refreshStorage().catch(error => notify(errorText(error)));
  $('settings-dialog').showModal();
});
listen('settings-close', 'click', () => $('settings-dialog').close());
listen('settings-dialog', 'click', event => {
  if (event.target === $('settings-dialog')) $('settings-dialog').close();
});
listen('cache-clear', 'click', async () => {
  try {
    for (const id of await listCachedModels()) await deleteCachedModel(id);
    await refreshCache(); await refreshStorage();
  } catch (error) { notify(errorText(error)); }
});
listen('mode-camera', 'click', () => setMode('camera'));
listen('mode-file', 'click', () => setMode('file'));
listen('camera-start', 'click', () => startCamera());
listen('camera-toggle', 'click', async () => {
  if (media.kind === 'camera' || state.cameraStarting) {
    state.cameraEpoch++; state.cameraStarting = false; stopLoop(); media.stopCamera();
    setPhase('stopped'); syncMedia(); await updateDevices();
  } else await startCamera();
});
listen('mirror-toggle', 'change', event => {
  state.mirror = event.target.checked;
  remember('local-yolo-mirror', String(state.mirror));
  drawFrame();
});
listen('zoom-range', 'input', event => changeZoom(event.target.value));
listen('fullscreen-toggle', 'click', toggleFullscreen);
listen('fullscreen-exit', 'click', exitFullscreen);
listen('stage', 'pointermove', wakeControls);
listen('stage', 'pointerdown', wakeControls);
listen('stage', 'focusin', wakeControls);
document.addEventListener('fullscreenchange', fullscreenChanged);
listen('choose-file', 'click', () => $('file-input').click());
listen('choose-file-empty', 'click', () => $('file-input').click());
listen('file-input', 'change', async () => {
  await loadFile($('file-input').files[0]);
  $('file-input').value = '';
});
listen('video-play', 'click', async () => {
  if (video.paused) await playVideo(); else { video.pause(); stopLoop(); }
  syncMedia();
});
listen('video-restart', 'click', () => playVideo({restart: true}));
video.addEventListener('timeupdate', () => {
  const time = value => Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
  setText('video-time', time(video.currentTime) + ' / ' + time(Number.isFinite(video.duration) ? video.duration : 0));
});
video.addEventListener('ended', () => { stopLoop(); syncMedia(); });
video.addEventListener('error', () => {
  if (media.kind !== 'video') return;
  stopLoop();
  stageMessage(() => tx('视频无法解码，请换一种浏览器支持的格式。', 'Cannot decode this video. Try another supported format.'), true);
});
listen('confidence', 'input', () => {
  setText('confidence-value', Math.round(Number($('confidence').value) * 100) + '%');
  $('confidence').setAttribute('aria-valuetext', $('confidence-value').textContent);
});
listen('confidence', 'change', () => {
  if (!state.running && media.source) inferFrame();
});
listen('save-image', 'click', () => saveFrame($('overlay-canvas'), 'local-yolo-result.png'));
listen('save-json', 'click', exportJson);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (!state.info) return;
  state.cameraEpoch++;
  stopLoop();
  state.cameraStarting = false;
  if (state.mode === 'camera') {
    media.stopCamera();
    setPhase('stopped');
    show('stage-empty', true);
    stageMessage(() => tx('已在后台停止摄像头，点击启动继续。', 'Camera stopped in background. Tap Start to resume.'));
  } else video.pause();
  syncMedia();
});
window.addEventListener('pagehide', () => {
  state.cameraEpoch++; stopLoop(); media.dispose(); engine.dispose().catch(() => {});
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
window.visualViewport?.addEventListener('resize', resizeViewport);
window.addEventListener('resize', resizeViewport);

listen('install-app', 'click', async () => {
  if (!installPrompt) return notify(tx('在 Safari 分享菜单中选择“添加到主屏幕”。', 'In Safari, choose Share → Add to Home Screen.'));
  await installPrompt.prompt(); await installPrompt.userChoice;
  installPrompt = undefined; show('install-app', false);
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; show('install-app', true);
});
window.addEventListener('appinstalled', () => { installPrompt = undefined; show('install-app', false); });
listen('app-update', 'click', () => {
  const waiting = updateRegistration?.waiting;
  if (!waiting) return;
  const channel = new MessageChannel();
  channel.port1.onmessage = async event => {
    const version = event.data?.version;
    channel.port1.close();
    if (!version || waiting !== updateRegistration?.waiting) return;
    $('app-update').disabled = true;
    try {
      if (state.loading) await cancelLoad();
      await chooseAnotherModel();
      updateApproved = true;
      waiting.postMessage({type: 'ACTIVATE_UPDATE', version});
    } catch (error) {
      updateApproved = false;
      $('app-update').disabled = false;
      notify(errorText(error));
    }
  };
  waiting.postMessage({type: 'GET_VERSION'}, [channel.port2]);
});
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateApproved && !refreshing) { refreshing = true; location.reload(); }
  });
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', {scope: import.meta.env.BASE_URL})
    .then(registration => {
      updateRegistration = registration;
      const ready = () => show('app-update', Boolean(registration.waiting && navigator.serviceWorker.controller));
      ready();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', ready);
      });
    }).catch(error => notify(tx('离线缓存暂不可用：', 'Offline cache unavailable: ') + error.message));
}
translatePage();
setPhase('choose');
appearance(state.theme);
resizeViewport();
refreshCache().catch(error => loadMessage(errorText(error), true));
syncMedia();
