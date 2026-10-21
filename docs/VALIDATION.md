# Minimal V1.1 应用验收快照

截至2026-10-21，应用已重新执行完整真实模型和浏览器测试：**Node WASM 25/25、内置 Chrome 155 WASM 25/25、真实 NVIDIA Blackwell WebGPU 25/25、56/56自动化测试、14/14应用交互检查均通过**。安全上下文PWA检查为**11/11通过**，严格本地Gate、可复现构建和6组静态验证通过。**本地发布验证通过。首次应用提交、GitHub CI、Pages运行及线上实测状态统一记录在[发布收据](DELIVERY.md)。**

当前源码/不可变模型指纹：`3f42cae598f691ad6de779f100a6a69f915baeb3075f3454b897f1a6c2bcdb4c`。JSON证据与本指纹绑定；旧报告备份为[接手前报告](diagnostics/pre-takeover-VALIDATION.md)，旧验收和失败记录保留，不把历史结果当作本轮执行。

## 目标与开始时状态

已确认目标是可通过GitHub Pages发布、在浏览器本地运行YOLO26的视觉工具；第一版本以黑白简洁UI、少量清晰操作、桌面/移动布局和稳定性为优先。25模型、图片/视频/摄像头、WASM/WebGPU、缓存、本地ONNX、中英、PNG/JSON和PWA为已有范围。Studio/训练页面属于保留入口，尚未实现完整产品，也不纳入本版本扩展。

开始时仓库已有V1.1的简化界面和大量真实WASM证据，但主文档仍混有V1的YOLO11说明，GPU和安全PWA缺验证，旧CI为失败；不能据此声称完整交付。实际审查另外发现菜单键盘/语义、全屏指针焦点、忙时阈值、文件状态、模型适配/缓存边界及验证工具的跨平台问题。

## 本轮完成

- 保留已有顶部任务/大小与单启动入口、折叠本地导入、预览优先工作台和次级导出/摄像头菜单。
- 修复桌面菜单箭头导航选中隐藏控件、上下首末边界、嵌套Escape焦点和菜单语义；倍率滑块保持原生箭头操作。
- 全屏淡出仅保护键盘可见焦点，鼠标/触摸遗留焦点不再阻止淡出；直接点击全屏后的淡出、恢复、退出已真实通过。
- 忙时置信度变化合并重跑最新阈值；真实Worker连续0.01→0.99回归通过，输出与高阈值实际基线一致。
- 显示当前文件名，替换/无效文件后清理旧导出和媒体状态；实际Blob URL释放、PNG/JSON下载、3002×2000→1920×1279坐标验证通过。
- 完善模型签名/后处理及缓存边界回归，保留原有功能；模型与验证代码的具体修改以提交diff和对应自动化断言为准。
- 完成Windows可运行的验证工具、当前源码绑定、真实浏览器UI/PWA检查模块，恢复此前缺失的测试证据。

## 当前完成度

| 范围 | 当前状态 | 证据与界限 |
| --- | --- | --- |
| 25个YOLO26模型、预处理/后处理/绘制/释放 | 已完成且验证 | 三种实际运行路径各25/25；[逐模型矩阵](MODEL_COMPATIBILITY.md) |
| WASM与硬件WebGPU | 已完成且验证 | Chrome155、真实NVIDIA Blackwell；不推广到所有设备 |
| 选择/下载/缓存/本地导入/图片/视频/导出 | 已完成且验证 | [browser JSON](browser-validation-matrix.json)的14项checks |
| 黑白UI、菜单/中英/主题、全屏、六视口 | 已完成且验证 | 本轮真实浏览器操作；视口模拟不是真机触摸 |
| 自动化回归 | 已完成且验证 | 56通过，0失败，0跳过；单元替身不冒充真实推理 |
| PWA注册/离线/更新隔离/存储恢复 | 已完成且验证 | 11/11真实安全上下文检查通过 |
| iPhone Safari、iOS PWA、物理摄像头/镜头/触摸 | 因环境限制未验证 | 保留真机复查步骤，不声称通过 |
| 首次应用提交、CI、Pages与线上状态 | 见发布收据 | [DELIVERY](DELIVERY.md)保存精确版本和实际观察 |
| Studio/实验训练完整功能 | 尚未实现、超出本版范围 | 保留原入口；额外产品目标待确认 |

## 测试证据

| 实际执行 | 结果 | 证据 |
| --- | --- | --- |
| Node24.19 / Windows / ORT Web1.23.2 WASM | 25/25 | [Node JSON](model-validation-matrix.json)、[说明](NODE_WASM_VALIDATION.md) |
| 内置Chrome155 / Windows / WASM | 25/25 | [browser JSON](browser-validation-matrix.json) |
| 同浏览器、真实NVIDIA Blackwell WebGPU | 25/25 | [独立GPU JSON](hardware-webgpu-matrix.json) |
| 实际应用交互 | 14/14 | browser JSON的checks与uiRun |
| 375×650、375×812、390×844、844×390、768×1024、1280×900 | 6/6 | 无文档溢出、无可见小于44px目标、预览contain |
| 安全localhost、两份真实生产构建PWA | 11/11 | [PWA JSON](pwa-validation.json)，含真实存储故障与恢复 |
| Chromium触摸模拟 | 4/4 | [touch JSON](touch-validation.json)，不是物理手机 |

每模型包含真实任务图、两帧实际解码MP4、任务绘制及生命周期观察。当前[25模型Node渲染汇总](model-validation-matrix.png)已人工查看；JSON中的`render.visualReview`字段仍保留原值，不借此宣称25张原分辨率图都独立精审。浏览器与GPU绘制有实际像素变化证据。

分类主金鱼参考5/5正确；另外十图诊断N/S/M/L/X的top-1分别为3/3/4/5/6（满分10），所有误判仍保留。兼容性通过验证输入/输出、概率、标签、变换与渲染，**不代表准确率100%或完整数据集基准成绩**。

## 本地复验、剩余工作与版本保护

存储故障已定位：Chromium已有IndexedDB的预留空间使quota override不立即阻止写入；在隔离测试库中重新建立连接后，真实失败/警告、5个公交结果的内存推理和解除配额后缓存恢复均通过。三次失败与真实配额诊断保留。

最终本地复验：56/56无跳过，生产构建revision `fe0bf848230e`可复现，6组静态产物检查通过，严格Gate通过且`errors=[]`；依赖审计所有级别0，44个JS/MJS语法、78个JSON/manifest解析及`git fsck`通过。首次发布的独立GitHub CI、提交、部署和线上实测见[发布收据](DELIVERY.md)；本节保留原始本地验收范围。

实现分支为`codex/minimal-v1-release`，原稳定提交`2cea0ebebd3399a77a2d649c44755e54ca0e16b0`与`backup/minimal-v1-2cea0eb`保留。不得强推或重写历史。发布和回滚状态统一记录在[DELIVERY](DELIVERY.md)，恢复步骤见[RELEASE_GATE](RELEASE_GATE.md)。
