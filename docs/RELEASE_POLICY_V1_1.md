# Minimal V1.1 release acceptance — 2026-10-21

This revision follows the user's latest release criteria. The five tasks × five sizes remain mandatory. Real input, SHA-256, raw outputs, task postprocessing, rendering, video and lifecycle evidence remain required. A missing or failed model cannot pass.

Hardware WebGPU unavailable in the available cloud environment is a documented device limitation, not a fabricated GPU pass. The gate now accepts `environment-wasm-fallback` only with a real secure-browser capability observation, no acquired adapter, a specific reason, and that model's actual automatic-backend WASM image + decoded-video inference. Merely changing an unavailable label, or the presence of an older WASM run without the new automatic-backend run, does not pass.

Real Service Worker installation, offline cold start, cached-model offline inference, cache deletion, two-version update waiting/activation, version isolation, subpath resources and storage recovery remain required. GitHub CI runs these against finalized production files on browser-trusted localhost. CDP quota override forces a real browser storage limit; it does not replace IndexedDB or model outputs. The prior build differs only by an HTML validation marker and has its own real finalized SW revision.

Physical iPhone camera/Safari WebGPU/iOS installation and other unavailable devices retain explicit unverified status and reproduction steps. Passing cloud Chromium or a viewport simulation does not promote those device checks. Known severe compatibility faults still block publication.

Existing 25-model Node/WASM and browser/WASM evidence is reused only when the application fingerprint, pinned model definitions and real result/PNG digests still match. Fresh automatic-backend and PWA integration is required. The CI runner is isolated to this repository; no local personal computer or device is used.

The development workflow has no publication permissions. Production publication requires a successful complete gate on `main`. The preserved V1/rollback SHA remains `2cea0ebebd3399a77a2d649c44755e54ca0e16b0` until development acceptance succeeds.
