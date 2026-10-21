# V1.1 PWA validation and remaining limits

Frozen application fingerprint: `0f9955933f5a6ccf170f3ca1880433c5bc6eef090de993388cda8dcac2d1a579`.

The production build passes static verification and all eight service-worker lifecycle unit checks. **Actual secure-browser PWA validation remains blocked by the available browser origin.** These are different kinds of evidence; neither static files nor controlled lifecycle tests establish a successful installation, offline run or real update.

## Actual browser environment

Root browser QA in this task observed cloud Chromium at `http://terminal.local:4173/local-yolo/` with `isSecureContext === false` and no `navigator.gpu`. The HTTP origin cannot establish the required secure-context service-worker installation/offline/update evidence. No successful service-worker registration, installed PWA, cold offline launch or version transition is claimed for this build.

All eleven actual PWA checks in `docs/pwa-validation.json` therefore remain `environment-unavailable`: manifest in a secure browser, service-worker installation, cold offline start, cached-model offline inference, cache deletion, waiting update, old-tab consistency, activation, absence of mixed versions, storage failure recovery and subpath resources as observed by a secure installed app. Their static counterparts are recorded separately below.

This limitation blocks the release gate. It is not an automatic waiver and must not be converted to a runtime pass. The reviewed V1.1 build must be tested on an approved HTTPS origin before these checks can pass; do not publish to production simply to remove the limitation.

## Executed static build verification

Commands completed successfully:

```sh
npm run build
node scripts/finalize-sw.mjs
node scripts/verify-build.mjs --output docs/build-verification.json
```

The emitted build revision is `12d09067cbcc`. The verifier checks actual artifact bytes and filesystem paths:

| Check | Actual static result |
| --- | --- |
| Production-only output | 24 emitted files; no test harness, browser run config, validation fixtures, test tree or ONNX weights |
| GitHub Pages base | Main JS/CSS use `/local-yolo/assets/`; referenced resources exist under the project scope |
| Four entry paths | Minimal and all three reserved pages exist; reserved pages have correctly resolved backlinks |
| Manifest and icons | `scope` and `start_url` resolve to `/local-yolo/`; standalone display; actual PNG dimensions are 192×192 and 512×512, including maskable icon |
| Service-worker precache | All 15 entries reference existing visible files; none is hidden, escapes scope or incorrectly pre-caches a runtime binary |
| Build revision/runtime | Revision matches deterministic emitted paths and bytes; runtime modules/WASM exist, pair correctly and have valid WASM binary magic |

`docs/build-verification.json` contains the machine-readable observations. These checks do not execute a service worker or infer browser behavior from file existence.

## Executed lifecycle unit tests

`node --test tests/pwa-lifecycle.test.mjs` completed with **8 passed, 0 failed, 0 skipped**. They check:

1. Unsafe and hidden precache paths are rejected.
2. Failed installation removes its partial cache.
3. Offline root and reserved-route cache lookup resolves the matching document.
4. Runtime caching and quota-failure logic preserve a successful network response.
5. External URLs, uploads and other application scopes are not intercepted.
6. Waiting activation requires the explicit matching-version message.
7. Activation removes only older caches in the current app scope.
8. The build finalizer excludes the historical `.nojekyll` issue and emits a deterministic revision.

These execute the generated template's event/cache logic in a Node VM with controlled API test doubles. They do not substitute for actual browser service-worker installation, network transitions, storage pressure or an old-tab/new-version transition. The separate PWA report labels their scope explicitly.

## Required real secure-browser retest

Use the exact frozen build and record the browser/version, approved HTTPS URL, timestamps and actual observations. Install its service worker, cache a real model/runtime, close all app tabs, then cold-start with networking disabled and complete actual inference. Delete the model through settings and verify storage/cache behavior. Exercise an observed storage failure and verify the app continues with an honest offline-cache warning.

For updates, use two distinguishable builds and an already-open old tab. Confirm the new worker waits, the old tab remains internally consistent, and explicit update consent stops active inference before activation. After `controllerchange`, verify exactly one reload and matching new shell, worker, runtime and resources. Repeat with an offline return and multiple tabs. Record any failure rather than synthesizing a pass.

## Physical-device checks

Physical iPhone Safari installation, genuine camera capture, multiple-camera switching, native zoom, background/resume and physical fullscreen remain **unverified**. Each has reproduction steps under `deviceChecks` in `docs/pwa-validation.json`. No desktop viewport or feature-detection result is presented as physical-device validation. Native zoom must be evaluated from actual track capabilities; lack of exposed zoom should produce the labelled digital-crop fallback, not a claim to control every iPhone lens.

The existing production V1 remains the live version while the V1.1 release gate is blocked. This record does not authorize merging or publishing V1.1.

## Current verification refresh

This record was regenerated for the frozen fingerprint above after the controller race/coordinate fixes. The production build completed; an independent revision check detected artifact changes between finalization and verification. Finalization was repeated against the stable emitted files, and the complete independent verification then passed. The eight lifecycle unit tests were run again. Secure-browser checks were not relabelled or reused: all remain environment-unavailable. Before packaging or any future approved release, serialize the final build and run the independent verifier after it.

The current emitted-file checks are intermediate diagnostics, not approval of a final release artifact. Root will perform the final serialized build and independent verification after model-status promotions and before the browser matrix. Publication remains blocked.

## Final serialized artifact verification

2026-10-21T01:23:05.764Z: after all model status promotions, the frozen source was built once and independently verified. All six static groups passed, 24 files, 0121f012cee0 service-worker revision and 15 valid shell entries. No model weights, media fixtures, or development harness are present in dist. This does not change any secure-browser or device check to pass.

Final artifact after browser validation-label updates: 2026-10-21T01:35:51.558Z, revision `395743021b71`, 24 files, 15 valid shell entries, all six static groups pass. This supersedes earlier intermediate artifact revisions; it does not mark any real SW/install/offline/update check passed.
