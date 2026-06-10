---
"@runflow-io/studio": minor
---

`<StudioShell>` accepts four optional customization props — `tools` (workflow catalogue), `source` (initial asset URL or sample list), `sentinel` (`{ enabled, taskDescription }`), and `copy` (brand/labels) — making vertical forks possible without rebuilding on `./headless`. Zero props renders exactly as before. `mount()` forwards them via the new `props` option.

`./headless` now exports `createMaskController` — the framework-free dual-canvas brush engine (stroke interpolation, coverage, full-resolution thresholded mask blob) the shell itself uses, so headless consumers get working mask creation for inpaint workflows without rebuilding it.
