---
"@runflow-io/sdk": minor
---

Add `rf.assets.upload(file)` — the browser-safe presigned upload flow (create session → PUT to storage → confirm) with transient-failure retry and a size-scaled PUT timeout, returning a model-ready signed HTTPS `url` plus the stable `runflow://assets/{id}` `ref`. Fixes the most common external-fork failure: browser file uploads ending up as `data:` URIs that models reject with a 422. Add `rf.assets.get(id)` to re-mint an expired signed url (store the `id`, not the `url`).

Export `composePinPrompt`, `composeRegionPrompt`, `pinRegion`, and `PinPoint` — the pin→region prompt convention (3×3 grid baked into the edit prompt) that previously existed only as private copies inside the studio bundle.

Hardening: proxy mode (`baseUrl`) now never sends `Authorization`, even when `apiKey` is also passed (the documented contract); presigned-URL query strings are redacted from error messages; non-https `upload_url`s are refused. New `RunflowErrorCode` union for autocompletable `catch` handling.
