# Local YOLO — Minimal V1.1

A browser-only YOLO vision workbench for GitHub Pages. Camera frames, uploaded images/videos and inference results stay on the device. There is no inference backend, account, analytics or API key. Public model downloads require a network connection; ONNX Runtime Web is bundled with the static app.

**Application validation, 2026-10-21:** fresh Node WASM **25/25**, built-in Chrome 155 WASM **25/25**, and genuine NVIDIA Blackwell hardware WebGPU **25/25** passed. All **14 application interaction checks**, six responsive viewports and four Chromium-emulated touch checks passed. Touch emulation does not certify physical phones. Local automated tests: **56 passed, no failures or skips**. Secure-context PWA integration is **11/11**. The strict local release gate, six static-artifact checks and a reproducible production build passed. **Local release validation passed. The first release commit, exact CI results, Pages run and live observations are recorded in the [release receipt](docs/DELIVERY.md).** See [current validation](docs/VALIDATION.md) and [delivery status](docs/DELIVERY.md).

Application/model fingerprint: `3f42cae598f691ad6de779f100a6a69f915baeb3075f3454b897f1a6c2bcdb4c`.

## Run and build

Use Node.js 22.12 or later and npm:

```sh
npm ci
npm run dev
```

Open Vite's Local URL under `/local-yolo/`. For camera, WebGPU and service workers, use HTTPS or a browser-trusted localhost origin. A remote HTTP preview does not provide the same capabilities.

```sh
npm run build
npm run preview
```

The production output is static `dist/`, with the GitHub Pages base `/local-yolo/`. ONNX Runtime Web 1.23.2 modules/WASM are served from the same origin. Opening `index.html` directly as a local file is unsupported.

## Minimal workflow

Select a task and model size, then start. The launcher shows the model name, download size and cache state. Local ONNX import expands only when needed. The camera workspace remains the default after initialization; use Upload file for images or videos.

The workbench prioritizes the preview. Camera selection, mirror and zoom live in camera options; PNG/JSON exports live in the results menu. Confidence is the only exposed inference slider; applicable raw-head NMS retains the internal IoU default of 0.45. The interface supports Chinese/English and light/dark/system appearance, keyboard navigation, desktop/tablet/phone layouts, safe areas, fullscreen with a page-filling fallback, and controls that fade during active fullscreen inference and return on interaction.

Images infer once and rerun when confidence changes, including a change made while a real inference is busy. Video inference is serialized and composites each completed frame with its own results. Detection boxes, segmentation masks, 17-point human pose, classification labels and rotated boxes use separate task adapters. Switching media/models releases previous resources; backgrounding stops camera capture and pauses video.

Camera zoom uses real track capabilities when available and explicitly uses digital crop otherwise. A compatible camera API does not guarantee access to every physical phone lens. Latency includes preprocessing, ONNX execution and postprocessing; FPS counts completed inferences. Those figures are not camera frame rate or GPU/VRAM measurements.

## Models and compatibility

The online inventory is exactly **25 genuine YOLO26 exports: Detection, Segmentation, Pose, Classification and OBB × N/S/M/L/X**. Each entry pins its source revision, byte length, SHA-256 and graph signatures in [the model manifest](src/core/model-manifest.json). The online picker contains YOLO26 only; compatible YOLO11 local imports remain a regression target.

| Models | Input / export | Pinned source |
| --- | --- | --- |
| Detection, segmentation, pose and OBB; 20 models | FP32 `[1,3,480,640]`; task-specific raw heads and NMS | [unileon-robotics](https://huggingface.co/unileon-robotics/YOLO26-ONNX/tree/e046fc5125ee6b579f1801f0b6df68a60b949c42) |
| Classification; 5 models | FP32 `[1,3,224,224]`; 1,000 probabilities, no additional softmax or NMS | [prithivMLmods](https://huggingface.co/prithivMLmods/YOLO26-ONNX/tree/c526dae7a5a5b4f1d79d704903b4406011da2716) |

These are pinned community exports of upstream Ultralytics YOLO26 checkpoints. See [provenance](docs/MODEL_PROVENANCE.md) and the [25-row compatibility matrix](docs/MODEL_COMPATIBILITY.md). Compatibility testing verifies execution, transforms, labels, rendering and resource cleanup. It does not promise prediction accuracy: the primary goldfish reference passes all five classifiers, while a ten-image diagnostic records N/S/M/L/X top-1 counts of **3/3/4/5/6 out of 10**, including every miss. This is not an ImageNet benchmark.

Local import supports compatible self-contained float32, single-RGB-input NCHW batch-one YOLO models, including supported raw and metadata-identified end-to-end layouts. Task overrides and class labels are available when needed. External weights, unsupported shapes/types, ambiguous layouts and incompatible networks fail explicitly. This is not a universal ONNX runner. Large models can exceed device memory; the app never silently substitutes a smaller model.

## Cache, PWA and export coordinates

Model downloads are streamed, verified and stored separately in IndexedDB. Actual storage-failure testing passed: the model ran in memory with a warning and caching recovered after the restriction was removed. Browser eviction and quotas limit offline guarantees. Imported media/results are not saved to the model cache or uploaded.

A versioned service worker supports offline app resources. Updates wait for explicit activation after active inference/media stops. All eleven actual secure-context tests passed, including service-worker installation, offline cold start, cached-model inference, two-version update/isolation and storage-failure recovery; see [PWA evidence and remaining limitation](docs/PWA_VALIDATION.md). iPhone Safari, iOS home-screen installation, physical camera/lens/zoom/touch behavior remain unverified.

JSON records the actual `coordinateSpace.scaleX` and `scaleY`. Divide x/width by scaleX and y/height by scaleY to restore original-media coordinates. The real 3002×2000 → 1920×1279 regression passed; independent rounding means the two scales can differ slightly.

## Reproduce validation

The full model inventory downloads approximately 2.17 GB. Python 3 extracts exact validation ZIP members and FFmpeg decodes actual MP4 frames; neither is an application backend.

```sh
npm ci
node scripts/fetch-test-fixtures.mjs
node scripts/fetch-yolo26-models.mjs
node scripts/fetch-yolo26-validation-fixtures.mjs
npm test
npm run validate:models
npm run build
node scripts/validate-browser-release.mjs
npm run release:check
```

The browser runner needs the isolated Playwright/Chromium setup specified in the workflows. The development-only `/local-yolo/tests/browser-harness.html` separately executes all 25 real browser WASM and WebGPU/fallback combinations. A partial run cannot pass the gate. The production build excludes harnesses, fixtures and weights.

Additional current validation: 44 JS/MJS syntax checks, 78 JSON/manifest parses and Git integrity passed; dependency audit reports zero known vulnerabilities at every level. Chromium touch evidence is [explicitly emulated](docs/touch-validation.json).

Current evidence: [Node JSON](docs/model-validation-matrix.json), [browser JSON and 14 UI checks](docs/browser-validation-matrix.json), [hardware WebGPU JSON](docs/hardware-webgpu-matrix.json), [PWA JSON](docs/pwa-validation.json). Source fingerprints prevent old evidence from passing for changed code. Never rewrite an old fingerprint to make evidence appear current.

## Release protection and reserved workspaces

Implementation was isolated on `codex/minimal-v1-release` and merged through its reviewed PR. The preserved V1 baseline is `2cea0ebebd3399a77a2d649c44755e54ca0e16b0`, also kept on `backup/minimal-v1-2cea0eb`. Only a passing gated workflow on `main` may deploy Pages. The first application release/deployment receipt is recorded in [DELIVERY](docs/DELIVERY.md), with its exact tested commit and observations.

`/local-yolo/` is the Minimal inference app. `/studio/`, `/experimental-training/` and `/studio/experimental-training/` remain reserved development pages; they do not implement a finished studio or training product and are outside this version's scope. The inference core remains independent of the UI.

Application source is AGPL-3.0-only; selected model sources are marked AGPL-3.0. Dependencies retain their own licenses. Model weights and user media are not committed to the repository. Earlier reports remain in `docs/diagnostics/pre-takeover-*` with their original claims and evidence.
