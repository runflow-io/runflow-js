import type { AllInputValues, AnyInput, RuntimeInputValues } from "./inputs.js";
import type { AnyOutput, OutputValues } from "./outputs.js";
import { extractFirstImageUrl } from "./outputs.js";

/**
 * A declarative tool that binds a Runflow model to:
 *  - a typed input schema (with preset / runtime / user sources)
 *  - a request builder that maps inputs to the model's body shape
 *  - an output schema that names the values clients will receive
 *  - an extractor that pulls those values out of `run.output`
 *
 * The same definition is consumed server-side (for validation /
 * dispatch) and client-side (for the Studio's UI generation), so the
 * tool is the single source of truth across the stack.
 */
export interface ToolDef<
  I extends Record<string, AnyInput> = Record<string, AnyInput>,
  O extends Record<string, AnyOutput> = Record<string, AnyOutput>,
> {
  /** Stable id, used in chat plans, package recipes, analytics. */
  id: string;
  /** Human-readable name shown in the Studio. */
  name: string;
  /** Short description shown under the name. */
  description?: string;
  /** UI grouping; the Studio bins tools by group. */
  group?: string;
  /** Runflow model id, e.g. `"runflow/background-removal"`. */
  model: string;
  /** Input definitions. Order is preserved for UI rendering. */
  inputs: I;
  /** Output schema — the named values clients should expect. */
  output: O;
  /** Build the request body sent to `POST /v1/models/{model}/runs`. */
  buildRequest: (values: AllInputValues<I>) => unknown;
  /** Pull named outputs from the raw `run.output`. Defaults to a single `image` field via {@link extractFirstImageUrl}. */
  extractOutput?: (rawRunOutput: unknown) => OutputValues<O>;
  /** Returned by the Studio so a UI can hint applicability per sample. */
  applicableHint?: (tags: ReadonlyArray<string>) => { ok: boolean; reason?: string };
  /** Free-form metadata for analytics / tagging. */
  metadata?: Record<string, unknown>;
}

/**
 * Define a tool. Returns the same object with strong types preserved.
 *
 * @example
 * const aiScene = defineTool({
 *   id: "ai-scene",
 *   name: "Drop into a new scene",
 *   model: "google/nano-banana-pro/edit",
 *   inputs: {
 *     image: imageInput({ source: "runtime" }),
 *     prompt: textInput({ source: "user", label: "Describe the scene" }),
 *   },
 *   output: { image: imageOutput() },
 *   buildRequest: ({ image, prompt }) => ({
 *     input: { prompt, image_urls: [image] },
 *   }),
 * });
 */
export function defineTool<
  I extends Record<string, AnyInput>,
  O extends Record<string, AnyOutput>,
>(def: ToolDef<I, O>): ToolDef<I, O> {
  return def;
}

/**
 * Merge runtime args with the tool's presets to produce the full input
 * record that `buildRequest` expects.
 */
export function mergeToolValues<I extends Record<string, AnyInput>>(
  tool: ToolDef<I, Record<string, AnyOutput>>,
  args: RuntimeInputValues<I>,
): AllInputValues<I> {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(tool.inputs)) {
    if (def.source === "preset") {
      if (def.value === undefined) {
        throw new Error(`Tool ${tool.id}: preset input '${key}' is missing a 'value'`);
      }
      out[key] = def.value;
    } else {
      const v = (args as Record<string, unknown>)[key];
      if (v === undefined) {
        if (def.optional) continue;
        throw new Error(`Tool ${tool.id}: missing required input '${key}'`);
      }
      out[key] = v;
    }
  }
  return out as AllInputValues<I>;
}

/** Default output extractor used when a tool omits `extractOutput`. */
export function defaultExtract(raw: unknown): { image: string | null } {
  return { image: extractFirstImageUrl(raw) };
}
