import { describe, expect, it } from "vitest";
import { DEFAULT_ALLOWED_PATHS, runflowProxy } from "../src/index.js";
import type { ProxyConfig } from "../src/index.js";

function mockUpstream(handler: (req: Request) => Response | Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as string, init);
    return Promise.resolve(handler(req));
  }) as typeof fetch;
}

const KEY = "rf_live_test";
const UUID = "11111111-2222-3333-4444-555555555555";

function spyProxy(extra?: Partial<ProxyConfig>) {
  const seen: Array<{ method: string; url: string; auth: string | null }> = [];
  const proxy = runflowProxy({
    apiKey: KEY,
    fetch: mockUpstream((req) => {
      seen.push({
        method: req.method,
        url: req.url,
        auth: req.headers.get("authorization"),
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }),
    ...extra,
  });
  return { proxy, seen };
}

describe("allowedPaths — defaults (asset uploads)", () => {
  it("forwards POST /v1/asset-uploads with bearer auth", async () => {
    const { proxy, seen } = spyProxy();
    const res = await proxy(
      new Request("http://app/api/runflow/v1/asset-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "a.png", mime_type: "image/png", size_bytes: 3 }),
      }),
    );
    expect(res.status).toBe(200);
    expect(seen[0]?.auth).toBe(`Bearer ${KEY}`);
    expect(seen[0]?.url).toBe("https://api.runflow.io/v1/asset-uploads");
  });

  it("forwards GET /v1/assets/{id} (rf.assets.get re-signing)", async () => {
    const { proxy, seen } = spyProxy();
    const res = await proxy(new Request(`http://app/api/runflow/v1/assets/${UUID}`));
    expect(res.status).toBe(200);
    expect(seen[0]?.url).toBe(`https://api.runflow.io/v1/assets/${UUID}`);
  });

  it("rejects a trailing slash on allow-list matches", async () => {
    const { proxy, seen } = spyProxy();
    const res = await proxy(new Request(`http://app/api/runflow/v1/assets/${UUID}/`));
    expect(res.status).toBe(403);
    expect(seen.length).toBe(0);
  });

  it("rejects empty path segments so matching always equals forwarding", async () => {
    const { proxy, seen } = spyProxy();
    const res = await proxy(
      new Request("http://app/api/runflow/v1//asset-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(403);
    expect(seen.length).toBe(0);
  });

  it("403 body carries an actionable message + machine code", async () => {
    const { proxy } = spyProxy();
    const res = await proxy(new Request("http://app/api/runflow/v1/secrets"));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("path_not_allowed");
    expect(body.error).toContain("GET /v1/secrets");
    expect(body.error).toContain("allowedPaths");
  });

  it("forwards POST /v1/asset-uploads/{id}/confirmations", async () => {
    const { proxy, seen } = spyProxy();
    const res = await proxy(
      new Request(`http://app/api/runflow/v1/asset-uploads/${UUID}/confirmations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: null }),
      }),
    );
    expect(res.status).toBe(200);
    expect(seen[0]?.url).toBe(`https://api.runflow.io/v1/asset-uploads/${UUID}/confirmations`);
  });

  it("does NOT forward other methods or shapes on the same prefix", async () => {
    const { proxy, seen } = spyProxy();
    for (const req of [
      new Request("http://app/api/runflow/v1/asset-uploads"), // GET
      new Request("http://app/api/runflow/v1/asset-uploads/x/y/z", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      new Request(`http://app/api/runflow/v1/asset-uploads/${UUID}/confirmations/extra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    ]) {
      const res = await proxy(req);
      expect(res.status).toBe(403);
    }
    expect(seen.length).toBe(0);
  });

  it("rejects traversal in :param segments, including percent-encoded", async () => {
    const { proxy, seen } = spyProxy();
    for (const id of ["..", ".", "%2e%2e", "%2E%2E", "a%2Fb", "a%5Cb"]) {
      const res = await proxy(
        new Request(`http://app/api/runflow/v1/asset-uploads/${id}/confirmations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      );
      expect(res.status, `id=${id}`).toBe(403);
    }
    expect(seen.length).toBe(0);
  });
});

describe("allowedPaths — custom rules", () => {
  it("forwards an opted-in GET /v1/runs listing", async () => {
    const { proxy, seen } = spyProxy({ allowedPaths: [{ method: "GET", path: "/v1/runs" }] });
    const res = await proxy(new Request("http://app/api/runflow/v1/runs?limit=5"));
    expect(res.status).toBe(200);
    expect(seen[0]?.url).toBe("https://api.runflow.io/v1/runs?limit=5");
  });

  it("still 403s routes outside the configured set", async () => {
    const { proxy } = spyProxy({ allowedPaths: [{ method: "GET", path: "/v1/runs" }] });
    expect((await proxy(new Request("http://app/api/runflow/v1/billing/balance"))).status).toBe(
      403,
    );
    expect((await proxy(new Request("http://app/api/runflow/v1/api-keys"))).status).toBe(403);
    expect(
      (await proxy(new Request("http://app/api/runflow/v1/runs", { method: "DELETE" }))).status,
    ).toBe(403);
  });

  it("accepts method arrays and :param patterns", async () => {
    const { proxy, seen } = spyProxy({
      allowedPaths: [{ method: ["GET", "DELETE"], path: "/v1/assets/:id" }],
    });
    expect((await proxy(new Request(`http://app/api/runflow/v1/assets/${UUID}`))).status).toBe(200);
    const del = await proxy(
      new Request(`http://app/api/runflow/v1/assets/${UUID}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(del.status).toBe(200);
    expect(seen.map((s) => s.method)).toEqual(["GET", "DELETE"]);
  });

  it("custom rules REPLACE the defaults (same semantics as allowedModels)", async () => {
    const { proxy } = spyProxy({ allowedPaths: [{ method: "GET", path: "/v1/runs" }] });
    const res = await proxy(
      new Request("http://app/api/runflow/v1/asset-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("spreading DEFAULT_ALLOWED_PATHS extends instead of replacing", async () => {
    const { proxy } = spyProxy({
      allowedPaths: [...DEFAULT_ALLOWED_PATHS, { method: "GET", path: "/v1/runs" }],
    });
    const upload = await proxy(
      new Request("http://app/api/runflow/v1/asset-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(upload.status).toBe(200);
    const list = await proxy(new Request("http://app/api/runflow/v1/runs?limit=1"));
    expect(list.status).toBe(200);
  });

  it("allowedPaths: [] disables the default asset routes entirely", async () => {
    const { proxy, seen } = spyProxy({ allowedPaths: [] });
    const res = await proxy(
      new Request("http://app/api/runflow/v1/asset-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(403);
    // Built-ins are unaffected by the path allow-list.
    const health = await proxy(new Request("http://app/api/runflow/v1/health"));
    expect(health.status).toBe(200);
    expect(seen.length).toBe(1);
  });
});

describe("allowedPaths — existing gates still apply", () => {
  it("CSRF origin check still rejects cross-origin POSTs to allowed paths", async () => {
    const { proxy, seen } = spyProxy();
    const res = await proxy(
      new Request("http://app/api/runflow/v1/asset-uploads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example",
          Host: "app",
        },
        body: "{}",
      }),
    );
    expect(res.status).toBe(403);
    expect(seen.length).toBe(0);
  });

  it("authenticate hook still gates allowed paths", async () => {
    const { proxy } = spyProxy({ authenticate: () => null });
    const res = await proxy(
      new Request("http://app/api/runflow/v1/asset-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("content-type gate still applies to allowed POSTs", async () => {
    const { proxy } = spyProxy();
    const res = await proxy(
      new Request("http://app/api/runflow/v1/asset-uploads", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(415);
  });
});
