# Actual browser validation — Minimal V1.1

**Actual browser WASM: 25/25 passed. Actual hardware WebGPU: 0/25 tested; all 25 remain environment-unavailable. Publication is blocked.**

Frozen source fingerprint: `ee5bfc2de06d9d6032a9be329c8138c097187cfb646fd9528368dc78e32bbb7e`. Matrix run `browser-1792547796612-0.4990128884822652` executed from `2026-10-21T01:56:36.612Z` to `2026-10-21T02:02:55.613Z` (UTC), with ONNX Runtime Web `1.23.2`. Browser: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36`. Actual origin: `http://terminal.local:4173/local-yolo/tests/browser-harness.html`. The run completed all 25 required models and was not partial or stopped.

Every model used the normal **verified** catalog/cache path. All 25 had a previously cached model, checked its actual pinned size/SHA-256 before worker transfer, and used no development-only unverified-model exception. The main application's separate fresh download/cache-deletion retest is recorded below; this cached matrix is not presented as 25 fresh network downloads. The preserved [previous 0f995 human report](diagnostics/0f995-BROWSER_VALIDATION.md) retains its old run and measurements.

## Actual 25-model matrix

Each row performed a real task image, two real H.264 MP4 frames decoded by HTMLVideoElement at 0s/1s, the corresponding task decoder/renderer, actual PNG pixel-change measurement and worker disposal. Browser execution is separate from the Node/Canvas matrix.

| Model | Cached before | Image results | Top real prediction | Image latency ms | Video results 0s / 1s | Changed render pixels | Client disposed | WebGPU |
| --- | --- | ---: | --- | ---: | --- | ---: | --- | --- |
| yolo26-detect-n | yes | 5 | bus 89.4% | 281.3 | 25 / 22 | 37193 | yes | unavailable |
| yolo26-detect-s | yes | 5 | bus 92.8% | 886.4 | 16 / 16 | 39782 | yes | unavailable |
| yolo26-detect-m | yes | 5 | bus 93.8% | 2224.3 | 15 / 16 | 37900 | yes | unavailable |
| yolo26-detect-l | yes | 5 | bus 93.7% | 2895.5 | 15 / 17 | 39274 | yes | unavailable |
| yolo26-detect-x | yes | 5 | bus 94.1% | 5903.3 | 25 / 22 | 38269 | yes | unavailable |
| yolo26-segment-n | yes | 5 | bus 88.8% | 409.9 | 16 / 16 | 147251 | yes | unavailable |
| yolo26-segment-s | yes | 5 | bus 91.0% | 1178.7 | 26 / 20 | 148704 | yes | unavailable |
| yolo26-segment-m | yes | 5 | person 91.8% | 3919.4 | 17 / 16 | 148171 | yes | unavailable |
| yolo26-segment-l | yes | 5 | bus 91.0% | 4488.4 | 21 / 23 | 148158 | yes | unavailable |
| yolo26-segment-x | yes | 5 | bus 93.9% | 9667.4 | 16 / 20 | 149270 | yes | unavailable |
| yolo26-pose-n | yes | 4 | person 85.0% | 360.9 | 7 / 6 | 38993 | yes | unavailable |
| yolo26-pose-s | yes | 4 | person 88.6% | 793.2 | 4 / 4 | 40202 | yes | unavailable |
| yolo26-pose-m | yes | 4 | person 87.8% | 2335.8 | 4 / 3 | 39978 | yes | unavailable |
| yolo26-pose-l | yes | 4 | person 89.5% | 3273.7 | 4 / 2 | 40326 | yes | unavailable |
| yolo26-pose-x | yes | 4 | person 91.4% | 6183.1 | 4 / 2 | 40548 | yes | unavailable |
| yolo26-classify-n | yes | 5 | goldfish 31.5% | 53.6 | 5 / 5 | 8096 | yes | unavailable |
| yolo26-classify-s | yes | 5 | goldfish 98.5% | 137.5 | 5 / 5 | 8389 | yes | unavailable |
| yolo26-classify-m | yes | 5 | goldfish 89.6% | 249.2 | 5 / 5 | 8161 | yes | unavailable |
| yolo26-classify-l | yes | 5 | goldfish 99.8% | 445.7 | 5 / 5 | 9718 | yes | unavailable |
| yolo26-classify-x | yes | 5 | goldfish 99.0% | 577.1 | 5 / 5 | 8984 | yes | unavailable |
| yolo26-obb-n | yes | 172 | ship 84.2% | 281.1 | 0 / 0 | 132776 | yes | unavailable |
| yolo26-obb-s | yes | 163 | ship 86.3% | 753.5 | 0 / 0 | 126707 | yes | unavailable |
| yolo26-obb-m | yes | 181 | ship 87.2% | 2345.1 | 0 / 2 | 135779 | yes | unavailable |
| yolo26-obb-l | yes | 184 | ship 88.2% | 3041.6 | 19 / 15 | 137384 | yes | unavailable |
| yolo26-obb-x | yes | 185 | ship 88.2% | 5953.4 | 15 / 20 | 139318 | yes | unavailable |

Image latency is this cloud host's actual measured preprocessing + inference + postprocessing, excluding worker transport, capture and presentation. Concurrent development work can affect these values; they are not phone benchmarks. Canvas resampling can alter scores between browser and Node, so bit-identical predictions are not promised. A zero OBB count on the people video is a retained real result. Classification counts refer to returned class scores, not object counts.

EngineClient disposal terminates the worker; it does not expose an underlying ORT session-release promise. The [separate Node evidence](model-validation-matrix.json) records actual awaited ONNX releases and raw tensor signature/finite-value/digest checks. Browser renderer pixel changes are observed; the raw per-render visual-review field remains pending and is not silently promoted here.

## Fourteen fresh application checks

These current-source checks were recorded at `2026-10-21T02:07:30Z`. They are actual main-application interactions and observations, separate from the engine harness. Their pass scope is the named check: the video-control pass does **not** establish a successful visual idle fade.

| Check | Recorded result | Actual observation |
| --- | --- | --- |
| modelSelection25 | pass | Fresh actual custom menus selected all 25 distinct YOLO26 models and enabled all 25 launch buttons. Evidence: docs/evidence/browser-25-ui-selections.json. |
| modelSwitching | pass | Fresh actual app switched online YOLO26n to local yolo26n.onnx, inferred real high-resolution bus and H264 video, returned and reloaded online Nano. Matrix independently switched and disposed all 25 workers. |
| downloadProgress | pass | Fresh actual main controller after cache deletion displayed 0.0/9.4MB through 8.0/9.4MB, measured progress 0→84.36%; automatic WASM initialization then succeeded. Exact timed DOM observations: docs/evidence/browser-ui-download-progress.json. Each matrix row also preserves genuine engine progress. |
| cacheRecognition | pass | Fresh main page recognized YOLO26n Cached after actual download. All25 matrix rows record real cache/integrity phases. |
| cachedReload | pass | Fresh actual main cache reload initialized WASM and bus.jpg returned 5 real results; current source online model also reloaded in phone iframe. Evidence: browser-ui-cache-reload.json. |
| localOnnxImport | pass | Fresh actual system picker imported 9,887,916-byte yolo26n.onnx; auto Detection, WASM,5 real high-res bus results and real video. Truncated128-byte ONNX specifically rejected with ONNX protobuf is truncated. and empty load status. Evidence: browser-local-import.json. |
| imageExport | pass | Fresh actual PNG download Blob read: 2,136,157bytes,1920x1279,SHA2560ae3fdec1a1e6ce8769c5ad82eeef87a921a3002bb6845de7f58f23e90726146. Original browser download was unchanged. Evidence: browser-exports.json. |
| jsonExport | pass | Fresh actual local-model JSON download 1804bytes parsed,5 real results, exact scaleX=.6395736175882745 and scaleY=.6395 for3002x2000→1920x1279. Evidence: browser-exports.json. |
| videoPauseReplay | pass | Fresh actual H264 auto detection/play/pause/restart observed; pause time 1.012994 s, restart advanced to 5.658627 s with 20 real results. Fullscreen fallback state, independent exit, idle state and restoration observed; the historical observation had opacity 1; follow-up acceptance now confirms opacity 0 → 1 in desktop and phone-size Chromium (see ACCEPTANCE.md). Evidence: browser-video-fullscreen.json. Actual performance 1.0 FPS / 263 ms under this cloud host concurrent test, not phone benchmark. |
| fileReplacementCleanup | pass | Fresh actual high-res image replaced by real video; prior image src became null, HTMLVideoElement640x360. No old image remained rendered. Core API lifecycle tests separately cover Blob revoke. |
| responsivePhone | pass | Fresh Chromium iframe 375x812,390x844,844x390 have no horizontal/vertical document overflow,0 visible targets below44px, canvas object-fit contain. This is neither Safari nor physical phone emulation. Evidence: final-viewports.json. |
| responsiveTablet | pass | Fresh Chromium iframe 768x1024 has no horizontal/vertical document overflow,0 visible targets below44px, contain canvas. Not a physical iPad. Evidence: final-viewports.json. |
| permissionDeniedOrUnavailable | pass | Fresh actual HTTP environment camera API/insecure-context failure with actionable image/video fallback observed in Chinese and English. No real permission refusal or camera hardware pass is claimed. Evidence: browser-ui-cache-reload.json. |
| noMediaNetworkRequests | pass | Fresh app Resource Timing during local ONNX, real image/video and exports only lists app/runtime/local Blob assets; no media/results remote request observed. Source audit finds public model GET/static only. App-scoped observation, not whole-browser packet capture. Evidence: browser-exports.json and final-viewports.json. |

## Fullscreen animation caveat

The real video played, paused/restarted and used the fullscreen fallback; the independent exit worked. The toolbar acquired `.is-idle` and interaction cleared that class. The historical capture had opacity `1`; it remains unmodified. Follow-up acceptance with the same application fingerprint now observes actual opacity `0` during real video inference, restoration to `1` after interaction and independent exit in desktop and 375×650 Chromium. [New raw observations and screenshots](ACCEPTANCE.md) close this cloud-UI uncertainty. They do not establish physical mobile/Safari behavior. Native fullscreen and physical-device camera behavior remain unverified.

## Backend, camera and PWA limits

The actual context is insecure, `navigator.gpu` is absent and no GPU adapter was acquired. Automatic application loading used actual WASM. Neither hardware WebGPU nor a genuine operator-failure GPU-to-WASM fallback was tested. All 25 GPU rows remain environment-unavailable. Camera feedback was the actual insecure/API-unavailable path; it is not a physical permission-denial/camera pass. Secure service-worker, installed-PWA, offline and two-version update checks remain unavailable.

The current [release-gate result](release-gate-result.json) rejects publication with 37 blockers. There are no current fingerprint, model-scope, Node, browser WASM or named UI-check gate errors. Model scope was not reduced and unavailable environments were not relabelled as passed.

## Console observation

Fresh main-page and phone-view console observations contain **0 product warnings/errors**. The record separately excludes 54 messages attributed to the actual cloud browser extension; these are not counted as product messages. See [the current app-scoped console record](evidence/browser-console-current.json). This does not imply that every browser or physical device has been tested.

## Observation method and artifacts

The development-only matrix and responsive harnesses use real model bytes, image/video decoders, EngineClient inference and the application renderer. The responsive harness observes original Blob downloads, DOM geometry and Resource Timing without replacing inference or suppressing the browser's download. Resource observations are app-scoped and are not a whole-browser packet capture. Only public test fixtures are used. Harnesses, their configuration, model weights and media are excluded from the production artifact.

- Full matrix: [JSON](browser-validation-matrix.json), [CSV](browser-validation-matrix.csv).
- Main download/cache: [actual progress](evidence/browser-ui-download-progress.json), [cache reload](evidence/browser-ui-cache-reload.json).
- Import/exports: [local ONNX](evidence/browser-local-import.json), [PNG and JSON](evidence/browser-exports.json).
- Video/layout: [controls/fullscreen](evidence/browser-video-fullscreen.json), [performance](evidence/browser-live-performance.json), [four viewport measurements](evidence/final-viewports.json).
- [UI comparison](UI_COMPARISON.md), [PWA and physical-device steps](PWA_VALIDATION.md).
