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

The proxy accepts these paths out of the box:

| Method | Path                                    | Purpose                          |
|--------|-----------------------------------------|----------------------------------|
| POST   | `/v1/models/{owner}/{slug…}/runs`       | Dispatch a run.                  |
| GET    | `/v1/runs/{uuid}`                       | Poll a run.                      |
| GET    | `/v1/health`                            | Public health.                   |
| POST   | `/v1/asset-uploads`                     | Create a presigned upload.       |
| POST   | `/v1/asset-uploads/{id}/confirmations`  | Confirm it (`rf.assets.upload`). |
| GET    | `/v1/assets/{id}`                       | Re-sign an asset URL (`rf.assets.get`). |

Everything else returns `403 Not allowed`. Run IDs are validated as
UUIDv4-shape to block path traversal. Dispatch is additionally gated by
`allowedModels`.

### Extending the allow-list: `allowedPaths`

```ts
import { DEFAULT_ALLOWED_PATHS, runflowProxy } from "@runflow-io/proxy";

runflowProxy({
  apiKey: process.env.RUNFLOW_API_KEY!,
  allowedPaths: [
    ...DEFAULT_ALLOWED_PATHS, // keep the rf.assets.upload/get routes
    { method: "GET", path: "/v1/runs" }, // run listing
    { method: "GET", path: "/v1/billing/balance" }, // billing read
  ],
});
```

Like `allowedModels`, a custom list **replaces** the defaults — spread
`DEFAULT_ALLOWED_PATHS` (exported) to extend them, as above, or pass
`[]` to turn the asset routes off entirely. Matching is strict — full
path, segment by segment, no prefixes or wildcards. A `:param` segment
matches exactly one non-empty segment and rejects traversal (`.`, `..`,
percent-encoded forms). `method` takes a string or an array
(`["GET", "DELETE"]`); the handler also exports `PUT`/`PATCH`/`DELETE`
for framework route files. Non-GET requests must send
`Content-Type: application/json` (CSRF gate) even when bodyless, and
upstream responses are fully buffered — avoid allowing large or binary
endpoints.

> **Security:** every matched request is forwarded with **your** API
> key, so an allowed `GET /v1/runs` exposes org-wide run data to any
> same-origin browser session. Opt into reads deliberately and pair
> them with `authenticate` + `rateLimit` in production.

## License

MIT
