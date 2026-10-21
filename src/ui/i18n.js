const messages = {
  en: {
    resultsOptions: 'Result options', modelInspection: 'Model information', updateApp: 'Update app',
    minimal: 'Minimal V1.1', modelTitle: 'Vision. On your device.',
    modelSubtitle: 'Choose a model. Start seeing.',
    launchTitle: 'Vision. On your device.', launchSubtitle: 'Choose a model. Start seeing.',
    visionTask: 'Task', modelScale: 'Size', launchWorkbench: 'Open workbench',
    localImportLink: 'Import local ONNX', cameraOptions: 'Camera options', backToModels: 'Choose model',
    closeMenu: 'Close menu', cameraSource: 'Camera source', useLocalModel: 'Use local model',
    detectionTask: 'Detection', segmentationTask: 'Segmentation', poseTask: 'Pose', classificationTask: 'Classification', obbTask: 'Oriented boxes',
    modelUnavailableShort: 'Not available yet', standardPrivacy: 'Your images stay on this device.',
    downloadOnFirstUse: 'Downloads on first use', cacheReady: 'Cached · ready to load', downloading: 'Downloading…',
    initializing: 'Initializing…', languageShort: 'EN', performanceLabel: 'Performance',
    fullscreenFallback: 'Expanded view · browser fullscreen unavailable',
    onlineModels: 'Online models', localOnnx: 'Local ONNX', series: 'Model family', task: 'Vision task', modelSize: 'Model size',
    detection: 'Detection', segmentation: 'Segmentation', pose: 'Pose', classification: 'Classification', obb: 'Oriented boxes',
    detectionHint: 'Find objects with bounding boxes', segmentationHint: 'Trace the shape of each object', poseHint: 'Locate body joints and movement',
    classificationHint: 'Identify the content of an image', obbHint: 'Detect objects at any angle', chooseModel: 'Choose a model',
    modelReady: 'Ready to load', modelSource: 'Source', downloadLoad: 'Download & open workbench', loadModel: 'Load model',
    localTitle: 'Local ONNX', localHint: 'Choose a compatible ONNX model.', chooseOnnx: 'Choose ONNX file',
    taskType: 'Task type', autoDetect: 'Detect automatically', classNames: 'Class names',
    classNamesHint: 'Optional. One name per line, or comma-separated, in the model’s class order.',
    compatibilityNote: 'Supports compatible float32, single-input YOLO models. External weights, custom operators, and other export layouts may require a dedicated adapter.',
    privacyTitle: 'On-device processing', privacyDescription: 'Your images stay on this device. Model downloads use the network.',
    workbench: 'Workbench', camera: 'Camera', uploadFile: 'Upload file', switchModel: 'Switch model', settings: 'Settings', theme: 'Change theme',
    cameraTitle: 'Camera', cameraHint: 'Start the camera for live detection.', startCamera: 'Start camera', stopCamera: 'Stop camera',
    selectCamera: 'Select camera', mirror: 'Mirror', zoom: 'Zoom', nativeZoom: 'Camera zoom', digitalZoom: 'Digital zoom', fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen', confidence: 'Confidence threshold', iou: 'IoU threshold', showResults: 'Show results', parameters: 'Detection parameters',
    performance: 'Performance', fps: 'Detection FPS', latency: 'Detection latency', backend: 'Runtime',
    latencyDefinition: 'Latency measures one completed inference, including preprocessing and postprocessing. FPS counts completed detections, not camera frames.',
    chooseFile: 'Choose image or video', fileHint: 'Images and videos are detected automatically. Your files stay on this device.',
    saveImage: 'Save image', saveJson: 'Export JSON', play: 'Play', pause: 'Pause', restart: 'Restart', language: 'Language',
    appearance: 'Appearance', system: 'System', light: 'Light', dark: 'Dark', executionBackend: 'Inference backend',
    autoBackend: 'Automatic · WebGPU first', wasmBackend: 'WASM · compatibility mode', cachedModels: 'Cached models', clearCache: 'Clear model cache',
    storage: 'Storage', close: 'Close', installApp: 'Install app', offlineNote: 'Downloaded models may work offline. Browser storage can be cleared or evicted; large models are not guaranteed to remain cached.',
    aboutVersion: 'Local YOLO · Minimal V1.1', modelLoading: 'Initializing model…', downloadProgress: 'Downloading model…', cached: 'Cached on device',
    notCached: 'Download required', unavailable: 'Unavailable', notVerified: 'Not yet verified', loading: 'Loading…', ready: 'Ready',
    noCamera: 'No camera found. Connect a camera or upload an image or video.',
    permissionDenied: 'Camera access was denied. Allow camera access in your browser’s site settings, then try again.',
    copyDetails: 'Copy details', export: 'Export', localFilesStayLocal: 'Processed on your device', privacy: 'Private by design',
    back: 'Back', cancel: 'Cancel', retry: 'Try again', remove: 'Remove', download: 'Download', model: 'Model', taskLabel: 'Task',
    file: 'File', unknown: 'Unknown', noCachedModels: 'No models cached yet.', cacheUnavailable: 'Browser storage is unavailable. The model can still run for this session.',
    cacheSaved: 'Model saved for offline use.', cacheCleared: 'Model cache cleared.', storageUnavailable: 'Storage estimate unavailable.',
    storageUsed: '{used} used of {quota}', modelUnavailable: 'This model combination has not been verified yet.',
    modelSelectHint: 'Available combinations are verified individually. Unsupported combinations cannot be loaded.',
    modelFileSize: 'Download size', modelFormat: 'Format', license: 'License', inputSize: 'Input size', sizeHint: 'Smaller models favor speed. Larger models need more memory.',
    verifyingModel: 'Checking model inputs and outputs…', importModel: 'Import model', selectedFile: 'Selected file', noFileSelected: 'No file selected',
    running: 'Running', paused: 'Paused', stopped: 'Stopped', cameraStarting: 'Starting camera…', cameraStopped: 'Camera stopped.',
    cameraDisconnected: 'The camera was disconnected. Reconnect it or choose another camera.', cameraBusy: 'The camera is busy or could not be started. Close other apps using it and try again.',
    cameraUnsupported: 'This browser cannot access a camera. Use HTTPS in a supported browser, or upload a file.',
    cameraBackground: 'Camera stopped while the app was in the background. Start it again when ready.',
    fileUnsupported: 'This file could not be opened. Choose a supported image or video format.', mediaLoading: 'Opening file…',
    noDetections: 'No objects above the confidence threshold.', detections: '{count} detections', inferenceFailed: 'Inference failed',
    iouNotApplicable: 'IoU suppression does not apply to this model’s output.', iouClassification: 'IoU is not used for image classification.',
    downloadFailed: 'The model could not be downloaded. Check your connection and try again.', modelLoadFailed: 'This model could not be initialized.',
    webgpuFallback: 'WebGPU was unavailable. Running with WASM.', webgpu: 'WebGPU', wasm: 'WASM',
    saveUnavailable: 'Run a detection before exporting a result.', installIos: 'In Safari, tap Share and then Add to Home Screen.',
    installUnavailable: 'Use your browser’s install or Add to Home Screen option.', offline: 'Offline', online: 'Online',
    advancedImport: 'Import options', inferenceOnly: 'On-device inference', futureStudio: 'Studio', futureTraining: 'Experimental training',
    comingSoon: 'In development', futureDescription: 'This workspace is planned for a future release.', openMinimal: 'Open Minimal',
    downloadNote: 'The first load downloads the model. Future loads use your browser cache when available.',
    sourceNote: 'Publicly available models. See the model source and license before use.', selectDeviceHint: 'Camera names appear after you allow access.',
    zoomUnavailable: 'Native zoom is unavailable. Digital cropping is used.', cpuNote: 'WASM may be slower on mobile devices.',
    labelsNote: 'Unknown classes are displayed with their class index.', themeSystem: 'Follow system', display: 'Display',
    modelDetails: 'Model details', errorDetails: 'Details', modelCacheNote: 'Clearing model cache does not delete your files or settings.',
    processing: 'Processing…', browserNotice: 'Capability depends on the browser and device.', updated: 'Updated',
    highMemory: 'This model may exceed the memory available on your device.', thresholdHint: 'Lower confidence shows more results; higher confidence filters uncertain predictions.',
    dragDrop: 'Drop an image or video here', orChooseFile: 'or choose a file', deviceOnly: 'On-device',
    experimentalTraining: 'Experimental training ↗', backendHint: 'Changes apply the next time a model is loaded.',
  },
  zh: {
    resultsOptions: '结果选项', modelInspection: '模型信息', updateApp: '更新应用',
    minimal: 'Minimal V1.1', modelTitle: '让视觉，留在本地。',
    modelSubtitle: '选择模型，即刻开始。',
    launchTitle: '让视觉，留在本地。', launchSubtitle: '选择模型，即刻开始。',
    visionTask: '任务', modelScale: '大小', launchWorkbench: '打开工作台',
    localImportLink: '导入本地 ONNX', cameraOptions: '摄像头选项', backToModels: '选择模型',
    closeMenu: '关闭菜单', cameraSource: '摄像头来源', useLocalModel: '使用本地模型',
    detectionTask: '目标检测', segmentationTask: '实例分割', poseTask: '姿态估计', classificationTask: '图像分类', obbTask: '旋转框检测',
    modelUnavailableShort: '暂不可用', standardPrivacy: '画面只在你的设备上处理',
    downloadOnFirstUse: '首次使用时下载', cacheReady: '已缓存 · 可以加载', downloading: '正在下载…',
    initializing: '正在初始化…', languageShort: '中', performanceLabel: '性能',
    fullscreenFallback: '已展开画面 · 浏览器不支持全屏',
    onlineModels: '在线模型', localOnnx: '本地 ONNX', series: '模型系列', task: '视觉任务', modelSize: '模型大小',
    detection: '目标检测', segmentation: '实例分割', pose: '姿态估计', classification: '图像分类', obb: '旋转框检测',
    detectionHint: '使用边框定位画面中的物体', segmentationHint: '描绘每个物体的轮廓', poseHint: '识别人体关节与姿态',
    classificationHint: '识别整张图片的内容', obbHint: '检测任意角度的物体', chooseModel: '选择模型',
    modelReady: '可以加载', modelSource: '模型来源', downloadLoad: '下载并进入工作台', loadModel: '加载模型',
    localTitle: '本地 ONNX', localHint: '选择兼容的 ONNX 模型。', chooseOnnx: '选择 ONNX 文件',
    taskType: '任务类型', autoDetect: '自动识别', classNames: '类别名称',
    classNamesHint: '选填。每行一个名称，或使用逗号分隔，顺序需与模型类别一致。',
    compatibilityNote: '支持兼容的 float32 单输入 YOLO 模型。外部权重、自定义算子及其他导出结构可能需要专用适配器。',
    privacyTitle: '本地处理', privacyDescription: '画面只在你的设备上处理。模型下载需要联网。',
    workbench: '工作台', camera: '摄像头', uploadFile: '上传文件', switchModel: '切换模型', settings: '设置', theme: '切换主题',
    cameraTitle: '摄像头', cameraHint: '启动摄像头，开始实时检测。', startCamera: '启动摄像头', stopCamera: '停止摄像头',
    selectCamera: '选择摄像头', mirror: '镜像', zoom: '倍率', nativeZoom: '摄像头倍率', digitalZoom: '数字变焦', fullscreen: '全屏',
    exitFullscreen: '退出全屏', confidence: '置信度阈值', iou: 'IoU 阈值', showResults: '显示检测结果', parameters: '检测参数',
    performance: '性能', fps: '检测 FPS', latency: '检测延迟', backend: '运行后端',
    latencyDefinition: '延迟为一次完整推理耗时，包含预处理和后处理。FPS 按实际完成的检测次数计算，不是摄像头帧率。',
    chooseFile: '选择图片或视频', fileHint: '自动识别图片和视频。文件保留在你的设备上。',
    saveImage: '保存图片', saveJson: '导出 JSON', play: '播放', pause: '暂停', restart: '重新开始', language: '语言',
    appearance: '外观', system: '跟随系统', light: '浅色', dark: '深色', executionBackend: '推理后端',
    autoBackend: '自动 · 优先 WebGPU', wasmBackend: 'WASM · 兼容模式', cachedModels: '已缓存模型', clearCache: '清除模型缓存',
    storage: '存储空间', close: '关闭', installApp: '安装应用', offlineNote: '已下载模型可能支持离线使用。浏览器可能清理缓存，无法保证大型模型永久保留。',
    aboutVersion: 'Local YOLO · Minimal V1.1', modelLoading: '正在初始化模型…', downloadProgress: '正在下载模型…', cached: '已缓存在设备上',
    notCached: '需要下载', unavailable: '不可用', notVerified: '尚未验证', loading: '正在加载…', ready: '就绪',
    noCamera: '未找到摄像头。请连接摄像头，或上传图片、视频。',
    permissionDenied: '摄像头权限已被拒绝。请在浏览器网站设置中允许访问摄像头，然后重试。',
    copyDetails: '复制详情', export: '导出', localFilesStayLocal: '在你的设备上处理', privacy: '隐私，始于本地',
    back: '返回', cancel: '取消', retry: '重试', remove: '移除', download: '下载', model: '模型', taskLabel: '任务',
    file: '文件', unknown: '未知', noCachedModels: '暂未缓存任何模型。', cacheUnavailable: '浏览器存储不可用，模型仍可在本次会话运行。',
    cacheSaved: '模型已保存，可供离线使用。', cacheCleared: '模型缓存已清除。', storageUnavailable: '暂时无法获取存储空间估算。',
    storageUsed: '已使用 {used}，总配额 {quota}', modelUnavailable: '此模型组合尚未完成验证。',
    modelSelectHint: '逐项验证可用组合，未支持的组合无法加载。',
    modelFileSize: '下载大小', modelFormat: '格式', license: '许可证', inputSize: '输入尺寸', sizeHint: '小模型偏重速度，大模型需要更多内存。',
    verifyingModel: '正在检查模型输入与输出…', importModel: '导入模型', selectedFile: '已选文件', noFileSelected: '未选择文件',
    running: '运行中', paused: '已暂停', stopped: '已停止', cameraStarting: '正在启动摄像头…', cameraStopped: '摄像头已停止。',
    cameraDisconnected: '摄像头已断开。请重新连接，或选择其他摄像头。', cameraBusy: '摄像头被占用或无法启动。请关闭其他使用摄像头的应用，然后重试。',
    cameraUnsupported: '当前浏览器无法访问摄像头。请通过 HTTPS 使用支持的浏览器，或上传文件。',
    cameraBackground: '应用进入后台后，摄像头已停止。准备好后可重新启动。',
    fileUnsupported: '无法打开此文件。请选择浏览器支持的图片或视频格式。', mediaLoading: '正在打开文件…',
    noDetections: '没有高于当前置信度阈值的目标。', detections: '{count} 个结果', inferenceFailed: '推理失败',
    iouNotApplicable: '此模型输出不适用 IoU 抑制。', iouClassification: '图像分类不使用 IoU 阈值。',
    downloadFailed: '模型下载失败。请检查网络后重试。', modelLoadFailed: '无法初始化此模型。',
    webgpuFallback: 'WebGPU 不可用，已使用 WASM 运行。', webgpu: 'WebGPU', wasm: 'WASM',
    saveUnavailable: '请先执行一次检测，再导出结果。', installIos: '在 Safari 中点击分享，然后选择“添加到主屏幕”。',
    installUnavailable: '请使用浏览器的安装应用或添加到主屏幕选项。', offline: '离线', online: '在线',
    advancedImport: '导入选项', inferenceOnly: '本地视觉推理', futureStudio: 'Studio', futureTraining: '实验训练',
    comingSoon: '开发中', futureDescription: '此工作区将在后续版本提供。', openMinimal: '打开 Minimal',
    downloadNote: '首次加载需要下载模型。后续加载会优先使用可用的浏览器缓存。',
    sourceNote: '使用公开模型。请在使用前查看模型来源及许可证。', selectDeviceHint: '授权后可显示摄像头名称。',
    zoomUnavailable: '原生倍率不可用，使用数字裁切放大。', cpuNote: 'WASM 在移动设备上的速度可能较慢。',
    labelsNote: '未命名类别以类别编号显示。', themeSystem: '跟随系统', display: '画面',
    modelDetails: '模型详情', errorDetails: '详细信息', modelCacheNote: '清除模型缓存不会删除你的文件或设置。',
    processing: '正在处理…', browserNotice: '具体能力取决于浏览器和设备。', updated: '已更新',
    highMemory: '此模型可能超出设备可用内存。', thresholdHint: '降低置信度可显示更多结果；提高阈值可筛除不确定预测。',
    dragDrop: '将图片或视频拖到这里', orChooseFile: '或选择文件', deviceOnly: '设备本地',
    experimentalTraining: '实验训练 ↗', backendHint: '更改后在下次加载模型时生效。',
  },
};

let language;
try { language = globalThis.localStorage?.getItem('local-yolo-language'); } catch { /* Storage is optional. */ }
if (!['en', 'zh'].includes(language)) {
  language = (globalThis.navigator?.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function getLanguage() { return language; }

export function setLanguage(value) {
  language = value === 'zh' ? 'zh' : 'en';
  try { globalThis.localStorage?.setItem('local-yolo-language', language); } catch { /* Storage is optional. */ }
  if (globalThis.document) document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  return language;
}

export function t(key, variables = {}) {
  const message = messages[language][key] ?? messages.en[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(variables, name) ? String(variables[name]) : match);
}

export function translatePage(root = globalThis.document) {
  if (!root) return;
  if (globalThis.document) document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  const mappings = [
    ['data-i18n', null], ['data-i18n-title', 'title'], ['data-i18n-placeholder', 'placeholder'], ['data-i18n-aria', 'aria-label'],
  ];
  for (const [dataAttribute, targetAttribute] of mappings) {
    const elements = [...root.querySelectorAll(`[${dataAttribute}]`)];
    if (root.matches?.(`[${dataAttribute}]`)) elements.unshift(root);
    for (const element of elements) {
      const value = t(element.getAttribute(dataAttribute));
      if (targetAttribute) element.setAttribute(targetAttribute, value);
      else element.textContent = value;
    }
  }
}

export { messages };
