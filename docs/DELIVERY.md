# Minimal V1.1 候选交付收据

**本地发布准备通过；最终GitHub CI、提交、Pages部署和线上验收待完成。** 更新日期2026-10-21。当前源码指纹`3f42cae598f691ad6de779f100a6a69f915baeb3075f3454b897f1a6c2bcdb4c`。

| 项目 | 当前状态 |
| --- | --- |
| 自动化测试 | 56通过，0失败，0跳过 |
| Node WASM | 25/25真实模型通过 |
| 内置Chrome155 WASM | 25/25真实模型通过 |
| NVIDIA Blackwell硬件WebGPU | 25/25真实模型通过 |
| 应用交互/额外UI回归 | 14/14通过；忙时阈值/高分辨率坐标通过 |
| 六视口/直接全屏淡出恢复退出 | 通过；不是物理手机验证 |
| 真实安全PWA | 11/11通过，含真实存储故障恢复 |
| Chromium触摸模拟 | 4/4通过；不是物理触摸硬件 |
| 本地严格Gate/构建/静态产物 | Gate通过errors=[]；revision fe0bf848230e；6组静态检查通过 |
| 文件/依赖完整性 | 44脚本语法、78 JSON/manifest解析、git fsck通过；audit所有级别0 |
| 最终GitHub CI | 待运行/确认；不沿用旧失败run为当前状态 |
| 最终Git提交SHA | 待提交后补录 |
| Pages候选版部署/线上实际验收 | 待满足条件后执行 |
| 正式发布标准 | 本地准备通过；须补独立CI与线上实际验收 |

详见[完整验收](VALIDATION.md)、[UI简化](UI_COMPARISON.md)、[25模型](MODEL_COMPATIBILITY.md)、[浏览器](BROWSER_VALIDATION.md)、[PWA](PWA_VALIDATION.md)。原始证据为[Node JSON](model-validation-matrix.json)、[browser JSON](browser-validation-matrix.json)、[硬件GPU JSON](hardware-webgpu-matrix.json)及[PWA JSON](pwa-validation.json)。

当前工作分支为`codex/minimal-v1-release`。稳定基线`2cea0ebebd3399a77a2d649c44755e54ca0e16b0`及`backup/minimal-v1-2cea0eb`保留。站点地址为[Local YOLO](https://unowhatpvp-alt.github.io/local-yolo/)；地址本身不能证明本候选已部署，须补充成功Pages run、实际部署SHA和线上推理观察。

iPhone Safari、iOS主屏幕安装、物理摄像头/镜头/原生倍率、真实触摸硬件仍未验证。分类十图诊断N/S/M/L/X top-1为3/3/4/5/6，金鱼主参考5/5；不宣称100%准确率。

本地全部必要验证与严格Gate已通过。接下来完成独立GitHub CI、提交/推送，并在满足条件后部署与线上复验。若尚未发布，保持旧站即可；发布后的恢复应准备独立恢复分支或复用以前已验收的Pages产物，按[回滚方案](RELEASE_GATE.md)执行，不强推、不删除备份、不削弱Gate。

接手前的CI/验收/交付记录保存在[历史收据](diagnostics/pre-takeover-DELIVERY.md)和diagnostics，均维持原指纹与原结论。
