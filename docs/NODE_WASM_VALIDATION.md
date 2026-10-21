# 当前YOLO26 Node WASM真实验证

**25/25通过，0失败、0缺失、非partial。** 本轮实际环境为Windows x64 / Node `v24.19.0` / ONNX Runtime Web1.23.2 WASM。run `f81baebd-d0ba-4787-aa28-17e57659e8be`，UTC `2026-10-21T20:10:33.774Z` 至 `2026-10-21T20:13:18.443Z`。源码指纹`3f42cae598f691ad6de779f100a6a69f915baeb3075f3454b897f1a6c2bcdb4c`，运行前后及逐模型记录一致；validator SHA-256为`f4da932bea629409008584eb0362f049a9f1ae6b607e5373db67ed50b0792106`。

## 复现与证据

```sh
npm ci
node scripts/fetch-yolo26-models.mjs
node scripts/fetch-yolo26-validation-fixtures.mjs
npm run validate:models
```

需要Python3提取精确ZIP成员、FFmpeg解码真实MP4；应用本身不依赖它们。模型在隔离子进程串行执行。缺失权重、摘要不匹配、断言失败、partial或源码变化不能通过。

[当前JSON](model-validation-matrix.json)包含模型固定来源/字节数/摘要、图签名、有限值统计、原始张量摘要、真实输出/耗时、任务绘制、裁切与实际session释放。当前[25模型contact sheet](model-validation-matrix.png)已人工查看；单图在`docs/evidence/yolo26/`。机器`render.visualReview`仍保留pending，未将contact sheet查看冒充每张原分辨率独立精审。

## 实际任务覆盖

| 任务 | 真实参考 | 关键断言 |
| --- | --- | --- |
| Detection | Ultralytics公交照片 | bus、有限坐标、裁切还原与范围 |
| Segmentation | 同照片 | 非空实例mask、尺寸与合成 |
| Pose | 同照片 | 每人17关键点、可信可见点与骨架 |
| Classification | 固定ImageNet10金鱼JPEG | top-1金鱼、1000有限概率与标签 |
| OBB | 真实航空船舶图 | ship、四点旋转多边形 |

每模型另外处理真实H.264 MP4的0/1秒帧、保留真实零目标场景并释放session。Nano还有多次真实load/infer/dispose生命周期观察。latency包含预处理/ONNX/后处理；Node额外张量统计会增加开销，不能作为浏览器或手机性能基准。

## 分类诊断和历史长运行记录

五分类模型的主金鱼参考全部正确；十图top-1为N3/10、S3/10、M4/10、L5/10、X6/10。每个误判/置信度/top-5/预期标签均在`classificationAccuracy`中保留；这是小图诊断，不是ImageNet基准或100%准确率保证。

旧480×640分类X误判金鱼的失败与标准224导出调查仍在`docs/diagnostics/`和[classification-source-investigation.json](classification-source-investigation.json)，没有将失败改写为通过。

此前250次Nano持续推理记录使用旧指纹`ee5bfc2d…`，是历史诊断，不声称本轮重跑或对当前源码的无限稳定性证明。旧完整说明保存在[接手前Node报告](diagnostics/pre-takeover-NODE_WASM_VALIDATION.md)。本轮自动化56/56、完整25模型和实际浏览器回归独立执行。

Node通过不代替浏览器、GPU或PWA。浏览器WASM和真实GPU已分别25/25通过，PWA11/11及本地严格Gate已通过，最终GitHub CI/部署及线上验收尚待完成；发布状态见[DELIVERY](DELIVERY.md)。
