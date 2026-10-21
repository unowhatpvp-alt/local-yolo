# YOLO26 model provenance and reproducible downloads

Minimal V1.1's online picker contains exactly the requested **25 YOLO26 exports**: detection, instance segmentation, pose, classification and OBB, each in the official N/S/M/L/X sizes. YOLO11 is absent from the online registry; retaining compatible local-import adapters does not add it to the picker.

## Sources and license

Official architecture, task/size table and export modes: <https://docs.ultralytics.com/models/yolo26/>. Official checkpoint publisher: <https://huggingface.co/Ultralytics/YOLO26>. Upstream license: <https://www.ultralytics.com/license>.

The registry deliberately uses two immutable ONNX export sources, recorded **per model**:

| Selected models | ONNX exporter/publisher | Pinned repository revision |
| --- | --- | --- |
| Detection, segmentation, pose and OBB; N/S/M/L/X (20 files) | Grupo de Robótica de la Universidad de León, `unileon-robotics` | [`e046fc5125ee6b579f1801f0b6df68a60b949c42`](https://huggingface.co/unileon-robotics/YOLO26-ONNX/tree/e046fc5125ee6b579f1801f0b6df68a60b949c42) |
| Classification; N/S/M/L/X (5 files) | `prithivMLmods` | [`c526dae7a5a5b4f1d79d704903b4406011da2716`](https://huggingface.co/prithivMLmods/YOLO26-ONNX/tree/c526dae7a5a5b4f1d79d704903b4406011da2716) |

These are **community ONNX exports of official Ultralytics YOLO26 checkpoints**, not official Ultralytics-hosted ONNX artifacts. Both pinned export cards identify the upstream YOLO26 checkpoints and AGPL-3.0. Every actual ONNX file embeds Ultralytics authorship, an AGPL license string, its YOLO26 name, task and class labels. The application source remains AGPL-3.0-only. Weights are downloaded from the publishers and are not included in Git or the app bundle.

The official family also documents semantic-segmentation and depth variants. Those are outside the requested five-task V1.1 scope; “25” means all combinations of the five requested tasks and five sizes, not every head currently mentioned in upstream documentation.

## Actual artifact checks

All 25 currently selected files were actually downloaded: **2,166,780,209 bytes total**. Every final response returned HTTP 200 and `Access-Control-Allow-Origin: *` for an Origin of `https://unowhatpvp-alt.github.io`. Exact byte length and SHA-256 were checked. No authenticated download or API token was used. The five classifiers were independently downloaded again with Origin headers when their source was selected.

The graphs were inspected individually; geometry is read from actual artifacts rather than stale search-index snippets or guessed filename conventions.

| Requested task | Sizes | Actual input | Actual output | Labels | Exporter / opset |
| --- | --- | --- | --- | --- | --- |
| Detection | N/S/M/L/X | `[1,3,480,640]` float32 | `[1,84,6300]` | 80 COCO classes | Ultralytics 8.4.174 / 12 |
| Segmentation | N/S/M/L/X | `[1,3,480,640]` float32 | `[1,116,6300]` and `[1,32,120,160]` | 80 COCO classes | Ultralytics 8.4.174 / 12 |
| Pose | N/S/M/L/X | `[1,3,480,640]` float32 | `[1,56,6300]` | 1 person class; 17 keypoints | Ultralytics 8.4.174 / 12 |
| Classification | N/S/M/L/X | `[1,3,224,224]` float32 | `[1,1000]` probabilities | 1,000 ImageNet classes | Ultralytics 8.4.100 / 20 |
| OBB | N/S/M/L/X | `[1,3,480,640]` float32 | `[1,20,6300]` | 15 DOTAv1 classes | Ultralytics 8.4.174 / 12 |

All files use static batch-one RGB NCHW float32 inputs with embedded weights and labels. The 20 spatial models have actual metadata `end2end=False`, `nms=None`, and use raw one-to-many heads with task-specific NMS. Classifier outputs are already probabilities and must not receive a second softmax. Supporting YOLO26 does not imply that every selected export uses the NMS-free layout.

Actual metadata identifies `Segment26`, `Pose26` and `OBB26` heads for the specialized spatial tasks, `Detect` for detection, and `Classify` for classification. None of the spatial graph byte streams contains a `/dfl/` node-name path, consistent with the upstream DFL-free architecture. This corroborates publisher provenance; it is not a claim to have independently reproduced training. No YOLO11 file was renamed to create these entries.

An additional local check compares raw numeric initializer payloads of five YOLO26 N exports against the pinned YOLO11 N exports from V1, excluding description/license metadata. Exact tensor counts, changed payload hashes and sample digests are recorded in `docs/model-metadata-evidence.json`. This is a five-N comparison, not a claim that all 25 were compared against legacy YOLO11.

`src/core/model-manifest.json` is the machine-readable source of per-file URLs, revisions, SHA-256, byte lengths, signatures and validation states. `docs/model-download-evidence.json` and `docs/model-metadata-evidence.json` record actual retrieval and graph inspection. Runtime image/video validation lives separately in the complete model matrix. Node WASM success does not establish physical WebGPU, browser-cache, mobile camera or PWA success; those fields remain distinct.

## Why classifiers use 224 × 224

The first source also supplied 480×640 classifier exports. A real test found that its X classifier predicted `dugong` on the official blurred goldfish training-image fixture. The failure and original five source records were preserved in `docs/classification-source-investigation.json`, with further actual comparisons in `docs/diagnostics/`; the failure was not relabeled as a pass.

The final classifier selection uses genuine native 224×224 exports, matching the standard official classification size and reducing input pixels from 307,200 to 50,176. All five correctly classified both the original goldfish image and a separate native-resolution bus image in real tests. Independent PIL bilinear preprocessing corroborated the browser Canvas path. This evidence justified switching the source for the same N/S/M/L/X variants; no smaller model or different architecture was substituted. It is a compatibility/quality check on known references, not a general classification-accuracy benchmark.

## Reproduce

Download all selected models and the integrity-pinned bus/boats image fixtures:

```sh
node scripts/fetch-test-fixtures.mjs
```

Download models only, or narrow a development check:

```sh
node scripts/fetch-yolo26-models.mjs
node scripts/fetch-yolo26-models.mjs --size=N
node scripts/fetch-yolo26-models.mjs --task=classify --size=X --concurrency=1
```

The helper streams at most three model downloads concurrently into ignored `tests/fixtures/yolo26/` files. It checks exact length, SHA-256 and final-response CORS before replacing a fixture. Existing files are reused only after hash verification. `--force` redownloads valid fixtures and rechecks actual HTTP/CORS responses. The runtime matrix helper prepares the classification/video fixtures it needs. Node retrieval checks are not represented as browser download/cache tests.

Large model loading can exceed a browser or device memory budget even when the format is valid. Successful development-machine tests do not guarantee universal mobile performance. An unsupported device must receive a concrete failure or smaller-model suggestion; it must never be silently assigned a different size.
