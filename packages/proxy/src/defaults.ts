/**
 * Default allowlist for the Runflow proxy.
 *
 * Mirrors the model set used by `runflow-prototypes/projects/demos`. Any
 * model id in this set is reachable through the proxy via
 * `POST /v1/models/{model}/runs`. Callers can pass a custom
 * `allowedModels` to override.
 */
export const DEFAULT_ALLOWED_MODELS: ReadonlyArray<string> = [
  "runflow/background-removal",
  "runflow/tag-removal",
  "runflow/product-isolation",
  "runflow/model-removal",
  "runflow/background-color",
  "runflow/object-removal",
  "runflow/object-removal/prompt",
  "runflow/outpaint",
  "runflow/skin-fix",
  "runflow/smart-resize",
  "runflow/reference-inpaint",
  "google/nano-banana-pro/edit",
  "google/nano-banana-pro",
  "topaz/upscale/image",
];

import type { AllowedPath } from "./types.js";

/**
 * Extra upstream routes the proxy forwards out of the box — the
 * presigned-upload pair `rf.assets.upload(file)` calls. Customer
 * `allowedPaths` entries are additive over these.
 *
 * Deliberately NOT here: `GET /v1/runs` (org-wide run listing),
 * billing reads, account info. Those expose org data through the
 * proxy's API key and must be opted into explicitly.
 */
export const DEFAULT_ALLOWED_PATHS: ReadonlyArray<AllowedPath> = [
  { method: "POST", path: "/v1/asset-uploads" },
  { method: "POST", path: "/v1/asset-uploads/:id/confirmations" },
];

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_RUNFLOW_BASE = "https://api.runflow.io";
export const DEFAULT_MAX_BODY_BYTES = 32 * 1024;
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 30_000;
export const DEFAULT_BASE_PATH = "/api/runflow";
