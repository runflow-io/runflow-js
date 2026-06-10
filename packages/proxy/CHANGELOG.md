# @runflow-io/proxy

## 0.1.0

### Minor Changes

- 991b164: Add `allowedPaths` — an extensible, strictly-matched route allow-list on top of the built-ins (dispatch, run polling, health). Defaults cover what `rf.assets.upload`/`rf.assets.get` need (`POST /v1/asset-uploads`, `POST /v1/asset-uploads/:id/confirmations`, `GET /v1/assets/:id`). Like `allowedModels`, a custom list **replaces** the defaults — spread the exported `DEFAULT_ALLOWED_PATHS` to extend, or pass `[]` to disable the asset routes. Rules support method arrays and `:param` segments, reject traversal (including percent-encoded) and empty segments. 403/415 bodies now carry actionable messages plus machine-readable `code`s (`path_not_allowed`, `model_not_allowed`, `origin_not_allowed`, `json_content_type_required`). The handler also exposes `PUT`/`PATCH`/`DELETE` for framework route exports. `RateLimitResult`'s `void` member is now `undefined` (type-level only).
