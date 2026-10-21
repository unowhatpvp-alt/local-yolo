/**
 * Minimal V1.1 online registry: genuine YOLO26 exports only.
 * The complete immutable model manifest carries the 5-task × 5-size matrix,
 * exact sizes/digests, provenance, geometry, and separate validation states.
 * Legacy YOLO11 local import compatibility lives in the adapters, not here.
 */
import manifest from './model-manifest.json' with { type: 'json' };
export const SERIES = ['YOLO26'];
export const TASKS = [
  { id: 'detect', label: 'Detection', labelZh: '目标检测', description: 'Boxes and object classes', descriptionZh: '识别目标位置与类别' },
  { id: 'segment', label: 'Segmentation', labelZh: '实例分割', description: 'Individual object masks', descriptionZh: '显示每个物体的像素遮罩' },
  { id: 'pose', label: 'Pose', labelZh: '姿态估计', description: 'Human keypoints and skeletons', descriptionZh: '人体关键点与骨架' },
  { id: 'classify', label: 'Classification', labelZh: '图像分类', description: 'Classify the entire image', descriptionZh: '识别整张图片的类别' },
  { id: 'obb', label: 'OBB', labelZh: '旋转框检测', description: 'Oriented object boxes', descriptionZh: '检测带有旋转角度的目标框' }
];
export const MODEL_REVISIONS = manifest.sources.map(({repository,revision}) => ({repository,revision}));
export const MODEL_MANIFEST = manifest;
export const MODELS = manifest.models;
export const SERIES_NOTES = {
  YOLO26: {
    en: '25 YOLO26 exports: 5 tasks × N/S/M/L/X. Source, integrity and per-model validation are recorded. Large models can exceed mobile memory limits.',
    zh: 'YOLO26 共 25 个导出模型：5 种任务 × N/S/M/L/X。记录来源、完整性及逐模型验证状态。大型模型可能超出移动设备的可用内存。'
  }
};
