/**
 * Audited export registry. An upstream task/size existing is not a claim that an
 * export was tested. Only status:"verified" entries can be downloaded in-app.
 * Provenance: community ONNX exports of upstream Ultralytics YOLO11 checkpoints.
 * License: https://www.ultralytics.com/license (AGPL-3.0).
 * Export card: https://huggingface.co/unileon-robotics/YOLO11-ONNX
 * Raw input/output execution: ORT Web 1.23.2, WASM, one thread, FP32 batch=1.
 */
export const SERIES = ['YOLO11', 'YOLO26'];
export const TASKS = [
  { id: 'detect', label: 'Detection', labelZh: '目标检测', description: 'Boxes and object classes', descriptionZh: '识别目标位置与类别' },
  { id: 'segment', label: 'Segmentation', labelZh: '实例分割', description: 'Individual object masks', descriptionZh: '显示每个物体的像素遮罩' },
  { id: 'pose', label: 'Pose', labelZh: '姿态估计', description: 'Human keypoints and skeletons', descriptionZh: '人体关键点与骨架' },
  { id: 'classify', label: 'Classification', labelZh: '图像分类', description: 'Classify the entire image', descriptionZh: '识别整张图片的类别' },
  { id: 'obb', label: 'OBB', labelZh: '旋转框检测', description: 'Oriented object boxes', descriptionZh: '检测带有旋转角度的目标框' }
];
export const MODEL_REVISION = '0e2a3f195ae62a25bc038ee9665b8e4ac5b98793';
const source = `https://huggingface.co/unileon-robotics/YOLO11-ONNX/tree/${MODEL_REVISION}`;
const upstream = 'https://huggingface.co/Ultralytics/YOLO11';
const audited = {
  detect: { suffix: '', bytes: 10699288, sha256: 'baeb4c1d6f3bb460689823cc2d40daa31e6156f2517fcd48aab0db9490d9f4e5', outputShapes: [[1,84,6300]], classes: 80 },
  segment: { suffix: '-seg', bytes: 11721598, sha256: 'f2616a376c3999dfecad4e1e4488c7a2729edf1c74081e74fdc9bdff4a1d6547', outputShapes: [[1,116,6300],[1,32,120,160]], classes: 80 },
  pose: { suffix: '-pose', bytes: 11786115, sha256: '84159992482a6011cea95f352180cdef6088808c11872a823e2f2a868a31d0b9', outputShapes: [[1,56,6300]], classes: 1 },
  classify: { suffix: '-cls', bytes: 11292967, sha256: '5e3cb11b796da3d1ce785ff08f8640c7b56bfceecd4ea222e3801dbbba771c80', outputShapes: [[1,1000]], classes: 1000 },
  obb: { suffix: '-obb', bytes: 10820692, sha256: 'c3ec434f4697e8f74d85286fea9644e7f72918585d46ede56bf957d92ebeb5e9', outputShapes: [[1,20,6300]], classes: 15 }
};
// Sizes and content hashes below are observed from the pinned HF file/LFS API;
// listing one does not enable it or claim that its runtime path was tested.
const sizes = {
  detect: { S: [38009680,'ade501f5c53ea4c771e2c014c86ff79e187698ec9d56442473b4f00a73c8fbc3'], M: [80631583,'a627d319b78acd49fc0b36b7fd9c214579750439c99e9266ffadc36a13317d29'], L: [101701963,'0a55ab0447cff45bf626ae77345d8fa8f53d02b061b8c6883f5fef789d118a6f'], X: [228015717,'dd31caa5c188bb10b6b87f06c345e5e35be3b31c0601bfaf2db186a86b3ebcd1'] },
  segment: { S: [40638417,'a187920739d565aee2ff5ecc0c710eeb2387ffb105afc6ddbbd4652052e604ca'], M: [89865388,'6ddbf8620ea851da85a1036d1aeaa189cb42028266d215c0cf8c4de72668a617'], L: [110935768,'820d8b4e2dc2537ffaacb546ae29ee7609f9ce0673afd02c2f0282bea4e25bcc'], X: [248728824,'76926da1f4a825fb25ebfca8f5f0e4a360fd69aeaf50de8a460123ff0201e72e'] },
  pose: { S: [39932348,'8a002d24c9e35f734aac84f626bb6a36a3117d44c2d7841dea7de35994c83846'], M: [83906707,'0e8eae78a6e46d2e1a0f7b00f4955f693c6a4172d256b08e9bd8a56ef557ea71'], L: [104977087,'ca16979db31f1a693218e60937fcb1ffb0957de05c06d05118cc3726348d6023'], X: [235429219,'f1e34abdf69c99cd6862e0303fba620a7646d13500ca338c82e326d149732d14'] },
  classify: { S: [26925511,'3f30e8cc3fe5d6abdd5db1448f9e52a6386e1366e3c278d41f373c6f539bf6d1'], M: [46567454,'26d7500455773da1da5b9a64952bc51eff71e3f0cfc7194f233914fddb939b9b'], L: [56514435,'5fe1d64e99e2b4476e12cfa5166c33242c75daacf73535221382077c298fe88a'], X: [118570389,'c3329a81adc0ac91ed1e8edfe17b2106813821987c2cdc521cc108fcb56c608d'] },
  obb: { S: [39012837,'a78b93fdf4a5c0ca04d0486e595dd41baa6cf48fa53c9a803d8821fcda000581'], M: [83784764,'ec44370fc234b59d49125d45396dda19c71664fa3cafb9a2875d3e86ceacb52d'], L: [104855144,'ee28a0acbf723f10e6ff911083c13ade3f89808fb948808cbefc3a9fd185a9e0'], X: [235309580,'c49dcda89edb28860ff6a2b8c6240378d0c80de6154979a61b9b0c8ab24b8d66'] }
};
// Parent integration promotes each N entry only after real-image adapter verification.
const VERIFIED_TASKS = new Set(['detect','segment','pose','classify','obb']);
export const MODELS = TASKS.flatMap(({ id: task }) => ['N','S','M','L','X'].map(size => {
  const audit = audited[task];
  const filename = `yolo11${size.toLowerCase()}${audit.suffix}.onnx`;
  const isNano = size === 'N';
  return {
    id: `yolo11-${task}-${size.toLowerCase()}`, name: `YOLO11${size.toLowerCase()}${audit.suffix}`,
    series: 'YOLO11', task, size, format: 'yolo11-raw', fileFormat: 'ONNX FP32',
    url: `https://huggingface.co/unileon-robotics/YOLO11-ONNX/resolve/${MODEL_REVISION}/${filename}`,
    bytes: isNano ? audit.bytes : sizes[task][size][0], sha256: isNano ? audit.sha256 : sizes[task][size][1],
    revision: MODEL_REVISION, license: 'AGPL-3.0', source, upstream,
    inputSize: 640, inputWidth: 640, inputHeight: 480, inputShape: [1,3,480,640],
    outputShapes: audit.outputShapes, classes: audit.classes,
    compatibility: 'FP32 NCHW · batch 1 · WebGPU preferred / WASM fallback',
    status: isNano && VERIFIED_TASKS.has(task) ? 'verified' : 'unverified',
    reason: isNano ? 'Verified with real image inference using ONNX Runtime Web WASM' : 'This size has not been tested in Local YOLO V1.',
    reasonZh: isNano ? '已通过 ONNX Runtime Web WASM 真实图片推理验证' : '此尺寸尚未通过 Local YOLO V1 的实际测试。'
  };
}));
export const SERIES_NOTES = {
  YOLO11: { en: 'Only individually tested exports are enabled. Models are downloaded from a pinned community export of Ultralytics checkpoints.', zh: '仅启用逐项验证的导出模型。模型来自固定版本的 Ultralytics 权重社区 ONNX 导出。' },
  YOLO26: { en: 'Not yet verified for this app. Import a compatible local ONNX export, or choose YOLO11.', zh: '此应用尚未验证在线 YOLO26 模型。可导入兼容的本地 ONNX，或选择 YOLO11。' }
};
