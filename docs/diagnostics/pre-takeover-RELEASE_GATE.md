# Minimal V1.1 release gate

Current acceptance policy follows the user’s 2026-10-21 instruction: [device limits and actual fallback requirements](RELEASE_POLICY_V1_1.md). Hardware tests unavailable in Work may remain explicitly unverified when the actual automatic WASM fallback and all other necessary checks pass.

Production stays on the existing Minimal V1 until this gate passes and the release is approved. Development validation is not deployment authorization. Required online scope is **25 genuine YOLO26 exports**: detection, segmentation, pose, classification and OBB, each N/S/M/L/X. YOLO11 is a local-import regression target; it does not substitute for any required YOLO26 model.

## Preserved baseline

- Baseline commit: `2cea0ebebd3399a77a2d649c44755e54ca0e16b0`.
- Preserved remote branch: `backup/minimal-v1-2cea0eb`.
- Development branch: `develop/minimal-v1.1`.
- Production branch: `main`.

Only `main` can run the production Pages build/deploy jobs. A manual dispatch on any other branch skips both production jobs. Development push/PR validation has only `contents: read`, no Pages permission, no Pages environment and no publication step. Production build has Pages read permission; only the successful deployment job receives Pages write and OIDC permissions. Do not move, weaken or bypass the gate after a failed check.

## Required commands and artifacts

Run `npm ci`, `node scripts/verify-model-evidence.mjs`, the required Nano/media fixture preparation, `npm test`, `npm run build`, the actual CI browser integration runner, then `node scripts/check-release-gate.mjs`. Re-execute `npm run validate:models` when application/model inputs change or evidence cannot be verified; unchanged valid real Node results are reused. The isolated browser runner dependency and exact commands are pinned in the workflows.

The final command exits nonzero until **all** required evidence is current:

| Evidence | Required source |
| --- | --- |
| Actual Node WASM execution, all 25 | `docs/model-validation-matrix.json` |
| Actual browser WASM and WebGPU/fallback execution, all 25 | `docs/browser-validation-matrix.json` |
| Actual secure-browser PWA/offline/update checks | `docs/pwa-validation.json` |

Every report has `schemaVersion: 1`, a unique actual run ID, start/end timestamps and `sourceFingerprint`. Obtain that value using `node scripts/check-release-gate.mjs --fingerprint` or the exported `sourceFingerprint()` utility. It binds the application files, dependencies, PWA build scripts, icons/manifest and immutable model metadata. Changing only a model's validation label does not change the immutable metadata fingerprint. Changing engine, UI, dependencies or model bytes does. Evidence from a different fingerprint must be rerun; never rewrite its fingerprint after testing.

The required model IDs are fixed in `scripts/check-release-gate.mjs`, independent of enabled catalog entries. Duplicate rows, missing sizes, substituted YOLO11 models, stale hashes, missing artifacts, skipped cases and pending cases fail. A smaller model set cannot pass by changing the catalog.

## What constitutes model evidence

Each model row identifies its pinned SHA-256 and captures actual image inference and at least two decoded video frames. Image fixtures must produce meaningful task-specific results: a bus for detection, real nonempty masks for segmentation, 17 human keypoints for pose, probabilities for classification and ship polygons for OBB. Samples contain measured latency, source dimensions and output values. Node records additionally retain actual raw tensor signatures, finite-value statistics and digests, plus observed session cleanup.

Video scenes may correctly produce zero objects. Record that actual output with valid raw tensor statistics and latency; do not invent bus/ship detections in unrelated video frames. Model output count and sample count must agree. Synthetic geometry or lifecycle unit tests do not replace actual inference evidence.

Keep these backend states separate:

- `wasmNode.status: pass` means actual Node/Canvas WASM execution only.
- `browserWasm.status: pass` means actual browser WASM execution.
- `webgpu.status: pass` means actual WebGPU execution.
- `webgpu.status: unsupported-operator-fallback` requires a real acquired GPU adapter, a recorded initialization/inference operator or kernel error and a successful actual browser WASM fallback. It is a supported fallback case, not a GPU pass.
- `webgpu.status: environment-wasm-fallback` requires an actual secure-browser capability observation with no acquired GPU adapter, a specific reason, and this model’s actual automatic-backend WASM image/video inference. It passes compatibility under the current user-approved device-limit policy, while hardware WebGPU stays unverified.
- Bare `environment-unavailable`, `pending`, `fail` or missing execution evidence still blocks release. An insecure cloud observation alone cannot satisfy the new fallback check.

A genuine environmental limitation is recorded honestly. The explicit revised user instruction permits unavailable real-device checks to remain unverified. It does not waive actual WASM/model/PWA execution or permit a reduced model scope. Unknown software failures remain blockers.

## Browser and PWA checks

Browser evidence requires actual observations for all-25 selection, switching, progress, cache recognition/reload, local ONNX import, image/JSON exports, video pause/replay, file cleanup, phone/tablet layouts, permission failure and absence of media network uploads. The exact machine-readable check IDs are in `browserChecks` in the gate script.

PWA requires a secure browser context and actual observations for manifest, installed service worker, cold offline start, cached-model offline inference, cache deletion, waiting update, old-tab consistency, activation, absence of mixed versions, storage failure recovery and GitHub Pages subpath resources. Static HTTP availability and service-worker lifecycle unit tests are useful checks, but are not actual installation/offline/update evidence.

Physical iPhone installation, camera capture, camera switching, native zoom, background resume and physical fullscreen must be recorded under `deviceChecks`. They may remain `unverified` with explicit reproduction steps; a physical-device pass requires its device identity and observed behavior. Never describe these as tested based on feature detection or an emulated desktop viewport.

## PWA update contract

The service worker pre-caches visible app resources and lazily caches same-origin runtime assets. Hidden files, including `.nojekyll`, are excluded because Pages may return 404 for them. Failed pre-cache installation removes its partial cache. Runtime quota failures preserve an otherwise successful network response. Model bytes use the separate IndexedDB model store; uploaded media is never put in this cache.

A waiting worker keeps the existing version active. Query the waiting worker through a MessageChannel using `{type: 'GET_VERSION'}`; it responds with `{version, scope}`. After the user chooses the update action and the app stops active inference/media, post `{type: 'ACTIVATE_UPDATE', version}` and reload once on `controllerchange`. A different version, obsolete `SKIP_WAITING` string or ordinary navigation does not activate a waiting update. Test update behavior with two real builds and an already-open old tab.

## Review and rollback plan

Before merging, review the actual matrix failures, browser/PWA artifacts, known-device limitations and the final fingerprint. A green build or a Node-only matrix is insufficient. Keep the backup branch intact.

If the new version has not been published, stop and keep the existing production site; no rollback is needed. If a published V1.1 requires recovery, first identify its exact deployed commit/artifact, the intended baseline above and any browser cache impact. Prepare a recovery branch from the preserved baseline for review. Where an intact previous Pages artifact is available, redeploy that exact previously verified artifact through a separately reviewed recovery action. Otherwise prepare a baseline-source recovery deployment and obtain explicit approval for that recovery; do not pretend it satisfies V1.1's 25-model gate.

Do not force-push `main`, delete the backup, rewrite evidence, label V1 recovery as a V1.1 pass or weaken the V1.1 gate to make recovery green. After an authorized recovery, verify the public page, subpath assets, runtime, manifest and offline/update behavior, and retain the recovery record. This document is a plan; it does not execute a merge, recovery or deployment.
