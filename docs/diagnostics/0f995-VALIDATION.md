# Local YOLO Minimal V1.1 — 最终开发与验证报告

**结论：开发成果保留在 `develop/minimal-v1.1`，不合并、不发布。** 真实 Node/WASM 和 Chrome/WASM 均为 **25/25 通过**。严格 Release Gate 为 **不通过**：25 个 WebGPU 项、HTTPS 安全上下文及 11 个真实 PWA 项仍缺少可执行环境证据，共 37 个阻断条件。没有删减模型范围，也没有把不可用环境改成通过。

最终应用/不可变模型清单指纹：`0f9955933f5a6ccf170f3ca1880433c5bc6eef090de993388cda8dcac2d1a579`。验证标签的提升不改变该指纹；推理、UI、依赖、PWA 或实际模型定义改变都会使证据失效。规则见 [Release Gate](RELEASE_GATE.md)。

## 版本保护与交付范围

- 仓库仅为 `unowhatpvp-alt/local-yolo`，默认分支 `main`。
- 保留原线上 SHA：`2cea0ebebd3399a77a2d649c44755e54ca0e16b0`。
- 回滚分支：`backup/minimal-v1-2cea0eb`，与原线上提交一致。
- 开发分支：`develop/minimal-v1.1`。未向 main 写入，未触发 V1.1 Pages 发布。
- 开发工作流只有验证、没有 Pages/OIDC 权限或部署步骤；生产工作流要求 main 且完整 Gate 通过。
- 推送前的默认分支、三个 ref 和最后一次生产运行记录见 [BASELINE_PROTECTION.json](BASELINE_PROTECTION.json)。原 V1 验证文档保存在 [历史报告](diagnostics/baseline-v1-validation.md)。
- 其他三个入口仍保留独立扩展目录；训练实验不进入正式推理运行路径。未修改其他 GitHub 项目。

## 代码与 UI 修改

固定 YOLO26，移除在线 YOLO11 选择器。首页只保留顶部任务/尺寸自定义菜单、中央名称/缓存/启动及按需展开的本地 ONNX。工作台以画面为主，设备/镜像/倍率收进次级菜单，只显示 Confidence、低调的真实 FPS/ms 和后端；IoU 核心保留，Minimal 默认 0.45。

新增克制的页面、菜单、按钮、加载与全屏控制栏过渡，尊重减少动画偏好；适配安全区域、动态视口、44px 触摸区域及页面级全屏回退。修复预览拉伸、极小分类图文字重叠、高分辨率取整裁切越界、后台授权与播放的异步边界、取消初始化及模型资源切换。

[UI 前后对比及截图](UI_COMPARISON.md)。[模型来源、导出参数与许可](MODEL_PROVENANCE.md)。应用仍为纯静态前端，Python 文件仅是可选的开发预处理对照工具，不是服务或运行依赖。

## 25 个实际模型组合

| 任务 | 尺寸范围 | Node WASM | Chrome WASM | WebGPU |
| --- | --- | --- | --- | --- |
| Detection | N / S / M / L / X | 5/5 通过 | 5/5 通过 | 5 未验证 |
| Segmentation | N / S / M / L / X | 5/5 通过 | 5/5 通过 | 5 未验证 |
| Pose | N / S / M / L / X | 5/5 通过 | 5/5 通过 | 5 未验证 |
| Classification | N / S / M / L / X | 5/5 通过 | 5/5 通过 | 5 未验证 |
| OBB | N / S / M / L / X | 5/5 通过 | 5/5 通过 | 5 未验证 |

完整逐模型结果、精确来源/签名/体积、真实计数、分数、延迟、两帧结果、可视化和释放次数：

- [25 行兼容性矩阵](MODEL_COMPATIBILITY.md)、[Node JSON](model-validation-matrix.json)、[Node CSV](model-validation-matrix.csv)。
- [浏览器 25 行报告](BROWSER_VALIDATION.md)、[浏览器 JSON](browser-validation-matrix.json)、[浏览器 CSV](browser-validation-matrix.csv)。
- [25 个真实任务渲染汇总](evidence/yolo26-matrix.png)；单图位于 `evidence/yolo26/`。
- [精确清单与 SHA-256](../src/core/model-manifest.json)、[实际下载记录](model-download-evidence.json)、[图元数据](model-metadata-evidence.json)。全部 25 个实际 GET 的字节数、SHA 和公开 CORS 已核验。

20 个空间任务使用固定版的 480×640 原始导出；5 个分类模型使用另一固定来源的标准 224×224 导出，分别记录版本/路径/哈希。不是重命名 YOLO11。额外真实的五任务 Nano 端到端导出及旧 YOLO11 本地兼容回归也通过。

最初 480×640 分类 X 在金鱼参考图上误判，**原失败保留**于 `diagnostics/initial-node-matrix.json`，未改成通过。与官方预处理/PIL 对照后，改用真实标准 224 导出；全部 5 个分类模型通过原金鱼及原尺寸公交参考。10 张微小留出图仍存在误判，完整保留，不能据此宣称 100% 准确率或 ImageNet 基准成绩。见 [分类来源调查](classification-source-investigation.json) 及 Node 报告。

## 实际执行范围

| 环境 | 实际完成 | 限制 |
| --- | --- | --- |
| Linux / Node 24 / ORT Web 1.23.2 WASM | 25 模型、真实任务图片、真实 MP4 的 0/1 秒帧、原始输出有限值/签名/哈希、后处理、PNG、实际 session release；Nano 每个额外释放循环 | 不是浏览器或 GPU |
| 云端 Chrome 154 / Linux | 25 模型，全部走正常 verified 清单/缓存路径；真实图片、HTMLVideoElement 实际解码的两帧、任务绘制、Worker 终止 | HTTP，无 navigator.gpu/真实摄像头/安全 SW |
| Chromium iframe | 最终代码的 375×812、390×844、844×390、768×1024：无文档溢出，可见交互目标均至少 44px，预览 contain | 仅视口检查，不是 Safari、iPhone 或 iPad 模拟器 |
| iPhone Safari / iOS PWA | 未真机验证，已提供操作步骤 | 不声称手机 GPU、镜头、安装、后台或安全区域真机通过 |
| Windows / macOS / Android / iPad 浏览器 | 未在实际设备运行 | 功能检测与 WASM 路径不能代替设备结果 |

38 项自动化测试通过、0 失败/跳过，包含真实 YOLO26 五任务 Nano、真实端到端导出及旧 YOLO11 回归。几何、摄像头异常、Blob 清理和 PWA API 生命周期的模拟测试仅验证变换/API 行为，不冒充真实摄像头或推理。日志：[final-tests.txt](evidence/final-tests.txt)。

Nano 另外完成 250 次真实串行持续推理及释放。最后窗口 RSS 范围约 2.34 / 2.32 / 5.02 / 0.34 / 3.50 MiB（检测/分割/姿态/分类/OBB），只是当前 Node 主机观察，不保证手机内存、温度或长期运行。原始紧循环的内存增长诊断也保留。详见 [Node 方法与内存观察](NODE_WASM_VALIDATION.md)。

## 实际应用流程

- 逐一选择 25 个自定义任务/尺寸组合，名称正确、按钮可用：[记录](evidence/browser-25-ui-selections.json)。
- 删除真实 Nano 缓存后，首页变为首次下载，显示 0.0 / 9.4 MB 真实进度，下载后自动初始化；返回首页识别缓存并再次加载：[进度](evidence/browser-ui-download-progress.json)、[缓存重载](evidence/browser-ui-cache-reload.json)。
- 实际文件选择器导入真实本地 ONNX，再进行图片及视频推理；128 字节截断文件具体报错 `ONNX protobuf is truncated.`：[导入记录](evidence/browser-local-import.json)。外部权重、任意自定义图与所有手动标签组合不在真实文件测试范围，界面没有承诺通用 ONNX 支持。
- 3002×2000 的真实公交照片派生文件完成推理，输出 1920×1279；JSON 记录实际 scaleX/scaleY，解决独立取整后的越界和映射误差。实际 PNG 2,136,157 字节，JSON 1814 字节，内容/尺寸/SHA 已读取：[导出证据](evidence/browser-exports.json)。测试工具只观察实际 Blob，不替换推理/输出，也不阻止浏览器下载。
- 自动区分图片和真实 H.264 视频；单图推理、逐帧播放、暂停、重播、文件替换与原图片 Blob src 清除均已观察。长控制测试为原真实录像的 6 次重复，明确标记，并非伪造视频检测。
- 全屏回退、2.6 秒空闲淡出、触摸恢复、始终可用的退出按钮已实际验证：[全屏/视频](evidence/browser-video-fullscreen.json)。原生全屏与真机镜头仍未验证。
- 实际完成 FPS/ms 显示已观察：[性能记录](evidence/browser-live-performance.json)。延迟为预处理 + session.run + 后处理，不含 Worker 传输、画面采集/呈现和调度；FPS 来自完成结果的滚动窗口。没有展示虚构的 GPU 利用率/显存。
- 实际摄像头能力不可用错误及中英文切换正确；没有伪造摄像头画面。权限拒绝、晚到媒体流、断开与倍率的 API 测试不计入物理设备通过。
- 应用和完整浏览器矩阵没有采集到产品控制台错误/警告，云端扩展自身的消息另行排除：[控制台](evidence/browser-console.json)。
- 实际媒体/导出期间观察的应用资源请求与源码审查没有发现媒体或结果上传；模型仅从公开来源下载。测试报告仅包含公开测试素材，没有个人摄像头或个人上传文件。

## PWA、构建与 Pages 子路径

最终串行生产构建及 6 组独立静态验证通过：24 个生产文件、15 个有效 shell 缓存条目、正确 `/local-yolo/` 资源路径、四个入口/返回链接、真实 192/512/maskable PNG 图标、匹配的 Runtime 模块/WASM、确定性 SW 版本。开发测试页面、模型权重与媒体没有进入产物。[构建记录](build-verification.json)、[最终构建日志](evidence/final-build.txt)。

8 项 PWA 生命周期单元测试通过，但它们不是安装/离线/更新的真实浏览器证据。当前预览是 HTTP；真实 SW 安装、离线冷启动、缓存模型离线推理、等待更新、旧标签一致性、新版本激活、无混版及存储故障恢复仍全部不可验证。[PWA 详细报告和设备步骤](PWA_VALIDATION.md)、[机器记录](pwa-validation.json)。

## 未解决问题与发布决定

1. 25 个模型缺少安全浏览器中的真实 WebGPU 推理，或真实适配器上算子失败后 WASM 回退的证据。当前自动使用 WASM 已观察；不能把无 GPU 环境算成 GPU 通过。
2. 缺少 HTTPS 环境中真实 PWA 安装、离线、缓存与两版本更新测试。静态构建和模拟 API 测试不替代这些项目。
3. 物理摄像头、摄像头切换/原生 zoom、真实手机 GPU、iOS PWA、背景恢复和原生全屏仍需设备测试。具体步骤已提供。
4. 分类保留真实误判；大模型有手机内存/速度风险。不能承诺准确率、所有媒体编码支持或永久离线保存。

严格检查以退出码 1 拒绝发布，37 项均为上述 WebGPU/PWA 环境证据缺口；Node、浏览器 WASM、实际 UI、模型范围和指纹没有 Gate 错误：[release-gate-result.json](release-gate-result.json)。未合并、未发布，现有网站继续使用原版本。后续须由用户决定可用的 HTTPS/WebGPU 验证环境，再补齐证据；本轮不会绕过 Gate 或自行缩小范围。
