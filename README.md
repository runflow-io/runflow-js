# runflow-js

The JavaScript surface for [Runflow](https://runflow.io) — SDK, embeddable Studio, and server proxy.

## Packages

| Package | Description |
|---------|-------------|
| [`@runflow/sdk`](./packages/sdk) | Typed HTTP client for the Runflow API. Isomorphic — runs in Node, Bun, Deno, browsers, workers. |
| [`@runflow/studio`](./packages/studio) | Embeddable Studio UI. Drop into any website via `<script>` tag or `npm install`. |
| [`@runflow/proxy`](./packages/proxy) | Web Standards proxy handler for forwarding browser calls to the Runflow API with your secret key server-side. |

## Quick start

**Embed Studio on your site** (the 3-line integration):

```bash
bun add @runflow/studio @runflow/proxy
```

```ts
// app/api/runflow/[...path]/route.ts (Next.js App Router)
import { runflowProxy } from "@runflow/proxy";
export const { GET, POST } = runflowProxy({ apiKey: process.env.RUNFLOW_API_KEY! });
```

```html
<div id="studio"></div>
<script type="module">
  import { mount } from "@runflow/studio";
  mount("#studio");
</script>
```

## Repository layout

```
runflow-js/
├── packages/
│   ├── sdk/         → @runflow/sdk
│   ├── studio/      → @runflow/studio
│   └── proxy/       → @runflow/proxy
├── examples/
│   └── e2e-proof/                end-to-end integration test
└── tooling/
    └── tsconfig/                 shared TS presets
```

## Development

```bash
bun install
bun run build      # build all packages
bun run test       # run all tests
bun run typecheck  # type-check all packages
bun run lint       # biome check
```

Add a changeset for every user-visible change:

```bash
bun changeset
```

## License

MIT
