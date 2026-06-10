/**
 * @runflow-io/sdk — Typed HTTP client and tool DSL for the Runflow API.
 *
 * Isomorphic: runs in Node, Bun, Deno, browsers, workers. Uses Web
 * Standards fetch.
 *
 * @example Server-side
 * ```ts
 * const rf = new Runflow({ apiKey: process.env.RUNFLOW_API_KEY });
 * const run = await rf.models.run("runflow/background-removal", { input: { image_url } });
 * const final = await rf.runs.wait(run.id);
 * ```
 *
 * @example Browser, through a proxy
 * ```ts
 * const rf = new Runflow({ baseUrl: "/api/runflow" });
 * const { output } = await rf.tools.run(backgroundRemoval, { image: url });
 * ```
 */

export { Runflow, ModelsResource, RunsResource, HealthResource } from "./client.js";
export { AssetsResource } from "./assets.js";
export type { UploadedAsset, UploadOptions } from "./assets.js";
export {
  RunflowError,
  RunFailedError,
  RunTimeoutError,
} from "./errors.js";
export type {
  Run,
  RunDispatched,
  RunStatus,
  RunflowConfig,
  WaitOptions,
} from "./types.js";
export * from "./tools/index.js";
