/**
 * Core types for the Runflow SDK.
 *
 * These mirror the Runflow REST API's run lifecycle and are intentionally
 * a curated subset — full OpenAPI types live in @runflow/types when that
 * package is generated.
 */

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

/** A run after dispatch. Returned by POST /v1/models/{model}/runs. */
export interface RunDispatched {
  id: string;
  status_code: RunStatus;
  /** Owner/slug, e.g. "runflow/background-removal". */
  model?: string;
  created_at?: string;
}

/** A run with its current state. Returned by GET /v1/runs/{id}. */
export interface Run {
  id: string;
  status_code: RunStatus;
  model?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  output?: unknown;
  error?: { code?: string; message?: string } | null;
}

/** Configuration passed to `new Runflow(...)`. Exactly one of apiKey / baseUrl is required. */
export interface RunflowConfig {
  /**
   * Server-side: a Runflow API key (`rf_live_*` for inference scope,
   * `rf_svc_*` for admin). Sent as `Authorization: Bearer <key>`.
   * Required when calling `https://api.runflow.io` directly; omit when
   * using a `baseUrl` that handles auth.
   */
  apiKey?: string;

  /**
   * Browser-side: the URL of a server-side proxy that injects the API
   * key. Typically `/api/runflow`. When set, requests go here and no
   * `Authorization` header is sent.
   */
  baseUrl?: string;

  /** Override the upstream base URL. Defaults to `https://api.runflow.io`. */
  apiBase?: string;

  /** Per-request timeout. Default 30s. Set to 0 to disable. */
  requestTimeoutMs?: number;

  /** Extra headers attached to every request. */
  headers?: Record<string, string>;

  /** Pass a custom fetch (Web Standards). Defaults to global fetch. */
  fetch?: typeof fetch;
}

/** Options for polling a run to completion. */
export interface WaitOptions {
  /** Overall deadline in ms before a `RunTimeoutError` is thrown. Default 180s. */
  timeoutMs?: number;
  /** Time between poll attempts. Default 2s. */
  pollIntervalMs?: number;
  /** Optional progress callback fired on each poll. */
  onPoll?: (run: Run) => void;
  /** AbortSignal to cancel the wait. */
  signal?: AbortSignal;
}
