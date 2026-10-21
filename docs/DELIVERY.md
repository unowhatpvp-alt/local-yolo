# Minimal V1.1 首次应用发布收据

**首次应用版本e791802已完成生产部署和线上验收；本收据固定记录该次应用发布，后续文档提交另走正常CI。** 更新日期2026-10-21。当前源码指纹`3f42cae598f691ad6de779f100a6a69f915baeb3075f3454b897f1a6c2bcdb4c`。

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
| 候选分支push / PR CI | 两次success；每次56 tests、55 pass、0 fail、1项可选旧YOLO11素材skip；该项本地已真实通过 |
| 实现提交 / 首次应用合并 | `038a1a4ac6a044060aa170dfbdcc8480b1181dd0` / `e791802f395fa47a2464ceb5b283025b7093c619`，普通merge [PR #1](https://github.com/unowhatpvp-alt/local-yolo/pull/1) |
| 首次生产Pages / 线上实测 | [run39678500898](https://github.com/unowhatpvp-alt/local-yolo/actions/runs/39678500898) build/deploy均success；线上真实WebGPU、缓存WASM重载及实际导出通过 |
| 正式发布结论 | 达到当前Windows/Chromium已验证范围内的第一版本发布标准；iPhone Safari/iOS安装、物理摄像头及触摸硬件仍未验证 |

详见[完整验收](VALIDATION.md)、[UI简化](UI_COMPARISON.md)、[25模型](MODEL_COMPATIBILITY.md)、[浏览器](BROWSER_VALIDATION.md)、[PWA](PWA_VALIDATION.md)。原始证据为[Node JSON](model-validation-matrix.json)、[browser JSON](browser-validation-matrix.json)、[硬件GPU JSON](hardware-webgpu-matrix.json)及[PWA JSON](pwa-validation.json)。

实现分支为`codex/minimal-v1-release`，已通过普通PR合并为上述首次应用提交。稳定基线`2cea0ebebd3399a77a2d649c44755e54ca0e16b0`及`backup/minimal-v1-2cea0eb`保留。站点地址为[Local YOLO](https://unowhatpvp-alt.github.io/local-yolo/)；首次生产运行：[39678500898](https://github.com/unowhatpvp-alt/local-yolo/actions/runs/39678500898)。UTC 2026-10-21T21:42:05.977Z完成[线上实测收据](online-validation.json)：应用资源`assets/index-BppwNdth.js`与候选产物一致，中英切换成功。YOLO26n的[真实WebGPU导出](online-webgpu-results.json)和[缓存WASM重载导出](online-wasm-results.json)均为1个bus、4个person，后端标记正确，框在810×1080范围内，两后端最大框差0.000274658203125像素。PNG实际下载810×1080并人工查看；console errors为空。相机显示真实无设备错误，未将其当成摄像头采集通过。

iPhone Safari、iOS主屏幕安装、物理摄像头/镜头/原生倍率、真实触摸硬件仍未验证。分类十图诊断N/S/M/L/X top-1为3/3/4/5/6，金鱼主参考5/5；不宣称100%准确率。

本收据固定记录首次实测应用提交`e791802f395fa47a2464ceb5b283025b7093c619`。候选push运行[39677756523](https://github.com/unowhatpvp-alt/local-yolo/actions/runs/39677756523)和PR运行[39677943335](https://github.com/unowhatpvp-alt/local-yolo/actions/runs/39677943335)均success；CI执行实际UI14、PWA11、触摸4和严格Gate，并校验/复用本轮25模型及硬件GPU证据，不声称托管CI再次取得同一硬件GPU。

完整CI原始日志：[候选push](diagnostics/release-ci-push-39677756523.txt)、[PR](diagnostics/release-ci-pr-39677943335.txt)、[首次生产部署](diagnostics/release-ci-production-39678500898.txt)。日志按原样保留。

后续仅文档收据的提交仍走普通PR与正常CI，不使用skip指令、弱化门禁或改写证据指纹。只改本文等文档不改变应用指纹；相同应用的首次收据无须随每次文档部署无限自我更新。应用、依赖、模型或构建逻辑发生改变时须重新验证相应范围。若尚未发布，保持旧站即可；发布后的恢复应准备独立恢复分支或复用以前已验收的Pages产物，按[回滚方案](RELEASE_GATE.md)执行，不强推、不删除备份、不削弱Gate。

接手前的CI/验收/交付记录保存在[历史收据](diagnostics/pre-takeover-DELIVERY.md)和diagnostics，均维持原指纹与原结论。
