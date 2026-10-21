/** Browser media only. No camera frames or local files leave this device. */
const DEVICE_KEY = 'local-yolo.camera-device';
const CAMERA_MESSAGES = {
  permission: ['摄像头权限被拒绝。请在浏览器网站设置中允许访问，然后重试。', 'Camera permission was denied. Allow access in this site’s browser settings and retry.'],
  missing: ['没有找到可用的摄像头，请连接摄像头后重试。', 'No camera was found. Connect a camera and retry.'],
  busy: ['无法读取摄像头。它可能正被其他应用占用，或被系统隐私设置阻止。', 'The camera could not be read. Another app or system privacy setting may be blocking it.'],
  unsupported: ['当前浏览器不支持摄像头访问，或页面不是 HTTPS 安全环境。你仍然可以上传图片和视频。', 'Camera access is unavailable in this browser or insecure context. You can still open images and videos.'],
  constraints: ['这台摄像头不支持请求的设置。请选择其他摄像头。', 'This camera does not support the requested settings. Select another camera.'],
  disconnected: ['摄像头已断开或被系统停止，请重新连接后启动。', 'The camera was disconnected or stopped by the system. Reconnect it and start again.'],
  file: ['无法解码这个文件。请选择浏览器支持的图片或视频格式。', 'This file could not be decoded. Choose an image or video format supported by your browser.'],
  empty: ['文件为空。请选择有效的图片或视频。', 'This file is empty. Choose a valid image or video.'],
  cancelled: ['操作已取消。', 'The operation was cancelled.'],
  zoom: ['摄像头拒绝了倍率设置。请尝试其他倍率。', 'The camera rejected this zoom setting. Try another zoom value.'],
  unknown: ['无法启动摄像头，请检查浏览器和系统的摄像头设置。', 'The camera could not start. Check browser and system camera settings.'],
};

export class MediaError extends Error {
  constructor(code, cause) {
    super(CAMERA_MESSAGES[code]?.[1] || CAMERA_MESSAGES.unknown[1], { cause });
    this.name = 'MediaError';
    this.code = code;
  }
}

export function mediaErrorMessage(error, language = 'zh') {
  const code = typeof error?.code === 'string' ? error.code : cameraError(error).code;
  return (CAMERA_MESSAGES[code] || CAMERA_MESSAGES.unknown)[language.startsWith('zh') ? 0 : 1];
}

function cameraError(error) {
  if (error instanceof MediaError) return error;
  const code = ({ NotAllowedError: 'permission', SecurityError: 'permission', NotFoundError: 'missing', DevicesNotFoundError: 'missing', NotReadableError: 'busy', TrackStartError: 'busy', OverconstrainedError: 'constraints', ConstraintNotSatisfiedError: 'constraints', AbortError: 'cancelled', TypeError: 'unsupported' })[error?.name] || 'unknown';
  return new MediaError(code, error);
}

function rememberedDevice() {
  try { return localStorage.getItem(DEVICE_KEY); } catch { return null; }
}

function rememberDevice(value) {
  try { localStorage.setItem(DEVICE_KEY, value); } catch { /* Storage may be disabled. */ }
}

function waitForMedia(element, event, ready, signal, timeoutMs = 30000) {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      element.removeEventListener(event, onReady);
      element.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      error ? reject(error) : resolve();
    };
    const onReady = () => finish();
    const onError = () => finish(new MediaError('file', element.error));
    const onAbort = () => finish(new MediaError('cancelled'));
    const timer = setTimeout(() => finish(new MediaError('file')), timeoutMs);
    element.addEventListener(event, onReady, { once: true });
    element.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

async function fileKind(file) {
  if (!file?.size) throw new MediaError('empty');
  if (/^image\//i.test(file.type)) return 'image';
  if (/^video\//i.test(file.type)) return 'video';
  const name = (file.name || '').toLowerCase();
  if (/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|svg)$/.test(name)) return 'image';
  if (/\.(mp4|m4v|mov|webm|ogv|avi|mkv)$/.test(name)) return 'video';
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const ascii = new TextDecoder().decode(bytes);
  if ((bytes[0] === 0xff && bytes[1] === 0xd8) || ascii.startsWith('\u0089PNG') || (bytes[0] === 0x89 && ascii.slice(1, 4) === 'PNG') || ascii.startsWith('GIF8') || ascii.startsWith('BM') || (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP')) return 'image';
  if (ascii.slice(4, 8) === 'ftyp') return /avif|avis|heic|heif/.test(ascii) ? 'image' : 'video';
  if ((bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) || ascii.startsWith('OggS')) return 'video';
  throw new MediaError('file');
}

export class MediaController {
  constructor(videoElement, imageElement, { onEnded, onDeviceChange } = {}) {
    this.video = videoElement;
    this.image = imageElement;
    this.onEnded = onEnded;
    this.onDeviceChange = onDeviceChange;
    this.stream = null;
    this.kind = null;
    this.objectURL = null;
    this.digitalZoom = 1;
    this.nativeZoom = null;
    this._epoch = 0;
    this._abort = null;
    this._deviceChange = () => { this.listCameras().then((devices) => this.onDeviceChange?.(devices)).catch(() => {}); };
    navigator.mediaDevices?.addEventListener?.('devicechange', this._deviceChange);
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');
    this.video.preload = 'auto';
  }

  get source() { return this.kind === 'image' ? this.image : this.kind ? this.video : null; }
  get width() { return this.kind === 'image' ? this.image.naturalWidth : this.video.videoWidth; }
  get height() { return this.kind === 'image' ? this.image.naturalHeight : this.video.videoHeight; }
  get deviceId() { return this.stream?.getVideoTracks()[0]?.getSettings?.().deviceId || ''; }
  get zoomInfo() {
    if (this.nativeZoom) return { mode: 'native', ...this.nativeZoom };
    // Digital zoom is an application crop, deliberately capped at 4×.
    return { mode: 'digital', min: 1, max: 4, step: 0.1, value: this.digitalZoom };
  }

  async listCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput').map((device, index) => ({ deviceId: device.deviceId, groupId: device.groupId, label: device.label || `Camera ${index + 1}` }));
  }

  async startCamera(deviceId) {
    if (!navigator.mediaDevices?.getUserMedia) throw new MediaError('unsupported');
    this.release();
    const epoch = this._epoch;
    const controller = new AbortController();
    this._abort = controller;
    const saved = deviceId || rememberedDevice();
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let stream;
    try {
      const constraints = { width: { ideal: 1280 }, height: { ideal: 720 }, ...(saved ? { deviceId: { exact: saved } } : mobile ? { facingMode: { ideal: 'environment' } } : {}) };
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
      } catch (error) {
        if (!deviceId && saved && ['NotFoundError', 'OverconstrainedError'].includes(error.name)) {
          stream = await navigator.mediaDevices.getUserMedia({ video: mobile ? { facingMode: { ideal: 'environment' } } : true, audio: false });
        } else throw error;
      }
      if (epoch !== this._epoch) throw new MediaError('cancelled');
      this.stream = stream;
      this.kind = 'camera';
      this.video.muted = true;
      this.video.loop = false;
      this.video.srcObject = stream;
      await waitForMedia(this.video, 'loadedmetadata', () => this.video.readyState >= 1 && this.video.videoWidth > 0, controller.signal);
      await this.video.play();
      if (epoch !== this._epoch) throw new MediaError('cancelled');
      const track = stream.getVideoTracks()[0];
      let capabilities = {};
      try { capabilities = track?.getCapabilities?.() || {}; } catch { /* Some drivers expose the method but reject capability queries. */ }
      const settings = track?.getSettings?.() || {};
      if (capabilities.zoom && Number.isFinite(capabilities.zoom.min) && Number.isFinite(capabilities.zoom.max) && capabilities.zoom.max > capabilities.zoom.min && track.applyConstraints) {
        this.nativeZoom = { min: capabilities.zoom.min, max: capabilities.zoom.max, step: capabilities.zoom.step || 0.1, value: settings.zoom ?? capabilities.zoom.min };
      }
      track?.addEventListener('ended', () => {
        if (this.stream !== stream) return;
        this.stopCamera();
        this.onEnded?.(new MediaError('disconnected'));
      }, { once: true });
      if (deviceId) rememberDevice(settings.deviceId || deviceId);
      return { kind: 'camera', source: this.video, width: this.width, height: this.height, deviceId: settings.deviceId, zoom: this.zoomInfo, devices: await this.listCameras().catch(() => []) };
    } catch (error) {
      if (stream && this.stream !== stream) stream.getTracks().forEach((track) => track.stop());
      if (epoch === this._epoch) this.release();
      throw cameraError(error);
    }
  }

  stopCamera() {
    if (this.kind === 'camera' || this.stream || this._abort) this.release();
  }

  async loadFile(file) {
    this.release();
    const epoch = this._epoch;
    const controller = new AbortController();
    this._abort = controller;
    try {
      const kind = await fileKind(file);
      if (epoch !== this._epoch) throw new MediaError('cancelled');
      this.objectURL = URL.createObjectURL(file);
      this.kind = kind;
      if (kind === 'image') {
        this.image.src = this.objectURL;
        await waitForMedia(this.image, 'load', () => this.image.complete && this.image.naturalWidth > 0, controller.signal);
      } else {
        this.video.srcObject = null;
        this.video.muted = true;
        this.video.loop = false;
        this.video.src = this.objectURL;
        this.video.load();
        await waitForMedia(this.video, 'loadeddata', () => this.video.readyState >= 2 && this.video.videoWidth > 0, controller.signal);
      }
      if (epoch !== this._epoch) throw new MediaError('cancelled');
      if (!this.width || !this.height) throw new MediaError('file');
      return { kind, source: this.source, width: this.width, height: this.height, name: file.name };
    } catch (error) {
      if (epoch === this._epoch) this.release();
      throw error instanceof MediaError ? error : new MediaError('file', error);
    }
  }

  getCrop() {
    const width = this.width || 0;
    const height = this.height || 0;
    const scale = this.kind === 'camera' && !this.nativeZoom ? this.digitalZoom : 1;
    return { x: (width - width / scale) / 2, y: (height - height / scale) / 2, width: width / scale, height: height / scale };
  }

  async setZoom(value) {
    const info = this.zoomInfo;
    const requested = Math.min(info.max, Math.max(info.min, Number(value) || info.min));
    if (this.nativeZoom && this.stream) {
      try {
        const track = this.stream.getVideoTracks()[0];
        await track.applyConstraints({ advanced: [{ zoom: requested }] });
        this.nativeZoom.value = track.getSettings?.().zoom ?? requested;
      } catch (error) { throw new MediaError('zoom', error); }
    } else this.digitalZoom = requested;
    return this.zoomInfo;
  }

  async resetZoom() { return this.setZoom(this.zoomInfo.min); }

  release() {
    this._epoch += 1;
    this._abort?.abort();
    this._abort = null;
    const stream = this.stream;
    this.stream = null;
    stream?.getTracks().forEach((track) => track.stop());
    this.video.pause();
    this.video.srcObject = null;
    this.video.removeAttribute('src');
    this.video.load();
    this.image.removeAttribute('src');
    if (this.objectURL) URL.revokeObjectURL(this.objectURL);
    this.objectURL = null;
    this.kind = null;
    this.digitalZoom = 1;
    this.nativeZoom = null;
  }

  dispose() {
    this.release();
    navigator.mediaDevices?.removeEventListener?.('devicechange', this._deviceChange);
  }
}
