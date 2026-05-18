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
- `runflow.tools.run(tool, args)` / `runflow.tools.dispatch(tool, args)`
- `runflow.health.check()`

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
