# @runflow-io/studio

Embeddable [Runflow](https://runflow.io) Studio for any website. Three
lines to integrate; expressive enough to model every workflow Runflow
ships.

## Quick start

```bash
bun add @runflow-io/studio @runflow-io/proxy
```

```ts
// Server: mount the proxy. Your API key never leaves the server.
// app/api/runflow/[...path]/route.ts
import { runflowProxy } from "@runflow-io/proxy";
export const { GET, POST } = runflowProxy({ apiKey: process.env.RUNFLOW_API_KEY! });
```

```ts
// Browser: mount the Studio.
import { mount } from "@runflow-io/studio";
import "@runflow-io/studio/styles.css";

mount("#studio");
```

```html
<div id="studio"></div>
```

That's it. The Studio talks to `/api/runflow`, which talks to
`api.runflow.io` with your key attached.

## CDN

```html
<link rel="stylesheet" href="https://cdn.runflow.io/studio.css" />
<script src="https://cdn.runflow.io/studio.js"></script>
<div id="studio"></div>
<script>
  RunflowStudio.mount('#studio', { baseUrl: '/api/runflow' });
</script>
```

## Configuration

```ts
mount("#studio", {
  baseUrl: "/api/runflow",            // your proxy mount path

  tools: BUILTIN_TOOLS,                // override / curate / extend (see below)
  samples: [                           // images shown in the source picker
    { id: "sneaker", title: "Sneaker", url: "https://cdn/sneaker.png" },
  ],

  theme: "auto",                       // 'light' | 'dark' | 'auto' | { accent: '#FBBF24', ... }
  hideSourcePicker: false,             // pair with `source: 'https://...'` for embed-on-PDP

  on: {
    ready:        ()      => {},
    sourceChange: (url)   => {},
    runStart:     ({ toolId })            => {},
    runComplete:  ({ toolId, runId, output }) => {},
    runError:     ({ toolId, error })     => {},
  },
});
```

## Tools

The Studio ships every workflow from the Runflow Studio app as a
declarative `defineTool({...})`. They live in `@runflow-io/studio/tools`
and can be imported individually:

```ts
import {
  aiEdit, aiScene, referenceInpaint,
  productIsolation, smartResize, outpaint,
  backgroundColor, backgroundRemoval, tagRemoval,
  objectRemoval, modelRemoval, skinFix,
  topazUpscale,
} from "@runflow-io/studio/tools";
```

### Define your own

```ts
import {
  defineTool, imageInput, textInput, selectInput, imageOutput,
  extractFirstImageUrl,
} from "@runflow-io/sdk";

export const myEdit = defineTool({
  id: "my-edit",
  name: "Marketplace polish",
  group: "magic",
  model: "runflow/product-isolation",
  inputs: {
    image:        imageInput({ source: "runtime" }),
    aspect_ratio: selectInput({
      source: "preset", value: "1:1",
      options: [{ value: "1:1", label: "1:1" }],
    }),
    instruction:  textInput({ source: "user", label: "What to keep?" }),
  },
  output: { image: imageOutput() },
  buildRequest: ({ image, aspect_ratio, instruction }) => ({
    input: { image_url: image, aspect_ratio, prompt: instruction },
  }),
  extractOutput: (raw) => ({ image: extractFirstImageUrl(raw) ?? "" }),
});
```

Pass it via `tools`:

```ts
mount("#studio", { tools: [...BUILTIN_TOOLS, myEdit] });
```

### Input sources

| Source    | Meaning                                                              |
|-----------|----------------------------------------------------------------------|
| `preset`  | Baked into the tool. Not collected at runtime.                        |
| `runtime` | Provided programmatically every call (e.g. the source image).         |
| `user`    | Collected from the end user via the Studio UI (or programmatically).  |

## Headless mode

If you want the catalogue + state machine but not the UI:

```ts
import { BUILTIN_TOOLS, reducer, initialState } from "@runflow-io/studio/headless";
```

Bring your own renderer; call `runflow.tools.run(tool, args)` directly.

## License

MIT
