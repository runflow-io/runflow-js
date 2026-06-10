---
"@runflow-io/sdk": patch
"@runflow-io/studio": patch
---

Docs: `UploadedAsset.ref` (`runflow://assets/{id}`) is now the recommended model input — the API resolves refs to freshly signed URLs at dispatch (shipped backend-side, formerly RUN-418), so refs never expire in your hands. `url` remains the short-TTL signed HTTPS URL for immediate browser use. Examples and JSDoc updated accordingly; no runtime changes.
