import { AssetsResource } from "./assets.js";
import { RunflowError } from "./errors.js";
import { RunFailedError, RunTimeoutError } from "./errors.js";
import { ToolsResource } from "./tools/run.js";
import type { Run, RunDispatched, RunflowConfig, WaitOptions } from "./types.js";

const DEFAULT_API_BASE = "https://api.runflow.io";
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_WAIT_TIMEOUT_MS = 180_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

export class Runflow {
  private readonly fetcher: typeof fetch;
  private readonly base: string;
  private readonly authHeader?: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly requestTimeoutMs: number;

  readonly models: ModelsResource;
  readonly runs: RunsResource;
  readonly health: HealthResource;
  readonly tools: ToolsResource;
  readonly assets: AssetsResource;

  constructor(config: RunflowConfig) {
    if (!config.apiKey && !config.baseUrl) {
      throw new RunflowError(
        "Runflow: pass `apiKey` (server-side) or `baseUrl` (browser through a proxy).",
        { code: "missing_config" },
      );
    }
    if (config.apiKey && !/^[a-z0-9_]+$/i.test(config.apiKey)) {
      throw new RunflowError("Runflow: apiKey looks malformed", { code: "invalid_api_key" });
    }
    this.fetcher = config.fetch ?? globalThis.fetch;
    this.base = stripTrailing(config.baseUrl ?? config.apiBase ?? DEFAULT_API_BASE);
    // In proxy mode (baseUrl) the proxy injects the key server-side — the
    // browser-side client must never send one, even if a caller passes
    // both. Matches the documented "baseUrl wins, bearer omitted" contract.
    this.authHeader = config.apiKey && !config.baseUrl ? `Bearer ${config.apiKey}` : undefined;
    this.extraHeaders = { ...config.headers };
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    this.models = new ModelsResource(this);
    this.runs = new RunsResource(this);
    this.health = new HealthResource(this);
    this.tools = new ToolsResource(this);
    this.assets = new AssetsResource(this);
  }

  /**
   * Fetch an absolute URL through the configured fetcher — no base-URL
   * joining, no auth header. Used for presigned storage PUTs, which are
   * authorized by the URL itself and must not leak the API key.
   * @internal
   */
  async rawFetch(
    url: string,
    init: {
      method?: string;
      headers?: Record<string, string>;
      body?: BodyInit;
      signal?: AbortSignal;
    },
    timeoutMs: number = this.requestTimeoutMs,
  ): Promise<Response> {
    const controller = mergeAbort(init.signal, timeoutMs);
    try {
      return await this.fetcher(url, {
        method: init.method ?? "GET",
        headers: init.headers,
        body: init.body,
        signal: controller.signal,
      });
    } catch (err) {
      // Presigned URLs carry bearer-like signatures in the query string —
      // never echo them into error messages.
      const redacted = redactUrl(url);
      if (controller.timedOut()) {
        throw new RunflowError(
          `Request timed out (${timeoutMs}ms): ${init.method ?? "GET"} ${redacted}`,
          {
            code: "request_timeout",
            cause: err,
          },
        );
      }
      throw new RunflowError(`Request failed: ${init.method ?? "GET"} ${redacted}`, {
        code: "network_error",
        cause: err,
      });
    } finally {
      controller.clear();
    }
  }

  /** @internal */
  async request<T>(
    method: string,
    path: string,
    init: { body?: unknown; signal?: AbortSignal; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const url = `${this.base}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.extraHeaders,
      ...(init.headers ?? {}),
    };
    if (this.authHeader) headers.Authorization = this.authHeader;

    let body: BodyInit | undefined;
    if (init.body !== undefined) {
      if (init.body instanceof FormData) {
        body = init.body;
      } else {
        body = JSON.stringify(init.body);
        headers["Content-Type"] = "application/json";
      }
    }

    const controller = mergeAbort(init.signal, this.requestTimeoutMs);
    let res: Response;
    try {
      res = await this.fetcher(url, { method, headers, body, signal: controller.signal });
    } catch (err) {
      if (controller.timedOut()) {
        throw new RunflowError(
          `Request timed out (${this.requestTimeoutMs}ms): ${method} ${path}`,
          {
            code: "request_timeout",
            cause: err,
          },
        );
      }
      throw new RunflowError(`Request failed: ${method} ${path}`, {
        code: "network_error",
        cause: err,
      });
    } finally {
      controller.clear();
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Two error body shapes flow through here: the API's nested
      // { error: { message, code } } and the proxy's flat
      // { error: string, code: string }.
      let parsed: {
        error?: { message?: string; code?: string } | string;
        message?: string;
        code?: string;
      } | null = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // body wasn't JSON
      }
      const errField = parsed?.error;
      const msg =
        (typeof errField === "string" ? errField : errField?.message) ??
        parsed?.message ??
        text.slice(0, 300) ??
        res.statusText;
      const code = (typeof errField === "object" ? errField?.code : undefined) ?? parsed?.code;
      throw new RunflowError(`HTTP ${res.status}: ${msg || "request failed"}`, {
        status: res.status,
        code,
      });
    }

    if (res.status === 204) return undefined as T;
    const ct = res.headers.get("Content-Type") ?? "";
    if (ct.includes("application/json")) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  }
}

export class ModelsResource {
  constructor(private readonly client: Runflow) {}

  /**
   * Dispatch a run against `<owner>/<slug>` (or a multi-segment slug like
   * `runflow/object-removal/prompt`). Returns immediately with a run id.
   *
   * Each `/`-separated segment is URL-encoded. Empty segments, `.`, and
   * `..` are rejected so that a user-controlled model id can't escape
   * the `/v1/models/.../runs` shape or hit a different upstream route.
   */
  async run(
    model: string,
    body: unknown,
    opts: { signal?: AbortSignal } = {},
  ): Promise<RunDispatched> {
    const encoded = encodeModelId(model);
    return this.client.request<RunDispatched>("POST", `/v1/models/${encoded}/runs`, {
      body,
      signal: opts.signal,
    });
  }
}

export class RunsResource {
  constructor(private readonly client: Runflow) {}

  /** Fetch the current state of a run. Run id is URL-encoded. */
  async get(id: string, opts: { signal?: AbortSignal } = {}): Promise<Run> {
    const encoded = encodeRunId(id);
    return this.client.request<Run>("GET", `/v1/runs/${encoded}`, { signal: opts.signal });
  }

  /**
   * Poll a run until it reaches a terminal state. Yields each fetched
   * `Run` so callers can stream progress. Throws on timeout.
   */
  async *poll(id: string, opts: WaitOptions = {}): AsyncGenerator<Run> {
    const interval = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + (opts.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS);

    while (Date.now() < deadline) {
      if (opts.signal?.aborted) {
        throw new RunflowError("Polling aborted by signal", { code: "aborted" });
      }
      let run: Run;
      try {
        run = await this.get(id, { signal: opts.signal });
      } catch (err) {
        if (err instanceof RunflowError && (err.status ?? 0) >= 500) {
          await sleep(interval);
          continue;
        }
        throw err;
      }
      opts.onPoll?.(run);
      yield run;
      if (
        run.status_code === "succeeded" ||
        run.status_code === "failed" ||
        run.status_code === "canceled"
      ) {
        return;
      }
      await sleep(interval);
    }

    throw new RunTimeoutError(
      `Run ${id} did not finish within ${opts.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS}ms`,
      id,
      Date.now() - (deadline - (opts.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS)),
    );
  }

  /** Poll until the run reaches a terminal state. Resolves with the final `Run` on success, throws on failure. */
  async wait(id: string, opts: WaitOptions = {}): Promise<Run> {
    let last: Run | null = null;
    for await (const r of this.poll(id, opts)) {
      last = r;
    }
    if (!last) {
      throw new RunflowError(`Run ${id} produced no status updates`, { code: "no_status" });
    }
    if (last.status_code === "failed" || last.status_code === "canceled") {
      throw new RunFailedError(last.error?.message ?? `Run ${id} ${last.status_code}`, {
        id: last.id,
        status: last.status_code,
        error: last.error,
      });
    }
    return last;
  }
}

export class HealthResource {
  constructor(private readonly client: Runflow) {}

  async check(): Promise<{ ok: boolean; [k: string]: unknown }> {
    return this.client.request<{ ok: boolean }>("GET", "/v1/health");
  }
}

function stripTrailing(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/** Drop the query string (where presigned-URL signatures live). */
function redactUrl(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : `${url.slice(0, q)}?…`;
}

/**
 * Validate + percent-encode a multi-segment model id (`owner/slug`,
 * `owner/slug/subroute`). Each segment must be non-empty and not `.`
 * or `..`. This blocks accidental path traversal — `models/x/../../secret`
 * — when callers feed user/LLM input straight to the SDK.
 */
function encodeModelId(model: string): string {
  if (typeof model !== "string" || model.length === 0) {
    throw new RunflowError("models.run: model id is required", { code: "invalid_model_id" });
  }
  const parts = model.split("/");
  for (const p of parts) {
    if (p === "" || p === "." || p === "..") {
      throw new RunflowError(
        `models.run: invalid model id segment ${JSON.stringify(p)} in ${JSON.stringify(model)}`,
        {
          code: "invalid_model_id",
        },
      );
    }
  }
  return parts.map(encodeURIComponent).join("/");
}

/**
 * Validate + percent-encode a run id. Rejects path separators and empty
 * strings so callers can't smuggle path segments through `runs.get`.
 */
function encodeRunId(id: string): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new RunflowError("runs.get: run id is required", { code: "invalid_run_id" });
  }
  if (id.includes("/") || id === "." || id === "..") {
    throw new RunflowError(`runs.get: invalid run id ${JSON.stringify(id)}`, {
      code: "invalid_run_id",
    });
  }
  return encodeURIComponent(id);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MergedController {
  signal: AbortSignal;
  timedOut: () => boolean;
  clear: () => void;
}

function mergeAbort(external: AbortSignal | undefined, timeoutMs: number): MergedController {
  const ac = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => ac.abort(external?.reason);
  if (external) {
    if (external.aborted) {
      ac.abort(external.reason);
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true });
    }
  }
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          ac.abort(new Error("timeout"));
        }, timeoutMs)
      : null;
  return {
    signal: ac.signal,
    timedOut: () => timedOut,
    clear: () => {
      if (timer !== null) clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}
