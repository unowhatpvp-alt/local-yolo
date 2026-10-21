# Actual browser validation — Minimal V1.1

**Browser WASM25/25passed; genuine WebGPU0/25tested. Publication is blocked.**

Run `browser-1792545792198-0.4556791088664569` executed on `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36` from 2026-10-21T01:23:12.198Z to 2026-10-21T01:29:36.575Z. Actual HTTP origin: `http://terminal.local:4173/local-yolo/tests/browser-harness.html`. Frozen source: `0f9955933f5a6ccf170f3ca1880433c5bc6eef090de993388cda8dcac2d1a579`. All25models used the normal verified catalog/cache path; no development-only model exception was used.

Every row performed SHA/size verification, a real task image, two frames decoded by the actual HTMLVideoElement H.264 decoder at0s/1s, task-specific postprocessing/rendering, PNG pixel-change evidence and worker termination. This is browser execution, separate from the Node/Canvas matrix. Differences in Canvas resampling can change scores; bit-identical predictions across runtimes are not claimed.

|Model|Cached before|Image results|Top real prediction|Latency ms|Video counts0s/1s|Changed render pixels|Worker disposed|WebGPU|
|---|---|---:|---|---:|---|---:|---|---|
|yolo26-detect-n|yes|5|bus 89.4%|356.9|25/22|37193|yes|unavailable|
|yolo26-detect-s|yes|5|bus 92.8%|788.9|16/16|39782|yes|unavailable|
|yolo26-detect-m|yes|5|bus 93.8%|2119.2|15/16|37900|yes|unavailable|
|yolo26-detect-l|yes|5|bus 93.7%|2875.5|15/17|39274|yes|unavailable|
|yolo26-detect-x|yes|5|bus 94.1%|6459.3|25/22|38269|yes|unavailable|
|yolo26-segment-n|yes|5|bus 88.8%|425|16/16|147251|yes|unavailable|
|yolo26-segment-s|yes|5|bus 91.0%|1102.5|26/20|148704|yes|unavailable|
|yolo26-segment-m|yes|5|person 91.8%|3737.8|17/16|148171|yes|unavailable|
|yolo26-segment-l|yes|5|bus 91.0%|4552.3|21/23|148158|yes|unavailable|
|yolo26-segment-x|yes|5|bus 93.9%|9487.9|16/20|149270|yes|unavailable|
|yolo26-pose-n|yes|4|person 85.0%|335.2|7/6|38993|yes|unavailable|
|yolo26-pose-s|yes|4|person 88.6%|873.9|4/4|40202|yes|unavailable|
|yolo26-pose-m|yes|4|person 87.8%|2272.8|4/3|39978|yes|unavailable|
|yolo26-pose-l|yes|4|person 89.5%|2917.2|4/2|40326|yes|unavailable|
|yolo26-pose-x|yes|4|person 91.4%|5927.3|4/2|40548|yes|unavailable|
|yolo26-classify-n|no|5|goldfish 31.5%|65.7|5/5|8096|yes|unavailable|
|yolo26-classify-s|no|5|goldfish 98.5%|121.3|5/5|8389|yes|unavailable|
|yolo26-classify-m|no|5|goldfish 89.6%|276|5/5|8161|yes|unavailable|
|yolo26-classify-l|no|5|goldfish 99.8%|284.2|5/5|9718|yes|unavailable|
|yolo26-classify-x|no|5|goldfish 99.0%|558|5/5|8984|yes|unavailable|
|yolo26-obb-n|yes|172|ship 84.2%|261.9|0/0|132776|yes|unavailable|
|yolo26-obb-s|yes|163|ship 86.3%|730.5|0/0|126707|yes|unavailable|
|yolo26-obb-m|yes|181|ship 87.2%|2492|0/2|135779|yes|unavailable|
|yolo26-obb-l|no|184|ship 88.2%|2914.4|19/15|137384|yes|unavailable|
|yolo26-obb-x|no|185|ship 88.2%|6076.5|15/20|139318|yes|unavailable|

The latency numbers are this cloud host under development/concurrent testing, not phone benchmarks. Video may correctly contain no ships for an OBB model. Classification counts are returned classes, not object counts. Raw tensor signatures/finite-value hashes are checked separately in the [Node evidence](model-validation-matrix.json).

## Actual app checks

- **modelSelection25 — pass:** Actual custom task/size menus selected25distinct YOLO26models andall25launchbuttons were enabled. Evidence: docs/evidence/browser-25-ui-selections.json.
- **modelSwitching — pass:** Actual app switched online YOLO26n to local yolo26n.onnx, then loaded and inferred the real bus image and MP4; model name, media source and result state changed. Engine matrix independently switches/releases all25.
- **downloadProgress — pass:** Actual getModel onProgress phase/byte/total/percent observations are preserved per-model in this browser run; cached reads, integrity and cache-write are distinct phases. Initial main UI download and automatic initialization were observed.
- **cacheRecognition — pass:** Main model page recognized YOLO26n as cached; IndexedDB identifiers and actual cachedBefore flags are recorded per-model.
- **cachedReload — pass:** Main YOLO26n was reloaded repeatedly from its recognized cache and performed real inference. Every matrix row records its exact cache/download phases and integrity hash.
- **localOnnxImport — pass:** Actual system picker imported9,887,916-byte YOLO26n ONNX; auto-inspection selected Detection and WASM; real image returned5objects and real video inferred. A128-byte truncated ONNX was rejected with ONNX protobuf is truncated.; no stale initialization message remained. Evidence: docs/evidence/browser-local-import.json.
- **imageExport — pass:** Actual app export Blob captured without modifying app results or suppressing the browser download: PNG2,136,157bytes,1920x1279, SHA2560ae3fdec1a1e6ce8769c5ad82eeef87a921a3002bb6845de7f58f23e90726146. Evidence: docs/evidence/browser-exports.json.
- **jsonExport — pass:** Actual JSON download payload1814bytes parsed successfully with5real detections, model/backend and exact coordinateSpace scaleX=.6395736175882745 and scaleY=.6395 for3002x2000→1920x1279. Evidence: docs/evidence/browser-exports.json.
- **videoPauseReplay — pass:** Real H.264 MP4 auto-detected; play/pause/restart observed. A clearly identified six-repeat derivative of real footage verified fullscreen idle fade, touch restore and independent exit. Actual completed FPS1.0 and232ms were observed on this host under concurrent matrix load, not a phone benchmark. Evidence: browser-video-fullscreen.json and browser-live-performance.json.
- **fileReplacementCleanup — pass:** Actual image upload was replaced by video: old image Blob URL removed (src=null), video controls and640x360source appeared; core lifecycle tests separately verify Blob revocation and late-stream cleanup.
- **responsivePhone — pass:** Final-source375x812,390x844,844x390 Chromium iframe layouts have no horizontal or vertical document overflow,0 visible interactive targets below44px, and canvas object-fit contain. Not Safari/device emulation. Evidence: docs/evidence/final-viewports.json.
- **responsiveTablet — pass:** Final-source768x1024 Chromium iframe has no document overflow,0 visible targets below44px and720x817preview. Evidence: docs/evidence/final-viewports.json.
- **permissionDeniedOrUnavailable — pass:** Actual HTTP cloud browser reported camera API/insecure-context unavailability with actionable upload fallback in both Chinese and English; no camera feed or detections were fabricated. This does not claim a real permission-denial or physical camera test.
- **noMediaNetworkRequests — pass:** Observed app Resource Timing entries during real image/video uploads and exports contain application/runtime assets and local Blob resources; no remote media/result request was observed. Source audit finds only public model GET downloads and static/runtime fetches, no telemetry or inference upload endpoint. This is app-scoped observation, not whole-browser packet capture. Evidence: docs/evidence/browser-exports.json and final-viewports.json.

## Backend limits

The actual browser reports an insecure context, no navigator.gpu and no acquired adapter. Automatic app loading used actual WASM. No hardware WebGPU, GPU operator fallback, iPhone GPU, or Safari compatibility pass is inferred. All25GPU records stay environment-unavailable and fail the release gate.

## Observation method

The development-only responsive harness observes actual downloaded Blob bytes (including detached download anchors), actual DOM geometry and Resource Timing. It calls the original browser download unchanged. It does not replace model bytes, infer methods, predictions, task rendering, media decoders or backend labels. Public real media fixtures are used; no personal media is uploaded. The matrix and responsive harness are excluded from the production artifact.

Full records: [JSON](browser-validation-matrix.json), [CSV](browser-validation-matrix.csv), [UI comparison](UI_COMPARISON.md), [PWA/device limits](PWA_VALIDATION.md).

## Final main-page download/cache retest

The frozen main UI deleted the actual YOLO26n cache, changed to the first-download state, displayed0.0MB/9.4MB download progress, automatically initialized WASM, then recognized and reloaded its new cache. This directly verifies the production controller path in addition to the engine harness. See [download observation](evidence/browser-ui-download-progress.json) and [cache reload](evidence/browser-ui-cache-reload.json).
