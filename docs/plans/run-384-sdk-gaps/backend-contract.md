# Backend contract: resolve `runflow://` asset refs at dispatch (RUN-384 gaps 2 + 6)

**Target repo:** `runflow-monorepo` (api.runflow.io). **Not** implemented in `runflow-js` —
this document is the companion spec for the backend ticket.

## Current behavior (verified in code)

- **Writes** (`POST /v1/models/{owner}/{slug}/runs`, `POST /v1/comfyui-workflows/.../runs`,
  batches, admin retries): inline `data:` URIs in `body.input`/`body.metadata` are
  auto-materialized to R2 and stored as `runflow://assets/{uuid}` refs. This is correct
  and should stay.
- **Reads** (`GET /v1/runs`, `GET /v1/runs/{id}`, batch/canonical listings): asset-backed
  URLs are re-signed and `runflow://assets/{uuid}` refs are resolved to short-TTL signed
  HTTPS URLs. Also correct.
- **The gap:** at **model dispatch**, the materialized `runflow://` ref is forwarded to the
  model worker **as-is**. Worker media validators accept only HTTP(S)/`data:` URIs —
  `google/nano-banana-pro/edit` (and most non-ComfyUI models) reject with
  `422: media URL must use HTTP(S) or data URI, got 'runflow'`. ComfyUI workflow file
  inputs already accept the refs; singleton model dispatch does not.

So the `data:`-materialization *convenience* currently breaks the exact requests it
rewrites. (The original ticket framed this as "make materialization opt-in"; the better
fix below removes the need for any flag.)

## Requested change

At the dispatch layer — after materialization, before the input reaches the model
worker / provider transport — apply the **same resolution the read path already does**:

1. Walk `body.input` (and `metadata` where it feeds workers) for strings of scheme
   `runflow://assets/{uuid}`.
2. Resolve each ref org-scoped (existing read-side resolver semantics: load asset, check
   `access_expires_at`, sign `r2_key`) into a signed HTTPS URL whose TTL comfortably
   covers worker pull + retries (suggest ≥ the worker's max queue+run window).
3. Forward the signed HTTPS URL to the worker. Persist the **ref** (not the signed URL)
   on the run record, as today.
4. Unknown/foreign-org/expired refs → 422 with a precise message
   (`asset not found or expired: runflow://assets/{uuid}`) — fail at dispatch, not in
   the worker.

### Acceptance criteria

- `POST /v1/models/google/nano-banana-pro/edit/runs` with `input.image_urls:
  ["runflow://assets/{uuid}"]` succeeds end to end (no 422), for both an explicit ref
  and one produced by `data:` auto-materialization.
- Read-side responses are unchanged (refs still resolve on read).
- ComfyUI dispatch behavior unchanged.
- A run whose ref points at a foreign org's asset 404s/422s without leaking existence
  details beyond the standard non-leaky pattern.

### Why dispatch-side resolution (not validator changes, not an opt-in flag)

- One implementation point instead of N model-validator changes across providers.
- Asset refs become first-class on the write path, matching the read path — the SDK can
  then hand `UploadedAsset.ref` (stable, no TTL) to any model instead of the signed `url`.
- The `data:` materialization default stays a pure convenience with no footgun, so no
  config flag is needed.

## Interim state (already shipped in runflow-js)

`rf.assets.upload(file)` returns the **signed HTTPS** url from the confirmation response
(`routers/asset_uploads.py` signs it server-side), so external forks are unblocked today
without this change. Once dispatch-side resolution lands, the SDK will document `ref` as
the preferred long-lived input.

## Suggested ticket

> **Title:** Resolve `runflow://assets/{uuid}` refs to signed HTTPS at model dispatch
> **Parent:** RUN-384
> **Why:** Auto-materialized `data:` inputs currently 422 on most singleton models
> (worker media validators only accept HTTP(S)/data:). Read path already resolves refs;
> dispatch must do the same so asset refs are first-class across the stack.
> **Scope:** dispatch layer for `POST /v1/models/.../runs` (+ batches, retries);
> resolver reuse from the read path; 422 on unknown/expired refs; tests per acceptance
> criteria above. ComfyUI unchanged.
