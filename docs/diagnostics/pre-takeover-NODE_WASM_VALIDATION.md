# YOLO26 actual Node WASM validation

This report covers actual ONNX Runtime Web WASM execution in Node with Canvas. It does not establish browser, WebGPU, camera, iPhone Safari or installed-PWA compatibility. The release gate keeps those checks separate.

## Reproduction

Prerequisites: the committed Node dependencies, Python 3 for exact ZIP-member extraction, and FFmpeg for decoding the real H.264 fixture. Python is a development-only extraction tool; the application has no Python service.

```sh
npm ci
node scripts/fetch-yolo26-models.mjs
node scripts/fetch-yolo26-validation-fixtures.mjs
node scripts/validate-yolo26-matrix.mjs
```

The required scope is fixed at 25: detection, segmentation, pose, classification and OBB, each N/S/M/L/X. Models execute serially in isolated processes. The full command fails for a missing model, failed assertion, partial selection, changed source fingerprint or changed runner. It never treats a skipped case as a pass. A partial `--ids` run is useful for diagnosis and deliberately exits nonzero.

`docs/model-validation-matrix.json` is the final machine-readable evidence; `docs/model-validation-matrix.csv` contains the compact per-model summary. Each row includes the exact model digest and source, source fingerprint captured before execution, ONNX metadata/signatures, actual tensor statistics/digests, measured latency, real decoded outputs, PNG digest and observed session release. The contact sheet is `docs/evidence/yolo26-matrix.png`; individual rendered results are under `docs/evidence/yolo26/`.

The engine latency spans preprocessing, ONNX execution and decoding, excluding result drawing. This Node validator also collects tensor statistics inside its ONNX call wrapper, so its instrumented latency is diagnostic rather than a device-speed benchmark. RSS/heap/ArrayBuffer measurements describe this host process only. They are not GPU usage or phone memory predictions.

## Real fixture coverage

| Task | Primary image | Actual checks |
| --- | --- | --- |
| Detection | Ultralytics bus photograph | Bus detected, finite source-coordinate boxes, digital-crop coordinate bounds |
| Segmentation | Same bus photograph | Nonempty per-instance binary masks with valid dimensions, correct result compositing |
| Pose | Same bus photograph | 17 human keypoints per person and confident visible points, actual skeleton drawing |
| Classification | Exact goldfish JPEG from official ImageNet10 archive | Expected top-1 goldfish, 1000 finite probabilities summing to approximately one, actual labels drawn |
| OBB | Ultralytics aerial boats photograph | Ship labels and four-point rotated polygons, actual rotated-box drawing |

Every model also infers two frames at 0 and 1 seconds decoded from the same real `solutions_ci_demo.mp4`. This overhead people footage may correctly produce no ships or no confident poses. Empty scene results are retained; no detections are invented to satisfy a test. Its exact MP4 SHA-256 and each decoded frame's dimensions/digest are recorded.

The five Nano variants additionally complete three real load/infer/dispose cycles. Every model awaits the actual ONNX session release and checks that engine session, model information and preprocessing canvas references are cleared. Memory telemetry is retained across Nano reloads. This is a bounded lifecycle check, not a long-running mobile memory benchmark.

## Sustained Nano inference diagnostic

`node scripts/stress-yolo26-nano.mjs` performs 50 actual sequential inferences for each of the five Nano tasks, alternating two real decoded MP4 frames and yielding one event-loop task turn after every result. All 250 inferences and actual session releases completed against unchanged current source `ee5bfc2de06d9d6032a9be329c8138c097187cfb646fd9528368dc78e32bbb7e`. Run `47b8d4b5-b419-4c51-b0d2-3ec489c1195c` executed from `2026-10-21T01:56:16.634Z` to `2026-10-21T01:57:29.581Z`. Full samples and real result counts are in [the sustained-inference evidence](diagnostics/nano-sustained-inference.json). The previous 0f995 and aa22 runs remain preserved separately.

| Nano task | Actual inferences | Late-window RSS range |
| --- | ---: | ---: |
| detect | 50 | 1.26 MiB |
| segment | 50 | 8.51 MiB |
| pose | 50 | 4.15 MiB |
| classify | 50 | 0.84 MiB |
| obb | 50 | 3.52 MiB |

The late window comprises the last five requested-GC samples at inferences 30/35/40/45/50. Observed retained RSS in those windows ranged from 355.8 to 413.8 MiB on this host. Disposal does not promise that all allocator pages return to the OS; external-buffer totals fluctuate as buffers are collected. A prior microtask-only stress loop showed steadily increasing native Canvas memory; that actual observation is retained in [the original tight-loop diagnostic](diagnostics/nano-sustained-interrupted-source.json). Allowing real event-loop task turns lets native finalizers run and matches the application's worker/frame scheduling. This bounded host test is not proof of iPhone memory capacity or indefinite-run stability.

## Classifier export investigation

The initial rectangular 480×640 classifier-X misclassified the original goldfish image as dugong. That failure is preserved in `docs/diagnostics/initial-node-matrix.json` and `rectangular-classifier-x.json`; the original contact sheet is also retained. It was not relabeled as a pass.

After comparison with the publisher's standard preprocessing, the five online classifiers use genuine pinned YOLO26 224×224 exports. The other 20 model exports are unchanged. Independent PIL/bilinear reference diagnostics are retained in `docs/diagnostics/classification-224-pil.json`; the rectangular/native comparison is in `classification-resolution-comparison.json`. All five native classifiers correctly identify the unchanged primary goldfish and a separate native-resolution bus photograph as minibus. Provenance, exact hashes and signatures are documented in `MODEL_PROVENANCE.md`.

A further ten held-out, known-label ImageNet10 images run through every classifier. Every predicted label, confidence, expected class, top-five list and miss is retained in the final matrix's `classificationAccuracy` records. Observed top-1 counts are N 3/10, S 3/10, M 4/10, L 5/10 and X 6/10; these very small, low-resolution images are a diagnostic and are not an ImageNet benchmark. Independent reference preprocessing reproduces the observed misses. The compatibility pass requires the correct transform/signature/label mapping, valid probabilities, the primary known-label result and actual rendering/lifecycle. It does not assert that every probabilistic prediction is correct.

## Final execution status

Final actual Node WASM result after the Vite/esbuild dependency patch: **25/25 pass, 0 failed, 0 missing, 0 pending**. Complete nonpartial run `b1d9dcb7-8dce-48ab-8990-c347ef04e6a3` executed from `2026-10-21T01:56:14.966Z` to `2026-10-21T02:01:15.810Z` with ONNX Runtime Web `1.23.2`. Start/end fingerprints and every model-row fingerprint match `ee5bfc2de06d9d6032a9be329c8138c097187cfb646fd9528368dc78e32bbb7e`. The validator source digest is `9f3697e6f82e87f0097ee76b971188acc5c6a2350af222efca8144c262b6555a`. The CLI exited successfully. The previous complete [0f995 report](diagnostics/0f995-complete-node-matrix.json) and [aa22 report](diagnostics/aa22-complete-node-matrix.json) retain their original fingerprints; neither was rebound to the new dependencies.

| Task | N | S | M | L | X |
| --- | --- | --- | --- | --- | --- |
| detect | Pass; 5 results | Pass; 5 results | Pass; 5 results | Pass; 5 results | Pass; 5 results |
| segment | Pass; 5 results | Pass; 5 results | Pass; 5 results | Pass; 5 results | Pass; 5 results |
| pose | Pass; 4 results | Pass; 4 results | Pass; 4 results | Pass; 4 results | Pass; 4 results |
| classify | Pass; 5 results | Pass; 4 results | Pass; 5 results | Pass; 1 result | Pass; 4 results |
| obb | Pass; 170 results | Pass; 163 results | Pass; 181 results | Pass; 184 results | Pass; 184 results |

Each pass includes actual file integrity/signature checks, initialization, primary-image inference and decoding, finite raw tensor statistics, two real video-frame inferences, task rendering and awaited session release. Counts above are actual primary-image results at the validator's thresholds; classification counts denote labels, not objects. Every classifier retains all ten known-label observations, including misses. All 25 current render hashes match the previously inspected renders; the fresh original-resolution contact sheet was also inspected. Classification labels fit the small primary image. This is qualitative rendering validation, not a measured ground-truth accuracy benchmark. The [human 25-row compatibility matrix](MODEL_COMPATIBILITY.md) contains exact input/output signatures, model sizes, actual image counts/labels/confidences/latency, two-frame video counts, releases and PNG links.

This Node result does not establish the complete release gate. Browser WASM, actual WebGPU or genuine operator fallback, secure PWA checks and physical-device status are reported separately. No browser, GPU or phone pass is inferred from Node execution. A stale diagnostic run cannot be rebound to a later application fingerprint.
