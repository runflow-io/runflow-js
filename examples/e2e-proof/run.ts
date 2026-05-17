/**
 * End-to-end proof run.
 *
 * Exercises the full chain the way a real customer would:
 *   browser SDK ── http ──▶ @runflow/proxy ── http ──▶ api.runflow.io
 *
 * Here we run the proxy in-process and route the SDK's `fetch` directly
 * to it, so the proof needs no HTTP listener and runs in a single
 * `bun run` invocation. The upstream call to `api.runflow.io` is real.
 *
 * Loads `RUNFLOW_API_KEY` (or `RUNFLOW_API_TOKEN`) from the env. Run with:
 *
 *     bun run --env-file=/path/to/runflow-prototypes/.env examples/e2e-proof/run.ts
 *
 * Saves a log and the run.json output under `.proof/`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Runflow, RunFailedError } from "@runflow/sdk";
import { runflowProxy } from "@runflow/proxy";
import { backgroundRemoval } from "@runflow/studio/tools";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROOF_DIR = resolve(__dirname, "../../.proof");

const SOURCE_URL =
  process.env.E2E_SOURCE_URL ||
  // A stable product photo from the prototype's sample library
  // (immutable CDN URL — `cache-control: immutable` from upstream).
  "https://v3b.fal.media/files/b/0a991a66/8YuTT7o8iAEI5FuH3u81m_2e00493442924f0f9a654023c4eda645.jpg";

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
  const log = (line: string) => {
    const stamped = `${new Date().toISOString()}  ${line}\n`;
    process.stdout.write(stamped);
    return writeFile(logPath, stamped, { flag: "a" });
  };

  await writeFile(logPath, ""); // truncate
  await log("== runflow-js end-to-end proof ==");
  await log(`source: ${SOURCE_URL}`);
  await log(`tool:   ${backgroundRemoval.id} (model: ${backgroundRemoval.model})`);

  // Stand up the proxy in-process. This is identical to what
  // runflow-prototypes/projects/demos/api/runflow.mjs runs at the edge.
  const handler = runflowProxy({
    apiKey,
    basePath: "/api/runflow",
    onRun: ({ runId, model }) => {
      void log(`proxy: dispatched ${model} → run ${runId}`);
    },
  });

  // SDK client routed at the proxy via a custom fetch — no HTTP listener
  // required.
  const rf = new Runflow({
    baseUrl: "http://proof.local/api/runflow",
    fetch: (input, init) => handler(new Request(input as RequestInfo, init)),
  });

  await log("dispatching run…");
  const start = Date.now();
  try {
    const result = await rf.tools.run(backgroundRemoval, { image: SOURCE_URL }, {
      pollIntervalMs: 2_000,
      timeoutMs: 5 * 60_000,
      onPoll: (run) => {
        void log(`  poll: status=${run.status_code}`);
      },
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    await log(`status: SUCCEEDED in ${elapsed}s`);
    await log(`runId:  ${result.runId}`);
    await log(`output: ${result.output.image}`);

    await writeFile(
      resolve(PROOF_DIR, `${result.runId}.json`),
      JSON.stringify(
        {
          ok: true,
          tool: backgroundRemoval.id,
          model: backgroundRemoval.model,
          source: SOURCE_URL,
          runId: result.runId,
          output: result.output,
          rawStatus: result.raw.status_code,
          rawOutput: result.raw.output,
          elapsedSeconds: Number(elapsed),
          completedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    await log("PROOF: written to .proof/");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    await log(`status: FAILED after ${elapsed}s — ${message}`);
    if (err instanceof RunFailedError) {
      await log(`raw error: ${JSON.stringify(err.run.error)}`);
      // Fetch the run one more time to capture the full payload for triage.
      try {
        const tail = await rf.runs.get(err.run.id);
        await writeFile(
          resolve(PROOF_DIR, `${err.run.id}.json`),
          JSON.stringify({ ok: false, run: tail, elapsedSeconds: Number(elapsed) }, null, 2),
        );
      } catch {
        // ignore — we'll still write error.json below
      }
    }
    await writeFile(
      resolve(PROOF_DIR, "error.json"),
      JSON.stringify({ ok: false, message, elapsedSeconds: Number(elapsed) }, null, 2),
    );
    process.exit(1);
  }
}

void main();
