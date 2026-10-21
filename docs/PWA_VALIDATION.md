# 当前PWA验收与真机限制

**安全上下文中的11项真实PWA检查全部通过，包括实际存储故障恢复。本地严格Gate通过；首次GitHub CI、应用提交、Pages运行及线上实测状态见[发布收据](DELIVERY.md)。** 当前指纹为`3f42cae598f691ad6de779f100a6a69f915baeb3075f3454b897f1a6c2bcdb4c`。依据[实际PWA JSON](pwa-validation.json)，不是静态构建或API单元替身。

本轮在Windows Playwright Chromium、浏览器信任的`http://127.0.0.1:4175/local-yolo/`执行。localhost被浏览器视为安全上下文；这与旧报告中的远程不安全HTTP环境不同。测试使用两份真实finalized生产构建，先前版本只增加HTML验证标记并有独立SW版本；没有替换推理代码、IndexedDB或Service Worker API。

| 必需检查 | 当前状态 | 真实观察范围 |
| --- | --- | --- |
| manifest | 通过 | standalone、scope/start及图标配置 |
| serviceWorkerInstalled | 通过 | 实际controller及版本消息 |
| offlineColdStart | 通过 | 关闭原应用页，断网后新页冷启动 |
| cachedModelOfflineInference | 通过 | 断网实际缓存模型推理公交图 |
| cacheDeletion | 通过 | 设置界面删除实际模型缓存 |
| updateWaiting | 通过 | 新worker等待，旧controller保持 |
| oldTabConsistency | 通过 | 旧页重新加载保持旧文档/版本 |
| activateNewVersion | 通过 | 应用更新按钮停止活动并显式激活 |
| noVersionMix | 通过 | 新worker/资源一致，旧缓存清理 |
| subpathResources | 通过 | `/local-yolo/`子路径缓存资源 |
| storageFailureRecovery | 通过 | 实际配额限制/新隔离库，警告、内存推理5个结果，解除限制后缓存重建 |

本轮run `b3c14655-4a08-43f2-8027-4fc94144af40`，UTC 2026-10-21T20:43:57.750Z至20:44:49.820Z，整体status=pass。存储实验的前三次真实失败保留在`docs/diagnostics/takeover-pwa-*-attempt.json`，配额调查保留在[takeover-real-quota-diagnostic.json](diagnostics/takeover-real-quota-diagnostic.json)。

根因是Chromium已建立IndexedDB的预留空间使quota override不立即阻止写入。使用实际CDP配额限制1字节，在隔离测试库中重新建立连接后，真实缓存写入失败、应用显示缓存警告，模型仍在内存推理出5个公交图结果；取消配额后重新加载，缓存重建通过。测试没有替换IndexedDB/存储API或降低断言；reported storage estimate不保证直接显示CDP强制配额。

最终生产构建可复现revision `fe0bf848230e`，6组静态产物验证通过；这些静态结果与上述11项真实PWA执行分别记录。

## 单元、真实浏览器与物理设备的区分

56项自动化测试包含PWA生命周期/发布Gate等回归；受控API单元测试不替代上表真实SW和离线执行。上表的serviceWorkerInstalled是浏览器中的实际注册/控制，不表示桌面或iOS主屏幕安装已被物理验证。

以下设备检查仍未验证：iPhone Safari/iOS主屏幕安装、物理摄像头采集、前后/多镜头切换、原生倍率、实际触摸硬件、系统后台恢复及手机原生全屏。六种桌面浏览器视口、真实桌面NVIDIA WebGPU、页面级全屏以及[4项Chromium触摸模拟](touch-validation.json)通过都不能推广为上述真机通过。

## 真机复查步骤

1. 在目标设备的HTTPS地址打开相同已验收版本，记录设备、系统、浏览器版本、URL和提交。
2. Safari通过分享→添加到主屏幕安装；首次在线加载模型后关闭应用，再断网冷启动并实际推理。
3. 允许/拒绝摄像头权限，启动/停止、切换可用设备，核实镜像、数字裁切与真实原生倍率标签。
4. 分别检查横/竖屏、安全区域、触摸目标、全屏进入/淡出/恢复/退出、后台停止与返回后的明确恢复操作。
5. 使用两份可区分真实构建确认等待更新、旧页一致性、显式激活和离线返回。删除模型并核对存储状态；不要保证永久缓存。

保留真实失败和不可用状态，记录可复现步骤；不以其他平台或特征检测代替设备结果。接手前报告完整保存在[历史PWA报告](diagnostics/pre-takeover-PWA_VALIDATION.md)。
