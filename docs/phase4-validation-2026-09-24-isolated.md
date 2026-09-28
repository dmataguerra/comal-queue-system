# Phase 4 production validation — partial execution

**Result: NOT PRODUCTION READY / validation incomplete.** This report covers checks that were possible in the current Windows session. It does not certify the installed application, physical TV, or customer-facing audio.

## Environment and traceability

- Test date and time: 2026-09-24, approximately 23:10–23:15 America/Mexico_City.
- Operator: Codex validation session; venue operator not identified.
- Git HEAD: `529b5d422e3c02d19e4f83280ec975525a46ac0f`.
- Source state: many uncommitted changes from parallel sessions. The tested source snapshot cannot be identified by the commit alone. Snapshot: `C:\Projects\comal-queue-system\test-results\phase4-20260924-231033`. Its `package.json` SHA-256 was `4F4A81276204809E3EAF652B7E0B63B121C840712C9EF9ED8DCC2F4FEE9C9A10` when copied.
- Application version/product: `0.3.0` / `Comal++` from `package.json`.
- Node/npm/Electron: 22.19.0 / 10.9.3 / 44.3.0.
- Windows: registry reports `Windows 10 Home`, display version `25H2`, build `26200.9457`; Electron Builder reports Windows `10.0.26200`. The marketing name was not independently verified.
- Displays detected: primary `\\.\DISPLAY1` at 1536×864; secondary `\\.\DISPLAY2` at 1920×1080. Physical monitor and TV models, scaling, and viewing distance were not available. The smoke log records selection of the secondary display for the public window, but the renderer failed before visual verification.
- Audio output device and audibility: not identified or verified.
- Production data: `C:\Users\dmata\Documents\Turnero Comal` was absent at inspection. No production data was edited or deleted by this session. No backup could be made from that path; confirm the actual venue data path before live testing.
- Isolated test data: `C:\Projects\comal-queue-system\test-results\phase4-20260924-231033\test-data`, with copied `contenido`, an invalid text file, and an empty MP4. The desktop smoke test used its own isolated `test-results\desktop-hvSiB5` directory within the snapshot and created a default config and log there. Source assets contain two JPEG images and no usable local videos.
- New installer hash: unavailable; the new installer was not generated. Existing files in the shared `release` directory were not treated as this run's artifacts.

## Test cases

### P4-01 — Formatting

- Environment: shared repository, existing dependencies.
- Preconditions: source had uncommitted changes.
- Steps: `npm run format:check`.
- Expected result: all checked files formatted.
- Actual result: exit 0, all matched files passed.
- Status: **PASS**
- Severity: none.
- Evidence: command output from this session.
- Notes: the files are concurrently editable, so this is a point-in-time result.
- Required follow-up: rerun on the frozen release candidate.

### P4-02 — Lint

- Environment: shared repository, existing dependencies.
- Preconditions: source had uncommitted changes.
- Steps: `npm run lint`.
- Expected result: exit 0.
- Actual result: exit 1 with 30 ESLint errors across main, core, operator, and public view files.
- Status: **FAIL**
- Severity: P1 release-quality gate.
- Evidence: command output; examples include `main/contenido.ts:198`, `main/escritura-atomica.ts:39`, `vistas/publica/Contenido.tsx:84`, and `vistas/operador/OperadorPage.tsx:269`.
- Notes: errors may change as parallel agents continue editing.
- Required follow-up: application team resolves the lint errors and reruns the command on the frozen candidate.

### P4-03 — Audio inventory and unit tests

- Environment: shared repository; Node 22.19.0.
- Preconditions: source voice assets present.
- Steps: `npm test`; then rerun with `NODE_OPTIONS=--require C:\Projects\comal-queue-system\.tsx-userinfo-shim.cjs` because this Windows session returned `uv_os_get_passwd ... ENOMEM` from `tsx` before tests started.
- Expected result: all required audio found and all unit tests pass.
- Actual result: audio verifier found 100 selected voices (99 MP3, one WAV) and `contenido/aviso.wav`; 72 tests passed with the shim. The initial unmodified command exited 1 before tests ran.
- Status: **PASS with environment workaround**
- Severity: none for the passing rerun; initial environment failure needs confirmation on the target host.
- Evidence: test output; `tooling/audio/verify-audio.mjs` validates file structure and levels.
- Notes: automatic checks do not establish that each recorded voice speaks the correct number or is audible on the venue device.
- Required follow-up: manually listen to and map voices 00–99; rerun the plain command on the release machine.

### P4-04 — Build

- Environment: isolated copy of current working files at the snapshot path above; existing shared `node_modules` linked for execution.
- Preconditions: unit tests passed with the shim.
- Steps: `npm run build` from the isolated copy.
- Expected result: frontend and Electron main process compile.
- Actual result: exit 0; Vite built 62 modules, and both TypeScript stages passed.
- Status: **PASS**
- Severity: none.
- Evidence: isolated `dist` and `build` folders.
- Notes: this proves buildability of the copied uncommitted files, not a committed release.
- Required follow-up: build again after freezing and committing the release candidate.

### P4-05 — Desktop smoke test

- Environment: isolated copy and test data; two displays were detected.
- Preconditions: build succeeded.
- Steps: `npm run test:desktop` from the isolated copy.
- Expected result: both views load and UI assertions pass.
- Actual result: exit 1. Electron logged repeated GPU process exits (`-1073741515`), repeated renderer `launch-failed` recovery, then `GPU process isn't usable. Goodbye.` The UI assertions did not complete.
- Status: **BLOCKED**
- Severity: P0 validation gap; application defect versus session graphics failure is undetermined.
- Evidence: `C:\Projects\comal-queue-system\test-results\phase4-20260924-231033\test-results\desktop-hvSiB5\turnero.log` and command output.
- Notes: the test created isolated config/content/log data and recorded the public display selection before renderer failure.
- Required follow-up: desktop/venue operator retests on the actual Windows session with working graphics and captures screenshots. Application team investigates repeated renderer recovery if reproduced there.

### P4-06 — Installer generation

- Environment: isolated copy; local Electron Builder cache redirected into the snapshot.
- Preconditions: build succeeded; desktop smoke remained blocked.
- Steps: `npm run desktop:build` twice; the second attempt used `ELECTRON_BUILDER_CACHE` under the snapshot.
- Expected result: a new `Comal++ Setup 0.3.0.exe`.
- Actual result: no new installer. First attempt failed writing to the default Electron Builder cache (`EPERM`). Second attempt packaged `win-unpacked`, then NSIS dependency retrieval failed with `connect EACCES ...:443`.
- Status: **BLOCKED**
- Severity: P0 release gate because installer generation and version/hash verification cannot finish.
- Evidence: command output and isolated `release/win-unpacked` directory.
- Notes: the installer name in the packaging log matches version 0.3.0, but there is no completed installer to verify or install.
- Required follow-up: release owner supplies the required NSIS tool cache or permits dependency retrieval in an authorized build environment; regenerate and hash the installer from a frozen commit, then install that exact file.

### P4-07 — Installation and venue behavior

- Environment: actual operator monitor, TV, audio device, and installed application required.
- Preconditions: newly generated installer and backed-up production data required.
- Steps: installer launch; operator workflow; audio order, ducking, and mapping; all required resolutions/scales; TV disconnect/reconnect; restart; offline/local media; YouTube failures; content management; log inspection; optional isolated power test.
- Expected result: every acceptance criterion in the Phase 4 instructions passes.
- Actual result: not executed because the new installer was unavailable, the desktop renderer failed in this session, video fixtures were absent, and physical intervention is required for TV/audio/power/network checks.
- Status: **BLOCKED**
- Severity: P0 validation gap.
- Evidence: none for live behavior; no passing screenshots or video captured.
- Notes: physical TV and audio validation is mandatory before declaring production readiness. Do not perform abrupt power testing on active production hardware without explicit approval.
- Required follow-up: venue operator and release owner run the full manual checklist on a frozen installed build, record device models/scales/audio output, collect screenshots and logs, and assign owners and retest results to any failures.

## Controls not completed

- `npm ci` was not run: the shared `node_modules` was in use by parallel sessions, and replacing it could disrupt their tests. The isolated snapshot linked that dependency tree instead of installing fresh dependencies. Repeat `npm ci` in a dedicated checkout with network/cache access.
- No valid videos were present; the required two video fixtures must be supplied for local playback and content management validation.
- No backup was made because the documented production directory was absent. Confirm the real data location and back it up before any installed-app or destructive test.
- No physical display settings, internet connection, system date, production files, or real installer were changed by this session.
