# Local YOLO Minimal V1.1 — 后续最终验收报告

**验收结论：未通过发布验收，不合并、不部署。** 当前开发成果完整保留。此次从远端 `develop/minimal-v1.1` 的 `e92166e193f2a32a592a21c28574b832aa1fad37` 恢复工作副本，没有重新开发项目，也没有重跑已通过的 25 模型矩阵。

验收时间：2026-10-20 晚间（America/New_York）；原始机器时间使用 UTC。应用指纹仍为 `ee5bfc2de06d9d6032a9be329c8138c097187cfb646fd9528368dc78e32bbb7e`。除验证记录引用外，推理、UI、依赖、模型定义和工作流均未改变。

## 文件和代码完整性

- `git fsck --full` 通过；175 个原有受控文件逐个重算 Git blob SHA-1，与远端提交完全一致，无缺失或损坏。
- 32 个 JavaScript/ES module 文件语法检查通过；62 个 JSON/Manifest 成功解析；38 个相对静态导入路径均存在。
- 25 个模型 ID、任务、尺寸、精确字节数、SHA-256 和 ONNX 签名，与原始真实测试证据交叉核对。25 张 PNG 的哈希及尺寸匹配。
- 重查 410 条实际输出样本、90 个 Node 原始输出张量记录，无数值/摘要矛盾；三份主要报告与当前应用指纹匹配。
- 未重新下载 2.17 GB 全部权重或重跑已通过推理；本次结论建立在完整保存、与未变更推理代码对应的真实证据上。原始完整性下载及实际推理记录并未用模拟数据替换。

原始检查：[完整性与证据审计 JSON](evidence/acceptance-audit.json)。

## 本次发现与处理

1. **修复 25 条陈旧验证引用。** `model-manifest.json` 的 `nodeValidation` 仍引用旧 `0f995593…` 批次，而所链接 JSON 已是当前 `ee5bfc2d…` 批次。仅把 runId、指纹、完成时间校准到已存在的真实结果。固定来源、权重哈希、模型大小、输入输出、运行代码与通过状态均未变化；没有改写原始推理结果或给旧结果套新指纹。修复前后明细见 [引用修复记录](evidence/acceptance-model-reference-fix.json)。
2. **关闭云端全屏淡出疑点。** 使用真实 YOLO26n / WASM 和固定真实 MP4 的 15 次拼接副本，分别在桌面、375×650 Chromium iframe 观察：播放期间 `.is-idle` 对应 opacity `0`；点击画面恢复至 `1`；独立退出有效。手机尺寸退出后无水平/垂直溢出，可见触摸目标均至少 44 px。未改动 UI 源码；旧 opacity `1` 观察保留。此结论不代表真机 iPhone、触摸硬件或原生 Fullscreen API 已验证。
3. **只重建受影响的生产包。** 清单注释进入 bundle，因此重跑构建与六组静态产物检查：全部通过；24 个文件、15 个 shell 预缓存条目，SW revision `e639ad67e128`。四个入口、Pages 子路径、图标及 WASM 配套资源均存在；无测试工具、模型或媒体被打进正式包。静态验证不等于真实 PWA 安装/离线通过。

证据：[桌面全屏 JSON](evidence/acceptance-fullscreen.json) · [桌面截图](evidence/acceptance-fullscreen-hidden.jpg) · [手机视口全屏 JSON](evidence/acceptance-phone-fullscreen.json) · [手机截图](evidence/acceptance-phone-fullscreen.jpg) · [当前构建](evidence/acceptance-build.json)。

## 25 模型真实推理结果

以下沿用已完成的真实测试，不代表本轮再次执行。单元格为“状态 / 真实任务图片结果数量”；分类为 top-5 数量，不是准确率。每模型还包含两个真实视频帧、后处理和资源释放记录。

| 模型 | Node WASM / 结果数 | Chrome WASM / 结果数 | WebGPU |
| --- | --- | --- | --- |
| yolo26-detect-n | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-detect-s | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-detect-m | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-detect-l | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-detect-x | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-segment-n | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-segment-s | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-segment-m | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-segment-l | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-segment-x | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-pose-n | 通过 / 4 | 通过 / 4 | 未验证 |
| yolo26-pose-s | 通过 / 4 | 通过 / 4 | 未验证 |
| yolo26-pose-m | 通过 / 4 | 通过 / 4 | 未验证 |
| yolo26-pose-l | 通过 / 4 | 通过 / 4 | 未验证 |
| yolo26-pose-x | 通过 / 4 | 通过 / 4 | 未验证 |
| yolo26-classify-n | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-classify-s | 通过 / 4 | 通过 / 5 | 未验证 |
| yolo26-classify-m | 通过 / 5 | 通过 / 5 | 未验证 |
| yolo26-classify-l | 通过 / 1 | 通过 / 5 | 未验证 |
| yolo26-classify-x | 通过 / 4 | 通过 / 5 | 未验证 |
| yolo26-obb-n | 通过 / 170 | 通过 / 172 | 未验证 |
| yolo26-obb-s | 通过 / 163 | 通过 / 163 | 未验证 |
| yolo26-obb-m | 通过 / 181 | 通过 / 181 | 未验证 |
| yolo26-obb-l | 通过 / 184 | 通过 / 184 | 未验证 |
| yolo26-obb-x | 通过 / 184 | 通过 / 185 | 未验证 |

逐项输入输出签名、SHA、任务样本、耗时与渲染：[兼容性矩阵](MODEL_COMPATIBILITY.md)、[Node 原始 JSON](model-validation-matrix.json)、[浏览器原始 JSON](browser-validation-matrix.json)。

Node 的 25 张实际渲染图已经人工复核。浏览器的实际渲染执行/像素变化已通过，但其 25 条 `render.visualReview` 字段仍为 `pending`；本轮没有将它们改为人工复核通过。分类留出图的真实误判也保留，不宣称全部图片识别正确。

## CI、原有功能与手机布局

最新 GitHub CI：[39531783945](https://github.com/unowhatpvp-alt/local-yolo/actions/runs/39531783945)，对应 `83acca20217317255f135a074cb3ed3ded888be1`。已重新读取远端 jobs 和原始日志：

- `npm test`：37 通过、0 失败、1 个可选 YOLO11 素材测试跳过；此前完整本地素材环境是 38/38，通过记录保留。
- 必需的 25 模型真实 Node/WASM：25/25 通过，生产构建通过。
- **整体 CI 为 failure**，唯一失败步骤是严格发布检查；37 个失败条件均为 GPU/安全 PWA 证据缺失，没有模型 WASM 或过期应用指纹错误。
- 最新旧提交 `e92166e…` 仅补报告，以 `[skip ci]` 避免递归重跑。本次开发验收记录和引用修复同样不触发完整模型重跑；不把旧 CI 冒充为新的全绿 CI。

下载/缓存/重载、本地 ONNX 导入、不兼容文件错误、图片和视频推理、PNG/JSON 导出、文件释放、模型切换，继续使用源指纹匹配的既有通过记录。375×812、390×844、844×390、768×1024 四种 Chromium 视口仍无溢出、无小于 44 px 的可见交互目标；本轮只补测此前未确认的全屏行为，没有重复四组已完成布局测试。

## 剩余发布阻碍

当前严格 Gate **37 项未满足**，仍维持原范围，没有降低或修改门槛：

- 25 个模型的真实硬件 WebGPU 或真实算子不支持后 WASM 回退验证。
- 1 项真实安全浏览器上下文。
- 11 项真实 PWA：Manifest 观察、SW 安装、离线冷启动、已缓存模型离线推理、缓存删除、更新等待、旧标签一致性、激活新版、不混用版本、存储故障恢复、子路径资源。

本次重新打开现有验证工具，云端 Chrome 154 仍报告 `secure context: false`、`GPU: environment-unavailable`。内部预览仅可使用 HTTP，当前可调用浏览器不能完成上述安全上下文/GPU 实验；没有以模拟浏览器对象、静态构建或禁用安全机制绕过。原始观察：[环境记录](evidence/acceptance-browser-environment.json)。

此外，真实 iPhone Safari / iOS PWA、物理摄像头、镜头切换、原生倍率、后台恢复及原生全屏仍未验证；Windows、macOS、Android、iPad 实机亦未执行。提供的 [真机步骤](PWA_VALIDATION.md) 保留。浏览器 25 张渲染的逐图人工复核仍待补齐。上述缺项未标记为通过。

## GitHub 和部署保护

- 仅修改 `unowhatpvp-alt/local-yolo` 的独立开发分支 `develop/minimal-v1.1`；验收记录为开发成果，不是最终发布版本。
- `main` 与 `backup/minimal-v1-2cea0eb` 仍为 `2cea0ebebd3399a77a2d649c44755e54ca0e16b0`。
- 最近成功的生产 Pages run 仍为 `39519330823`，对应同一 V1 SHA；V1.1 没有部署。
- 开发工作流无发布步骤/Pages 写入权限；生产工作流仅允许 main 且完整 Gate 通过。
- 当前线上 [Local YOLO](https://unowhatpvp-alt.github.io/local-yolo/) 继续提供原版。

本报告不构成发布批准。只有补齐现有范围的真实验证并通过原定门槛，才可合并和发布。
