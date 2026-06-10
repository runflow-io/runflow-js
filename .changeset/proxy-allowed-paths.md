---
"@runflow-io/proxy": minor
---

Add `allowedPaths` — an extensible, strictly-matched route allow-list on top of the built-ins (dispatch, run polling, health). Defaults now include the asset-upload pair `rf.assets.upload` needs (`POST /v1/asset-uploads`, `POST /v1/asset-uploads/:id/confirmations`); customer rules are additive, support method arrays and `:param` segments, and reject traversal. Org-data reads (run listing, billing) remain strictly opt-in. The handler now also exposes `PUT`/`PATCH`/`DELETE` for framework route exports. `RateLimitResult`'s `void` member is now `undefined` (type-level only).
