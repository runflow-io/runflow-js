# @runflow-io/sdk

Typed HTTP client and tool DSL for the [Runflow](https://runflow.io) API.
Isomorphic — runs in Node, Bun, Deno, browsers, and edge workers.

## Install

```bash
bun add @runflow-io/sdk
```

## Usage

### Server-side

```ts
import { Runflow } from "@runflow-io/sdk";

const rf = new Runflow({ apiKey: process.env.RUNFLOW_API_KEY! });

const dispatched = await rf.models.run("runflow/background-removal", {
  input: { image_url: "https://example.com/photo.png" },
});
const final = await rf.runs.wait(dispatched.id);
console.log(final.output);
```

### Browser, through a proxy

```ts
const rf = new Runflow({ baseUrl: "/api/runflow" });
```

The browser SDK never sees your API key — it's injected by
`@runflow-io/proxy` on your server.

### Uploading files

```ts
const asset = await rf.assets.upload(fileInput.files[0]);
await rf.models.run("google/nano-banana-pro/edit", {
  // asset.ref is the stable runflow://assets/{id} reference — dispatch
  // resolves it to a fresh signed URL server-side, so it never expires.
  input: { prompt: "remove the price tag", image_urls: [asset.ref] },
});
```

`upload()` runs the platform's presigned flow (create session → PUT the
bytes to storage → confirm), retrying transient failures, and returns
`{ id, url, ref, ... }`. **Prefer `ref`** (`runflow://assets/{id}`) for
model inputs and for anything you store — the API resolves it to a
freshly signed URL at dispatch, so it never expires. `url` is a
short-TTL **signed HTTPS URL** for immediate browser use (previews,
`<img>`); re-mint one with `rf.assets.get(id)` when needed. Works in
the browser through `@runflow-io/proxy` (the upload + asset-read
endpoints are on its default allow-list). Raw `Blob`s need
`{ filename }`; the cap is 50 MB.

### Pin-based editing

Edit models like `google/nano-banana-pro/edit` have no `pin_x`/`pin_y`
inputs — the convention is a region phrase baked into the prompt.
`composePinPrompt` is that convention, shared with the Studio shell:

```ts
import { composePinPrompt } from "@runflow-io/sdk";

await rf.models.run("google/nano-banana-pro/edit", {
  input: {
    // {x,y} are normalized 0..1; thirds map to upper|middle|lower ×
    // left|center|right ("upper-left" … "lower-right").
    prompt: composePinPrompt({ x: 0.25, y: 0.2 }, "remove the price tag"),
    image_urls: [sourceUrl],
  },
});
```

## Tools

Declarative model bindings with typed inputs, presets, and outputs:

```ts
import {
  defineTool,
  imageInput,
  textInput,
  selectInput,
  imageOutput,
  extractFirstImageUrl,
} from "@runflow-io/sdk";

const sceneSwap = defineTool({
  id: "ai-scene",
  name: "Drop into a new scene",
  group: "magic",
  model: "google/nano-banana-pro/edit",
  inputs: {
    image: imageInput({ source: "runtime" }),
    prompt: textInput({
      source: "user",
      label: "Describe the scene",
      maxLength: 400,
    }),
    style: textInput({
      source: "preset",
      value: "Photoreal product photography, true colors preserved",
    }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, prompt, style }) => ({
    input: {
      prompt: `Place the subject of this image ${prompt}. ${style}.`,
      image_urls: [image],
    },
  }),
  // extractOutput is optional for `{ image: imageOutput() }` schemas —
  // the default extractor pulls the first image URL from run.output
  // and throws RunflowError if none is present.
});

const { output } = await rf.tools.run(sceneSwap, {
  image: "https://example.com/sneaker.png",
  prompt: "on a windswept rooftop at golden hour",
});
console.log(output.image);
```

### Input sources

| Source    | Meaning                                                     |
|-----------|-------------------------------------------------------------|
| `preset`  | Baked into the tool. Not collected at runtime.              |
| `runtime` | Provided programmatically every call (e.g. the source image). |
| `user`    | Collected from the end user via the Studio UI (or programmatically). |

### Input builders

`imageInput`, `textInput`, `numberInput`, `colorInput`, `selectInput`,
`referenceInput`, `maskInput`, `pinInput`. Each preserves type
information for `buildRequest` and the run helpers.

### Output builders

`imageOutput`, `textOutput`, `numberOutput`, `jsonOutput`,
`imageListOutput`. Plus extractor helpers `extractFirstImageUrl` /
`extractAllImageUrls` that tolerate the common Runflow output shapes.

## API surface

- `runflow.models.run(model, body)` — dispatch a run. Model id segments
  are URL-encoded; `..`/empty segments are rejected.
- `runflow.runs.get(id)` / `runflow.runs.poll(id)` / `runflow.runs.wait(id)`
- `runflow.assets.upload(file, opts?)` — presigned upload (with retry);
  returns the stable `runflow://` `ref` (preferred model input) + a
  short-TTL signed https `url` for browser display.
- `runflow.assets.get(id)` — re-fetch an asset with a freshly signed `url`.
- `runflow.tools.run(tool, args)` / `runflow.tools.dispatch(tool, args)`
- `runflow.health.check()`
- `pinRegion(pin)` / `composeRegionPrompt(region, instruction)` /
  `composePinPrompt(pin, instruction)` — the shared pin→region prompt
  contract.

All return well-typed promises; errors are `RunflowError`,
`RunFailedError`, or `RunTimeoutError`.

## Configuration

```ts
new Runflow({
  apiKey?: string;        // server-side; sent as Authorization: Bearer
  baseUrl?: string;       // browser; usually "/api/runflow" pointing at @runflow-io/proxy
  apiBase?: string;       // override the upstream base; defaults to https://api.runflow.io
  requestTimeoutMs?: number; // per-request timeout; default 30s
  headers?: Record<string, string>;
  fetch?: typeof fetch;
});
```

Pass either `apiKey` (the request goes straight to `apiBase`) or `baseUrl`
(the request goes through your proxy, which injects the key). If both are
set, `baseUrl` wins — the bearer header is omitted.

## License

MIT
