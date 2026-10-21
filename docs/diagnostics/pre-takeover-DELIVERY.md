# Minimal V1.1 delivery receipt

最新状态：[后续最终验收报告（未通过发布验收）](ACCEPTANCE.md)。已有测试记录保留，未重跑完整模型矩阵。

**Not released.** Development branch: `develop/minimal-v1.1`. Application and complete model/browser evidence commit: `83acca20217317255f135a074cb3ed3ded888be1`. Final application fingerprint: `ee5bfc2de06d9d6032a9be329c8138c097187cfb646fd9528368dc78e32bbb7e`.

Preserved main/live and backup/minimal-v1-2cea0eb: `2cea0ebebd3399a77a2d649c44755e54ca0e16b0`. No other repository changed. No V1.1 Pages deployment occurred.

- [Full Chinese delivery report](VALIDATION.md), [UI before/after](UI_COMPARISON.md).
- [All25 model results/signatures/sources](MODEL_COMPATIBILITY.md), [browser/WASM/GPU scope](BROWSER_VALIDATION.md), [PWA/device steps](PWA_VALIDATION.md).
- [Final GitHub CI](https://github.com/unowhatpvp-alt/local-yolo/actions/runs/39531783945):37testspass/0fail/1optionallegacyfixture skip; mandatory25actualmodels25pass; buildpass; strictgatefailure37. Local38/38tests passed with all optional fixtures.
- [Machine CI receipt](ci-validation.json), [strict local gate](release-gate-result.json), [clean static artifact](build-verification.json), [independent evidence audit](evidence/independent-audit.json).

Required remaining evidence: real WebGPU or genuine adapter/operator-WASM-fallback for all25, real HTTPS PWA install/offline/two-version update/storage checks. Physical Safari/iOS/camera/zoom/background/fullscreen remain explicitly unverified with steps. Follow-up acceptance observed actual opacity 0 while real video inference was playing, restoration to 1 and independent exit in desktop and 375×650 Chromium views. This closes the earlier cloud visual-fade uncertainty, not physical-device/fullscreen coverage. See [current acceptance](ACCEPTANCE.md).

This final receipt commit changes only documentation and static evidence records, with [skip ci] to prevent recursively rerunning the same application while recording its completed CI. It does not change application/model/dependency/workflow bytes, mark blocked checks passed, waive any gate or authorize deployment. All source-bound tests remain tied to the exact same application fingerprint.
