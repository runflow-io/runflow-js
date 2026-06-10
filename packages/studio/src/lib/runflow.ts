// Runflow Studio dispatcher — the single function the UI calls to run any
// workflow. Handles the four shapes (simple/prompt/pin/mask-only/
// mask-ref) by building the right body, uploading any attached files
// individually via /demos/api/upload, then dispatching through
// /demos/api/runflow and polling for the result.
//
// The future Chat tab can call this same function — pass a workflow id
// + already-resolved inputs and it'll run the same path.

import type { Workflow } from "../data/workflows";

import { URLS } from "./urls";
// Endpoint constants flow through the module-level URLS registry;
// callers configure them in mount() via setStudioUrls(). The original
// prototype hardcoded /demos/api/* paths here.
const POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 180_000;

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export type RunProgress = {
  phase: "preparing" | "uploading" | "dispatching" | "queued" | "running" | "complete" | "error";
  message: string;
};

export type RunResult = {
  status: RunStatus;
  outputUrl: string | null;
  error?: string;
};

export type DispatchInputs = {
  // For prompt/pin: the user's freeform text.
  prompt?: string;
  // For pin: normalized 0..1 coords on the source image.
  pin?: { x: number; y: number };
  // For mask-only / mask-ref: a B&W mask blob the caller already rendered.
  maskBlob?: Blob;
  // For mask-ref: the user-uploaded reference image. Singular form is
  // kept for backwards compatibility with the chat agent and logo
  // (prompt-ref) flow. Multi-ref mask workflows should populate
  // `referenceFiles` (which includes the primary file as index 0).
  referenceFile?: File;
  referenceFiles?: File[];
  // Generic key/value for select/text/color/textarea inputs.
  values: Record<string, string>;
};

function pinPhrase(p: { x: number; y: number }) {
  const yLabel = p.y < 0.33 ? "upper" : p.y < 0.66 ? "middle" : "lower";
  const xLabel = p.x < 0.33 ? "left" : p.x < 0.66 ? "center" : "right";
  return `${yLabel}-${xLabel}`;
}

// Fetch a remote image through our same-origin proxy to dodge the
// no-cors-cache "Failed to fetch" trap on cross-origin sources.
async function fetchSourceBlob(url: string): Promise<Blob> {
  const proxyUrl = `${URLS.imageProxy}?url=${encodeURIComponent(url)}`;
  const resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error(`Could not fetch source (${resp.status})`);
  return resp.blob();
}

// Retry schedule for transient upload failures. The mid-mask-paint
// flow is the worst-case scenario — a flaky network kills brushwork
// the user can't easily recreate. Three attempts with exponential
// backoff (250ms, 750ms) covers 99% of transient blips without making
// a deterministic 4xx (auth, payload-too-large, etc.) feel sluggish.
const UPLOAD_RETRY_DELAYS_MS = [250, 750];

export async function uploadFile(
  name: string,
  body: Blob,
  fallbackType = "image/png",
): Promise<string> {
  // Server only accepts PNG/JPEG/WebP. Rewrap if the blob lost its type
  // (e.g. some fetch responses arrive as application/octet-stream).
  const type = body.type?.startsWith("image/") ? body.type : fallbackType;
  const file = new File([body], name, { type });

  const totalAttempts = UPLOAD_RETRY_DELAYS_MS.length + 1;
  let lastTransientReason: string | null = null;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    if (attempt > 0) {
      const delay = UPLOAD_RETRY_DELAYS_MS[attempt - 1] ?? 0;
      await new Promise((r) => setTimeout(r, delay));
    }

    const form = new FormData();
    form.append("file", file);

    let up: Response;
    try {
      up = await fetch(URLS.upload, { method: "POST", body: form });
    } catch (e) {
      lastTransientReason = e instanceof Error ? e.message : "network error";
      continue;
    }

    if (up.ok) {
      const data = (await up.json()) as { url?: string };
      if (!data.url) throw new Error("Upload returned no URL");
      return data.url;
    }

    if (up.status >= 400 && up.status < 500) {
      let msg = `Upload failed (${up.status})`;
      try {
        const j = await up.json();
        msg = j.error || msg;
      } catch {
        /* body wasn't JSON */
      }
      throw new Error(msg);
    }

    lastTransientReason = `${up.status}`;
    try {
      const j = await up.json();
      if (j.error) lastTransientReason = `${up.status}: ${j.error}`;
    } catch {
      /* body wasn't JSON */
    }
  }

  throw new Error(
    `Upload failed after ${totalAttempts} attempts — check your connection and try again.${
      lastTransientReason ? ` (last error: ${lastTransientReason})` : ""
    }`,
  );
}

async function buildBody(
  wf: Workflow,
  sourceUrl: string,
  inputs: DispatchInputs,
  onProgress: (p: RunProgress) => void,
): Promise<unknown> {
  if (wf.kind === "simple") {
    if (!wf.staticBody) throw new Error(`Workflow ${wf.id} has no staticBody`);
    return wf.staticBody(sourceUrl, inputs.values);
  }
  if (wf.kind === "prompt") {
    if (wf.staticBody) return wf.staticBody(sourceUrl, inputs.values);
    return {
      input: {
        prompt: inputs.values.prompt || inputs.prompt || "",
        image_urls: [sourceUrl],
      },
    };
  }
  if (wf.kind === "pin") {
    const region = inputs.pin ? pinPhrase(inputs.pin) : "center";
    const text = inputs.prompt || "";
    return {
      input: {
        prompt: `Edit the ${region} area of this image: ${text}. Photoreal product photography, preserve the rest of the image, true colors and lighting.`,
        image_urls: [sourceUrl],
      },
    };
  }
  if (wf.kind === "mask-only") {
    if (!inputs.maskBlob) throw new Error("Mask is required");
    onProgress({ phase: "preparing", message: "Preparing files…" });
    const src = await fetchSourceBlob(sourceUrl);
    onProgress({ phase: "uploading", message: "Uploading files…" });
    const [imageUrl, maskUrl] = await Promise.all([
      uploadFile("photo.png", src),
      uploadFile("mask.png", inputs.maskBlob),
    ]);
    return {
      input: {
        image_url: imageUrl,
        mask_url: maskUrl,
      },
    };
  }
  if (wf.kind === "prompt-zip") {
    const promptText = (inputs.values.prompt || inputs.prompt || "").trim();
    if (!promptText) throw new Error("Prompt is required");
    onProgress({ phase: "preparing", message: "Preparing files…" });
    const src = await fetchSourceBlob(sourceUrl);
    onProgress({ phase: "uploading", message: "Uploading files…" });
    const imageUrl = await uploadFile("photo.png", src);
    return {
      input: {
        prompt: promptText,
        image_url: imageUrl,
      },
    };
  }
  if (wf.kind === "mask-ref") {
    if (!inputs.maskBlob) throw new Error("Mask is required");
    // Prefer the array (multi-slot UI) and fall back to the single
    // referenceFile so the chat agent path keeps working unchanged.
    const refs =
      inputs.referenceFiles && inputs.referenceFiles.length > 0
        ? inputs.referenceFiles
        : inputs.referenceFile
          ? [inputs.referenceFile]
          : [];
    if (refs.length === 0) throw new Error("Reference image is required");
    onProgress({ phase: "preparing", message: "Preparing files…" });
    const src = await fetchSourceBlob(sourceUrl);
    onProgress({ phase: "uploading", message: "Uploading files…" });
    const [imageUrl, maskUrl, ...referenceUrls] = await Promise.all([
      uploadFile("photo.png", src),
      uploadFile("mask.png", inputs.maskBlob),
      ...refs.map((f, i) => uploadFile(`reference-${i + 1}.png`, f)),
    ]);
    // The model accepts an optional `prompt` for steering — if the user
    // typed one in the optional Direction step, ship it. Otherwise the
    // model runs reference-only. Send `reference_url` (singular, first
    // ref) alongside `reference_urls` (full array) so older Runflow
    // model schemas that only know the singular field still get the
    // primary reference.
    const promptText = (inputs.prompt || inputs.values.prompt || "").trim();
    return {
      input: {
        image_url: imageUrl,
        mask_url: maskUrl,
        reference_url: referenceUrls[0],
        reference_urls: referenceUrls,
        ...(promptText ? { prompt: promptText } : {}),
      },
    };
  }
  if (wf.kind === "prompt-ref") {
    // logo-fix today. The dev endpoint uses workflow-specific field
    // names (file_input + logo_file_input) and lives outside the
    // standard /v1/models/<id>/runs path, so the dispatch path in
    // runWorkflow handles it separately. We just return the raw
    // body here — no `input` wrapper.
    if (!inputs.referenceFile) throw new Error("Logo image is required");
    const promptText = (inputs.values.prompt || inputs.prompt || "").trim();
    if (!promptText) throw new Error("Placement instruction is required");
    onProgress({ phase: "preparing", message: "Preparing files…" });
    const src = await fetchSourceBlob(sourceUrl);
    onProgress({ phase: "uploading", message: "Uploading files…" });
    const [imageUrl, logoUrl] = await Promise.all([
      uploadFile("photo.png", src),
      uploadFile("logo.png", inputs.referenceFile),
    ]);
    return {
      file_input: imageUrl,
      logo_file_input: logoUrl,
      prompt: promptText,
      resolution: inputs.values.resolution || "1K",
      vlm_assist: true,
    };
  }
  throw new Error(`Unsupported workflow kind: ${wf.kind}`);
}

export async function runWorkflow(
  wf: Workflow,
  sourceUrl: string,
  inputs: DispatchInputs,
  onProgress: (p: RunProgress) => void,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<RunResult> {
  if (!wf.runflowId) {
    return { status: "failed", outputUrl: null, error: `${wf.name} has no model` };
  }

  let body: unknown;
  try {
    body = await buildBody(wf, sourceUrl, inputs, onProgress);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "preparation failed";
    onProgress({ phase: "error", message: msg });
    return { status: "failed", outputUrl: null, error: msg };
  }

  onProgress({ phase: "dispatching", message: "Sending to Runflow…" });

  // prompt-ref workflows (logo-fix today) live behind the dev ngrok
  // tunnel and respond synchronously — POST returns the finished
  // image without a separate poll round-trip. We branch here so the
  // shared polling loop below stays clean. When these models
  // graduate to the canonical /v1/models pattern, delete this
  // branch and they'll route through the standard path.
  if (wf.kind === "prompt-ref") {
    try {
      const create = await fetch(`${URLS.runflowDevProxy}/api/v1/${wf.runflowId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!create.ok) {
        const text = await create.text().catch(() => "");
        onProgress({ phase: "error", message: `Dispatch failed (${create.status})` });
        return {
          status: "failed",
          outputUrl: null,
          error: text ? `${create.status}: ${text.slice(0, 200)}` : `dispatch ${create.status}`,
        };
      }
      const data = (await create.json()) as Record<string, unknown> & {
        outputs?: Array<{ url?: string }>;
        image?: { url?: string };
        image_url?: string;
        output_url?: string;
        url?: string;
        error?: string;
      };
      const outputUrl =
        data.outputs?.[0]?.url ??
        data.image?.url ??
        data.image_url ??
        data.output_url ??
        data.url ??
        null;
      if (!outputUrl) {
        onProgress({ phase: "error", message: "No image in output" });
        return {
          status: "failed",
          outputUrl: null,
          error: data.error || "no output url in response",
        };
      }
      onProgress({ phase: "complete", message: "Done" });
      return { status: "succeeded", outputUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      onProgress({ phase: "error", message: msg });
      return { status: "failed", outputUrl: null, error: msg };
    }
  }

  const enriched = {
    ...(body as Record<string, unknown>),
    client_ref: `runflow-studio-${wf.id}-${Date.now()}`,
    metadata: { source: "runflow-studio", workflow: wf.id },
  };

  let runId: string;
  try {
    const create = await fetch(`${URLS.runflowProxy}/v1/models/${wf.runflowId}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enriched),
    });
    if (!create.ok) {
      const text = await create.text();
      onProgress({ phase: "error", message: `Dispatch failed (${create.status})` });
      return { status: "failed", outputUrl: null, error: text };
    }
    const run = await create.json();
    runId = run.id;
    if (!runId) {
      onProgress({ phase: "error", message: "No run id" });
      return { status: "failed", outputUrl: null, error: "no run id" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    onProgress({ phase: "error", message: msg });
    return { status: "failed", outputUrl: null, error: msg };
  }

  onProgress({ phase: "queued", message: "Queued…" });

  const deadline = Date.now() + timeoutMs;
  let lastStatus: RunStatus = "queued";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const poll = await fetch(`${URLS.runflowProxy}/v1/runs/${runId}`);
      if (!poll.ok) continue;
      const r = await poll.json();
      const status = r.status_code as RunStatus;
      if (status && status !== lastStatus) {
        lastStatus = status;
        if (status === "running") {
          onProgress({ phase: "running", message: "Generating…" });
        }
      }
      if (status === "succeeded") {
        const out = r.output || {};
        const outputUrl = out.outputs?.[0]?.url ?? out.image_urls?.[0] ?? out.image?.url ?? null;
        if (!outputUrl) {
          onProgress({ phase: "error", message: "No image in output" });
          return { status: "failed", outputUrl: null, error: "no output url" };
        }
        onProgress({ phase: "complete", message: "Done" });
        return { status: "succeeded", outputUrl };
      }
      if (status === "failed" || status === "canceled") {
        const err = r.error?.message || `run ${status}`;
        onProgress({ phase: "error", message: err });
        return { status, outputUrl: null, error: err };
      }
    } catch {
      // transient — keep polling
    }
  }
  onProgress({ phase: "error", message: "Timed out" });
  return { status: "failed", outputUrl: null, error: "deadline exceeded" };
}
