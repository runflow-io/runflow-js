---
"@runflow-io/sdk": minor
---

Add `rf.assets.upload(file)` — the browser-safe presigned upload flow (create session → PUT to storage → confirm), returning a model-ready signed HTTPS `url` plus the stable `runflow://assets/{id}` `ref`. Fixes the most common external-fork failure: browser file uploads ending up as `data:` URIs that models reject with a 422.

Export `composePinPrompt`, `composeRegionPrompt`, `pinRegion`, and `PinPoint` — the pin→region prompt convention (3×3 grid baked into the edit prompt) that previously existed only as private copies inside the studio bundle.
