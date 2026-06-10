// Translate a Version.request into a list of human-readable rows for
// the History tab. Each workflow has slightly different inputs that
// matter — for ai-edit it's "what did you ask + where did you pin",
// for product-isolation it's "aspect, resolution, and what to isolate".
// We label the prompt differently per workflow so the user reads
// natural copy ("Change description: …") instead of generic "Prompt".
//
// Returned rows are pure data — the UI decides how to render each kind
// (text / mono / swatch). Keeping this in a helper means the version
// thumb tooltip and the History card both render from the same shape.

import type { VersionRequest } from "../components/WorkflowsPanel";

export type SummaryKind = "text" | "mono" | "swatch" | "quote";

export type SummaryRow = {
  key: string;
  label: string;
  /** For most rows, plain text. For swatch rows, a hex string. */
  value: string;
  kind: SummaryKind;
};

const PROMPT_LABELS: Record<string, string> = {
  "ai-edit": "Change",
  "ai-scene": "Scene",
  "reference-inpaint": "Direction",
  "product-isolation": "What to isolate",
  "object-removal": "Removed",
  "logo-fix": "Placement",
  generate: "Prompt",
};

export function summarizeRequest(req: VersionRequest): SummaryRow[] {
  const rows: SummaryRow[] = [];
  const v = req.values || {};

  // Free-form text — quoted so it visually pops as the user's words.
  if (req.prompt?.trim()) {
    rows.push({
      key: "prompt",
      label: PROMPT_LABELS[req.workflowId] ?? "Prompt",
      value: req.prompt.trim(),
      kind: "quote",
    });
  } else if (
    (req.workflowId === "product-isolation" || req.workflowId === "object-removal") &&
    typeof v.prompt === "string" &&
    v.prompt.trim()
  ) {
    // Some workflows carry the prompt only in values.prompt (chat-flow
    // path) without dispatch.prompt being set — fall back to it so the
    // History row still shows the user's words.
    rows.push({
      key: "prompt",
      label: PROMPT_LABELS[req.workflowId] ?? "Prompt",
      value: v.prompt.trim(),
      kind: "quote",
    });
  }

  if (typeof v.aspect_ratio === "string" && v.aspect_ratio) {
    rows.push({
      key: "aspect",
      label: req.workflowId === "outpaint" ? "Target ratio" : "Aspect",
      value: v.aspect_ratio,
      kind: "mono",
    });
  }

  if (typeof v.resolution === "string" && v.resolution) {
    rows.push({
      key: "resolution",
      label: "Resolution",
      value: v.resolution,
      kind: "mono",
    });
  }

  if (typeof v.color === "string" && /^#[0-9a-f]{6}$/i.test(v.color)) {
    rows.push({
      key: "color",
      label: "Backdrop",
      value: v.color.toUpperCase(),
      kind: "swatch",
    });
  }

  if (req.pin) {
    rows.push({
      key: "pin",
      label: "Pin",
      value: `${Math.round(req.pin.x * 100)}%, ${Math.round(req.pin.y * 100)}%`,
      kind: "mono",
    });
  }

  if (typeof req.maskCoverage === "number") {
    rows.push({
      key: "mask",
      label: "Mask",
      value: `${req.maskCoverage.toFixed(1)}% painted`,
      kind: "text",
    });
  } else if (req.workflowId === "reference-inpaint") {
    // Chat-flow doesn't capture coverage % — at least confirm a mask
    // was supplied so the user knows the run wasn't whole-image.
    rows.push({ key: "mask", label: "Mask", value: "painted", kind: "text" });
  }

  if (req.referenceFileName) {
    rows.push({
      key: "reference",
      label: "Reference",
      value: req.referenceFileName,
      kind: "text",
    });
  }

  return rows;
}

// Compact one-liner for the version-thumb tooltip in the bottom stripe.
// Hover and you see "Smart resize · 16:9 · 4K" without leaving the
// canvas to open History.
export function compactSummary(label: string, req?: VersionRequest): string {
  if (!req) return label;
  const rows = summarizeRequest(req);
  if (rows.length === 0) return label;
  const joined = rows
    .map((r) => {
      if (r.kind === "quote") {
        const trimmed = r.value.length > 60 ? `${r.value.slice(0, 57)}…` : r.value;
        return `"${trimmed}"`;
      }
      return `${r.label} ${r.value}`;
    })
    .join(" · ");
  return `${label} · ${joined}`;
}
