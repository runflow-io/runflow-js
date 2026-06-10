# runflow-js

The JavaScript surface for [Runflow](https://runflow.io) — SDK, embeddable Studio, and server proxy.

## Packages

| Package | Description |
|---------|-------------|
| [`@runflow-io/sdk`](./packages/sdk) | Typed HTTP client for the Runflow API. Isomorphic — runs in Node, Bun, Deno, browsers, workers. |
| [`@runflow-io/studio`](./packages/studio) | Embeddable Studio UI. Drop into any website via `<script>` tag or `npm install`. |
| [`@runflow-io/proxy`](./packages/proxy) | Web Standards proxy handler for forwarding browser calls to the Runflow API with your secret key server-side. |

## Quick start

**Embed Studio on your site** (the 3-line integration):

```bash
bun add @runflow-io/studio @runflow-io/proxy
```

```ts
// app/api/runflow/[...path]/route.ts (Next.js App Router)
import { runflowProxy } from "@runflow-io/proxy";
export const { GET, POST } = runflowProxy({ apiKey: process.env.RUNFLOW_API_KEY! });
```

```html
<div id="studio"></div>
<script type="module">
  import { mount } from "@runflow-io/studio";
  mount("#studio");
</script>
```

## Repository layout

```
runflow-js/
├── packages/
│   ├── sdk/         → @runflow-io/sdk
│   ├── studio/      → @runflow-io/studio
│   └── proxy/       → @runflow-io/proxy
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

## End-to-end proof

`bun run proof` exercises the real customer chain — browser SDK →
`@runflow-io/proxy` → api.runflow.io — across every modality, including
file upload via `rf.assets.upload` and the proxy allow-list. It needs
`RUNFLOW_API_KEY` and spends real credits, so it's a local/manual gate
(not CI). Results land in `.proof/`.

For a worked example of a vertical fork (customize `<StudioShell>` via
its `tools` / `source` / `sentinel` / `copy` props, or build a custom UI
on `./headless`), see the
[real-estate-studio-sdk](https://github.com/runflow-io/real-estate-studio-sdk)
reference repo.

## License

MIT
