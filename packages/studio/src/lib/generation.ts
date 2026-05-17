// Text-to-image generation gateway. The user picks aspect, resolution,
// and count — the gateway picks the model. They never see a model
// dropdown.
//
// Resolution doubles as a quality dial:
//   1K → fast preview
//   2K → balanced default
//   4K → top-tier — the real shot
//
// Dispatch goes through /demos/api/runflow (the same proxy + key the
// rest of the studio uses). The Runflow API follows the standard
// async pattern: POST creates a run and returns an id, then we poll
// /v1/runs/{id} until it reaches a terminal state.
//
// All three tiers route to `google/nano-banana-pro`, which natively
// accepts a `resolution` enum of "1K" | "2K" | "4K" — the same enum
// the panel exposes — so the user's three inputs (prompt, aspect,
// resolution, count) map 1:1 onto the API. When other Runflow t2i
// models become useful for specific tiers (e.g. flux-2-klein-4b for
// a cheaper 1K exploration tier), swap the per-tier ids in the TIERS
// table; nothing else in the panel cares.

import { URLS } from "./urls";
const POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 180_000;

export type GenerationResolution = "1K" | "2K" | "4K";

export type GenerationTier = {
  /** Runflow model id used for dispatch. Format `<owner>/<slug>` —
   * matches the same pattern the runflow proxy expects in the path
   * (POST /v1/models/<owner>/<slug>/runs). */
  runflowId: string;
  /** Internal label, not surfaced to the user (we never name the
   * model in the UI). Kept for the version metadata tooltip if a
   * curious operator inspects it. */
  label: string;
  /** Rough USD cost per image, used to estimate the Generate
   * button. Tunable per tier without touching any UI. */
  costUsd: number;
};

const TIERS: Record<GenerationResolution, GenerationTier> = {
  "1K": { runflowId: "google/nano-banana-pro", label: "nano-banana-pro", costUsd: 0.025 },
  "2K": { runflowId: "google/nano-banana-pro", label: "nano-banana-pro", costUsd: 0.04 },
  "4K": { runflowId: "google/nano-banana-pro", label: "nano-banana-pro", costUsd: 0.06 },
};

export function pickGenerationTier(resolution: GenerationResolution): GenerationTier {
  return TIERS[resolution];
}

export function estimateGenerationCost(
  resolution: GenerationResolution,
  count: number,
): number {
  return TIERS[resolution].costUsd * count;
}

export function formatCostUsd(usd: number): string {
  if (usd < 0.01) return `< $0.01`;
  return `$${usd.toFixed(2)}`;
}

export type GenerationDispatchInput = {
  prompt: string;
  aspectRatio: string;
  resolution: GenerationResolution;
  /** Optional seed — variations within one Generate call use
   * different seeds so the user sees distinct results. */
  seed?: number;
};

export type GenerationResult =
  | {
      ok: true;
      outputUrl: string;
      width?: number;
      height?: number;
      tier: GenerationTier;
    }
  | { ok: false; error: string; tier: GenerationTier };

// Dispatch one text-to-image run. Mirrors the workflow dispatch path
// in runflow.ts (POST → poll), since the t2i endpoints on Runflow
// follow the same async lifecycle as the edit endpoints.
export async function dispatchGeneration(
  inp: GenerationDispatchInput,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<GenerationResult> {
  const tier = pickGenerationTier(inp.resolution);
  // Body shape matches the google/nano-banana-pro input schema
  // documented at https://docs.runflow.io/models/google/nano-banana-pro:
  // prompt + aspect_ratio (free-form) + resolution ("1K"/"2K"/"4K")
  // + num_images (1, since the panel dispatches one call per
  // variation so each tile can resolve independently in the UI) +
  // optional seed.
  const body = {
    input: {
      prompt: inp.prompt,
      aspect_ratio: inp.aspectRatio,
      resolution: inp.resolution,
      num_images: 1,
      output_format: "jpeg",
      ...(inp.seed !== undefined ? { seed: inp.seed } : {}),
    },
    metadata: { source: "runflow-studio", action: "generate" },
  };

  let runId: string;
  try {
    const create = await fetch(`${URLS.runflowProxy}/v1/models/${tier.runflowId}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!create.ok) {
      const text = await create.text().catch(() => "");
      return {
        ok: false,
        tier,
        error: `Dispatch failed (${create.status})${text ? `: ${text.slice(0, 160)}` : ""}`,
      };
    }
    const run = await create.json();
    runId = run.id;
    if (!runId) return { ok: false, tier, error: "No run id in response" };
  } catch (e) {
    return {
      ok: false,
      tier,
      error: e instanceof Error ? e.message : "Network error during dispatch",
    };
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const poll = await fetch(`${URLS.runflowProxy}/v1/runs/${runId}`);
      if (!poll.ok) continue;
      const r = await poll.json();
      const status = r.status_code;
      if (status === "succeeded") {
        const out = r.output || {};
        // The Runflow API normalises edit-output shapes around an
        // `outputs[]` array; fall back to a couple of legacy shapes
        // so a slight schema drift doesn't kill the panel.
        const outputUrl =
          out.outputs?.[0]?.url ?? out.image_urls?.[0] ?? out.image?.url ?? null;
        if (!outputUrl) {
          return { ok: false, tier, error: "Run succeeded but no image URL in output" };
        }
        return {
          ok: true,
          tier,
          outputUrl,
          width: out.outputs?.[0]?.width ?? out.image?.width,
          height: out.outputs?.[0]?.height ?? out.image?.height,
        };
      }
      if (status === "failed" || status === "canceled") {
        const err = r.error?.message || `run ${status}`;
        return { ok: false, tier, error: err };
      }
    } catch {
      // transient — keep polling
    }
  }
  return { ok: false, tier, error: "Timed out waiting for the model" };
}
