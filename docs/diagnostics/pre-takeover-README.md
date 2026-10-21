# Local YOLO — Minimal V1.1 (development)

A real YOLO inference workbench that runs entirely in the browser. Camera frames, uploaded images/videos and inference results stay on the user's device. There is no Python service, remote inference, account, analytics or API key. Model downloads use public HTTPS resources; the runtime is bundled with the app.

V1.1 is being developed on **`develop/minimal-v1.1`**. The preserved V1 baseline is `2cea0ebebd3399a77a2d649c44755e54ca0e16b0`, with backup branch `backup/minimal-v1-2cea0eb`. Work on the development branch does not update production `main` or publish Pages. **Release remains blocked until complete, current browser, WebGPU/fallback and PWA evidence passes the strict gate.** Download checks, a green build or Node WASM results alone do not establish release readiness.

Current frozen-source results: **Node WASM25/25 and actual cloud Chrome WASM25/25 passed**. WebGPU and secure PWA behavior remain unverified; publication is blocked. See the [Chinese delivery/validation report](docs/VALIDATION.md), [UI comparison](docs/UI_COMPARISON.md), [per-model matrix](docs/MODEL_COMPATIBILITY.md) and [actual browser report](docs/BROWSER_VALIDATION.md).

## Run locally

Use Node.js 22.12 or later and npm:

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite, under `/local-yolo/`. Use HTTPS or a browser-trusted localhost origin for camera, WebGPU and service-worker features. A remote HTTP preview is not equivalent to a secure device test. Browser/API/codec support and available memory determine the usable capabilities on Windows, macOS, Android, iPhone and iPad.

```sh
npm run build
npm run preview
```

The production build is static `dist/`, configured for the GitHub Pages `/local-yolo/` subpath. ONNX Runtime Web 1.23.2 assets are served from the same origin; no runtime CDN is required.

## Minimal workbench

The interface uses black, white and gray, Chinese/English, light/dark/system themes, touch-sized controls and layouts for phones, tablets and desktops. Model selection uses custom webpage controls. Minimal keeps the camera/file workflow prominent, with advanced information in settings or development tools.

After model initialization, the camera workspace is the default. It supports permission/error handling, available-device selection, start/stop, mirroring and native zoom when the actual camera track exposes it. Otherwise zoom is explicitly labeled digital crop. The source crop, restored coordinates and overlays use the same transform; browser camera APIs do not expose every iPhone physical lens.

The file tab distinguishes images from videos. Images infer once; videos use serialized inference and composite the completed frame with its corresponding results. Boxes, instance masks, human skeletons, classification scores and rotated polygons use task-specific decoders/renderers. Controls include confidence, camera options, zoom and fullscreen with a viewport-filling fallback. Applicable raw-head NMS uses the internal IoU default; the V1.1 Minimal surface does not expose an IoU slider. PNG and JSON export real results. Backgrounding stops camera capture and pauses video; switching files/models releases old resources.

Latency means preprocessing + ONNX execution + postprocessing, excluding worker transport, drawing and scheduling. FPS counts completed inferences, not camera frames. WebGPU is attempted first, with WASM fallback when session initialization or the real warm-up inference fails. WASM uses one thread for GitHub Pages compatibility. No GPU utilization, VRAM or device-performance figures are invented.

## Online model inventory: 25 genuine YOLO26 exports

The required inventory is fixed: **Detection, Segmentation, Pose, Classification and OBB × N/S/M/L/X**. Every entry has its own immutable source revision, exact byte length, SHA-256, actual graph signatures and separate validation state in [`src/core/model-manifest.json`](src/core/model-manifest.json). Source/integrity verification and runtime/backend verification are distinct. Consult the current reports for the actual completed rows; listing 25 models is not a claim that every release check has passed.

| Selected entries | Actual input / output mode | Pinned community ONNX source |
| --- | --- | --- |
| Detection, Segmentation, Pose, OBB; all five sizes (20) | FP32 `[1,3,480,640]`; raw one-to-many heads, task-specific NMS | [unileon-robotics, `e046fc5…`](https://huggingface.co/unileon-robotics/YOLO26-ONNX/tree/e046fc5125ee6b579f1801f0b6df68a60b949c42) |
| Classification; all five sizes (5) | FP32 `[1,3,224,224]`; 1,000 class probabilities, no NMS or second softmax | [prithivMLmods, `c526dae…`](https://huggingface.co/prithivMLmods/YOLO26-ONNX/tree/c526dae7a5a5b4f1d79d704903b4406011da2716) |

These are genuine exports of upstream Ultralytics YOLO26 checkpoints, not official Ultralytics-hosted ONNX artifacts and not renamed YOLO11 files. The five classifiers use native 224×224 exports after actual known-label/reference-preprocessing checks; the original rectangular-classifier failure and source decision remain documented. See [provenance and exact artifact checks](docs/MODEL_PROVENANCE.md), [official YOLO26 documentation](https://docs.ultralytics.com/models/yolo26/) and [official upstream weights](https://huggingface.co/Ultralytics/YOLO26).

The online picker contains **YOLO26 only**. Compatible YOLO11 local imports remain a regression target; they do not replace any required YOLO26 task or size. Model loading never silently substitutes a smaller model. Large files can exceed a browser/device memory budget even when the format is valid.

## Local ONNX and output adapters

Import a self-contained, float32, single-RGB-input NCHW batch-one model. The importer reads real ONNX metadata/signatures and validates actual warm-up outputs. Compatible raw Ultralytics Detection, Segmentation, 17-point human Pose, Classification and OBB layouts have separate decoding paths. Supplementary genuine YOLO26 N exports also exercise metadata-identified end-to-end Detection, Segmentation, Pose and OBB import formats; the native classifier remains a probability-output task. NMS-free layouts mark IoU as inapplicable and skip NMS rather than adding an unnecessary second suppression pass.

Task overrides and explicit class names are available where metadata is insufficient. Custom class counts require accurate labels. Incompatible layouts/types, multiple inputs, external `.data` weights, unsupported pose shapes, ambiguous exports and arbitrary networks receive specific failures. Dynamic spatial inputs use validated metadata/default dimensions. This is not a universal ONNX runner.

## PWA, privacy and storage

Manifest/icons, standalone mode, safe areas, a versioned service worker and model-cache management are included. Models are streamed, verified and stored separately in IndexedDB; storage failures permit memory-only use with a warning. Cache availability, quotas and browser eviction limit offline guarantees. Camera pixels, imported media and inference results are not persisted or uploaded by the app.

A waiting app update stays waiting until the user chooses to activate it and active inference/media has stopped. The update contract, old-tab consistency and version isolation require real secure-browser testing, described in [the release gate](docs/RELEASE_GATE.md). Desktop/Android installation availability depends on the browser. On iOS/iPadOS, use Safari → Share → Add to Home Screen. Physical installation, lenses, native zoom, background resume and fullscreen require actual device observations; responsive viewport checks do not establish them.

## Reproduce validation

Model downloads total approximately **2.17 GB**. The downloader streams at most three concurrently and checks pinned length, SHA-256 and CORS. Node image/video validation additionally requires Python 3 for extracting exact ZIP members and FFmpeg for decoding the real MP4. These are development tools, not application backends.

```sh
npm ci
node scripts/fetch-test-fixtures.mjs
node scripts/fetch-yolo26-validation-fixtures.mjs
npm test
npm run validate:models
npm run build
npm run release:check
```

The full model matrix requires all 25 actual artifacts, real task images, at least two decoded real video frames per model, tensor statistics, output samples, task rendering and session cleanup. It runs models serially in isolated processes. Missing, failed, skipped, partial or stale-source cases cannot satisfy the gate. Optional local smoke tests may skip unavailable fixtures; they are not a substitute for this full matrix.

| Check / artifact | Reproduction or location |
| --- | --- |
| Exact model downloads, optionally `--size=N`, `--task=classify`, `--force` | `node scripts/fetch-yolo26-models.mjs` |
| Optional Nano five-task image/video smoke | `npm run test:real` |
| Supplementary real N end-to-end imports | `FETCH_E2E_FIXTURES=1 node --test tests/real-e2e.test.mjs` in a POSIX shell; set that environment variable first in other shells |
| Optional compatible YOLO11 fixture regression | `npm run test:legacy`; existing V1 fixtures are required |
| All-25 actual Node WASM matrix | `npm run validate:models`; [JSON](docs/model-validation-matrix.json), [CSV](docs/model-validation-matrix.csv), [contact sheet](docs/evidence/yolo26-matrix.png) |
| Node evidence definitions and fixture details | [Node validation guide](docs/NODE_WASM_VALIDATION.md) |
| Current application/model fingerprint | `node scripts/check-release-gate.mjs --fingerprint` |
| Strict final readiness check | `npm run release:check`; [gate definitions](docs/RELEASE_GATE.md) |

For **actual browser** testing, prepare the model/media fixtures, freeze application source and record the current fingerprint in `tests/browser-run-config.json` before starting a new run. Start `npm run dev` and open `/local-yolo/tests/browser-harness.html` on that server. Its separate buttons run all 25 through the real browser `EngineClient`, worker, media decoder, model cache and renderer for WASM and genuine WebGPU/fallback. Export actual JSON to `docs/browser-validation-matrix.json`. A partial `?ids=…` smoke run cannot pass the release gate. The harness is development-only and is not a production build entry point.

Browser interaction observations and secure PWA/offline/update observations must be collected separately; the inference harness does not automatically mark them passed. Test the built app with `npm run preview` on a trusted secure origin, including two real builds for waiting-update/old-tab behavior, and record actual observations in `docs/pwa-validation.json`. Hardware absence or an insecure origin is recorded as unavailable and blocks the required GPU check; it is not labeled an operator fallback. Never rewrite an old report's fingerprint to make it appear current.

The final gate requires current all-25 Node and browser records plus secure-browser PWA evidence. The development workflow validates without Pages publication permissions. Only a passing gated production workflow on `main` can publish Pages; manual dispatch on a development branch cannot publish. See [review and rollback rules](docs/RELEASE_GATE.md) before a future approved release.

## Workspaces and architecture

| Path | State |
| --- | --- |
| `/local-yolo/` | Minimal inference V1.1 development |
| `/local-yolo/studio/` | Reserved development page |
| `/local-yolo/experimental-training/` | Reserved development page |
| `/local-yolo/studio/experimental-training/` | Reserved development page |

`src/core/engine.js`, `adapters.js` and `onnx-info.js` implement UI-independent inference. Worker/client, media lifecycle, result drawing, model registry/cache and Minimal UI are separate modules. Studio can reuse inference capabilities through these interfaces while keeping its own UI. Experimental training entries do not execute training code in the inference app.

The application source is **AGPL-3.0-only**; both selected model sources are marked AGPL-3.0. ONNX Runtime Web and other dependencies retain their own licenses and notices. No model weights or user media are redistributed in the repository.

### Exact export coordinates

JSON includes actual `coordinateSpace.scaleX` and `scaleY`. Divide x/width by scaleX and y/height by scaleY for original-media coordinates. The older `scale` field is the nominal longest-edge scale; rounding can make scaleY differ slightly. A real 3002×2000 input →1920×1279 pipeline and the exported PNG/JSON are checked in `docs/evidence/browser-exports.json`.
