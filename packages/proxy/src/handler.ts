import {
  DEFAULT_ALLOWED_MODELS,
  DEFAULT_ALLOWED_PATHS,
  DEFAULT_BASE_PATH,
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_RUNFLOW_BASE,
  DEFAULT_UPSTREAM_TIMEOUT_MS,
  UUID_RE,
} from "./defaults.js";
import type {
  AllowedPath,
  AuthResult,
  OnRunArgs,
  ProxyConfig,
  ProxyRequestContext,
  RateLimitResult,
} from "./types.js";

/** A Web Standards request handler. */
export type ProxyHandler = (req: Request) => Promise<Response>;

interface NormalizedConfig {
  apiKey: string;
  basePath: string;
  apiBase: string;
  maxBodyBytes: number;
  upstreamTimeoutMs: number;
  fetcher: typeof fetch;
  allowedModelsFor: (auth: AuthResult | null) => ReadonlyArray<string>;
  allowedPaths: ReadonlyArray<AllowedPath>;
  allowedOrigins: ReadonlyArray<string> | "same-origin" | false;
  requireJsonContentType: boolean;
  authenticate?: ProxyConfig["authenticate"];
  rateLimit?: ProxyConfig["rateLimit"];
  onRun?: ProxyConfig["onRun"];
  onError?: ProxyConfig["onError"];
}

function normalize(cfg: ProxyConfig): NormalizedConfig {
  if (!cfg.apiKey) {
    throw new Error("@runflow-io/proxy: `apiKey` is required.");
  }
  const allowed = cfg.allowedModels ?? DEFAULT_ALLOWED_MODELS;
  const allowedModelsFor =
    typeof allowed === "function" ? allowed : () => allowed as ReadonlyArray<string>;
  return {
    apiKey: cfg.apiKey,
    basePath: stripTrailing(cfg.basePath ?? DEFAULT_BASE_PATH),
    apiBase: stripTrailing(cfg.apiBase ?? DEFAULT_RUNFLOW_BASE),
    maxBodyBytes: cfg.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
    upstreamTimeoutMs: cfg.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS,
    fetcher: cfg.fetch ?? globalThis.fetch,
    allowedModelsFor,
    allowedPaths: cfg.allowedPaths ?? DEFAULT_ALLOWED_PATHS,
    allowedOrigins: cfg.allowedOrigins ?? "same-origin",
    requireJsonContentType: cfg.requireJsonContentType ?? true,
    authenticate: cfg.authenticate,
    rateLimit: cfg.rateLimit,
    onRun: cfg.onRun,
    onError: cfg.onError,
  };
}

/**
 * CSRF gate: a non-GET non-HEAD request must come from an allowed origin
 * and (by default) declare `Content-Type: application/json`. The two
 * checks together stop drive-by `fetch(..., {mode:"no-cors"})` from a
 * third-party page from spending the customer's API key.
 *
 * `same-origin` (default) accepts when Origin's host matches the `Host`
 * header. `false` opts out entirely (not recommended). An explicit
 * array of origins is matched case-insensitively on scheme + host + port.
 */
function originAllowed(req: Request, policy: NormalizedConfig["allowedOrigins"]): boolean {
  if (policy === false) return true;
  const origin = req.headers.get("origin");
  if (!origin) {
    // No Origin: not a browser fetch with cross-origin intent. Server-
    // to-server callers (curl, the SDK on the server) don't send Origin;
    // CSRF only applies to browser-spoofable requests.
    return true;
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (policy === "same-origin") {
    const host = req.headers.get("host");
    if (!host) return false;
    // Compare host:port portions. Origin always carries a port; Host may
    // omit it when default. Normalize both via URL parsing.
    const expected = new URL(`http://${host}`).host;
    return parsed.host.toLowerCase() === expected.toLowerCase();
  }
  const target = `${parsed.protocol}//${parsed.host}`.toLowerCase();
  return policy.some((allowed) => allowed.toLowerCase().replace(/\/+$/, "") === target);
}

function jsonContentTypeOK(req: Request): boolean {
  const ct = req.headers.get("content-type") ?? "";
  // Parameters allowed (e.g. `application/json; charset=utf-8`).
  return /^application\/json\b/i.test(ct.trim());
}

/**
 * Create a Web Standards proxy handler that forwards browser calls to
 * `api.runflow.io` with your API key injected server-side.
 *
 * Mount under `/api/runflow` (default) and the SDK's
 * `new Runflow({ baseUrl: '/api/runflow' })` calls flow through it.
 *
 * @example Next.js App Router
 * ```ts
 * export const { GET, POST } = runflowProxy({ apiKey: process.env.RUNFLOW_API_KEY! });
 * ```
 *
 * @example Hono / Cloudflare Workers
 * ```ts
 * app.all('/api/runflow/*', (c) => runflowProxy({ apiKey: env.RUNFLOW_API_KEY })(c.req.raw));
 * ```
 */
export function runflowProxy(cfg: ProxyConfig): ProxyHandler & {
  GET: ProxyHandler;
  POST: ProxyHandler;
  PUT: ProxyHandler;
  PATCH: ProxyHandler;
  DELETE: ProxyHandler;
} {
  const c = normalize(cfg);
  const handler: ProxyHandler = async (req) => handle(c, req);
  return Object.assign(handler, {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
  });
}

async function handle(c: NormalizedConfig, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const upstreamPath = stripBasePath(url.pathname, c.basePath);
  const segments = upstreamPath.split("/").filter(Boolean);
  const { isDispatch, model, runId } = classify(req.method, segments);
  const isHealth =
    req.method === "GET" &&
    segments.length === 2 &&
    segments[0] === "v1" &&
    segments[1] === "health";

  // Empty segments (`//`) would make the matched path differ from the
  // forwarded one — refuse to match them at all.
  const hasEmptySegments = /\/\//.test(upstreamPath);
  const isAllowedPath =
    !isDispatch &&
    !runId &&
    !isHealth &&
    !hasEmptySegments &&
    matchAllowedPath(req.method, segments, c.allowedPaths);

  if (!isDispatch && !runId && !isHealth && !isAllowedPath) {
    return json(
      {
        error: `Path not allowed: ${req.method} /${upstreamPath.slice(0, 120)}. The proxy forwards model dispatch, run polling, health, and the asset upload/read routes by default; add other upstream routes via the allowedPaths option.`,
        code: "path_not_allowed",
      },
      403,
    );
  }

  // CSRF gate — must run before any authenticate hook so a malicious
  // page can't drain cookie credentials into the customer's API key.
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (!originAllowed(req, c.allowedOrigins)) {
      return json({ error: "Origin not allowed", code: "origin_not_allowed" }, 403);
    }
    if (c.requireJsonContentType && !jsonContentTypeOK(req)) {
      return json(
        {
          error:
            "Content-Type must be application/json (CSRF defense — required on every non-GET request through the proxy, including bodyless DELETEs)",
          code: "json_content_type_required",
        },
        415,
      );
    }
  }

  // Run authenticate hook
  let auth: AuthResult | null = null;
  if (c.authenticate) {
    try {
      auth = (await c.authenticate(req)) ?? null;
      if (!auth) return json({ error: "Unauthorized" }, 401);
    } catch (err) {
      await c.onError?.(err, { request: req, method: req.method, upstreamPath });
      return json({ error: "Unauthorized" }, 401);
    }
  }

  // Enforce model allowlist on dispatch
  if (isDispatch && model) {
    const allowed = c.allowedModelsFor(auth);
    if (!allowed.includes(model)) {
      return json(
        { error: `Model not allowed: ${model.slice(0, 120)}`, code: "model_not_allowed" },
        403,
      );
    }
  }

  const ctx: ProxyRequestContext = {
    method: req.method,
    upstreamPath,
    isDispatch,
    model,
    runId,
    auth,
    request: req,
  };

  // Run rate-limit hook
  if (c.rateLimit) {
    try {
      const decision = (await c.rateLimit(ctx)) as RateLimitResult;
      if (decision && "status" in decision && decision.status === 429) {
        const headers: Record<string, string> = {};
        if (decision.retryAfter) headers["Retry-After"] = String(decision.retryAfter);
        return json({ error: decision.message }, 429, headers);
      }
    } catch (err) {
      await c.onError?.(err, ctx);
      return json({ error: "Rate limit check failed" }, 500);
    }
  }

  // Read body (with cap)
  let bodyText: string | undefined;
  let bodyParsed: unknown;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      bodyText = await readBoundedBody(req, c.maxBodyBytes);
    } catch (err) {
      if (err === TOO_LARGE) return json({ error: "Payload too large" }, 413);
      await c.onError?.(err, ctx);
      return json({ error: "Bad request" }, 400);
    }
    if (bodyText) {
      try {
        bodyParsed = JSON.parse(bodyText);
      } catch {
        // Allow non-JSON bodies for future use; for now just pass through.
      }
    }
  }

  // Forward upstream
  const upstreamUrl = `${c.apiBase}/${upstreamPath}${url.search}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${c.apiKey}`,
    Accept: "application/json",
  };
  if (bodyText !== undefined) headers["Content-Type"] = "application/json";

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error("timeout")), c.upstreamTimeoutMs);
  let upstreamRes: Response;
  try {
    upstreamRes = await c.fetcher(upstreamUrl, {
      method: req.method,
      headers,
      body: bodyText,
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    await c.onError?.(err, ctx);
    if (ac.signal.aborted) return json({ error: "Upstream timed out" }, 504);
    return json({ error: "Upstream unavailable" }, 502);
  } finally {
    clearTimeout(timer);
  }

  const upstreamBody = await upstreamRes.arrayBuffer();
  const contentType = upstreamRes.headers.get("Content-Type") ?? "application/json";

  // Fire onRun for successful dispatches
  if (isDispatch && model && upstreamRes.ok && c.onRun) {
    try {
      const text = new TextDecoder().decode(upstreamBody);
      const parsed = text ? (JSON.parse(text) as { id?: string }) : { id: undefined };
      if (parsed.id) {
        const args: OnRunArgs = {
          ...ctx,
          runId: parsed.id,
          model,
          body: bodyParsed,
          upstreamStatus: upstreamRes.status,
        };
        await c.onRun(args);
      }
    } catch (err) {
      // Don't fail the request because telemetry parsing broke.
      await c.onError?.(err, ctx);
    }
  }

  return new Response(upstreamBody, {
    status: upstreamRes.status,
    headers: { "Content-Type": contentType },
  });
}

/**
 * Strict allow-list matcher for configured extra routes. Full-path,
 * segment-by-segment comparison — no prefixes, no wildcards. A `:param`
 * rule segment accepts exactly one non-empty path segment, rejecting
 * `.`/`..` (and their percent-encoded forms) so a matched path can't
 * traverse to a different upstream route.
 */
function matchAllowedPath(
  method: string,
  segments: string[],
  rules: ReadonlyArray<AllowedPath>,
): boolean {
  for (const rule of rules) {
    const methods = Array.isArray(rule.method) ? rule.method : [rule.method];
    if (!methods.includes(method)) continue;
    const ruleSegments = rule.path.split("/").filter(Boolean);
    if (ruleSegments.length !== segments.length) continue;
    let matched = true;
    for (let i = 0; i < ruleSegments.length; i++) {
      const ruleSegment = ruleSegments[i] ?? "";
      const pathSegment = segments[i] ?? "";
      if (ruleSegment.startsWith(":")) {
        if (!isSafeParamSegment(pathSegment)) {
          matched = false;
          break;
        }
      } else if (ruleSegment !== pathSegment) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

function isSafeParamSegment(segment: string): boolean {
  if (!segment) return false;
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return false;
  }
  return decoded !== "." && decoded !== ".." && !decoded.includes("/") && !decoded.includes("\\");
}

function classify(
  method: string,
  segments: string[],
): { isDispatch: boolean; model: string | null; runId: string | null } {
  // POST /v1/models/{owner}/{slug...}/runs — dispatch
  if (
    method === "POST" &&
    segments.length >= 5 &&
    segments[0] === "v1" &&
    segments[1] === "models" &&
    segments[segments.length - 1] === "runs"
  ) {
    const model = segments.slice(2, -1).join("/");
    return { isDispatch: true, model, runId: null };
  }
  // GET /v1/runs/{uuid} — poll
  if (
    method === "GET" &&
    segments.length === 3 &&
    segments[0] === "v1" &&
    segments[1] === "runs" &&
    UUID_RE.test(segments[2] ?? "")
  ) {
    return { isDispatch: false, model: null, runId: segments[2] ?? null };
  }
  return { isDispatch: false, model: null, runId: null };
}

function stripBasePath(pathname: string, basePath: string): string {
  const p = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
  return p.replace(/^\/+/, "");
}

function stripTrailing(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

const TOO_LARGE = Symbol("too-large");

async function readBoundedBody(req: Request, max: number): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > max) throw TOO_LARGE;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let offset = 0;
  const merged = new Uint8Array(total);
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function json(
  payload: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
