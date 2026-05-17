/**
 * Output schemas for tools.
 *
 * The schema declares the shape of the final result. `extractOutput`
 * pulls those fields out of the raw `run.output` returned by the API,
 * isolating tool callers from the model-specific output shape.
 */

interface BaseOutput<V> {
  /** Optional human-readable label. */
  label?: string;
  /** Phantom marker for TS inference. Not present at runtime. */
  __v?: V;
}

export interface ImageOutputField extends BaseOutput<string> {
  type: "image";
}
export interface TextOutputField extends BaseOutput<string> {
  type: "text";
}
export interface NumberOutputField extends BaseOutput<number> {
  type: "number";
}
export interface JsonOutputField<V> extends BaseOutput<V> {
  type: "json";
}
export interface ImageListOutputField extends BaseOutput<string[]> {
  type: "image[]";
}

export type AnyOutput =
  | ImageOutputField
  | TextOutputField
  | NumberOutputField
  | JsonOutputField<unknown>
  | ImageListOutputField;

export type OutputValue<O> = O extends ImageOutputField
  ? string
  : O extends TextOutputField
    ? string
    : O extends NumberOutputField
      ? number
      : O extends JsonOutputField<infer V>
        ? V
        : O extends ImageListOutputField
          ? string[]
          : never;

export type OutputValues<O extends Record<string, AnyOutput>> = {
  [K in keyof O]: OutputValue<O[K]>;
};

// ── Output builders ────────────────────────────────────────────────────

export function imageOutput(opts: Omit<ImageOutputField, "type"> = {}): ImageOutputField {
  return { type: "image", ...opts };
}
export function textOutput(opts: Omit<TextOutputField, "type"> = {}): TextOutputField {
  return { type: "text", ...opts };
}
export function numberOutput(opts: Omit<NumberOutputField, "type"> = {}): NumberOutputField {
  return { type: "number", ...opts };
}
export function jsonOutput<V = unknown>(
  opts: Omit<JsonOutputField<V>, "type"> = {},
): JsonOutputField<V> {
  return { type: "json", ...opts };
}
export function imageListOutput(
  opts: Omit<ImageListOutputField, "type"> = {},
): ImageListOutputField {
  return { type: "image[]", ...opts };
}

// ── Default extractors ─────────────────────────────────────────────────

/**
 * Pull the first image URL out of `run.output`, tolerating the three
 * shapes Runflow models commonly return: `{ outputs: [{ url }] }`,
 * `{ image_urls: [url] }`, `{ image: { url } }`.
 */
export function extractFirstImageUrl(raw: unknown): string | null {
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

/** Pull all image URLs out of `run.output`. */
export function extractAllImageUrls(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const urls: string[] = [];
  if (Array.isArray(o.outputs)) {
    for (const it of o.outputs) {
      const url = (it as Record<string, unknown>)?.url;
      if (typeof url === "string") urls.push(url);
    }
  }
  if (urls.length === 0 && Array.isArray(o.image_urls)) {
    for (const u of o.image_urls) if (typeof u === "string") urls.push(u);
  }
  return urls;
}
