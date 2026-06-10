# RUN-384 — Close SDK gaps blocking external Studio forks

**Repo:** `runflow-js` (this monorepo). **Branch:** `mr/bb13-sdk-gaps-https-l`.
**Scope:** A — five in-repo gaps (1, 3, 4, 5, 7) implemented + proven end-to-end;
two backend gaps (2, 6) delivered as a contract spec + companion ticket, **not** coded here.

## Why (grounded in the actual code, which diverges from the ticket)

The ticket attributes `data:`→`runflow://` materialization and a flat-403 path filter to
`@runflow-io/proxy`. **Neither is in this package.** The JS proxy forwards bodies verbatim and
gates on a *model* allow-list (`handler.ts:140`, `classify()` at `:277`). The materialization is a
**backend** feature (`api.runflow.io`) and is, per the API contract, *correct*: `data:` URIs
materialize to R2 and **reads return signed HTTPS**. The real defect (gaps 2/6) is narrower:
`runflow://assets/{uuid}` refs are resolved on **reads** (`GET /v1/runs`) but **not at dispatch**
before a model worker's media validator runs — so `google/nano-banana-pro/edit` 422s on
`runflow://`.

Consequently the *real-world* browser breakage is fixed entirely in-repo by **gap 1 + gap 4**,
with no backend change required:

- `rf.assets.upload(file)` returns a **signed HTTPS** url (confirmed: `routers/asset_uploads.py:94-96`
  signs the confirm payload via `storage.sign_asset_payloads`). HTTPS ⇒ no 422.
- The proxy's default allow-list is widened to reach the asset-upload endpoints those calls need.

## In-repo changes

### Gap 1 — `rf.assets.upload(file)`  ·  `@runflow-io/sdk`
New `AssetsResource`, wired in `Runflow` constructor (`client.ts:39-42`) as `rf.assets`.
`upload(file: File | Blob, opts?: { filename?: string; folderId?: string }): Promise<UploadedAsset>`
lifts `assetService.uploadFile` (`runflow-monorepo/frontend/platform/src/services/api/asset.ts:29`):

1. `POST /v1/asset-uploads` `{ filename, mime_type, size_bytes }` → `{ asset_id, upload_url }`
2. **raw** `fetch(upload_url, { method:"PUT", headers:{ "Content-Type": mime }, body: file })`
   — absolute storage URL, must bypass `client.request()` (no base prefix, no `Authorization`).
3. `POST /v1/asset-uploads/{asset_id}/confirmations` `{ folder_id: opts.folderId ?? null }` → `Asset`.

Returns `{ id, url /* signed https */, ref: "runflow://assets/{id}", name, mimeType, sizeBytes, thumbnailUrl, createdAt }`.
- 50 MB guard (matches backend `MAX_FILE_SIZE`). Server callers pass a `Blob` + explicit `filename`.
- `request()` already passes `FormData` through (`client.ts:61`); here we use JSON for steps 1/3 and
  a direct `fetcher` call for step 2 (add a minimal internal `rawFetch` on the client).
- Errors surface as `RunflowError` with the failing step + status.
- New exports: `AssetsResource`, type `UploadedAsset`, from `index.ts`.

### Gap 4 — proxy `allowedPaths`  ·  `@runflow-io/proxy`
Add `allowedPaths?: ReadonlyArray<AllowedPath>` to `ProxyConfig` (`types.ts:55`):
```ts
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface AllowedPath { method: HttpMethod | HttpMethod[]; path: string; } // path may use :param
```
- New `matchAllowedPath()`: **strict, full-path** segment match; `:param` matches exactly one
  non-empty segment that is not `.`/`..`; method must match. No prefix/wildcard matching.
- Integrate into the gate at `handler.ts:140`: a request that matches an allowed path is forwarded
  (still through CSRF + `authenticate` + `rateLimit` + body-cap). It is **not** dispatch, so the
  model allow-list and `onRun` are untouched.
- `DEFAULT_ALLOWED_PATHS` (so `rf.assets.upload`/`rf.assets.get` work **zero-config**):
  `POST /v1/asset-uploads`, `POST /v1/asset-uploads/:id/confirmations`, `GET /v1/assets/:id`.
  *(Revised in review round 1: a customer `allowedPaths` **replaces** the defaults — same
  semantics as `allowedModels`; spread the exported `DEFAULT_ALLOWED_PATHS` to extend, pass `[]`
  to disable. The first draft said "additive", which made the defaults impossible to turn off.)*
  Built-in dispatch/runs/health stay always-on.
- **Security (council P0):** the proxy forwards with the org's secret key. Allowing *reads* like
  `GET /v1/runs` or `GET /v1/billing/balance` exposes org-wide data to any same-origin browser —
  therefore those are **opt-in only**, never defaulted. SSRF is bounded (upstream host is fixed to
  `apiBase`); the risk is method/path scope, which strict matching controls. Documented in README +
  JSDoc with an explicit warning.

### Gap 5 — `composePinPrompt`  ·  `@runflow-io/sdk` (+ de-dupe)
Export from SDK:
```ts
export function pinRegion(pin: { x: number; y: number }): string;        // "upper-left" … "lower-right"
export function composePinPrompt(pin: { x:number;y:number }, instruction: string): string;
```
`pinRegion` = `${y<.33?"upper":y<.66?"middle":"lower"}-${x<.33?"left":x<.66?"center":"right"}`.
`composePinPrompt` returns the **exact** existing template (behavior-preserving):
`Edit the ${region} area of this image: ${instruction}. Photoreal product photography, preserve the rest of the image, true colors and lighting.`
Replace all four copies: `studio/src/lib/runflow.ts:49,150`; `studio/src/tools/index.ts:78`;
`examples/e2e-proof/run.ts:104` (hardcoded) and `:513` (inline). The "no pin ⇒ center" fallback in
`runflow.ts:150` stays in the caller.

### Gap 3 — `<StudioShell>` props  ·  `@runflow-io/studio`
`StudioShell` takes **zero** props today (`StudioShell.tsx:104`). Add four **optional** props,
preserving the zero-prop default exactly:
- `tools?` — override/extend the workflow catalogue (defaults to module `WORKFLOWS`).
- `source?` — initial source image(s) (defaults to `SAMPLES`).
- `sentinel?` — sentinel config: `{ enabled?, taskDescription?, judges? }` (defaults to current hardcoded call).
- `copy?` — UI copy overrides (headings/labels/CTA), shallow-merged over defaults.
`mount()` forwards an optional props arg. Internal `useState` seeds from props once; no behavior
change when omitted. (Full prop wiring decided against `StudioShell.tsx` during implementation.)

### Gap 7 — brush + mask creation in `./headless`  ·  `@runflow-io/studio`
Lift the dual-canvas mask logic out of `StudioShell.tsx` (`paintAt`/`updateCoverage`/`clearMask`/
`generateMaskBlob`) — and the richer `runflow-prototypes/runflow-studio-v2` version — into a
**framework-agnostic** controller exported from `@runflow-io/studio/headless`:
```ts
createMaskController(opts): {
  attach(visible: HTMLCanvasElement, hidden: HTMLCanvasElement, image: HTMLImageElement): void;
  setBrushSize(px): void; strokeTo(x,y): void; beginStroke(x,y): void; endStroke(): void;
  clear(): void; coverage(): number; toBlob(): Promise<Blob | null>; // full-res B&W PNG
}
```
React-free (so forks in any framework reuse it). `StudioShell` refactors to consume it — that
refactor is the proof it's reusable. `useMaskController` React hook ships from the main entry, not headless.

### E2E proof — the gate  ·  `examples/e2e-proof/run.ts`
`npm run proof` already runs browser SDK → in-process `@runflow-io/proxy` → **real api.runflow.io**.
Extend it so the five gaps are proven live (only `RUNFLOW_API_KEY` needed):
- **New `asset-upload` modality:** `rf.assets.upload(File)` **through the proxy** (proves gap 1 +
  gap 4 defaults) → feed the returned **https** url to `google/nano-banana-pro/edit` → assert no 422
  + success. This is the direct repro of Fred's bug, now green.
- **Replace the R2 side-channel:** the `mask-reference` flow currently needs `R2_*` creds
  (absent here). Re-upload source/mask/reference via `rf.assets.upload` instead → proof becomes
  self-sufficient on the API key alone. (`uploads.ts` SigV4 helper retired; `buildSampleMask` kept.)
- **Gap-4 assertions (in-process):** a non-allowed path still 403s; asset-upload paths pass; a
  custom `allowedPaths` entry (e.g. `GET /v1/runs`) passes only when configured.
- **Gap-5:** pin modality + chat-agent section call `composePinPrompt` (shared contract).
- All existing modalities stay green. Also add proxy/SDK **vitest** unit tests for each new surface.

## Backend contract spec + companion ticket (gaps 2 & 6 — not coded here)
Deliver `docs/plans/run-384-sdk-gaps/backend-contract.md` + a ready-to-file ticket for
`runflow-monorepo`:
- **Gap 2:** resolve `runflow://assets/{uuid}` (and re-sign `{org}/assets|inline/...`) in
  `body.input`/`metadata` at the **dispatch write path**, before the model worker's media
  validator — mirroring the existing read-side resolver (`GET /v1/runs`). Makes asset refs
  first-class so the SDK can eventually return `ref` instead of a TTL-bound signed url.
- **Gap 6:** reframed — `data:` materialization is **correct** (reads sign to https); the missing
  piece is the same dispatch-side resolution as gap 2. Recommend that over a `data:` opt-out flag.
- Until shipped, gap 1 returns signed **https** so forks are unblocked today.

## Cross-cutting
- **Docs:** README note — the worked-example story today is "consume headless primitives + build
  UI"; link this repo's `examples/`. Mention `./headless` could later split into a minimal package.
- **Versioning:** changesets — `@runflow-io/sdk` **minor** (new `rf.assets`, `composePinPrompt`),
  `@runflow-io/proxy` **minor** (`allowedPaths`), `@runflow-io/studio` **minor** (props + headless
  mask). (Pre-1.0 minor = 0.0.3 → 0.1.0; flag if patch preferred.)
- **Quality gates:** `bun run typecheck`, `bun run test`, `bun run lint` (biome), then `npm run proof`
  live. No `--no-verify`.

## Out of scope
Backend code in `runflow-monorepo`; model-card doc edits; splitting `./headless` into its own
package; any change to the model allow-list semantics.
