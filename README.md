# Local YOLO — Minimal V1

A real, private, browser-only YOLO inference workbench. No Python service, account, media upload, analytics, remote inference, or API key. English / 中文, light / dark / system, responsive desktop and touch layouts.

## Run and build

```sh
npm ci
npm run dev
npm test
npm run test:real
npm run build
```

Development base: `/local-yolo/`. Deploy `dist/` to GitHub Pages. The included Actions workflow downloads integrity-pinned fixtures, runs tests, builds static files, and deploys Pages. Repository Settings → Pages → Source must be **GitHub Actions**. HTTPS is required for camera/WebGPU/PWA; file inference also works with WASM where these APIs are unavailable. No third-party CDN is required for the runtime.

## Four workspaces

| Path | State |
| --- | --- |
| `/local-yolo/` | Minimal inference V1 |
| `/local-yolo/studio/` | Reserved, development page |
| `/local-yolo/experimental-training/` | Reserved, development page |
| `/local-yolo/studio/experimental-training/` | Reserved, development page |

## Verified models

YOLO11 **N** detection, segmentation, pose, classification and OBB have passed real-image inference using ONNX Runtime Web 1.23.2 WASM. Online S/M/L/X and YOLO26 are intentionally disabled pending per-export validation. This does not imply those architectures cannot run; no unverified online combination is advertised as ready.

Models are community ONNX exports of Ultralytics checkpoints, not official Ultralytics-hosted ONNX artifacts. See the in-app source link and `src/core/catalog.js` for immutable revision, observed byte size, SHA-256, input/output shapes and license. Five N models use non-square `[1,3,480,640]` input. Each task has its own preprocessing/decoder/rendering path. SHA-256 is checked before caching and again when loading a cached model.

Sources:

- [Pinned export repository](https://huggingface.co/unileon-robotics/YOLO11-ONNX/tree/0e2a3f195ae62a25bc038ee9665b8e4ac5b98793)
- [YOLO11 model documentation](https://docs.ultralytics.com/models/yolo11/)
- [YOLO26 formats](https://docs.ultralytics.com/models/yolo26/)
- [ONNX Runtime Web deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html)

The application source is AGPL-3.0-only. The selected models are marked AGPL-3.0 upstream. ONNX Runtime Web and other dependencies retain their own licenses. No weights are redistributed in this repository.

## Local ONNX compatibility

Import a self-contained float32, single-RGB-input NCHW batch-one model. The importer reads the actual ONNX graph and metadata, validates output tensors during real warm-up, and fails with a specific reason when incompatible. Supported raw Ultralytics layouts include detection, prototypes for instance masks, 17-point human pose, classification probabilities, and rotated boxes. Metadata-identified end-to-end detection rows are supported; unverified end-to-end OBB is rejected.

Use task override and comma/newline-separated labels or a JSON string array when needed. Custom class counts require accurate labels to avoid silently interpreting objectness as a class. Multi-input graphs, external `.data` weights, incompatible tensor layouts/types, arbitrary networks, and ambiguous exports are not supported. Dynamic image sizes use metadata/default 640 when dimensions are symbolic. This is not a universal ONNX viewer.

## Media and performance

Camera defaults to rear-facing on mobile where available. Device lists and labels depend on permission. Settings/camera availability can be limited by OS and browser. Native hardware zoom is shown only when the actual camera track exposes it; otherwise a clearly labeled 1–4× **digital crop** is offered. Digital crop, letterbox restoration, mirror and overlays share one source-coordinate transform. Browser APIs do not expose every iPhone physical lens.

Images infer once; videos infer sequentially while playing. A completed frame and its results are composited together, avoiding boxes from another frame. Inference is serialized, normally in a Web Worker. Video presentation follows completed inference, so slow devices can show fewer frames than the source video. Files are decoded by the browser; codec support varies. Backgrounding stops the camera and pauses video; resume explicitly. Switching models releases the old session and camera resources.

Latency is **preprocessing + session.run + CPU postprocessing**, excluding worker transport, presentation and scheduling. FPS counts completed inference results in a rolling two-second window, not capture or display refresh. No GPU utilization/VRAM estimates are invented. WebGPU is attempted first and initialization/warm-up failure falls back to WASM. WASM uses one thread because GitHub Pages does not provide cross-origin isolation headers. GPU hardware testing is distinct from CPU/WASM validation.

PNG exports save the visible composited frame. JSON contains task results, model/backend and an explicit coordinateSpace: processed width/height, original media width/height and scale. Media is reduced to at most 1920 pixels on its longest edge before inference; multiply result coordinates by `1/coordinateSpace.scale` to map to original media. Mirror affects presentation only, not JSON source coordinates.

## PWA and storage

Manifest, standalone mode, icons, iOS safe areas and a versioned service worker are included. Production builds pre-cache the shell and runtime bundle. Runtime WASM assets are cached when first requested. Models use IndexedDB separately and can be removed under Settings. An already downloaded model alone does not guarantee offline use: the app and runtime must also have been opened successfully, and browser storage can be evicted. Cache failures fall back to memory and are shown as warnings. No camera pixels, uploaded files or inference results are persisted by the app.

Android/desktop browsers may show an installation control. On iOS/iPadOS use Safari → Share → Add to Home Screen. Fullscreen uses the Fullscreen API where available, with a viewport-filling fallback otherwise. Actual installation, physical camera zoom, thermal limits and device-specific codec support require testing on those devices.

## Architecture

- `src/core/engine.js`, `adapters.js`, `onnx-info.js`: UI-independent session, preprocessing and task adapters.
- `engine-client.js`, `engine-worker.js`: worker RPC with main-thread fallback when required APIs are absent.
- `catalog.js`, `model-cache.js`: explicit compatibility registry, streaming download, integrity and cache.
- `media.js`, `render.js`: lifecycle, zoom, crop and task-specific drawing.
- `src/main.js`, `src/ui/`: Minimal-specific controller and bilingual interface.
- `public/studio/` and training paths: independent entry points generated at build time; no experimental training code runs in inference.

See [validation record](docs/VALIDATION.md) for tested scope and remaining device checks.
