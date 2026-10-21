# V1.1 PWA validation and environmental limitations

Current dependency-patched application fingerprint: `ee5bfc2de06d9d6032a9be329c8138c097187cfb646fd9528368dc78e32bbb7e`.

Actual secure-browser PWA validation remains blocked. The current root browser uses cloud Chromium at `http://terminal.local:4173/local-yolo/`, where root QA observed an insecure context and no `navigator.gpu`. No installation, registered service worker, cold offline run or old-to-new worker transition is claimed for this build.

## Current evidence

`docs/pwa-validation.json` records all eleven required secure-browser checks as `environment-unavailable`, with **zero secure-browser passes**. Those checks cover manifest/runtime integration, installation, cold offline start, actual cached-model offline inference, deletion, waiting update, old-tab consistency, explicit activation, no mixed versions, storage failure recovery and application-subpath resources.

This is an environmental limitation, not an automatic waiver. It blocks publication under the release gate. Repeat the checks using the exact current source on an approved HTTPS test origin before marking any as passed; do not publish to production merely to make the test context secure.

The previous `0f995593…` report is retained at `docs/diagnostics/pwa-validation-0f995593.json`. Its artifact/lifecycle observations remain historical. They have not been relabelled as current secure-browser results.

## Fresh unit checks after the dependency patch

Executed:

```sh
node --test tests/pwa-lifecycle.test.mjs tests/release-gate.test.mjs
```

Results: **8 PWA lifecycle checks and 5 release-gate checks passed; 0 failed, 0 skipped**.

The lifecycle checks exercise hidden/unsafe precache rejection, partial-cache cleanup, offline route lookup, lazy runtime caching/quota handling, noninterception of uploads/external origins, explicit waiting-version activation, app-scope isolation and deterministic finalization. They execute generated worker logic in a Node VM with controlled API test doubles. They are not actual PWA installation, offline, update or physical-device evidence.

The release-gate checks confirm that missing or stale evidence, a reduced model set, unavailable GPU context and a non-main production dispatch cannot produce an eligible release.

## Current build verification is pending

No build, public HTML, application source, manifest or harness HTML was changed during this QA refresh because root is running the real browser matrix. The dependency patch changes the application fingerprint. Previous artifact verification cannot therefore be presented as verification of this current source.

After browser validation, serialize the final build and run:

```sh
npm run build
node scripts/verify-build.mjs --output docs/build-verification.json
```

The verifier must check production-only output, `/local-yolo/` URLs, all four entry paths/backlinks, manifest scope/start and real PNG dimensions, every actual visible precache resource, runtime modules/WASM and consistency of the revision with emitted bytes. A build exit code alone is insufficient. Keep it separate from actual secure-browser PWA validation.

## Required secure-browser retest

Install the current build on an approved HTTPS test origin, cache a real model/runtime, close all app tabs and cold-start offline. Perform actual inference, delete a cached model and observe actual storage behavior. Exercise a storage failure and record an honest cache warning instead of a fabricated offline guarantee.

For an update, use two distinguishable real builds and an already-open old tab. Verify waiting behavior and old-tab consistency. Confirm that explicit consent stops active inference/media before activation, that controller change produces one reload, and that the new shell, worker, runtime and resources agree. Repeat an offline return and a multiple-tab case. Record browser/version, URL, timestamps and actual observations, including failures.

## Physical-device checks remain unverified

The JSON report retains explicit steps for physical iPhone Safari installation, genuine camera capture, multiple-camera switching, native zoom, background/resume and physical fullscreen. All six remain `unverified`. Desktop viewports, feature detection and controlled media tests do not establish physical-device passes. Native zoom must follow the actual track capabilities and never imply access to every iPhone lens.

## CI and dependency evidence

Both CI workflows explicitly install and report the version of `ffmpeg` before actual video validation. `FETCH_E2E_FIXTURES=1` is set only for `npm test`: the supplementary test then downloads five integrity-pinned genuine Nano end-to-end exports into its separate test directory. This does not replace, reduce or alter the mandatory 25-model online matrix, which still runs independently through `npm run validate:models`.

The latest actual `npm audit --json` response is saved at `docs/dependency-audit.json`, with command/time/fingerprint metadata in `docs/dependency-audit-record.json`. It reports zero known vulnerabilities. Dependency audit status does not waive model, browser, GPU or PWA release requirements.
