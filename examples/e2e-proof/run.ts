/**
 * End-to-end proof run.
 *
 * Exercises the full chain a real customer would hit:
 *   browser SDK ── http ──▶ @runflow/proxy ── http ──▶ api.runflow.io
 *
 * The proxy runs in-process and the SDK's `fetch` routes directly to it,
 * so no HTTP listener is needed. Upstream calls to api.runflow.io are
 * real.
 *
 * Covers one run per modality that doesn't require additional customer
 * infrastructure (uploads / sentinel / chat depend on customer-side
 * services — those modalities are exercised in @runflow/sdk's unit
 * tests via mergeToolValues + buildRequest assertions).
 *
 * Loads RUNFLOW_API_KEY (or RUNFLOW_API_TOKEN) from env. Run with:
 *
 *     bun run --env-file=/path/to/.env examples/e2e-proof/run.ts
 *
 * Saves a log and per-run JSON files under `.proof/`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Runflow, RunFailedError } from "@runflow/sdk";
import { runflowProxy } from "@runflow/proxy";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROOF_DIR = resolve(__dirname, "../../.proof");

const SOURCE_URL =
  process.env.E2E_SOURCE_URL ||
  // Stable product photo, immutable CDN URL.
  "https://v3b.fal.media/files/b/0a991a66/8YuTT7o8iAEI5FuH3u81m_2e00493442924f0f9a654023c4eda645.jpg";

interface Modality {
  name: string;
  modality:
    | "simple"
    | "prompt"
    | "color"
    | "select"
    | "text-to-image";
  model: string;
  body: Record<string, unknown>;
  /** Some workflows take longer; bump the timeout where needed. */
  timeoutMs?: number;
}

const MODALITIES: Modality[] = [
  {
    name: "simple — background-removal",
    modality: "simple",
    model: "runflow/background-removal",
    body: { input: { image_url: SOURCE_URL } },
  },
  {
    name: "color — background-color (Zalando grey)",
    modality: "color",
    model: "runflow/background-color",
    body: {
      input: { image_url: SOURCE_URL, color_red: 241, color_green: 241, color_blue: 241 },
    },
  },
  {
    name: "select — smart-resize 1:1 @ 2K",
    modality: "select",
    model: "runflow/smart-resize",
    body: { input: { image_url: SOURCE_URL, aspect_ratio: "1:1", resolution: "2K" } },
  },
  {
    name: "prompt — object-removal/prompt",
    modality: "prompt",
    model: "runflow/object-removal/prompt",
    body: { input: { image_url: SOURCE_URL, prompt: "the price tag" } },
  },
  {
    name: "text-to-image — nano-banana-pro",
    modality: "text-to-image",
    model: "google/nano-banana-pro",
    body: {
      input: {
        prompt:
          "studio product photography of a white running sneaker on a clean grey backdrop, centered, soft natural light",
        aspect_ratio: "1:1",
        resolution: "2K",
      },
    },
    timeoutMs: 5 * 60_000,
  },
  {
    name: "pin — ai-edit (positional prompt)",
    modality: "simple",
    model: "google/nano-banana-pro/edit",
    body: {
      input: {
        // The pin builder in @runflow/studio's ai-edit tool produces this
        // exact preamble; we match it here to prove the dispatched body
        // shape works upstream.
        prompt:
          "Edit the upper-center area of this image: remove the price tag. Photoreal product photography, preserve the rest of the image, true colors and lighting.",
        image_urls: [SOURCE_URL],
      },
    },
    timeoutMs: 5 * 60_000,
  },
];

async function main() {
  const apiKey = process.env.RUNFLOW_API_KEY || process.env.RUNFLOW_API_TOKEN;
  if (!apiKey) {
    console.error(
      "Missing RUNFLOW_API_KEY (or RUNFLOW_API_TOKEN). Pass --env-file=<path/to/.env> when running with bun.",
    );
    process.exit(2);
  }

  await mkdir(PROOF_DIR, { recursive: true });
  const logPath = resolve(PROOF_DIR, "proof.log");
  await writeFile(logPath, "");
  const log = async (line: string) => {
    const stamped = `${new Date().toISOString()}  ${line}\n`;
    process.stdout.write(stamped);
    await writeFile(logPath, stamped, { flag: "a" });
  };

  await log("== runflow-js end-to-end proof — full modality sweep ==");
  await log(`source: ${SOURCE_URL}`);
  await log("");

  const handler = runflowProxy({
    apiKey,
    basePath: "/api/runflow",
    onRun: ({ runId, model }) => {
      void log(`  proxy: dispatched ${model} → ${runId}`);
    },
  });

  const rf = new Runflow({
    baseUrl: "http://proof.local/api/runflow",
    fetch: (input, init) => handler(new Request(input as RequestInfo, init)),
  });

  const summary: Array<{
    modality: string;
    name: string;
    ok: boolean;
    runId?: string;
    output?: string;
    elapsedSeconds: number;
    error?: string;
  }> = [];

  for (const mod of MODALITIES) {
    await log(`▶ ${mod.name}`);
    const start = Date.now();
    try {
      const dispatched = await rf.models.run(mod.model, mod.body);
      const enrichedBody = { ...mod.body, client_ref: `e2e-${mod.modality}-${start}` };
      void enrichedBody;
      const final = await rf.runs.wait(dispatched.id, {
        pollIntervalMs: 2_000,
        timeoutMs: mod.timeoutMs ?? 3 * 60_000,
        onPoll: (run) => {
          void log(`    poll: ${run.status_code}`);
        },
      });
      const elapsed = +((Date.now() - start) / 1000).toFixed(1);
      const outputUrl = extractImage(final.output);
      await log(`  ✓ SUCCEEDED in ${elapsed}s — ${outputUrl ?? "(no image URL)"}`);
      await writeFile(
        resolve(PROOF_DIR, `${mod.modality}-${dispatched.id}.json`),
        JSON.stringify(
          {
            ok: true,
            modality: mod.modality,
            name: mod.name,
            model: mod.model,
            body: mod.body,
            runId: dispatched.id,
            output: { image: outputUrl },
            rawOutput: final.output,
            elapsedSeconds: elapsed,
            completedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      summary.push({
        modality: mod.modality,
        name: mod.name,
        ok: true,
        runId: dispatched.id,
        output: outputUrl ?? undefined,
        elapsedSeconds: elapsed,
      });
    } catch (err) {
      const elapsed = +((Date.now() - start) / 1000).toFixed(1);
      const msg = err instanceof Error ? err.message : String(err);
      await log(`  ✗ FAILED in ${elapsed}s — ${msg}`);
      if (err instanceof RunFailedError) {
        await log(`    raw: ${JSON.stringify(err.run.error)}`);
      }
      summary.push({
        modality: mod.modality,
        name: mod.name,
        ok: false,
        elapsedSeconds: elapsed,
        error: msg,
      });
    }
    await log("");
  }

  // ── Package single-output (zalando) ─────────────────────────────────
  // Walks tag-removal → model-removal → background-color in sequence,
  // feeding each step's output into the next. Mirrors the
  // zalando-package recipe in @runflow/studio/data/workflows.ts.
  await log("▶ package single — zalando (tag → model → grey backdrop)");
  const zalandoStart = Date.now();
  try {
    const out = await runChain(rf, SOURCE_URL, [
      { model: "runflow/tag-removal", extra: {} },
      { model: "runflow/model-removal", extra: {} },
      {
        model: "runflow/background-color",
        extra: { color_red: 241, color_green: 241, color_blue: 241 },
      },
    ]);
    const elapsed = +((Date.now() - zalandoStart) / 1000).toFixed(1);
    await log(`  ✓ SUCCEEDED in ${elapsed}s — final ${out.outputUrl}`);
    await writeFile(
      resolve(PROOF_DIR, `package-single-${out.runIds.join("-").slice(0, 36)}.json`),
      JSON.stringify(
        {
          ok: true,
          modality: "package-single",
          name: "zalando — single-output 3-step chain",
          steps: out.runIds.map((id, i) => ({ runId: id, model: out.models[i] })),
          finalOutput: { image: out.outputUrl },
          elapsedSeconds: elapsed,
          completedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    summary.push({
      modality: "package-single",
      name: "zalando — 3-step chain",
      ok: true,
      runId: out.runIds.join(","),
      output: out.outputUrl,
      elapsedSeconds: elapsed,
    });
  } catch (err) {
    const elapsed = +((Date.now() - zalandoStart) / 1000).toFixed(1);
    const msg = err instanceof Error ? err.message : String(err);
    await log(`  ✗ FAILED in ${elapsed}s — ${msg}`);
    summary.push({
      modality: "package-single",
      name: "zalando",
      ok: false,
      elapsedSeconds: elapsed,
      error: msg,
    });
  }
  await log("");

  // ── Sentinel evaluation ─────────────────────────────────────────────
  // Direct passthrough to sentinel.runflow.io with the SENTINEL_API_KEY.
  // Same body shape as the prototype's /demos/api/sentinel proxy emits.
  const sentinelKey = process.env.SENTINEL_API_KEY;
  if (sentinelKey && summary.some((s) => s.ok && s.output)) {
    const firstSuccess = summary.find((s) => s.ok && s.output);
    if (firstSuccess?.output) {
      await log("▶ sentinel — evaluate first successful output");
      const senStart = Date.now();
      try {
        const verdict = await runSentinel(sentinelKey, SOURCE_URL, firstSuccess.output);
        const elapsed = +((Date.now() - senStart) / 1000).toFixed(1);
        await log(
          `  ✓ verdict=${verdict.state} judges=${verdict.judgesPassed}/${verdict.judgesTotal} in ${elapsed}s`,
        );
        await writeFile(
          resolve(PROOF_DIR, `sentinel-${verdict.evalId}.json`),
          JSON.stringify({ ok: true, modality: "sentinel", ...verdict, elapsedSeconds: elapsed }, null, 2),
        );
        summary.push({
          modality: "sentinel",
          name: "sentinel evaluation",
          ok: true,
          runId: verdict.evalId,
          output: verdict.state,
          elapsedSeconds: elapsed,
        });
      } catch (err) {
        const elapsed = +((Date.now() - senStart) / 1000).toFixed(1);
        const msg = err instanceof Error ? err.message : String(err);
        await log(`  ✗ sentinel FAILED in ${elapsed}s — ${msg}`);
        summary.push({
          modality: "sentinel",
          name: "sentinel evaluation",
          ok: false,
          elapsedSeconds: elapsed,
          error: msg,
        });
      }
      await log("");
    }
  } else {
    await log("▶ sentinel — skipped (SENTINEL_API_KEY missing or no successful output to evaluate)");
    await log("");
  }

  const ok = summary.every((s) => s.ok);
  await log(`== summary: ${summary.filter((s) => s.ok).length}/${summary.length} modalities succeeded ==`);
  await writeFile(
    resolve(PROOF_DIR, "summary.json"),
    JSON.stringify({ ok, summary, completedAt: new Date().toISOString() }, null, 2),
  );

  if (!ok) process.exit(1);
}

async function runChain(
  rf: Runflow,
  sourceUrl: string,
  steps: Array<{ model: string; extra: Record<string, unknown> }>,
): Promise<{ outputUrl: string; runIds: string[]; models: string[] }> {
  let current = sourceUrl;
  const runIds: string[] = [];
  const models: string[] = [];
  for (const step of steps) {
    const dispatched = await rf.models.run(step.model, {
      input: { image_url: current, ...step.extra },
    });
    const final = await rf.runs.wait(dispatched.id, { pollIntervalMs: 2_000, timeoutMs: 3 * 60_000 });
    const url = extractImage(final.output);
    if (!url) throw new Error(`No output URL from ${step.model} run ${dispatched.id}`);
    current = url;
    runIds.push(dispatched.id);
    models.push(step.model);
  }
  return { outputUrl: current, runIds, models };
}

async function runSentinel(
  apiKey: string,
  inputUrl: string,
  outputUrl: string,
): Promise<{ evalId: string; state: string; judgesPassed: number; judgesTotal: number; summary?: string }> {
  const SENTINEL = "https://sentinel.runflow.io/api/v1";
  const post = await fetch(`${SENTINEL}/evaluate?sync=false`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      generated_image_url: outputUrl,
      task_type: "product_photography",
      task_description: "Background removed and replaced with the requested backdrop.",
      reference_images: [{ url: inputUrl, role: "reference_image", description: "Original source image" }],
    }),
  });
  if (!post.ok) {
    throw new Error(`sentinel dispatch ${post.status}: ${await post.text().then((s) => s.slice(0, 200))}`);
  }
  const dispatched = (await post.json()) as { eval_id: string };
  const evalId = dispatched.eval_id;
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3_000));
    const poll = await fetch(`${SENTINEL}/evaluate/${encodeURIComponent(evalId)}`, {
      headers: { "X-API-Key": apiKey },
    });
    if (!poll.ok) continue;
    const data = (await poll.json()) as {
      status?: string;
      judges?: Array<{ passed: boolean }>;
      summary?: string;
    };
    if (data.status === "completed") {
      const judges = data.judges ?? [];
      const passed = judges.filter((j) => j.passed).length;
      const total = judges.length;
      const failures = total - passed;
      const state = failures === 0 ? "green" : failures === 1 ? "amber" : "red";
      return { evalId, state, judgesPassed: passed, judgesTotal: total, summary: data.summary };
    }
    if (data.status === "failed") {
      throw new Error(`sentinel eval ${evalId} failed`);
    }
  }
  throw new Error(`sentinel eval ${evalId} timed out`);
}

function extractImage(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.outputs) && o.outputs.length > 0) {
    const first = o.outputs[0] as Record<string, unknown> | undefined;
    if (first && typeof first.url === "string") return first.url;
  }
  if (Array.isArray(o.image_urls) && o.image_urls.length > 0) {
    const u = o.image_urls[0];
    if (typeof u === "string") return u;
  }
  if (o.image && typeof (o.image as Record<string, unknown>).url === "string") {
    return (o.image as { url: string }).url;
  }
  if (typeof o.url === "string") return o.url;
  if (typeof o.output_url === "string") return o.output_url;
  return null;
}

void main();
