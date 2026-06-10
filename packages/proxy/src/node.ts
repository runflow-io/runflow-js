/**
 * Node.js (Express / Fastify / classic http) adapter.
 *
 * Wraps the Web Standards handler in a `(req, res) => void` callback
 * that older Node frameworks expect.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { runflowProxy } from "./handler.js";
import type { ProxyConfig } from "./types.js";

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/**
 * Build a Node-style `(req, res)` handler.
 *
 * @example Express
 * ```ts
 * app.use('/api/runflow', runflowProxyNode({ apiKey: process.env.RUNFLOW_API_KEY! }));
 * ```
 */
export function runflowProxyNode(cfg: ProxyConfig): NodeHandler {
  const handler = runflowProxy(cfg);

  return async (req, res) => {
    const url = `http://${req.headers.host ?? "local"}${req.url ?? "/"}`;
    const init: RequestInit & { duplex?: "half" } = {
      method: req.method ?? "GET",
      headers: toHeaders(req.headers),
    };

    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      const body = await collectBody(req);
      init.body = new Uint8Array(body) as unknown as BodyInit;
      // Node's undici requires `duplex: 'half'` when body is a stream/buffer.
      init.duplex = "half";
    }

    let webRes: Response;
    try {
      webRes = await handler(new Request(url, init));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Proxy error", detail: errMessage(err) }));
      return;
    }

    res.statusCode = webRes.status;
    webRes.headers.forEach((v, k) => res.setHeader(k, v));
    const buf = Buffer.from(await webRes.arrayBuffer());
    res.end(buf);
  };
}

function toHeaders(h: IncomingMessage["headers"]): Headers {
  const out = new Headers();
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const vv of v) out.append(k, vv);
    else out.set(k, v);
  }
  return out;
}

async function collectBody(req: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of req)
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
