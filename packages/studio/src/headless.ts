/**
 * Headless primitives — for callers building their own UI on top of
 * Runflow's tool catalogue, dispatcher, and sentinel client.
 */

// Tool catalogue (mirrors the SDK's defineTool DSL — what the bundled
// Studio uses internally and what's documented in the README).
export { BUILTIN_TOOLS, findTool } from "./tools/index.js";

// Prototype-style workflow catalogue + dispatcher (mask/pin/reference
// kinds; richer than the SDK's defineTool DSL today but pre-1.0).
export {
  WORKFLOWS,
  type Workflow,
  type WorkflowInput,
  type WorkflowKind,
  type WorkflowGroup,
} from "./data/workflows.js";
export { SAMPLES, type SampleAsset } from "./data/samples.js";
export {
  runWorkflow,
  type RunProgress,
  type RunResult,
  type RunStatus,
  type DispatchInputs,
} from "./lib/runflow.js";

// Brush + mask creation — framework-free dual-canvas painting engine.
// The same controller StudioShell uses internally for its mask workflows.
export { createMaskController } from "./lib/mask.js";
export type { MaskController, MaskControllerOptions } from "./lib/mask.js";

// Sentinel evaluation client.
export {
  evaluate as sentinelEvaluate,
  taskDescription as sentinelTaskDescription,
} from "./lib/sentinel.js";
export type { Judge, SentinelResult } from "./lib/sentinel.js";

// Endpoint URL registry — the same `URLS` object the bundled Studio
// reads. mount() calls setStudioUrls() under the hood.
export { setStudioUrls, URLS } from "./lib/urls.js";
export type { StudioUrls } from "./lib/urls.js";
