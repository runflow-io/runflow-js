import type { Runflow } from "../client.js";
import { RunFailedError, RunflowError } from "../errors.js";
import type { Run, WaitOptions } from "../types.js";
import type { ToolDef } from "./define.js";
import { defaultExtract, mergeToolValues } from "./define.js";
import type { AnyInput, RuntimeInputValues } from "./inputs.js";
import type { AnyOutput, OutputValues } from "./outputs.js";

/** Final result returned from a tool run. */
export interface ToolRunResult<O extends Record<string, AnyOutput>> {
  runId: string;
  status: "succeeded";
  output: OutputValues<O>;
  raw: Run;
}

export interface ToolRunOptions extends WaitOptions {
  /**
   * Optional `client_ref` set on the dispatched run. Useful for
   * idempotency and cross-system correlation.
   */
  clientRef?: string;
  /** Free-form metadata sent with the dispatch. */
  metadata?: Record<string, unknown>;
}

/**
 * Resource exposing tool-level dispatch + wait. Available as
 * `runflow.tools`.
 */
export class ToolsResource {
  constructor(private readonly client: Runflow) {}

  /**
   * Dispatch a tool and wait for it to finish. Resolves with the
   * extracted output values per the tool's `output` schema.
   */
  async run<I extends Record<string, AnyInput>, O extends Record<string, AnyOutput>>(
    tool: ToolDef<I, O>,
    args: RuntimeInputValues<I>,
    opts: ToolRunOptions = {},
  ): Promise<ToolRunResult<O>> {
    const merged = mergeToolValues(tool, args);
    const body = tool.buildRequest(merged);
    if (!isPlainObject(body)) {
      throw new RunflowError(
        `Tool ${tool.id}: buildRequest must return a plain object (received ${describe(body)})`,
        { code: "invalid_tool_request_body" },
      );
    }
    const enriched: Record<string, unknown> = {
      ...body,
      client_ref: opts.clientRef ?? `runflow-sdk-${tool.id}-${Date.now()}`,
      metadata: { ...opts.metadata, tool: tool.id, source: "runflow-sdk" },
    };
    const dispatched = await this.client.models.run(tool.model, enriched, { signal: opts.signal });
    const final = await this.client.runs.wait(dispatched.id, opts);
    if (final.status_code !== "succeeded") {
      throw new RunFailedError(final.error?.message ?? `Run ${final.id} ${final.status_code}`, {
        id: final.id,
        status: final.status_code,
        error: final.error,
      });
    }
    const extractor =
      tool.extractOutput ?? (defaultExtract as unknown as (raw: unknown) => OutputValues<O>);
    const extracted = extractor(final.output);
    return { runId: final.id, status: "succeeded", output: extracted, raw: final };
  }

  /**
   * Lower-level: dispatch only — returns the run id immediately.
   * Useful when callers want to manage polling themselves.
   */
  async dispatch<I extends Record<string, AnyInput>>(
    tool: ToolDef<I, Record<string, AnyOutput>>,
    args: RuntimeInputValues<I>,
    opts: Pick<ToolRunOptions, "clientRef" | "metadata" | "signal"> = {},
  ): Promise<{ runId: string; model: string }> {
    const merged = mergeToolValues(tool, args);
    const body = tool.buildRequest(merged);
    if (!isPlainObject(body)) {
      throw new RunflowError(
        `Tool ${tool.id}: buildRequest must return a plain object (received ${describe(body)})`,
        { code: "invalid_tool_request_body" },
      );
    }
    const enriched: Record<string, unknown> = {
      ...body,
      client_ref: opts.clientRef ?? `runflow-sdk-${tool.id}-${Date.now()}`,
      metadata: { ...opts.metadata, tool: tool.id, source: "runflow-sdk" },
    };
    const dispatched = await this.client.models.run(tool.model, enriched, { signal: opts.signal });
    return { runId: dispatched.id, model: tool.model };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  // Filter out built-in object types the SDK can't merge — FormData,
  // Blob, ArrayBuffer, URLSearchParams, etc. — by requiring a plain
  // Object prototype.
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") {
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
    return ctor ? `${ctor} instance` : "non-plain object";
  }
  return typeof value;
}
