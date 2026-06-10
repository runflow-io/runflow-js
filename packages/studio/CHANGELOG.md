# @runflow-io/studio

## 0.1.1

### Patch Changes

- 0561402: Docs: `UploadedAsset.ref` (`runflow://assets/{id}`) is now the recommended model input — the API resolves refs to freshly signed URLs at dispatch (shipped backend-side, formerly RUN-418), so refs never expire in your hands. `url` remains the short-TTL signed HTTPS URL for immediate browser use. Examples and JSDoc updated accordingly; no runtime changes.

## 0.1.0

### Minor Changes

- 991b164: `<StudioShell>` accepts four optional customization props — `tools` (workflow catalogue), `source` (initial asset URL or sample list, read at mount), `sentinel` (`{ enabled, taskDescription }`), and `copy` (brand/labels) — making vertical forks possible without rebuilding on `./headless`. Zero props renders exactly as before. `mount()` forwards them via the new `props` option.

  `./headless` now exports `createMaskController` — the framework-free dual-canvas brush engine (stroke interpolation, coverage, full-resolution thresholded mask blob, guarded against unattached use and bad brush sizes) the shell itself uses, so headless consumers get working mask creation for inpaint workflows without rebuilding it.

  The shell's file uploads now default to the SDK's presigned flow through `runflowProxy` (zero-config — no separate `upload` endpoint needed); hosts that explicitly set `urls.upload` keep the legacy multipart path. `unmount()` now also clears theme CSS variables, and blob preview URLs are revoked on unmount.

### Patch Changes

- 2679e78: Stop declaring `@runflow-io/sdk` as a peerDependency — it has always been bundled into the studio's dist (`tsup noExternal`), so consumers never needed to install it. This also stops changesets from major-bumping the studio whenever the bundled SDK takes a minor. The build now tracks the workspace SDK directly (`workspace:*` devDependency).
