/**
 * Built-in tool catalogue for the Runflow Studio.
 *
 * Every workflow surfaced in the prototype is expressed as a
 * `defineTool({...})` so the SAME definitions drive both the Studio UI
 * and programmatic use via `runflow.tools.run(tool, args)`.
 *
 * Tool sources:
 *   - `runtime`  — passed at every call (typically the source image).
 *   - `user`     — collected by the Studio form (or passed programmatically).
 *   - `preset`   — baked into the definition; not collected at runtime.
 */

import {
  type ToolDef,
  colorInput,
  defineTool,
  extractFirstImageUrl,
  imageInput,
  imageOutput,
  maskInput,
  pinInput,
  referenceInput,
  selectInput,
  textInput,
} from "@runflow-io/sdk";

const extractImage = (raw: unknown) => ({ image: extractFirstImageUrl(raw) ?? "" });

// Hex → RGB helper used by background-color.
const hex2rgb = (hex: string) => {
  const h = hex.replace("#", "").padStart(6, "0");
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
};

const RATIO_OPTIONS = [
  { value: "1:1", label: "1:1 — square" },
  { value: "4:5", label: "4:5 — portrait feed" },
  { value: "3:4", label: "3:4 — portrait" },
  { value: "2:3", label: "2:3 — portrait tall" },
  { value: "9:16", label: "9:16 — stories" },
  { value: "5:4", label: "5:4 — landscape" },
  { value: "4:3", label: "4:3 — landscape" },
  { value: "3:2", label: "3:2 — landscape wide" },
  { value: "16:9", label: "16:9 — banner" },
  { value: "21:9", label: "21:9 — cinematic" },
] as const;

const RESOLUTION_OPTIONS = [
  { value: "1K", label: "1K — fast preview" },
  { value: "2K", label: "2K — balanced" },
  { value: "4K", label: "4K — print-ready" },
] as const;

// ── Magic ──────────────────────────────────────────────────────────────

export const aiEdit = defineTool({
  id: "ai-edit",
  name: "Pinpoint a change",
  description: "Click a spot on the image and describe how it should change.",
  group: "magic",
  model: "google/nano-banana-pro/edit",
  inputs: {
    image: imageInput({ source: "runtime" }),
    pin: pinInput({ source: "user", label: "Where on the image?" }),
    instruction: textInput({
      source: "user",
      label: "Describe the change",
      maxLength: 300,
      placeholder: "e.g. remove the price tag",
    }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, pin, instruction }) => {
    const yLabel = pin.y < 0.33 ? "upper" : pin.y < 0.66 ? "middle" : "lower";
    const xLabel = pin.x < 0.33 ? "left" : pin.x < 0.66 ? "center" : "right";
    return {
      input: {
        prompt: `Edit the ${yLabel}-${xLabel} area of this image: ${instruction}. Photoreal product photography, preserve the rest of the image, true colors and lighting.`,
        image_urls: [image],
      },
    };
  },
  extractOutput: extractImage,
});

export const aiScene = defineTool({
  id: "ai-scene",
  name: "Drop into a new scene",
  description: "Place the subject anywhere — describe the environment.",
  group: "magic",
  model: "google/nano-banana-pro/edit",
  inputs: {
    image: imageInput({ source: "runtime" }),
    prompt: textInput({
      source: "user",
      label: "Describe the scene",
      placeholder: "e.g. golden-hour Mediterranean rooftop with soft warm light",
      maxLength: 400,
      multiline: true,
    }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, prompt }) => ({
    input: {
      prompt: `Place the subject of this image ${prompt || "in a clean editorial scene"}. Photoreal product photography, the subject is the hero, natural lighting, true colors preserved.`,
      image_urls: [image],
    },
  }),
  extractOutput: extractImage,
});

export const referenceInpaint = defineTool({
  id: "reference-inpaint",
  name: "Restyle with a reference",
  description: "Brush an area, drop a reference image, swap the look in place.",
  group: "magic",
  model: "runflow/reference-inpaint",
  inputs: {
    image: imageInput({ source: "runtime" }),
    mask: maskInput({ source: "user", label: "Brush the area to restyle" }),
    reference: referenceInput({ source: "user", label: "Reference image", accept: "image/*" }),
    prompt: textInput({
      source: "user",
      label: "Optional steering text",
      optional: true,
      placeholder: "leave blank for reference-only",
    }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, mask, reference, prompt }) => ({
    input: {
      image_url: image,
      mask_url: mask,
      reference_url: reference,
      ...(prompt ? { prompt } : {}),
    },
  }),
  extractOutput: extractImage,
});

// ── Compose ────────────────────────────────────────────────────────────

export const productIsolation = defineTool({
  id: "product-isolation",
  name: "Cut out on white",
  description: "Generate a clean catalog composition on white.",
  group: "compose",
  model: "runflow/product-isolation",
  inputs: {
    image: imageInput({ source: "runtime" }),
    aspect_ratio: selectInput({
      source: "user",
      label: "Aspect ratio",
      default: "1:1",
      options: RATIO_OPTIONS,
    }),
    resolution: selectInput({
      source: "user",
      label: "Resolution",
      default: "2K",
      options: RESOLUTION_OPTIONS,
    }),
    prompt: textInput({
      source: "user",
      label: "What to isolate?",
      placeholder: "e.g. the cream sweater on the left",
      optional: true,
    }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, aspect_ratio, resolution, prompt }) => ({
    input: {
      image_url: image,
      aspect_ratio,
      resolution,
      ...(prompt ? { prompt } : {}),
    },
  }),
  extractOutput: extractImage,
});

export const smartResize = defineTool({
  id: "smart-resize",
  name: "Smart resize",
  description: "Recompose to any ratio — model handles the layout.",
  group: "compose",
  model: "runflow/smart-resize",
  inputs: {
    image: imageInput({ source: "runtime" }),
    aspect_ratio: selectInput({
      source: "user",
      label: "Aspect ratio",
      default: "1:1",
      options: RATIO_OPTIONS,
    }),
    resolution: selectInput({
      source: "user",
      label: "Resolution",
      default: "2K",
      options: RESOLUTION_OPTIONS,
    }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, aspect_ratio, resolution }) => ({
    input: { image_url: image, aspect_ratio, resolution },
  }),
  extractOutput: extractImage,
});

const OUTPAINT_RATIO_OPTIONS = [
  { value: "4:5", label: "4:5 — feed" },
  { value: "9:16", label: "9:16 — stories" },
  { value: "16:9", label: "16:9 — banner" },
  { value: "21:9", label: "21:9 — cinematic" },
] as const;

export const outpaint = defineTool({
  id: "outpaint",
  name: "Reframe to a new ratio",
  description: "Extend the canvas — keeps the subject, adds new background.",
  group: "compose",
  model: "runflow/outpaint",
  inputs: {
    image: imageInput({ source: "runtime" }),
    aspect_ratio: selectInput({
      source: "user",
      label: "Target ratio",
      default: "9:16",
      options: OUTPAINT_RATIO_OPTIONS,
    }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, aspect_ratio }) => {
    const map: Record<string, { top: number; bottom: number; left: number; right: number }> = {
      "4:5": { top: 13, bottom: 12, left: 0, right: 0 },
      "9:16": { top: 39, bottom: 39, left: 0, right: 0 },
      "16:9": { top: 0, bottom: 0, left: 39, right: 39 },
      "21:9": { top: 0, bottom: 0, left: 67, right: 66 },
    };
    const e = map[aspect_ratio] ?? map["9:16"];
    if (!e) throw new Error(`Unknown ratio ${aspect_ratio}`);
    return {
      input: {
        image_url: image,
        expand_top: e.top,
        expand_bottom: e.bottom,
        expand_left: e.left,
        expand_right: e.right,
      },
    };
  },
  extractOutput: extractImage,
});

// ── Cleanup ────────────────────────────────────────────────────────────

export const backgroundColor = defineTool({
  id: "background-color",
  name: "Solid background",
  description: "Swap the backdrop for a flat color of your choice.",
  group: "cleanup",
  model: "runflow/background-color",
  inputs: {
    image: imageInput({ source: "runtime" }),
    color: colorInput({
      source: "user",
      label: "Backdrop color",
      default: "#FFFFFF",
      help: "Pure white (#FFFFFF) is the marketplace default.",
    }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, color }) => {
    const { r, g, b } = hex2rgb(color);
    return { input: { image_url: image, color_red: r, color_green: g, color_blue: b } };
  },
  extractOutput: extractImage,
});

export const backgroundRemoval = defineTool({
  id: "background-removal",
  name: "Cut out (transparent)",
  description: "Lift the subject onto transparency.",
  group: "cleanup",
  model: "runflow/background-removal",
  inputs: {
    image: imageInput({ source: "runtime" }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image }) => ({ input: { image_url: image } }),
  extractOutput: extractImage,
});

export const tagRemoval = defineTool({
  id: "tag-removal",
  name: "Remove price tags",
  description: "Erase tags, hangtags, swing tickets and barcodes.",
  group: "cleanup",
  model: "runflow/tag-removal",
  inputs: {
    image: imageInput({ source: "runtime" }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image }) => ({ input: { image_url: image } }),
  extractOutput: extractImage,
});

export const objectRemoval = defineTool({
  id: "object-removal",
  name: "Erase something",
  description: "Describe what to remove — flux-fill rebuilds the background.",
  group: "cleanup",
  model: "runflow/object-removal/prompt",
  inputs: {
    image: imageInput({ source: "runtime" }),
    prompt: textInput({
      source: "user",
      label: "What should we remove?",
      placeholder: "e.g. the price tag",
      maxLength: 80,
      help: "Keep it short — up to about 7 words works best.",
    }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, prompt }) => ({ input: { image_url: image, prompt } }),
  extractOutput: extractImage,
});

export const modelRemoval = defineTool({
  id: "model-removal",
  name: "Remove the model",
  description: "Take the person out of the shot, keep the garment intact.",
  group: "cleanup",
  model: "runflow/model-removal",
  inputs: {
    image: imageInput({ source: "runtime" }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image }) => ({ input: { image_url: image } }),
  extractOutput: extractImage,
  applicableHint: (tags) =>
    tags.includes("on-model") ? { ok: true } : { ok: false, reason: "Best on on-model shots" },
});

export const skinFix = defineTool({
  id: "skin-fix",
  name: "Polish skin",
  description: "Even out tones on on-model shots, preserve identity.",
  group: "cleanup",
  model: "runflow/skin-fix",
  inputs: {
    image: imageInput({ source: "runtime" }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image }) => ({ input: { image_url: image } }),
  extractOutput: extractImage,
  applicableHint: (tags) =>
    tags.includes("on-model") ? { ok: true } : { ok: false, reason: "Best on on-model shots" },
});

// ── Enhance ────────────────────────────────────────────────────────────

export const topazUpscale = defineTool({
  id: "topaz-upscale",
  name: "Upscale",
  description: "Boost resolution and detail — 2× or 4× sharper.",
  group: "enhance",
  model: "topaz/upscale/image",
  inputs: {
    image: imageInput({ source: "runtime" }),
    model: selectInput({
      source: "user",
      label: "Model",
      default: "Standard V2",
      options: [
        { value: "Standard V2", label: "Standard V2 — balanced default" },
        { value: "High Fidelity V2", label: "High Fidelity V2 — sharp, well-exposed" },
        { value: "Low Resolution V2", label: "Low Resolution V2 — small / web sources" },
        { value: "CGI", label: "CGI — renders & 3D art" },
        { value: "Recovery V2", label: "Recovery V2 — damaged or noisy" },
      ],
    }),
    upscale_factor: selectInput({
      source: "user",
      label: "Upscale factor",
      default: "2",
      options: [
        { value: "2", label: "2× — double resolution" },
        { value: "4", label: "4× — print-ready detail" },
      ],
    }),
    face_enhancement: selectInput({
      source: "user",
      label: "Face enhancement",
      default: "off",
      options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On — refine faces" },
      ],
    }),
    output_format: textInput({ source: "preset", value: "png" }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, model, upscale_factor, face_enhancement, output_format }) => {
    const faceOn = face_enhancement === "on";
    return {
      input: {
        image_url: image,
        model,
        upscale_factor: Number.parseFloat(upscale_factor),
        output_format,
        ...(faceOn
          ? {
              face_enhancement: true,
              face_enhancement_strength: 0.8,
              face_enhancement_creativity: 0.1,
            }
          : {}),
      },
    };
  },
  extractOutput: extractImage,
});

// ── Catalogue ──────────────────────────────────────────────────────────

/** Every built-in tool, in display order. */
// biome-ignore lint/suspicious/noExplicitAny: existential — heterogeneous array of specific tools.
export const BUILTIN_TOOLS: ReadonlyArray<ToolDef<any, any>> = [
  // magic
  aiEdit,
  aiScene,
  referenceInpaint,
  // compose
  productIsolation,
  smartResize,
  outpaint,
  // cleanup
  backgroundColor,
  backgroundRemoval,
  tagRemoval,
  objectRemoval,
  modelRemoval,
  skinFix,
  // enhance
  topazUpscale,
];

/** Look up a tool by id. */
export function findTool(id: string): (typeof BUILTIN_TOOLS)[number] | undefined {
  return BUILTIN_TOOLS.find((t) => t.id === id);
}
