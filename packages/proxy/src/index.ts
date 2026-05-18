/**
 * @runflow-io/proxy — Web Standards proxy handler for the Runflow API.
 *
 * Mounts in any modern framework that speaks Request/Response (Next.js
 * App Router, Hono, SvelteKit, Cloudflare Workers, Vercel Edge, Bun,
 * Deno). For classic Node `(req, res)` servers, see `@runflow-io/proxy/node`.
 *
 * @example Next.js App Router
 * ```ts
 * // app/api/runflow/[...path]/route.ts
 * import { runflowProxy } from "@runflow-io/proxy";
 * export const { GET, POST } = runflowProxy({ apiKey: process.env.RUNFLOW_API_KEY! });
 * ```
 */

export { runflowProxy, type ProxyHandler } from "./handler.js";
export type {
  ProxyConfig,
  AuthResult,
  AuthContext,
  ProxyRequestContext,
  OnRunArgs,
  RateLimitResult,
  RateLimitDeniedResult,
  RateLimitAllowedResult,
} from "./types.js";
export {
  DEFAULT_ALLOWED_MODELS,
  DEFAULT_BASE_PATH,
  DEFAULT_RUNFLOW_BASE,
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_UPSTREAM_TIMEOUT_MS,
} from "./defaults.js";
