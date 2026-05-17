// Sentinel client — runs Runflow's image-eval model against a generated
// output and returns a verdict (green / amber / red) + per-judge details.
//
// Flow mirrors the fibbl one: POST /demos/api/sentinel/evaluate?sync=false
// returns an eval_id, then we poll GET /demos/api/sentinel/evaluate/<id>
// every 2.5s until status === 'completed' (or fail).
//
// State mapping is the same heuristic fibbl uses — 0 fails = green,
// 1 fail = amber (minor issue), 2+ = red (significant issues).

import { URLS } from "./urls";

const POLL_INTERVAL_MS = 3000;
// Sentinel evals reliably take 2–4 minutes (judge planning + module
// run + reasoning). 120s was eating most of them. 300s gives a real
// safety margin without making the user wait forever on a stuck eval.
const DEFAULT_TIMEOUT_MS = 300_000;

export type DetectedIssue = {
  subcategory: string;
  detail: string | null;
};

export type Judge = {
  name: string;
  pass: boolean;
  weight?: number;
  category?: string;
  /** 0..1 — how sure the judge is of its verdict. */
  confidence?: number;
  /** Multi-paragraph rationale (PHASE 1 / PHASE 2 / PHASE 3 format). */
  reasoning?: string;
  /** Specific findings — short subcategory tags, each with optional detail. */
  detectedIssues?: DetectedIssue[];
};

export type SentinelState = "pending" | "green" | "amber" | "red" | "failed";

export type SentinelResult = {
  state: SentinelState;
  score?: number;
  judges?: Judge[];
  /** Curated narrative summaries of the worst issues — one paragraph each. */
  topIssues?: string[];
  /** Curated narrative summaries of what worked. */
  topStrengths?: string[];
  /** Names of judges that triggered a critical (hard) failure, distinct
   * from soft fails. Empty array means no hard gates broke. */
  hardGateFailures?: string[];
  /** API-level overall pass/fail (weighted threshold). May differ from
   * the simple "0 fails = green" client heuristic. */
  overallPassed?: boolean;
  error?: string;
};

export async function evaluate(
  imageUrl: string,
  taskDescription: string,
  referenceUrl?: string,
): Promise<SentinelResult> {
  try {
    const dispatch = await fetch(`${URLS.sentinel}/evaluate?sync=false`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generated_image_url: imageUrl,
        task_type: "product_photography",
        task_description: taskDescription,
        ...(referenceUrl
          ? {
              reference_images: [
                {
                  url: referenceUrl,
                  role: "reference_image",
                  description: "Reference image",
                },
              ],
            }
          : {}),
      }),
    });
    if (!dispatch.ok) {
      const text = await dispatch.text().catch(() => "");
      console.warn(`[sentinel] dispatch ${dispatch.status}`, text);
      return { state: "failed", error: `dispatch ${dispatch.status}` };
    }
    const dispatchJson = (await dispatch.json()) as { eval_id?: string };
    const evalId = dispatchJson.eval_id;
    if (!evalId) {
      console.warn(`[sentinel] dispatch ok but no eval_id in response`, dispatchJson);
      return { state: "failed", error: "no eval_id in dispatch response" };
    }

    const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
    let lastPollFail: string | null = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const poll = await fetch(`${URLS.sentinel}/evaluate/${encodeURIComponent(evalId)}`);
        if (!poll.ok) {
          // Capture the most recent non-OK status — surfaced if we
          // never reach a terminal state. Useful for spotting a 502 /
          // 401 / 504 storm vs. a genuine "still running" loop.
          lastPollFail = `${poll.status}`;
          console.warn(`[sentinel] poll ${evalId} -> ${poll.status}`);
          continue;
        }
        const sd = (await poll.json()) as {
          status: string;
          judges?: Array<{
            name: string;
            passed: boolean;
            weight?: number;
            category?: string;
            confidence?: number;
            reasoning?: string;
            detected_issues?: Array<{ subcategory: string; detail: string | null }>;
          }>;
          weighted_pass_rate?: number;
          overall_passed?: boolean;
          top_issues?: string[];
          top_strengths?: string[];
          hard_gate_failures?: string[];
          // Failure-time fields — the upstream API can populate any of
          // these depending on where in the pipeline things broke
          // (Vertex image fetch, judge timeout, model error, etc).
          // We surface whichever is set so the toast says something
          // actionable instead of "eval failed".
          error?: string;
          error_message?: string;
          failure_reason?: string;
          message?: string;
        };
        if (sd.status === "completed") {
          const judges: Judge[] = (sd.judges ?? []).map((j) => ({
            name: j.name,
            pass: !!j.passed,
            weight: j.weight,
            category: j.category,
            confidence: j.confidence,
            reasoning: j.reasoning,
            detectedIssues: j.detected_issues ?? [],
          }));
          const fails = judges.filter((j) => !j.pass).length;
          const state: SentinelState = fails === 0 ? "green" : fails === 1 ? "amber" : "red";
          return {
            state,
            judges,
            score: sd.weighted_pass_rate,
            overallPassed: sd.overall_passed,
            topIssues: sd.top_issues ?? [],
            topStrengths: sd.top_strengths ?? [],
            hardGateFailures: sd.hard_gate_failures ?? [],
          };
        }
        if (sd.status === "failed") {
          // Log the full payload so failures aren't a black box —
          // anything Sentinel sends back (Vertex error, judge crash,
          // etc.) shows up in DevTools next time someone reports an
          // "eval failed" toast.
          console.warn(`[sentinel] eval ${evalId} returned status=failed`, sd);
          const upstreamReason =
            sd.error || sd.error_message || sd.failure_reason || sd.message || null;
          return {
            state: "failed",
            error: upstreamReason ? `eval failed: ${upstreamReason}` : "eval failed (no reason given)",
          };
        }
      } catch (e) {
        // transient — keep polling, but surface the reason if we
        // never recover. Common cases: client-side AbortError on
        // navigation, network blip, JSON parse error on a malformed
        // response.
        lastPollFail = e instanceof Error ? e.message : "poll error";
        console.warn(`[sentinel] poll ${evalId} threw`, e);
      }
    }
    return {
      state: "failed",
      error: lastPollFail ? `timed out (last poll: ${lastPollFail})` : "timed out",
    };
  } catch (e) {
    console.warn(`[sentinel] evaluate threw`, e);
    return { state: "failed", error: e instanceof Error ? e.message : "network" };
  }
}

// Translate a workflow + its input values into a natural-language task
// description for Sentinel's judges. Sentinel scores against this — the
// closer the description, the better the per-judge signal.
export function taskDescription(
  workflowId: string,
  values: Record<string, string>,
  promptText?: string,
): string {
  switch (workflowId) {
    case "ai-edit":
      return `Edit this product image: ${promptText || "apply the requested local change"}. Photoreal product photography, preserve the rest of the image, true colors and natural lighting.`;
    case "reference-inpaint":
      return "Replace the masked area using the supplied reference image. Photoreal product photography, blend cleanly with the surrounding image.";
    case "ai-scene":
      return `Place the subject ${values.prompt || "in a clean editorial scene"}. Photoreal product photography, the subject is the hero.`;
    case "product-isolation":
      return `Isolate ${values.prompt || "the subject"} on a clean white background at ${values.resolution || "2K"} resolution, ${values.aspect_ratio || "1:1"} aspect ratio. Sharp edges, natural shadow.`;
    case "background-color":
      return "Replace the background with a flat solid color. Subject preserved cleanly with a smooth edge.";
    case "background-removal":
      return "Cut out the subject on a transparent background. Sharp clean edges, no halos.";
    case "tag-removal":
      return "Remove all price tags, hangtags, swing tickets, and barcodes from the product. Photorealistic in-painting.";
    case "object-removal":
      return `Remove ${promptText || values.prompt || "the requested object"} from this product image. Photoreal in-painting, plausible background restoration, no visible artifacts at the seams, and the rest of the subject preserved.`;
    case "model-removal":
      return "Remove the human model from the image while keeping the garment isolated. Photoreal continuation of the garment.";
    case "skin-fix":
      return "Polish skin tones on the model — even out blemishes, preserve identity, pose, and natural texture.";
    case "outpaint":
      return `Extend the canvas to ${values.aspect_ratio || "9:16"} aspect ratio. Photoreal continuation of the original scene.`;
    case "smart-resize":
      return `Recompose the image at ${values.aspect_ratio || "1:1"} aspect ratio, ${values.resolution || "2K"} resolution. Photoreal output, subject preserved, intelligent layout — extend or crop as needed.`;
    case "logo-fix":
      return `Place the supplied logo onto this image ${promptText || values.prompt || "appropriately"}. Photoreal product photography, logo respects the garment's surface (fabric texture, lighting, folds), realistic scale, preserve the rest of the image.`;
    case "generate":
      // Text-to-image — the user's prompt IS the brief. Surfaces what
      // they asked for so the judges can score against it directly.
      return promptText || values.prompt || "Photoreal product photography, the subject is the hero.";
    default:
      return "Photoreal product photography, the subject is the hero.";
  }
}
