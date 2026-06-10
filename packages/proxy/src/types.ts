/**
 * Auth context returned by an `authenticate` hook. Whatever shape your
 * app produces (Clerk session, Supabase user, custom JWT claims) — the
 * proxy passes it through to `rateLimit` and `onRun` so downstream
 * hooks see the same identity.
 */
export type AuthContext = Record<string, unknown>;

export interface AuthResult {
  /** Stable identifier for the requester. */
  userId?: string;
  /** Free-form context handed to subsequent hooks. */
  context?: AuthContext;
}

export interface RateLimitDeniedResult {
  status: 429;
  /** User-facing message. Logged + returned in the response body. */
  message: string;
  /** Optional `Retry-After` header value, in seconds. */
  retryAfter?: number;
}
export interface RateLimitAllowedResult {
  status: 0;
}
export type RateLimitResult = RateLimitDeniedResult | RateLimitAllowedResult | undefined;

export interface ProxyRequestContext {
  method: string;
  /** The path *after* `basePath` is stripped. e.g. "v1/models/x/runs". */
  upstreamPath: string;
  /** Whether the path matched the dispatch pattern. */
  isDispatch: boolean;
  /** Model id (owner/slug…) when `isDispatch` is true; else null. */
  model: string | null;
  /** Run id when polling `/v1/runs/{id}`; else null. */
  runId: string | null;
  /** Whatever your `authenticate` hook returned. */
  auth: AuthResult | null;
  /** Original incoming request (read-only — body has likely been consumed). */
  request: Request;
}

export interface OnRunArgs extends ProxyRequestContext {
  /** Run id returned by the upstream when dispatched (POST). */
  runId: string;
  /** Model id this run targets (POST only). */
  model: string;
  /** Echo of the parsed request body sent upstream. */
  body: unknown;
  /** Status from upstream. */
  upstreamStatus: number;
}

export interface ProxyConfig {
  /** Runflow API key — required. Sent as `Authorization: Bearer <key>`. */
  apiKey: string;

  /**
   * Allowed models for dispatch. Either a static list, or a function
   * returning the list based on auth. Default: a curated set covering
   * Runflow's solutions models + nano-banana + Topaz upscale.
   */
  allowedModels?: ReadonlyArray<string> | ((auth: AuthResult | null) => ReadonlyArray<string>);

  /**
   * The URL prefix the proxy is mounted at. Stripped from incoming
   * paths before forwarding. Default: `/api/runflow`.
   */
  basePath?: string;

  /** Upstream Runflow API base URL. Default: `https://api.runflow.io`. */
  apiBase?: string;

  /** Body size cap, bytes. Default: 32 KB. */
  maxBodyBytes?: number;

  /**
   * Origins that may submit non-GET requests. The proxy compares the
   * incoming `Origin` header (case-insensitive, scheme + host + port)
   * against this list and rejects mismatches with 403.
   *
   * Defaults to `"same-origin"`, which checks that `Origin`'s host
   * equals the `Host` header — i.e. the request was made from the same
   * site the proxy is mounted on. Pass an array of `https://example.com`
   * strings to allow specific third-party origins, or `false` to opt
   * out (NOT recommended — it leaves the proxy CSRF-able).
   */
  allowedOrigins?: ReadonlyArray<string> | "same-origin" | false;

  /**
   * When `true` (default), non-GET requests must declare
   * `Content-Type: application/json` so they can't be sent as
   * `text/plain` "simple" requests under CORS, which would otherwise
   * be CSRF-able. Set `false` only if you proxy non-JSON workloads.
   */
  requireJsonContentType?: boolean;

  /** Upstream fetch timeout, ms. Default: 30 s. */
  upstreamTimeoutMs?: number;

  /**
   * Read the customer's auth state. Return `{ userId, context }` or
   * `null` to reject the request with 401. Throw to bubble a custom
   * error response.
   */
  authenticate?: (req: Request) => Promise<AuthResult | null> | AuthResult | null;

  /** Per-request rate limiting. Return a denied result to short-circuit. */
  rateLimit?: (ctx: ProxyRequestContext) => Promise<RateLimitResult> | RateLimitResult;

  /** Observability: fired AFTER a successful dispatch (POST returning 2xx). */
  onRun?: (args: OnRunArgs) => Promise<void> | void;

  /** Fired on any internal error so customers can log/alert. */
  onError?: (err: unknown, ctx: Partial<ProxyRequestContext>) => Promise<void> | void;

  /** Custom fetch (e.g. for testing). */
  fetch?: typeof fetch;
}
