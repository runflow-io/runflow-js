# @runflow-io/studio

Embeddable [Runflow](https://runflow.io) Studio for any website. Drops the
production Studio UI into a `<div>`, talks to `api.runflow.io` through a
proxy you control.

## Install

```bash
bun add @runflow-io/studio @runflow-io/proxy @runflow-io/sdk
```

`react@>=18` and `react-dom@>=18` (or 19) are peer dependencies.

## Server: mount the proxy

```ts
// app/api/runflow/[...path]/route.ts  (Next.js App Router)
import { runflowProxy } from "@runflow-io/proxy";

export const { GET, POST } = runflowProxy({
  apiKey: process.env.RUNFLOW_API_KEY!,
});
```

This handler covers the `/v1/models/*/runs` dispatch path and the
`/v1/runs/{id}` poll path the Studio uses for every workflow run. It
does NOT cover uploads, chat, image-proxy, or sentinel — see [Companion
endpoints](#companion-endpoints) below.

## Browser: mount the Studio

```ts
import { mount } from "@runflow-io/studio";

const studio = mount("#studio", {
  urls: { runflowProxy: "/api/runflow" },
  theme: "auto",
});

// Later, if you want to unmount:
studio.unmount();
```

```html
<div id="studio"></div>
```

The Studio injects its own stylesheet into `<head>` on mount. Pass
`injectStyles: false` if you ship your own CSS.

## Mount options

```ts
mount(target: string | HTMLElement, options?: {
  /** Endpoint overrides. Defaults to /api/runflow/* paths. */
  urls?: {
    runflowProxy?: string;     // /api/runflow         — dispatch + poll
    runflowDevProxy?: string;  // (off by default)      — unreleased models
    imageProxy?: string;       // /api/runflow/image    — same-origin image fetch
    upload?: string;           // optional legacy multipart endpoint — by default
                               // uploads use the SDK presigned flow through
                               // runflowProxy (no extra endpoint needed)
    chat?: string;             // /api/runflow/chat     — chat agent (SSE)
    sentinel?: string;         // /api/runflow/sentinel — sentinel evaluation
  };
  /** "light" | "dark" | "auto" | { accent, bg0, ink0, ... } */
  theme?: ThemeMode | ThemeOverrides;
  /** Inject the default <style> into <head>. Default: true. */
  injectStyles?: boolean;
  /** Shell customization — see "Customizing the shell" below. */
  props?: StudioShellProps;
}): { unmount(): void };
```

## Customizing the shell

`<StudioShell>` (and `mount()`'s `props` option) takes four optional
props; zero props renders the stock studio.

```tsx
import { StudioShell } from "@runflow-io/studio";
import { WORKFLOWS } from "@runflow-io/studio/headless";

<StudioShell
  // The workflow catalogue (Workflow[], not the SDK's ToolDefs):
  // cards, chat-agent tools, package steps.
  tools={WORKFLOWS.filter((w) => w.group === "cleanup")}
  // A starting image URL, or SampleAsset[] to replace the samples.
  source="https://cdn.example/listing.jpg"
  // Disable quality evals, or re-template their task description.
  sentinel={{ enabled: false }}
  // Brand + labels, shallow-merged over the defaults.
  copy={{ brandName: "Estates Studio", brandTag: "", assetsTitle: "Listings" }}
/>
```

If you need event callbacks or `update()` to reconfigure at runtime,
those are tracked as follow-ups.

## Companion endpoints

The Studio dispatches against five endpoints. `@runflow-io/proxy`
handles two; the other three are customer-provided because they involve
your storage, your Anthropic key, and (for sentinel) your evaluation
service:

| URL key | What needs to live there | Provided by |
|---|---|---|
| `runflowProxy` | `POST /v1/models/{model}/runs` + `GET /v1/runs/{id}` | `@runflow-io/proxy` |
| `imageProxy` | `GET /?url=<external>` → echo bytes, same-origin (for cross-origin source images) | You |
| `upload` | `POST` multipart → `{ url }` (writes to your storage) | You |
| `chat` | SSE chat agent (wraps Anthropic + the tool catalogue) | You |
| `sentinel` | `POST /evaluate?sync=false` + `GET /evaluate/{eval_id}` | You |

The runflow-prototypes repo has working reference implementations under
`projects/demos/api/{upload,chat,sentinel,image}.mjs`. If you only need
single-step dispatch (no uploads, no chat, no sentinel), the proxy alone
is enough — the upload/chat/sentinel-dependent UI paths gracefully
degrade when the routes return 404/403.

## CDN

```html
<link rel="stylesheet" href="https://cdn.runflow.io/studio.css" />
<script src="https://cdn.runflow.io/studio.js"></script>
<div id="studio"></div>
<script>
  RunflowStudio.mount("#studio", { urls: { runflowProxy: "/api/runflow" } });
</script>
```

The CDN bundle inlines React (~150 KB gzipped). The npm package
externalizes React — install that one if you already have React in your
bundle.

## Theming

```ts
mount("#studio", {
  theme: {
    accent: "#FBBF24",
    bg0: "#0a0a0b",
    ink0: "#fafafa",
    // ...
  },
});
```

Or pass `"light"` / `"dark"` / `"auto"` for the bundled defaults. All
theme values become CSS custom properties (`--rfs-*`) on the mount root,
so you can also override them in your own CSS.

## Workflows that ship

Built-in single workflows: `ai-edit`, `ai-scene`, `reference-inpaint`,
`logo-fix`, `product-isolation`, `smart-resize`, `outpaint`,
`background-color`, `background-removal`, `tag-removal`, `object-removal`,
`model-removal`, `skin-fix`, `topaz-upscale`. Plus the `zalando-package`
bundle. They map one-to-one to the catalogue published at
[runflow.io/models](https://runflow.io/models).

## Headless mode

If you want to skip the bundled UI and build your own with the same tool
catalogue:

```ts
import { BUILTIN_TOOLS, findTool } from "@runflow-io/studio/headless";
import { Runflow } from "@runflow-io/sdk";

const rf = new Runflow({ baseUrl: "/api/runflow" });
const tool = findTool("background-removal")!;
const { output } = await rf.tools.run(tool, { image: "https://cdn/x.png" });
```

The headless entry also exports `WORKFLOWS`, `SAMPLES`, the prototype's
`runWorkflow` dispatcher, the `sentinelEvaluate` client, `setStudioUrls`,
and `createMaskController` — the framework-free dual-canvas brush engine
the shell uses for its mask workflows:

```ts
import { createMaskController } from "@runflow-io/studio/headless";

const mask = createMaskController({ brushSize: 45 });
mask.attach(overlayCanvas); // rendered over your image
mask.syncToDisplay(rect.width, rect.height, devicePixelRatio);
// pointer events → beginStroke / strokeTo / endStroke; then:
const blob = await mask.toMaskBlob(img.naturalWidth, img.naturalHeight);
const asset = await rf.assets.upload(blob, { filename: "mask.png" });
// → feed asset.url as mask_url to runflow/reference-inpaint etc.
```

A React state reducer for building a custom shell is tracked as a
follow-up.

## License

MIT
