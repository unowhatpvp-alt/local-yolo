# Validation record — 2026-10-20

## Real runtime/model validation

ONNX Runtime Web 1.23.2 WASM, one thread, real pinned ONNX bytes and real public images. `npm run test:real` reproduces the checks and verifies downloaded model SHA-256 values. Outputs are never generated as mock detections.

| Task | Real image | Observed output |
| --- | --- | --- |
| Detection | Ultralytics bus.jpg | 5 objects; bus confidence 0.9275 |
| Segmentation | bus.jpg | 5 objects; nonempty instance masks |
| Pose | bus.jpg | 3 people; 17 keypoints per person |
| Classification | bus.jpg | 5 class scores; valid probability output |
| OBB | Ultralytics boats.jpg | 167 ships; rotated polygons visually aligned |

Also verified real digital-crop detections, original-coordinate bounds, graph signatures/metadata and session release. Low classification confidence on the scene is a real model output, not a correctness claim for scene classification.

## Automated checks

Geometry/adapter checks cover letterbox restoration, digital crop offsets, class-aware NMS, rotated IoU, small-class ambiguity, pose coordinates, masks, unsupported/truncated output errors. Lifecycle checks cover denied permission, late-camera cancellation, native and digital zoom, devicechange lifetime, hardware disconnect notification, track cleanup, upload Blob URL replacement and release. Cache checks use actual ONNX bytes for SHA integrity, damaged bytes, stream assembly and abort-before-fetch. Synthetic geometry/lifecycle fixtures test transforms and API behavior; they do not stand in for real model inference.

## Browser verification

Cloud Chrome browser checks passed: model download, exact integrity verification, IndexedDB cache recognition and model reload, WASM worker initialization, real image detection with correctly positioned boxes, MP4 sequential frame inference and replay controls, JSON export with real results/coordinate metadata, Chinese/English switching, dark appearance, and 375px/768px iframe viewport layouts (model picker and camera workspace; no horizontal document overflow after a narrow-header correction). The HTTP development origin correctly reported camera API unavailability instead of displaying fabricated frames. Local ONNX byte import and signature validation passed in the real engine tests; the browser file-picker path for ONNX is not separately verified. A cloud browser with no physical camera and a non-HTTPS development origin cannot verify real device camera behavior, hardware WebGPU, iPhone lenses, native fullscreen support or home-screen installation. Those remain explicitly unverified device checks, even when their feature-detection and fallback code passes automated checks.
