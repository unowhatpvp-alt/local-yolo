# 当前实际浏览器验证 — Minimal V1.1

**WASM 25/25、真实硬件WebGPU 25/25、应用UI检查14/14通过。** 本轮是Windows内置Chrome155的实际运行；GPU适配器实际报告`vendor=nvidia`、`architecture=blackwell`并取得adapter，不是软件标签或WASM回退。浏览器上下文为安全localhost。iPhone/Safari与物理摄像头仍未验证。

源码指纹：`3f42cae598f691ad6de779f100a6a69f915baeb3075f3454b897f1a6c2bcdb4c`。ONNX Runtime Web1.23.2。WASM run `f8f764db-b22a-4df0-a9bf-25b548eae83b`；WebGPU run `8ce26457-6628-4815-bafe-9849599e6f11`。运行时间和原始输出分别保留在[browser JSON](browser-validation-matrix.json)与[独立硬件GPU JSON](hardware-webgpu-matrix.json)。该GPU文件的UI checks仍为pending，因为它只做模型矩阵；合并报告的14项UI证据来自后续实际应用检查，不能把两者混为一谈。

## 模型矩阵

25模型均实际执行固定真实任务图片、HTMLVideoElement解码MP4的两个时间点、任务后处理/渲染与Worker释放。每行记录固定模型摘要/字节数、实际后端、结果样本、耗时、绘制像素变化及生命周期。完整逐模型结果见[MODEL_COMPATIBILITY](MODEL_COMPATIBILITY.md)。Node结果独立记录，不代替浏览器结果。

## 应用交互

| 检查 | 本轮状态 |
| --- | --- |
| 25任务/大小组合、名称/字节数/可用性 | 通过 |
| 模型切换、真实本地ONNX导入 | 通过 |
| 删除真实缓存后下载进度、缓存识别/重载 | 通过 |
| 真实图片、PNG和JSON实际下载 | 通过 |
| 视频暂停/重播、文件替换和Blob释放 | 通过 |
| 手机/平板视口、摄像头真实不可用错误 | 通过 |
| 本地媒体操作没有HTTP上传请求 | 通过 |

上述对应机器check为`modelSelection25`、`modelSwitching`、`downloadProgress`、`cacheRecognition`、`cachedReload`、`localOnnxImport`、`imageExport`、`jsonExport`、`videoPauseReplay`、`fileReplacementCleanup`、`responsivePhone`、`responsiveTablet`、`permissionDeniedOrUnavailable`、`noMediaNetworkRequests`；全部14项当前为pass。

额外回归已实际执行：桌面ArrowDown/ArrowUp/Escape及焦点恢复；中文/英文与明暗切换；同一JS任务内0.01→0.99触发真实忙时阈值重跑；3002×2000真实公交派生图片输出1920×1279，`scaleX=1920/3002`、`scaleY=1279/2000`，5个实际结果。没有延迟或替换推理API制造成功。

## 布局与全屏

六视口375×650、375×812、390×844、844×390、768×1024、1280×900均无文档溢出、无可见小于44px目标，预览contain。真实视频推理时直接点击全屏即可自动淡出，交互恢复至可见，独立退出有效；键盘可见焦点仍受保护。当前布局/全屏观察在[PWA实际运行JSON](pwa-validation.json)的viewports/videoFullscreen字段。

额外[Chromium触摸模拟](touch-validation.json)4/4通过：真实tap菜单/图片/阈值/全屏流程，使用实际模型和媒体。它与上述视口检查都不是iPhone/iPad真机、物理触摸硬件或手机GPU验证。实际摄像头授权成功/镜头切换/原生倍率/后台恢复未在物理硬件验证。分类存在真实误判，模型兼容结果不代表识别准确率。

## 发布状态

安全PWA为11/11，本地严格Gate及完整构建验收通过；首次GitHub CI、应用提交、Pages运行及线上实测状态见[发布收据](DELIVERY.md)。本浏览器通过不单独构成发布结论。旧Chrome154与GPU不可用报告保存在[接手前报告](diagnostics/pre-takeover-BROWSER_VALIDATION.md)，未重标为当前结果。
