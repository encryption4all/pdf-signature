
---

## Agent notes (migrated from the dobby memory repo)

## Overview
`encryption4all/pdf-signature` is a fork of `cryptify`, sharing the same README,
but it is its own monorepo with a different frontend:
- `cryptify-back-end/`: Rust + Rocket service (the IRMA-gated signing backend),
  the same lineage as cryptify's backend.
- `cryptify-front-end/`: CRA + craco React app, also wrapped as an Electron build.

## Repo status
Fork of cryptify. Issues are enabled and can be filed. The fork has `push:false`
for the automation's GitHub App install, so the bot cannot open PRs on this repo
directly; surface fixable findings as an issue instead, or hand off for a manual
PR. No `pr-title.yml`. No release automation.

## Config
Backend config in `conf/config.toml` (prod) and `conf/config.dev.toml` (dev).
Keys: `server_url`, `address`, `data_dir`, `email_from`, `smtp_*`,
`allowed_origins`, `pkg_url`, but unlike cryptify this repo uses an
`smtp_credentials` array instead of separate smtp user/pass keys.

## Build / verify
- **No CI workflow.** `.github/` doesn't exist. Call out "no CI, manual review"
  in every PR body.
- **No tests anywhere.** Both `cargo test` and `npm test` return zero matches.
  Verify the backend with `cargo build` + `cargo fmt --check`; verify the
  frontend with `npm run build-main`.
- **Frontend `npm install` needs `--legacy-peer-deps`.** React peer mismatches
  (e.g. react-file-drop wants an older react) block strict resolution.
- Frontend dev server runtime errors are expected without a backend running
  (`/v2/sign/parameters`, `/v2/upload/init` throw "Failed to fetch"); the bundle
  loading is the smoke-test signal.
- **`npm install` regenerates both `package-lock.json` and `yarn.lock`**
  coherently; don't fight it, commit both.

## Dependency-bump gotchas (major-version API shape)
- `pg-core` (backend) and `@e4a/pg-wasm` (frontend) must move in lockstep: the
  backend `Unsealer` parses files sealed by the frontend.
- rand 0.10: `thread_rng().gen()` becomes `rng().random()`; the extension trait
  is now `RngExt`, not `Rng`.
- sha2/digest 0.11: the output array no longer implements `LowerHex`, so
  `format!("{:x}", h.finalize())` breaks; use the `bytes_to_hex` helper already
  in `main.rs`.
- webpack must be >= ~5.96 to parse `pg-wasm` 0.6's wasm (wasm-bindgen reference
  types); older webpack fails with `Module parse failed: parseVec could not cast
  the value`.
- TypeScript is capped at 5.x: react-scripts 5's
  fork-ts-checker-webpack-plugin@6.5.3 crashes on TS 6.
- yivi 1.0 (yivi-frontend-packages) switched to named exports (`import {
  YiviCore } from ...`) and ships real TS types; session option callbacks need
  typed-compatible signatures. `SessionMappings.sessionToken` is optional, don't
  destructure `{ sessionToken }` off it blindly.
- `yivi-web` is a direct import in the frontend, not just transitive; keep it
  declared as a direct dependency.
- `webpack-dev-server` cannot go to 5.x while on react-scripts 5: it passes the
  removed `https:` option, which WDS 5 schema validation rejects and crashes
  `npm start`. Dev-only; needs a CRA to Vite migration to fix properly.
- `elliptic` has no patched release for a known low-severity advisory; it's
  pulled via node-polyfill-webpack-plugin -> node-stdlib-browser ->
  crypto-browserify, but the app never imports node `crypto`, so it's never
  bundled. Don't keep retrying an override for it.

## Electron
- Hardened `BrowserWindow`: `nodeIntegration:false`, `contextIsolation:true`,
  `sandbox:true`, with a `public/preload.js` bridge. The renderer (React in
  `src/`) uses no runtime Node APIs; every `process.env` reference is a
  CRA/webpack build-time constant.
- **`build.files` in `package.json` must include the directory holding `main`**
  (`public/`), or electron-builder only force-includes the main file itself and
  silently drops sibling `require`d files (e.g. `windowConfig`, `preload.js`);
  packaged builds crash with `MODULE_NOT_FOUND`. A regression test in
  `test/windowConfig.test.js` asserts `build.files` covers the dir holding
  `main`. Note `./build/*` in `build.files` is top-level-only, not `**/*`, a
  separate latent gap for `build/static/` that hasn't been addressed.
- **Electron packaging cannot be verified on an aarch64/no-display workspace.**
  An actual `electron-builder` run is the only way to confirm packaging fixes;
  treat local verification here as necessarily incomplete.
