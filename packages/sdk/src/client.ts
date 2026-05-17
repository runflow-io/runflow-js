import { RunflowError } from "./errors.js";
import type { Run, RunDispatched, RunflowConfig, WaitOptions } from "./types.js";
import { RunFailedError, RunTimeoutError } from "./errors.js";
import { ToolsResource } from "./tools/run.js";

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
    this.authHeader = config.apiKey ? `Bearer ${config.apiKey}` : undefined;
    this.extraHeaders = { ...config.headers };
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    this.models = new ModelsResource(this);
    this.runs = new RunsResource(this);
    this.health = new HealthResource(this);
    this.tools = new ToolsResource(this);
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
        throw new RunflowError(`Request timed out (${this.requestTimeoutMs}ms): ${method} ${path}`, {
          code: "request_timeout",
          cause: err,
        });
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
      let parsed: { error?: { message?: string; code?: string }; message?: string } | null = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // body wasn't JSON
      }
      const msg = parsed?.error?.message ?? parsed?.message ?? text.slice(0, 300) ?? res.statusText;
      throw new RunflowError(`HTTP ${res.status}: ${msg || "request failed"}`, {
        status: res.status,
        code: parsed?.error?.code,
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
   */
  async run(
    model: string,
    body: unknown,
    opts: { signal?: AbortSignal } = {},
  ): Promise<RunDispatched> {
    return this.client.request<RunDispatched>("POST", `/v1/models/${model}/runs`, {
      body,
      signal: opts.signal,
    });
  }
}

export class RunsResource {
  constructor(private readonly client: Runflow) {}

  /** Fetch the current state of a run. */
  async get(id: string, opts: { signal?: AbortSignal } = {}): Promise<Run> {
    return this.client.request<Run>("GET", `/v1/runs/${id}`, { signal: opts.signal });
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
      if (run.status_code === "succeeded" || run.status_code === "failed" || run.status_code === "canceled") {
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
      throw new RunFailedError(
        last.error?.message ?? `Run ${id} ${last.status_code}`,
        { id: last.id, status: last.status_code, error: last.error },
      );
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
