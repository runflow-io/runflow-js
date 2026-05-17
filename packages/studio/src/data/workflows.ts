// Single source of truth for the workflow cards in the Runflow
// Studio. Each entry declares its API model, input shape, and the
// "kind" — which dictates how StudioCanvas + the dispatcher behave:
//
//   simple      → just sends image_url (+ any pre-baked params).
//   prompt      → user types a prompt; sent to nano-banana-edit.
//   prompt-zip  → user types a short instruction; source image is
//                 uploaded and sent as image_url + prompt (e.g.
//                 runflow/object-removal/prompt — flux fill that
//                 rebuilds the background from text alone).
//   pin         → user clicks a spot on the image; pin region added
//                 to the prompt for nano-banana-edit.
//   mask-only   → user paints a brush mask; photo + mask uploaded
//                 separately, sent as image_url + mask_url to a
//                 runflow/object-removal-style model.
//   mask-ref    → user paints a brush mask AND uploads a reference;
//                 all three uploaded separately, sent as image_url +
//                 mask_url + reference_url to runflow/reference-inpaint.
//   prompt-ref  → user uploads a reference image (e.g. a logo) and
//                 types a short instruction. Photo + reference uploaded
//                 separately, sent with a workflow-defined body shape
//                 (logo-fix uses file_input + logo_file_input + prompt).
//                 Dispatched against the dev proxy until the model
//                 graduates to the canonical /v1/models pattern.
//   package     → marketplace-bundle preset: an ordered chain of
//                 existing simple/prompt workflows that produces ONE
//                 final image. No runflowId of its own; the dispatcher
//                 walks `package.steps` head-to-tail. The chain is
//                 surfaced to the user as an editable list before
//                 Apply (reorder + delete). See `package` field.
//   custom      → workflow handles its own dispatch (none today).
//
// All model IDs are allowlisted in projects/demos/lib/allowlist.mjs.

export type WorkflowKind =
  | "simple"
  | "prompt"
  | "prompt-zip"
  | "pin"
  | "mask-only"
  | "mask-ref"
  | "prompt-ref"
  | "package"
  | "soon";

export type WorkflowGroup = "magic" | "compose" | "cleanup" | "enhance" | "package" | "soon";

export type WorkflowInput =
  | { type: "color"; key: string; label: string; default?: string; help?: string }
  | { type: "text"; key: string; label: string; placeholder?: string; maxlength?: number; help?: string; optional?: boolean }
  | { type: "textarea"; key: string; label: string; placeholder?: string; maxlength?: number; help?: string }
  | {
      type: "select";
      key: string;
      label: string;
      default?: string;
      options: { value: string; label: string }[];
      help?: string;
    };

// One step inside a package's chain. References an existing
// single-output workflow id and the params to bake in. Steps run
// head-to-tail: each step's output URL becomes the next step's input.
export type PackageRecipeStep = {
  workflowId: string;
  params: Record<string, string>;
  /** Short user-facing label for the step row in the action panel,
   * e.g. "Remove tag", "Apply Zalando grey", "Upscale 2×". */
  label: string;
};

/** A fan-out variant in an omnichannel-style package. Each variant
 * runs its own mini-chain (typically smart-resize + upscale) from the
 * package's prep output. The variant's LAST step is the Sentinel-scored
 * final output that becomes its own version on the active asset. */
export type PackageVariant = {
  /** Stable id used for the version label and zip filenames. */
  id: string;
  /** Channel-name label that leads in the UI, e.g. "Amazon main", "Stories / TikTok". */
  label: string;
  /** Aspect-ratio chip shown next to the label, e.g. "1:1", "9:16". */
  ratio: string;
  /** Default-on state — the user can opt out per run before Apply. */
  defaultEnabled?: boolean;
  /** Mini-chain head-to-tail; last step's output is the Sentinel-scored final. */
  steps: PackageRecipeStep[];
};

/** Optional gating input on a package. Rendered as a top section of
 * the action panel with chip-style quick picks and a custom textarea.
 * Until the user picks or types a value, Apply is disabled. At
 * dispatch time, the chosen value is injected into the prep step whose
 * workflowId matches `injectAt.workflowIdMatch` (first match), under
 * `injectAt.paramKey`. This is how Campaign pack collapses the
 * cleanup-scene-channels chain into a single Apply: the user picks one
 * scene direction and the pipeline runs end-to-end. */
export type PackageCreativeDirection = {
  /** Section title shown above the picker, e.g. "Pick a creative direction". */
  label: string;
  /** Short helper line under the title. */
  description?: string;
  /** Placeholder for the custom textarea. */
  placeholder?: string;
  /** Chip-style quick picks. The `prompt` value gets injected into the
   * target step verbatim when the chip is selected. */
  quickPicks: Array<{ id: string; label: string; prompt: string }>;
  /** Which prep step receives the chosen value and under which param key. */
  injectAt: { workflowIdMatch: string; paramKey: string };
};

export type Workflow = {
  id: string;
  name: string;
  desc: string;
  group: WorkflowGroup;
  kind: WorkflowKind;
  runflowId?: string;
  inputs?: WorkflowInput[];
  // Static body fields baked in (e.g. preset prompts for nano-banana variants).
  staticBody?: (imageUrl: string, vals: Record<string, string>) => Record<string, unknown>;
  applicableHint?: (tags: string[]) => { ok: boolean; reason?: string };
  /** Only set when kind === "package". Three shapes:
   *  - Single-output (e.g. zalando-package): only `prep` is declared. All
   *    prep steps run head-to-tail; the last produces the final image.
   *  - Fan-out (e.g. omnichannel-pack): `prep` runs once, then every
   *    enabled `variant` runs its own mini-chain in parallel from the
   *    prep output. Each variant lands as its own Sentinel-scored
   *    version on the active asset.
   *  - Gated fan-out (e.g. campaign-pack): same as fan-out, but a
   *    `creativeDirection` picker sits at the top of the action panel
   *    and feeds its chosen value into a designated prep step at
   *    dispatch time. Apply is disabled until the user picks or types.
   *  The action panel renders the creative-direction picker (if any),
   *  then prep as a reorderable step list, then variants as a checkbox
   *  grid. Per-run edits don't mutate the workflow definition. */
  package?: {
    prep: PackageRecipeStep[];
    variants?: PackageVariant[];
    creativeDirection?: PackageCreativeDirection;
  };
};

const hex2rgb = (hex: string) => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

export const WORKFLOWS: Workflow[] = [
  // ===== Magic (the headline AI edits) =====
  {
    id: "ai-edit",
    name: "Pinpoint a change",
    desc: "Click any spot on the image and describe how it should change",
    group: "magic",
    kind: "pin",
    runflowId: "google/nano-banana-pro/edit",
  },
  {
    id: "reference-inpaint",
    name: "Restyle with a reference",
    desc: "Brush an area, drop a reference image, swap the look in place",
    group: "magic",
    kind: "mask-ref",
    runflowId: "runflow/reference-inpaint",
  },
  {
    // Logo placement model — currently behind ngrok at
    // /api/v1/logo-fix, routed via the runflow-dev proxy. The body
    // shape is workflow-specific (file_input / logo_file_input /
    // prompt / resolution / vlm_assist), so we don't go through the
    // shared input{} wrapper; runflow.ts builds it explicitly in the
    // prompt-ref branch.
    id: "logo-fix",
    name: "Add a logo",
    desc: "Drop in a brand logo with a short placement instruction",
    group: "magic",
    kind: "prompt-ref",
    runflowId: "logo-fix",
    inputs: [
      {
        type: "text",
        key: "prompt",
        label: "Where + how",
        placeholder: "e.g. Small embroidery logo above the pocket",
        maxlength: 200,
      },
      {
        type: "select",
        key: "resolution",
        label: "Resolution",
        default: "1K",
        options: [
          { value: "1K", label: "1K — fast preview" },
          { value: "2K", label: "2K — balanced" },
        ],
        help: "1K is faster; 2K is sharper.",
      },
    ],
  },
  {
    id: "ai-scene",
    name: "Drop into a new scene",
    desc: "Place the subject anywhere — describe the environment",
    group: "magic",
    kind: "prompt",
    runflowId: "google/nano-banana-pro/edit",
    inputs: [
      {
        type: "textarea",
        key: "prompt",
        label: "Describe the scene",
        placeholder: "e.g. golden-hour Mediterranean rooftop with soft warm light",
        maxlength: 400,
      },
    ],
    staticBody: (img, vals) => ({
      input: {
        prompt: `Place the subject of this image ${vals.prompt || "in a clean editorial scene"}. Photoreal product photography, the subject is the hero, natural lighting, true colors preserved.`,
        image_urls: [img],
      },
    }),
  },

  // ===== Compose (generative composition) =====
  {
    id: "product-isolation",
    name: "Cut out on white",
    desc: "Generate a clean catalog composition on white",
    group: "compose",
    kind: "simple",
    runflowId: "runflow/product-isolation",
    inputs: [
      {
        type: "select",
        key: "aspect_ratio",
        label: "Aspect ratio",
        default: "1:1",
        options: [
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
        ],
      },
      {
        type: "select",
        key: "resolution",
        label: "Resolution",
        default: "2K",
        options: [
          { value: "1K", label: "1K — fast preview" },
          { value: "2K", label: "2K — balanced (recommended)" },
          { value: "4K", label: "4K — print-ready" },
        ],
        help: "Higher resolutions take longer to generate.",
      },
      {
        type: "text",
        key: "prompt",
        label: "What to isolate?",
        placeholder: "e.g. the cream sweater on the left",
        maxlength: 200,
        optional: true,
        help: "Optional. Helps when several items are in frame.",
      },
    ],
    staticBody: (img, vals) => ({
      input: {
        image_url: img,
        aspect_ratio: vals.aspect_ratio || "1:1",
        resolution: vals.resolution || "2K",
        ...(vals.prompt ? { prompt: vals.prompt } : {}),
      },
    }),
  },
  {
    id: "smart-resize",
    name: "Smart resize",
    desc: "Recompose to any ratio at 1K / 2K / 4K — model handles the layout",
    group: "compose",
    kind: "simple",
    runflowId: "runflow/smart-resize",
    inputs: [
      {
        type: "select",
        key: "aspect_ratio",
        label: "Aspect ratio",
        default: "1:1",
        options: [
          { value: "1:1", label: "1:1 — square" },
          { value: "4:5", label: "4:5 — portrait feed" },
          { value: "3:4", label: "3:4 — portrait" },
          { value: "2:3", label: "2:3 — portrait tall" },
          { value: "9:16", label: "9:16 — stories" },
          // 25:36 ≈ 1:1.44, the Zalando catalogue ratio. Lives in the
          // generic ratio menu so any workflow can reach it, not just
          // the package recipes.
          { value: "25:36", label: "25:36 — Zalando (1:1.44)" },
          { value: "5:4", label: "5:4 — landscape" },
          { value: "4:3", label: "4:3 — landscape" },
          { value: "3:2", label: "3:2 — landscape wide" },
          { value: "16:9", label: "16:9 — banner" },
          { value: "21:9", label: "21:9 — cinematic" },
        ],
      },
      {
        type: "select",
        key: "resolution",
        label: "Resolution",
        default: "2K",
        options: [
          { value: "1K", label: "1K — fast preview" },
          { value: "2K", label: "2K — balanced (recommended)" },
          { value: "4K", label: "4K — print-ready" },
        ],
        help: "Higher resolutions take longer to generate.",
      },
    ],
    staticBody: (img, vals) => ({
      input: {
        image_url: img,
        aspect_ratio: vals.aspect_ratio || "1:1",
        resolution: vals.resolution || "2K",
      },
    }),
  },
  {
    id: "outpaint",
    name: "Reframe to a new ratio",
    desc: "Extend the canvas — keeps the subject, adds new background",
    group: "compose",
    kind: "simple",
    runflowId: "runflow/outpaint",
    inputs: [
      {
        type: "select",
        key: "aspect_ratio",
        label: "Target ratio",
        default: "9:16",
        options: [
          { value: "4:5", label: "4:5 — feed" },
          { value: "9:16", label: "9:16 — stories" },
          { value: "16:9", label: "16:9 — banner" },
          { value: "21:9", label: "21:9 — cinematic" },
        ],
      },
    ],
    staticBody: (img, vals) => {
      const ar = vals.aspect_ratio || "9:16";
      const map: Record<string, { top: number; bottom: number; left: number; right: number }> = {
        "4:5": { top: 13, bottom: 12, left: 0, right: 0 },
        "9:16": { top: 39, bottom: 39, left: 0, right: 0 },
        "16:9": { top: 0, bottom: 0, left: 39, right: 39 },
        "21:9": { top: 0, bottom: 0, left: 67, right: 66 },
      };
      const e = map[ar] || map["9:16"];
      return {
        input: {
          image_url: img,
          expand_top: e.top,
          expand_bottom: e.bottom,
          expand_left: e.left,
          expand_right: e.right,
        },
      };
    },
  },

  // ===== Cleanup (pixel-preserving edits) =====
  {
    id: "background-color",
    name: "Solid background",
    desc: "Swap the backdrop for a flat color of your choice",
    group: "cleanup",
    kind: "simple",
    runflowId: "runflow/background-color",
    inputs: [
      {
        type: "color",
        key: "color",
        label: "Backdrop color",
        default: "#FFFFFF",
        help: "Pure white (#FFFFFF) is the marketplace default.",
      },
    ],
    staticBody: (img, vals) => {
      const { r, g, b } = hex2rgb(vals.color || "#FFFFFF");
      return { input: { image_url: img, color_red: r, color_green: g, color_blue: b } };
    },
  },
  {
    id: "background-removal",
    name: "Cut out (transparent)",
    desc: "Lift the subject onto transparency, ready to drop anywhere",
    group: "cleanup",
    kind: "simple",
    runflowId: "runflow/background-removal",
    staticBody: (img) => ({ input: { image_url: img } }),
  },
  {
    id: "tag-removal",
    name: "Remove price tags",
    desc: "Erase tags, hangtags, swing tickets and barcodes",
    group: "cleanup",
    kind: "simple",
    runflowId: "runflow/tag-removal",
    staticBody: (img) => ({ input: { image_url: img } }),
  },
  {
    // Prompt-driven flux-fill: the user types a short instruction
    // ("remove the sticker", "erase the model's watch") and the
    // model rebuilds the background without needing a brush mask.
    // Dispatcher uploads the source image and posts image_url +
    // prompt — see kind "prompt-zip".
    id: "object-removal",
    name: "Erase something",
    desc: "Describe what to remove — flux-fill rebuilds the background",
    group: "cleanup",
    kind: "prompt-zip",
    runflowId: "runflow/object-removal/prompt",
    inputs: [
      {
        type: "text",
        key: "prompt",
        label: "What should we remove?",
        placeholder: "e.g. the price tag",
        maxlength: 80,
        help: "Keep it short — up to about 7 words works best.",
      },
    ],
  },
  {
    id: "model-removal",
    name: "Remove the model",
    desc: "Take the person out of the shot, keep the garment intact",
    group: "cleanup",
    kind: "simple",
    runflowId: "runflow/model-removal",
    staticBody: (img) => ({ input: { image_url: img } }),
    applicableHint: (tags) =>
      tags.includes("on-model") ? { ok: true } : { ok: false, reason: "Best on on-model shots" },
  },
  {
    id: "skin-fix",
    name: "Polish skin",
    desc: "Even out tones on on-model shots, preserve identity",
    group: "cleanup",
    kind: "simple",
    runflowId: "runflow/skin-fix",
    staticBody: (img) => ({ input: { image_url: img } }),
    applicableHint: (tags) =>
      tags.includes("on-model") ? { ok: true } : { ok: false, reason: "Best on on-model shots" },
  },

  // ===== Enhance (boost detail / resolution) =====
  {
    // Internal id stays "topaz-upscale" to avoid breaking saved
    // recipes / packages / version history that reference it.
    // The user never sees the id — just the name + desc.
    id: "topaz-upscale",
    name: "Upscale",
    desc: "Boost resolution and detail — 2× or 4× sharper",
    group: "enhance",
    kind: "simple",
    runflowId: "topaz/upscale/image",
    inputs: [
      {
        type: "select",
        key: "model",
        label: "Model",
        default: "Standard V2",
        options: [
          { value: "Standard V2", label: "Standard V2 — balanced default" },
          { value: "High Fidelity V2", label: "High Fidelity V2 — sharp, well-exposed" },
          { value: "Low Resolution V2", label: "Low Resolution V2 — small / web sources" },
          { value: "CGI", label: "CGI — renders & 3D art" },
          { value: "Recovery V2", label: "Recovery V2 — damaged or noisy" },
        ],
        help: "Match the source: photos, renders, and damaged inputs use different models.",
      },
      {
        type: "select",
        key: "upscale_factor",
        label: "Upscale factor",
        default: "2",
        options: [
          { value: "2", label: "2× — double resolution" },
          { value: "4", label: "4× — print-ready detail" },
        ],
        help: "Source must stay under 24 MP after upscaling.",
      },
      {
        type: "select",
        key: "face_enhancement",
        label: "Face enhancement",
        default: "off",
        options: [
          { value: "off", label: "Off" },
          { value: "on", label: "On — refine faces" },
        ],
        help: "Improves portraits; harmless on non-portrait sources.",
      },
    ],
    staticBody: (img, vals) => {
      const faceOn = vals.face_enhancement === "on";
      return {
        input: {
          image_url: img,
          model: vals.model || "Standard V2",
          upscale_factor: parseFloat(vals.upscale_factor || "2"),
          output_format: "png",
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
  },

  // ===== Packages (marketplace bundles) =====
  // A package is a preset chain of operations that produces marketplace-
  // ready output(s) from a source. Two shapes:
  //
  //  - Single-output (zalando-package): only `prep` declared. The
  //    dispatcher walks prep head-to-tail; intermediate steps run with
  //    intermediate=true (Sentinel skipped/gated by user setting), the
  //    final prep step runs Sentinel as usual and becomes one new
  //    version on the active asset.
  //
  //  - Fan-out (omnichannel-pack): `prep` runs once, then every enabled
  //    variant's mini-chain runs from the prep output. Each variant's
  //    last step is Sentinel-scored and lands as its own version on
  //    the active asset.
  //
  // The action panel renders prep as a reorderable list with delete
  // affordances and variants as a checkbox grid, so the user can
  // deviate from the preset per run (skip the upscale, drop a
  // channel) without mutating the workflow definition.
  {
    id: "zalando-package",
    name: "Zalando bundle",
    desc: "One Zalando-ready image: tag removal → mannequin removal → grey backdrop",
    group: "package",
    kind: "package",
    package: {
      // The default chain. The user can reorder or remove any of these
      // before clicking Apply; their edits are per-run and don't change
      // this baseline.
      //
      // Step rationale:
      //   1. tag-removal       — strip the $29 hangtag if present (no-op
      //                          when there isn't one).
      //   2. model-removal     — drop the mannequin/model so we have a
      //                          standalone garment packshot.
      //   3. background-color  — enforce Zalando's model-view grey
      //                          (#F1F1F1 / RGB 241,241,241) per Partner
      //                          University spec.
      //
      // Upscale used to be step 4 but was dropped: smart-resize and
      // the underlying models already produce 2K outputs, so the extra
      // Topaz pass cost time without changing the final quality on
      // typical Zalando-bound deliverables.
      prep: [
        { workflowId: "tag-removal", params: {}, label: "Remove price tag" },
        { workflowId: "model-removal", params: {}, label: "Remove the mannequin" },
        { workflowId: "background-color", params: { color: "#F1F1F1" }, label: "Apply Zalando grey" },
      ],
    },
  },
  {
    // Fan-out package: one source becomes five channel-ready assets.
    // Prep cleans the image once (tag + model + white), then each
    // enabled variant smart-resizes to its channel ratio and upscales
    // 2× in parallel. Every variant lands as a separate Sentinel-
    // scored version so the user can compare and download them
    // individually. Designed for e-com sellers shipping the same SKU
    // across Amazon, Instagram, TikTok, Meta ads, and a homepage hero.
    id: "omnichannel-pack",
    name: "Omnichannel pack",
    desc: "One shot, five channel-ready assets — Amazon, Instagram, Stories/TikTok, paid ads, and your homepage banner",
    group: "package",
    kind: "package",
    package: {
      // Prep — runs once before any variant. Drives:
      //   - tag-removal       → strip retail hangtags (no-op if absent)
      //   - product-isolation → cut the product out onto a clean comp,
      //                         with a short prompt steering focus (this
      //                         is the demo asset's hero — the shoe).
      //                         Replaces the older model-removal step
      //                         because product-isolation does the
      //                         "drop the person, keep the product"
      //                         job in one shot AND outputs a clean
      //                         catalog composition.
      //   - background-color  → enforce Amazon's pure-white spec
      //                         (#FFFFFF). Defensive even after
      //                         isolation (model output isn't always
      //                         pure white).
      prep: [
        { workflowId: "tag-removal", params: {}, label: "Remove price tag" },
        {
          workflowId: "product-isolation",
          params: { prompt: "the sneaker" },
          label: "Isolate the shoe",
        },
        { workflowId: "background-color", params: { color: "#FFFFFF" }, label: "Apply white backdrop" },
      ],
      // Variants — each runs a smart-resize to its channel ratio from
      // the prep output. No upscaler in v1: smart-resize already
      // returns 2K and we're keeping the chain short while the model
      // composition behavior is being tuned. Channel names lead in
      // the UI, ratio is a small chip. Defaults to all-on so the demo
      // shows 5 outputs by default; users can opt out per run.
      variants: [
        {
          id: "amazon-main",
          label: "Amazon main",
          ratio: "1:1",
          defaultEnabled: true,
          steps: [
            { workflowId: "smart-resize", params: { aspect_ratio: "1:1", resolution: "2K" }, label: "Smart-resize 1:1 (2K)" },
          ],
        },
        {
          id: "ig-feed",
          label: "Instagram feed",
          ratio: "4:5",
          defaultEnabled: true,
          steps: [
            { workflowId: "smart-resize", params: { aspect_ratio: "4:5", resolution: "2K" }, label: "Smart-resize 4:5 (2K)" },
          ],
        },
        {
          id: "stories-tiktok",
          label: "Stories / TikTok",
          ratio: "9:16",
          defaultEnabled: true,
          steps: [
            { workflowId: "smart-resize", params: { aspect_ratio: "9:16", resolution: "2K" }, label: "Smart-resize 9:16 (2K)" },
          ],
        },
        {
          id: "banner",
          label: "Homepage banner",
          ratio: "16:9",
          defaultEnabled: true,
          steps: [
            { workflowId: "smart-resize", params: { aspect_ratio: "16:9", resolution: "2K" }, label: "Smart-resize 16:9 (2K)" },
          ],
        },
      ],
    },
  },
  {
    // Fan-out package: one clean product shot becomes a small set of
    // PDP-ready lifestyle scenes (shoe in action). Prep mirrors
    // omnichannel-pack so the package works on raw uploads too: strip
    // hangtags, isolate the shoe, lay it on white. Every enabled
    // variant then runs ai-scene with a hand-tuned scene prompt, in
    // parallel, off the prep output. Each lands as its own Sentinel-
    // scored version. Designed to sit just before omnichannel-pack in
    // the creative pipeline: clean shot → lifestyle scenes → channel-
    // ready assets.
    id: "lifestyle-pack",
    name: "Lifestyle pack",
    desc: "Drop the product into a set of PDP-ready scenes: street, track, gym, cafe, trail",
    group: "package",
    kind: "package",
    package: {
      // Prep — runs once before any variant. Same trio as
      // omnichannel-pack so a messy on-foot shot lands as a clean
      // catalog comp before we send it into a scene.
      prep: [
        { workflowId: "tag-removal", params: {}, label: "Remove price tag" },
        {
          workflowId: "product-isolation",
          params: { prompt: "the sneaker" },
          label: "Isolate the shoe",
        },
        { workflowId: "background-color", params: { color: "#FFFFFF" }, label: "Apply white backdrop" },
      ],
      // Variants — each is one ai-scene call with a scene-only prompt.
      // ai-scene's staticBody wraps the text into "Place the subject
      // of this image ${prompt}. Photoreal product photography...", so
      // these prompts START with a preposition (in / on) and describe
      // the environment only. No "place the subject" wrapper here.
      //
      // Ratio chips reflect the natural composition of the scene
      // (portrait for vertical PDP heroes, landscape for wide editorial
      // crops). ai-scene doesn't take a ratio param, so the chip is
      // purely a UI hint — the model generates whatever ratio it
      // wants. Defaults to all-on so the demo lights up 5 scenes.
      variants: [
        {
          id: "urban-street",
          label: "Urban street",
          ratio: "4:5",
          defaultEnabled: true,
          steps: [
            {
              workflowId: "ai-scene",
              params: {
                prompt:
                  "on a sun-warmed cobblestone street at golden hour, mid-stride pose, low three-quarter angle, soft long shadows, blurred city backdrop, editorial photoreal product photography, true colors and materials preserved",
              },
              label: "Drop into urban street scene",
            },
          ],
        },
        {
          id: "running-track",
          label: "Running track",
          ratio: "4:5",
          defaultEnabled: true,
          steps: [
            {
              workflowId: "ai-scene",
              params: {
                prompt:
                  "on a red rubber running track at sunrise, mid-stride with a hint of motion blur on the lane lines, low dramatic side light, crisp morning air, editorial photoreal product photography, true colors and materials preserved",
              },
              label: "Drop onto a sunrise running track",
            },
          ],
        },
        {
          id: "gym-floor",
          label: "Gym floor",
          ratio: "1:1",
          defaultEnabled: true,
          steps: [
            {
              workflowId: "ai-scene",
              params: {
                prompt:
                  "on a polished concrete gym floor next to a black rubber kettlebell and the corner of a charcoal yoga mat, soft window light from camera-left, modern minimal training space, editorial photoreal product photography, true colors and materials preserved",
              },
              label: "Drop into a modern gym",
            },
          ],
        },
        {
          id: "cafe-table",
          label: "Cafe table",
          ratio: "4:5",
          defaultEnabled: true,
          steps: [
            {
              workflowId: "ai-scene",
              params: {
                prompt:
                  "resting on a warm oak cafe table next to a flat white in a ceramic cup and a folded linen napkin, soft window light, shallow depth of field with a blurred bistro background, editorial photoreal lifestyle product photography, true colors and materials preserved",
              },
              label: "Drop onto a cafe table",
            },
          ],
        },
        {
          id: "forest-trail",
          label: "Forest trail",
          ratio: "16:9",
          defaultEnabled: true,
          steps: [
            {
              workflowId: "ai-scene",
              params: {
                prompt:
                  "on a damp forest trail covered in fallen leaves and pine needles, dappled morning light through tall trees, faint mist in the background, low angle close to the ground, editorial photoreal product photography, true colors and materials preserved",
              },
              label: "Drop onto a forest trail",
            },
          ],
        },
      ],
    },
  },
  {
    // Full creative pipeline in one Apply. The user picks a single
    // creative direction up front (chip or custom text), then the
    // package walks: cleanup prep → drop into the chosen scene →
    // fan out to four channel ratios. Replaces the two-click flow
    // (Lifestyle pack → pick → Omnichannel pack) with a one-shot.
    //
    // Lifestyle pack still exists for the "show me my options" mode
    // where the user wants to see five scenes side-by-side and pick
    // visually. Campaign pack is for when the direction is decided
    // and the goal is ad-ready outputs.
    id: "campaign-pack",
    name: "Campaign pack",
    desc: "Pick a creative direction, get four channel-ready ads in one flow",
    group: "package",
    kind: "package",
    package: {
      // Creative direction picker sits at the top of the action panel.
      // Chip quick-picks mirror the Lifestyle pack scene library so a
      // user who tried Lifestyle pack first sees the same options.
      // Custom text lets them deviate from the presets.
      //
      // The injectAt config wires the chosen prompt into the prep
      // step matching ai-scene under the `prompt` param key at
      // dispatch time, so the workflow definition itself stays
      // stateless.
      creativeDirection: {
        label: "Pick a creative direction",
        description:
          "Choose a vibe or write your own. The product gets cleaned, dropped into the scene, then sized for each channel.",
        placeholder:
          "e.g. on a windswept rooftop at golden hour, low angle, blurred city skyline",
        quickPicks: [
          {
            id: "urban-street",
            label: "Urban street",
            prompt:
              "on a sun-warmed cobblestone street at golden hour, mid-stride pose, low three-quarter angle, soft long shadows, blurred city backdrop, editorial photoreal product photography, true colors and materials preserved",
          },
          {
            id: "running-track",
            label: "Running track",
            prompt:
              "on a red rubber running track at sunrise, mid-stride with a hint of motion blur on the lane lines, low dramatic side light, crisp morning air, editorial photoreal product photography, true colors and materials preserved",
          },
          {
            id: "gym-floor",
            label: "Gym floor",
            prompt:
              "on a polished concrete gym floor next to a black rubber kettlebell and the corner of a charcoal yoga mat, soft window light from camera-left, modern minimal training space, editorial photoreal product photography, true colors and materials preserved",
          },
          {
            id: "cafe-table",
            label: "Cafe table",
            prompt:
              "resting on a warm oak cafe table next to a flat white in a ceramic cup and a folded linen napkin, soft window light, shallow depth of field with a blurred bistro background, editorial photoreal lifestyle product photography, true colors and materials preserved",
          },
          {
            id: "forest-trail",
            label: "Forest trail",
            prompt:
              "on a damp forest trail covered in fallen leaves and pine needles, dappled morning light through tall trees, faint mist in the background, low angle close to the ground, editorial photoreal product photography, true colors and materials preserved",
          },
        ],
        injectAt: { workflowIdMatch: "ai-scene", paramKey: "prompt" },
      },
      // Prep: cleanup trio (same as omnichannel-pack) + an ai-scene
      // step whose prompt is filled by the creative-direction picker
      // at dispatch time. Empty prompt by default so the workflow
      // definition stays parameter-free.
      prep: [
        { workflowId: "tag-removal", params: {}, label: "Remove price tag" },
        {
          workflowId: "product-isolation",
          params: { prompt: "the sneaker" },
          label: "Isolate the shoe",
        },
        { workflowId: "background-color", params: { color: "#FFFFFF" }, label: "Apply white backdrop" },
        {
          workflowId: "ai-scene",
          params: { prompt: "" },
          label: "Drop into chosen scene",
        },
      ],
      // Variants: the same four channel ratios as omnichannel-pack so
      // the user gets ad-ready outputs from the chosen scene.
      variants: [
        {
          id: "amazon-main",
          label: "Amazon main",
          ratio: "1:1",
          defaultEnabled: true,
          steps: [
            { workflowId: "smart-resize", params: { aspect_ratio: "1:1", resolution: "2K" }, label: "Smart-resize 1:1 (2K)" },
          ],
        },
        {
          id: "ig-feed",
          label: "Instagram feed",
          ratio: "4:5",
          defaultEnabled: true,
          steps: [
            { workflowId: "smart-resize", params: { aspect_ratio: "4:5", resolution: "2K" }, label: "Smart-resize 4:5 (2K)" },
          ],
        },
        {
          id: "stories-tiktok",
          label: "Stories / TikTok",
          ratio: "9:16",
          defaultEnabled: true,
          steps: [
            { workflowId: "smart-resize", params: { aspect_ratio: "9:16", resolution: "2K" }, label: "Smart-resize 9:16 (2K)" },
          ],
        },
        {
          id: "banner",
          label: "Homepage banner",
          ratio: "16:9",
          defaultEnabled: true,
          steps: [
            { workflowId: "smart-resize", params: { aspect_ratio: "16:9", resolution: "2K" }, label: "Smart-resize 16:9 (2K)" },
          ],
        },
      ],
    },
  },

  // ===== Coming soon =====
  {
    id: "ai-logo",
    name: "Fix the logo",
    desc: "One-click logo and print clean-up — coming soon",
    group: "soon",
    kind: "soon",
  },
  {
    id: "video",
    name: "Bring it to life",
    desc: "Turn a still into a motion clip — coming soon",
    group: "soon",
    kind: "soon",
  },
];
