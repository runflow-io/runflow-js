# @runflow-io/proxy

Web Standards proxy handler that forwards browser calls to the
[Runflow](https://runflow.io) API with your API key injected server-side.

## Why

The Runflow API requires a secret key (`Authorization: Bearer rf_live_*`).
You don't want that key in your client bundle. Mount this proxy on your
own backend, point `@runflow-io/studio` (or `@runflow-io/sdk`) at it, and the
key never leaves the server.

## Install

```bash
bun add @runflow-io/proxy
```

## Usage

### Next.js App Router

```ts
// app/api/runflow/[...path]/route.ts
import { runflowProxy } from "@runflow-io/proxy";

export const { GET, POST } = runflowProxy({
  apiKey: process.env.RUNFLOW_API_KEY!,
});
```

### Hono / Cloudflare Workers / SvelteKit / Bun / Deno

Any framework that speaks Web Standards:

```ts
import { runflowProxy } from "@runflow-io/proxy";
const handler = runflowProxy({ apiKey: process.env.RUNFLOW_API_KEY! });

// Hono
app.all("/api/runflow/*", (c) => handler(c.req.raw));

// Cloudflare Workers
export default { fetch: (req: Request) => handler(req) };
```

### Express / Fastify / classic Node `(req, res)`

```ts
import { runflowProxyNode } from "@runflow-io/proxy/node";

app.use("/api/runflow", runflowProxyNode({
  apiKey: process.env.RUNFLOW_API_KEY!,
}));
```

## Customization via hooks

The proxy comes with safe defaults: a model allowlist, 32KB body cap,
30s upstream timeout, masked upstream errors. Layer your own auth,
rate-limiting, and observability via hooks:

```ts
runflowProxy({
  apiKey: process.env.RUNFLOW_API_KEY!,

  // Read whatever auth your stack already ran (Clerk, Auth0, Supabase…).
  authenticate: async (req) => {
    const session = await getSession(req);
    if (!session) return null; // → 401
    return { userId: session.userId, context: { plan: session.plan } };
  },

  // Per-user rate limit using your own store.
  rateLimit: async ({ auth }) => {
    const userId = auth?.userId;
    if (!userId) return;
    const hits = await redis.incr(`runflow:hits:${userId}`);
    if (hits > 100) return { status: 429, message: "Slow down", retryAfter: 60 };
  },

  // Restrict which models a given user can hit.
  allowedModels: (auth) => {
    const plan = (auth?.context as { plan?: string })?.plan;
    if (plan === "pro") return ["runflow/background-removal", "google/nano-banana-pro/edit"];
    return ["runflow/background-removal"];
  },

  // Observability — fired after a successful dispatch.
  onRun: async ({ runId, model, auth }) => {
    await db.runs.insert({ runId, model, userId: auth?.userId });
  },
});
```

## Path contract

The proxy accepts only these paths (configurable via `allowedModels`):

| Method | Path                              | Purpose          |
|--------|-----------------------------------|------------------|
| POST   | `/v1/models/{owner}/{slug…}/runs` | Dispatch a run.  |
| GET    | `/v1/runs/{uuid}`                 | Poll a run.      |
| GET    | `/v1/health`                      | Public health.   |

Everything else returns `403 Not allowed`. Run IDs are validated as
UUIDv4-shape to block path traversal.

## License

MIT
