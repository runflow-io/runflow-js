// The slice of StudioShell that the chat panel needs to drive the
// canvas + run workflows. Pin/mask handoffs go through StudioShell;
// reference upload, text input, and plan confirmation are managed by
// the chat panel itself (it owns the bubble state). The chat composes
// the full StudioHandle from this partial + its own resolvers.

import type { CapturedInputs, Pin } from "./chat";

export type WorkflowRunResult =
  | { ok: true; versionId: string; outputUrl: string; label: string }
  | { ok: false; error: string };

export type PartialStudioHandle = {
  getActiveAssetId: () => string | null;
  getCurrentVersionUrl: () => string | null;
  /** Pixel dims of the active version, or null if not yet probed.
   * Used by the chat resolution bubble to annotate "source is 1K". */
  getCurrentVersionDims: () => { width: number; height: number } | null;
  /** Puts the canvas in pin mode and resolves on first valid click. */
  requestPin: (hint: string) => Promise<Pin | null>;
  /** Puts the canvas in paint mode and resolves on Confirm-mask click. */
  requestMask: (hint: string) => Promise<Blob | null>;
  /**
   * Runs a workflow against the active asset's current version. Reuses
   * StudioShell's executeWorkflow so versioning and sentinel eval
   * happen exactly the same as a card-driven run.
   *
   * `opts.intermediate` is set true for non-final steps in a chained
   * chat plan. The dispatcher reads the global gateBetweenSteps
   * setting to decide whether to skip Sentinel (chain runs fast,
   * default) or await it and halt on red (gating mode).
   */
  runWorkflow: (
    workflowId: string,
    params: Record<string, string>,
    captured: CapturedInputs,
    opts?: { intermediate?: boolean },
  ) => Promise<WorkflowRunResult>;
};
