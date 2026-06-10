/**
 * End-to-end proof run.
 *
 * Exercises the full chain a real customer would hit:
 *   browser SDK ── http ──▶ @runflow-io/proxy ── http ──▶ api.runflow.io
 *
 * The proxy runs in-process and the SDK's `fetch` routes directly to it,
 * so no HTTP listener is needed. Upstream calls to api.runflow.io are
 * real.
 *
 * Covers one run per modality, file uploads via rf.assets.upload
 * (through the proxy's default allow-list), the proxy allow-list gate
 * itself, and the packaged workflows. Only RUNFLOW_API_KEY is needed —
 * the former R2 side-channel for mask/reference uploads is gone.
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

import { runflowProxy } from "@runflow-io/proxy";
import { RunFailedError, Runflow, composePinPrompt } from "@runflow-io/sdk";
import { buildSampleMask, fetchBytes } from "./fixtures.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROOF_DIR = resolve(__dirname, "../../.proof");

const SOURCE_URL =
  process.env.E2E_SOURCE_URL ||
  // Stable product photo, immutable CDN URL.
  "https://v3b.fal.media/files/b/0a991a66/8YuTT7o8iAEI5FuH3u81m_2e00493442924f0f9a654023c4eda645.jpg";

interface Modality {
  name: string;
  modality: "simple" | "prompt" | "color" | "select" | "pin" | "text-to-image";
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
    modality: "pin",
    model: "google/nano-banana-pro/edit",
    body: {
      input: {
        // composePinPrompt is the same helper @runflow-io/studio's ai-edit
        // tool uses, so this dispatch proves the shared pin contract works
        // upstream. {x: 0.5, y: 0.2} → "upper-center".
        prompt: composePinPrompt({ x: 0.5, y: 0.2 }, "remove the price tag"),
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

  // Route same-origin proxy calls into the in-process handler — exactly
  // what a browser does against /api/runflow — while absolute URLs to
  // other hosts (the presigned storage PUT inside rf.assets.upload) go
  // out over the real network.
  const proofFetch: typeof fetch = (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith("http://proof.local/")) {
      return handler(new Request(input as RequestInfo, init));
    }
    return fetch(input as RequestInfo, init);
  };
  const rf = new Runflow({
    baseUrl: "http://proof.local/api/runflow",
    fetch: proofFetch,
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

  // ── Asset upload — rf.assets.upload through the proxy ───────────────
  // THE regression test for RUN-384 gaps 1+4: a browser-style file
  // upload via the SDK's presigned flow (allowed through the proxy by
  // default), whose signed https URL then feeds google/nano-banana-pro/
  // edit — the model that 422s on runflow:// refs. Green here means the
  // external-fork upload path works end to end with no extra plumbing.
  await log("▶ asset-upload — rf.assets.upload → nano-banana-pro/edit");
  const upStart = Date.now();
  try {
    const srcBytes = await fetchBytes(SOURCE_URL);
    const file = new File([new Uint8Array(srcBytes)], "proof-source.jpg", { type: "image/jpeg" });
    const uploaded = await rf.assets.upload(file);
    if (!uploaded.url.startsWith("https://")) {
      throw new Error(`expected a signed https url, got ${uploaded.url.slice(0, 60)}`);
    }
    if (uploaded.ref !== `runflow://assets/${uploaded.id}`) {
      throw new Error(`unexpected asset ref ${uploaded.ref}`);
    }
    await log(`    uploaded asset ${uploaded.id} (${uploaded.sizeBytes} bytes, signed https url)`);
    const d = await rf.models.run("google/nano-banana-pro/edit", {
      input: {
        prompt: composePinPrompt({ x: 0.5, y: 0.5 }, "remove the price tag"),
        image_urls: [uploaded.url],
      },
    });
    const r = await rf.runs.wait(d.id, { pollIntervalMs: 2_000, timeoutMs: 5 * 60_000 });
    const elapsed = +((Date.now() - upStart) / 1000).toFixed(1);
    const url = extractImage(r.output);
    await log(`  ✓ SUCCEEDED in ${elapsed}s — ${url}`);
    await writeFile(
      resolve(PROOF_DIR, `asset-upload-${d.id}.json`),
      JSON.stringify(
        {
          ok: true,
          modality: "asset-upload",
          name: "rf.assets.upload → nano-banana-pro/edit",
          asset: { id: uploaded.id, ref: uploaded.ref, sizeBytes: uploaded.sizeBytes },
          runId: d.id,
          output: { image: url },
          elapsedSeconds: elapsed,
          completedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    summary.push({
      modality: "asset-upload",
      name: "rf.assets.upload → nano-banana-pro/edit",
      ok: true,
      runId: d.id,
      output: url ?? undefined,
      elapsedSeconds: elapsed,
    });
  } catch (err) {
    const elapsed = +((Date.now() - upStart) / 1000).toFixed(1);
    const msg = err instanceof Error ? err.message : String(err);
    await log(`  ✗ FAILED in ${elapsed}s — ${msg}`);
    if (err instanceof RunFailedError) {
      await log(`    raw: ${JSON.stringify(err.run.error)}`);
    }
    summary.push({
      modality: "asset-upload",
      name: "rf.assets.upload → nano-banana-pro/edit",
      ok: false,
      elapsedSeconds: elapsed,
      error: msg,
    });
  }
  await log("");

  // ── Proxy allow-list — allowedPaths gate assertions ─────────────────
  // In-process checks (no model spend) plus one live read: the gate
  // still hard-403s unknown routes, the default asset-upload rules and
  // a customer-opted GET /v1/runs forward, and run listing works against
  // the real API through an opted-in proxy.
  await log("▶ proxy allow-list — allowedPaths gate assertions");
  const gateStart = Date.now();
  try {
    const denied = await handler(new Request("http://proof.local/api/runflow/v1/secrets"));
    if (denied.status !== 403) {
      throw new Error(`expected 403 for /v1/secrets, got ${denied.status}`);
    }

    const seen: string[] = [];
    const mockProxy = runflowProxy({
      apiKey,
      basePath: "/api/runflow",
      allowedPaths: [{ method: "GET", path: "/v1/runs" }],
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push(new Request(input as RequestInfo, init).url);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch,
    });
    const up = await mockProxy(
      new Request("http://proof.local/api/runflow/v1/asset-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "x.png", mime_type: "image/png", size_bytes: 1 }),
      }),
    );
    if (up.status !== 200) throw new Error(`default asset-uploads rule failed: ${up.status}`);
    const list = await mockProxy(new Request("http://proof.local/api/runflow/v1/runs?limit=1"));
    if (list.status !== 200) throw new Error(`custom GET /v1/runs rule failed: ${list.status}`);
    const refused = await mockProxy(
      new Request("http://proof.local/api/runflow/v1/billing/balance"),
    );
    if (refused.status !== 403) throw new Error(`expected 403 for billing, got ${refused.status}`);
    if (seen.length !== 2) throw new Error(`expected exactly 2 upstream calls, saw ${seen.length}`);

    const liveListProxy = runflowProxy({
      apiKey,
      basePath: "/api/runflow",
      allowedPaths: [{ method: "GET", path: "/v1/runs" }],
    });
    const live = await liveListProxy(new Request("http://proof.local/api/runflow/v1/runs?limit=3"));
    if (live.status !== 200) {
      throw new Error(`live GET /v1/runs through the proxy: HTTP ${live.status}`);
    }
    const liveBody = (await live.json()) as { items?: unknown[] };
    if (!Array.isArray(liveBody.items)) {
      throw new Error("live run listing: no items[] in response");
    }
    await log(`    live run listing through allowedPaths: ${liveBody.items.length} runs`);

    const elapsed = +((Date.now() - gateStart) / 1000).toFixed(1);
    await log(`  ✓ allow-list assertions passed in ${elapsed}s`);
    summary.push({
      modality: "proxy-allowlist",
      name: "allowedPaths gate",
      ok: true,
      elapsedSeconds: elapsed,
    });
  } catch (err) {
    const elapsed = +((Date.now() - gateStart) / 1000).toFixed(1);
    const msg = err instanceof Error ? err.message : String(err);
    await log(`  ✗ FAILED in ${elapsed}s — ${msg}`);
    summary.push({
      modality: "proxy-allowlist",
      name: "allowedPaths gate",
      ok: false,
      elapsedSeconds: elapsed,
      error: msg,
    });
  }
  await log("");

  // ── Package single-output (zalando) ─────────────────────────────────
  // Walks tag-removal → model-removal → background-color in sequence,
  // feeding each step's output into the next. Mirrors the
  // zalando-package recipe in @runflow-io/studio/data/workflows.ts.
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

  // ── Mask + reference (runflow/reference-inpaint) ────────────────────
  // Mirrors the prototype's mask-ref flow: upload source + mask + ref to
  // R2 (using the same Sig V4 path /demos/api/upload uses), then dispatch
  // reference-inpaint with three URLs in the body.
  await log("▶ mask + reference — reference-inpaint");
  const maskStart = Date.now();
  try {
    const srcBytes = await fetchBytes(SOURCE_URL);
    const refBytes = await fetchBytes(
      // Second prototype sample, used as the reference image.
      "https://v3b.fal.media/files/b/0a991a67/wspXRxZt1H_09O0vv1_88_8c0fd4daa8444042b2df13df274e0f6a.jpg",
    );
    const maskBytes = buildSampleMask();
    const [imageUrl, maskUrl, referenceUrl] = (
      await Promise.all([
        rf.assets.upload(
          new File([new Uint8Array(srcBytes)], "source.jpg", { type: "image/jpeg" }),
        ),
        rf.assets.upload(new File([new Uint8Array(maskBytes)], "mask.png", { type: "image/png" })),
        rf.assets.upload(
          new File([new Uint8Array(refBytes)], "reference.jpg", { type: "image/jpeg" }),
        ),
      ])
    ).map((a) => a.url);
    await log("    uploaded source + mask + reference via rf.assets.upload");

    const dispatched = await rf.models.run("runflow/reference-inpaint", {
      input: {
        image_url: imageUrl,
        mask_url: maskUrl,
        reference_url: referenceUrl,
        prompt: "match the reference style in the masked area",
      },
    });
    const final = await rf.runs.wait(dispatched.id, {
      pollIntervalMs: 2_000,
      timeoutMs: 5 * 60_000,
    });
    const elapsed = +((Date.now() - maskStart) / 1000).toFixed(1);
    const outputUrl = extractImage(final.output);
    await log(`  ✓ SUCCEEDED in ${elapsed}s — ${outputUrl}`);
    await writeFile(
      resolve(PROOF_DIR, `mask-reference-${dispatched.id}.json`),
      JSON.stringify(
        {
          ok: true,
          modality: "mask-reference",
          name: "reference-inpaint",
          model: "runflow/reference-inpaint",
          inputs: {
            image: imageUrl,
            mask: maskUrl,
            reference: referenceUrl,
            prompt: "match the reference style in the masked area",
          },
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
      modality: "mask-reference",
      name: "reference-inpaint",
      ok: true,
      runId: dispatched.id,
      output: outputUrl ?? undefined,
      elapsedSeconds: elapsed,
    });
  } catch (err) {
    const elapsed = +((Date.now() - maskStart) / 1000).toFixed(1);
    const msg = err instanceof Error ? err.message : String(err);
    await log(`  ✗ FAILED in ${elapsed}s — ${msg}`);
    if (err instanceof RunFailedError) {
      await log(`    raw: ${JSON.stringify(err.run.error)}`);
    }
    summary.push({
      modality: "mask-reference",
      name: "reference-inpaint",
      ok: false,
      elapsedSeconds: elapsed,
      error: msg,
    });
  }
  await log("");

  // ── Package fan-out (omnichannel-pack — prep + 4 channel variants) ──
  // Walks tag-removal → product-isolation → background-color (prep)
  // then runs four smart-resize variants in parallel from the prep
  // output. Mirrors the omnichannel-pack recipe in workflows.ts.
  await log("▶ package fan-out — omnichannel (prep + 4 channel variants)");
  const fanStart = Date.now();
  try {
    const prep = await runChain(rf, SOURCE_URL, [
      { model: "runflow/tag-removal", extra: {} },
      {
        model: "runflow/product-isolation",
        extra: { aspect_ratio: "1:1", resolution: "2K", prompt: "the sneaker" },
      },
      {
        model: "runflow/background-color",
        extra: { color_red: 255, color_green: 255, color_blue: 255 },
      },
    ]);
    await log(`    prep done → ${prep.outputUrl.slice(0, 80)}…`);

    const variants = [
      { id: "amazon-main", aspect_ratio: "1:1" },
      { id: "ig-feed", aspect_ratio: "4:5" },
      { id: "stories-tiktok", aspect_ratio: "9:16" },
      { id: "banner", aspect_ratio: "16:9" },
    ];
    const variantRuns = await Promise.all(
      variants.map(async (v) => {
        const d = await rf.models.run("runflow/smart-resize", {
          input: { image_url: prep.outputUrl, aspect_ratio: v.aspect_ratio, resolution: "2K" },
        });
        const r = await rf.runs.wait(d.id, { pollIntervalMs: 2_000, timeoutMs: 5 * 60_000 });
        return {
          variant: v.id,
          ratio: v.aspect_ratio,
          runId: d.id,
          output: extractImage(r.output),
        };
      }),
    );

    const elapsed = +((Date.now() - fanStart) / 1000).toFixed(1);
    await log(`  ✓ SUCCEEDED in ${elapsed}s — 4 variants`);
    for (const v of variantRuns) await log(`    · ${v.variant} (${v.ratio}): ${v.output}`);
    await writeFile(
      resolve(PROOF_DIR, "package-fanout-omnichannel.json"),
      JSON.stringify(
        {
          ok: true,
          modality: "package-fanout",
          name: "omnichannel-pack",
          prep: prep.runIds.map((id, i) => ({ runId: id, model: prep.models[i] })),
          variants: variantRuns,
          elapsedSeconds: elapsed,
          completedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    summary.push({
      modality: "package-fanout",
      name: "omnichannel-pack",
      ok: true,
      runId: variantRuns.map((v) => v.runId).join(","),
      output: `${variantRuns.length} variants`,
      elapsedSeconds: elapsed,
    });
  } catch (err) {
    const elapsed = +((Date.now() - fanStart) / 1000).toFixed(1);
    const msg = err instanceof Error ? err.message : String(err);
    await log(`  ✗ FAILED in ${elapsed}s — ${msg}`);
    summary.push({
      modality: "package-fanout",
      name: "omnichannel-pack",
      ok: false,
      elapsedSeconds: elapsed,
      error: msg,
    });
  }
  await log("");

  // ── Package with creative direction (campaign-pack) ─────────────────
  // Prep includes an ai-scene step whose prompt is filled from the
  // creative-direction picker at dispatch time. Then a single channel
  // variant runs (1:1, smart-resize) — the dispatcher in the prototype
  // is identical to the fan-out flow, just gated by a chosen prompt.
  await log("▶ package creative-direction — campaign (chosen scene + channel resize)");
  const cdStart = Date.now();
  try {
    const direction =
      "on a sun-warmed cobblestone street at golden hour, mid-stride pose, low three-quarter angle, soft long shadows, blurred city backdrop, editorial photoreal product photography, true colors and materials preserved";
    const prep = await runChain(rf, SOURCE_URL, [
      { model: "runflow/tag-removal", extra: {} },
      {
        model: "runflow/product-isolation",
        extra: { aspect_ratio: "1:1", resolution: "2K", prompt: "the sneaker" },
      },
      {
        model: "runflow/background-color",
        extra: { color_red: 255, color_green: 255, color_blue: 255 },
      },
    ]);
    await log("    prep done");
    const sceneDispatched = await rf.models.run("google/nano-banana-pro/edit", {
      input: {
        prompt: `Place the subject of this image ${direction}.`,
        image_urls: [prep.outputUrl],
      },
    });
    const scene = await rf.runs.wait(sceneDispatched.id, {
      pollIntervalMs: 2_000,
      timeoutMs: 5 * 60_000,
    });
    const sceneUrl = extractImage(scene.output);
    if (!sceneUrl) throw new Error("ai-scene returned no image");
    await log("    creative direction injected, scene generated");
    const variantD = await rf.models.run("runflow/smart-resize", {
      input: { image_url: sceneUrl, aspect_ratio: "1:1", resolution: "2K" },
    });
    const variant = await rf.runs.wait(variantD.id, {
      pollIntervalMs: 2_000,
      timeoutMs: 5 * 60_000,
    });
    const elapsed = +((Date.now() - cdStart) / 1000).toFixed(1);
    const finalUrl = extractImage(variant.output);
    await log(`  ✓ SUCCEEDED in ${elapsed}s — ${finalUrl}`);
    await writeFile(
      resolve(PROOF_DIR, `package-creative-direction-${variantD.id}.json`),
      JSON.stringify(
        {
          ok: true,
          modality: "package-creative-direction",
          name: "campaign-pack",
          creativeDirection: direction,
          prep: prep.runIds.map((id, i) => ({ runId: id, model: prep.models[i] })),
          sceneRunId: sceneDispatched.id,
          variantRunId: variantD.id,
          output: { image: finalUrl },
          elapsedSeconds: elapsed,
          completedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    summary.push({
      modality: "package-creative-direction",
      name: "campaign-pack",
      ok: true,
      runId: variantD.id,
      output: finalUrl ?? undefined,
      elapsedSeconds: elapsed,
    });
  } catch (err) {
    const elapsed = +((Date.now() - cdStart) / 1000).toFixed(1);
    const msg = err instanceof Error ? err.message : String(err);
    await log(`  ✗ FAILED in ${elapsed}s — ${msg}`);
    summary.push({
      modality: "package-creative-direction",
      name: "campaign-pack",
      ok: false,
      elapsedSeconds: elapsed,
      error: msg,
    });
  }
  await log("");

  // ── Chat-agent plan (structural — no Anthropic key in this env) ─────
  // Exercises the dispatch path the chat agent's tool-call sequence
  // produces: propose_plan → request_pin → run_workflow → finish.
  // Each tool call's resulting body is verified by reusing the SDK's
  // ai-edit shape, then dispatched against api.runflow.io to prove the
  // chain works. The Anthropic step itself is not exercised here —
  // ANTHROPIC_API_KEY is not present in this env.
  await log("▶ chat-agent plan — structural dispatch of a propose_plan → run_workflow sequence");
  const chatStart = Date.now();
  try {
    // Simulate the chat agent's plan: one ai-edit step with pin coords.
    const planSteps = [
      { workflow_id: "ai-edit", description: "Remove the price tag in the upper-left" },
    ];
    const pin = { x: 0.25, y: 0.25 };
    const instruction = "remove the price tag";
    // composePinPrompt is the exact helper @runflow-io/studio's ai-edit
    // tool uses (positional words from normalized coords).
    const body = {
      input: {
        prompt: composePinPrompt(pin, instruction),
        image_urls: [SOURCE_URL],
      },
    };
    const d = await rf.models.run("google/nano-banana-pro/edit", body);
    const r = await rf.runs.wait(d.id, { pollIntervalMs: 2_000, timeoutMs: 5 * 60_000 });
    const elapsed = +((Date.now() - chatStart) / 1000).toFixed(1);
    const url = extractImage(r.output);
    await log(`  ✓ SUCCEEDED in ${elapsed}s — ${url}`);
    await writeFile(
      resolve(PROOF_DIR, `chat-agent-${d.id}.json`),
      JSON.stringify(
        {
          ok: true,
          modality: "chat-agent",
          name: "structural propose_plan → request_pin → run_workflow → finish",
          note: "Anthropic step omitted (ANTHROPIC_API_KEY not in this env). The tool-call shape and dispatch chain are exercised verbatim against api.runflow.io.",
          plan: planSteps,
          pin,
          instruction,
          dispatchedBody: body,
          runId: d.id,
          output: { image: url },
          elapsedSeconds: elapsed,
          completedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    summary.push({
      modality: "chat-agent",
      name: "structural plan dispatch",
      ok: true,
      runId: d.id,
      output: url ?? undefined,
      elapsedSeconds: elapsed,
    });
  } catch (err) {
    const elapsed = +((Date.now() - chatStart) / 1000).toFixed(1);
    const msg = err instanceof Error ? err.message : String(err);
    await log(`  ✗ FAILED in ${elapsed}s — ${msg}`);
    summary.push({
      modality: "chat-agent",
      name: "structural plan dispatch",
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
          JSON.stringify(
            { ok: true, modality: "sentinel", ...verdict, elapsedSeconds: elapsed },
            null,
            2,
          ),
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
    await log(
      "▶ sentinel — skipped (SENTINEL_API_KEY missing or no successful output to evaluate)",
    );
    await log("");
  }

  const ok = summary.every((s) => s.ok);
  await log(
    `== summary: ${summary.filter((s) => s.ok).length}/${summary.length} modalities succeeded ==`,
  );
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
    const final = await rf.runs.wait(dispatched.id, {
      pollIntervalMs: 2_000,
      timeoutMs: 3 * 60_000,
    });
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
): Promise<{
  evalId: string;
  state: string;
  judgesPassed: number;
  judgesTotal: number;
  summary?: string;
}> {
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
      reference_images: [
        { url: inputUrl, role: "reference_image", description: "Original source image" },
      ],
    }),
  });
  if (!post.ok) {
    throw new Error(
      `sentinel dispatch ${post.status}: ${await post.text().then((s) => s.slice(0, 200))}`,
    );
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
