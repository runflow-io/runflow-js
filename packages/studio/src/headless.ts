/**
 * Headless primitives — for callers building their own UI on top of
 * Runflow's tool catalogue, dispatcher, and sentinel client.
 */

export { WORKFLOWS, type Workflow, type WorkflowInput, type WorkflowKind, type WorkflowGroup } from "./data/workflows.js";
export { SAMPLES, type SampleAsset } from "./data/samples.js";
export { runWorkflow, type RunProgress, type RunResult, type RunStatus, type DispatchInputs } from "./lib/runflow.js";
export { evaluate as sentinelEvaluate, taskDescription as sentinelTaskDescription } from "./lib/sentinel.js";
export type { Judge, SentinelResult } from "./lib/sentinel.js";
export { setStudioUrls, URLS } from "./lib/urls.js";
export type { StudioUrls } from "./lib/urls.js";
