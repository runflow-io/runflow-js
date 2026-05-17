/**
 * Per-workflow proof — dispatches every individual workflow from the
 * prototype's catalogue that the main proof sweep didn't already
 * exercise.
 *
 * Run after `run.ts` to bump criterion-1 coverage:
 *
 *     bun run --env-file=<path> examples/e2e-proof/workflows.ts
 *
 * The chain is identical to `run.ts` — Runflow client + in-process
 * proxy + real `api.runflow.io` upstream. Each workflow saves its own
 * JSON proof under `.proof/workflow-<id>-<runId>.json`.
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
  "https://v3b.fal.media/files/b/0a991a66/8YuTT7o8iAEI5FuH3u81m_2e00493442924f0f9a654023c4eda645.jpg";

// The three workflows the main sweep doesn't already dispatch.
const WORKFLOWS = [
  {
    id: "outpaint",
    model: "runflow/outpaint",
    body: {
      input: {
        image_url: SOURCE_URL,
        expand_top: 39,
        expand_bottom: 39,
        expand_left: 0,
        expand_right: 0,
      },
    },
  },
  {
    id: "skin-fix",
    model: "runflow/skin-fix",
    body: { input: { image_url: SOURCE_URL } },
  },
  {
    id: "topaz-upscale",
    model: "topaz/upscale/image",
    body: {
      input: {
        image_url: SOURCE_URL,
        model: "Standard V2",
        upscale_factor: 2,
        output_format: "png",
      },
    },
  },
];

async function main() {
  const apiKey = process.env.RUNFLOW_API_KEY || process.env.RUNFLOW_API_TOKEN;
  if (!apiKey) {
    console.error("Missing RUNFLOW_API_KEY (or RUNFLOW_API_TOKEN).");
    process.exit(2);
  }

  await mkdir(PROOF_DIR, { recursive: true });
  const logPath = resolve(PROOF_DIR, "workflows.log");
  await writeFile(logPath, "");
  const log = async (line: string) => {
    const stamped = `${new Date().toISOString()}  ${line}\n`;
    process.stdout.write(stamped);
    await writeFile(logPath, stamped, { flag: "a" });
  };

  await log("== per-workflow proof — outpaint / skin-fix / topaz-upscale ==");
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

  let allOk = true;
  for (const wf of WORKFLOWS) {
    await log(`▶ ${wf.id} (${wf.model})`);
    const start = Date.now();
    try {
      const dispatched = await rf.models.run(wf.model, wf.body);
      const final = await rf.runs.wait(dispatched.id, {
        pollIntervalMs: 2_000,
        timeoutMs: 5 * 60_000,
        onPoll: (run) => {
          void log(`    poll: ${run.status_code}`);
        },
      });
      const elapsed = +((Date.now() - start) / 1000).toFixed(1);
      const url = extractImage(final.output);
      await log(`  ✓ SUCCEEDED in ${elapsed}s — ${url}`);
      await writeFile(
        resolve(PROOF_DIR, `workflow-${wf.id}-${dispatched.id}.json`),
        JSON.stringify(
          {
            ok: true,
            workflow: wf.id,
            model: wf.model,
            body: wf.body,
            runId: dispatched.id,
            output: { image: url },
            rawOutput: final.output,
            elapsedSeconds: elapsed,
            completedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    } catch (err) {
      allOk = false;
      const elapsed = +((Date.now() - start) / 1000).toFixed(1);
      const msg = err instanceof Error ? err.message : String(err);
      await log(`  ✗ FAILED in ${elapsed}s — ${msg}`);
      if (err instanceof RunFailedError) {
        await log(`    raw: ${JSON.stringify(err.run.error)}`);
      }
    }
    await log("");
  }

  if (!allOk) process.exit(1);
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
