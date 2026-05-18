import { describe, expect, it } from "vitest";
import { runflowProxy } from "../src/index.js";

function mockUpstream(handler: (req: Request) => Response | Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as string, init);
    return Promise.resolve(handler(req));
  }) as typeof fetch;
}

const KEY = "rf_live_test";

describe("runflowProxy — routing", () => {
  it("rejects disallowed paths with 403", async () => {
    const proxy = runflowProxy({
      apiKey: KEY,
      fetch: mockUpstream(() => new Response("nope")),
    });
    const res = await proxy(new Request("http://app/api/runflow/v1/secrets"));
    expect(res.status).toBe(403);
  });

  it("rejects POST to a non-allowlisted model with 403", async () => {
    let upstreamCalled = false;
    const proxy = runflowProxy({
      apiKey: KEY,
      allowedModels: ["runflow/background-removal"],
      fetch: mockUpstream(() => {
        upstreamCalled = true;
        return new Response("");
      }),
    });
    const res = await proxy(
      new Request("http://app/api/runflow/v1/models/some/private/runs", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(403);
    expect(upstreamCalled).toBe(false);
  });

  it("forwards an allowlisted dispatch with bearer auth", async () => {
    let seenAuth = "";
    let seenUrl = "";
    const proxy = runflowProxy({
      apiKey: KEY,
      fetch: mockUpstream((req) => {
        seenAuth = req.headers.get("authorization") ?? "";
        seenUrl = req.url;
        return new Response(JSON.stringify({ id: "run_abc", status_code: "queued" }), {
          headers: { "Content-Type": "application/json" },
        });
      }),
    });
    const res = await proxy(
      new Request("http://app/api/runflow/v1/models/runfl0w/background-removal/runs".replace("runfl0w", "runflow"), {
        method: "POST",
        body: JSON.stringify({ input: { image_url: "https://cdn/x.png" } }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(seenAuth).toBe(`Bearer ${KEY}`);
    expect(seenUrl).toMatch(/api\.runflow\.io\/v1\/models\/runflow\/background-removal\/runs/);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("run_abc");
  });

  it("forwards run polls with UUID validation", async () => {
    const proxy = runflowProxy({
      apiKey: KEY,
      fetch: mockUpstream(
        (req) =>
          new Response(JSON.stringify({ id: new URL(req.url).pathname.split("/").pop(), status_code: "succeeded" }), {
            headers: { "Content-Type": "application/json" },
          }),
      ),
    });
    const goodUuid = "11111111-2222-3333-4444-555555555555";
    const good = await proxy(new Request(`http://app/api/runflow/v1/runs/${goodUuid}`));
    expect(good.status).toBe(200);

    const bad = await proxy(new Request("http://app/api/runflow/v1/runs/not-a-uuid"));
    expect(bad.status).toBe(403);
  });
});

describe("runflowProxy — hooks", () => {
  it("returns 401 when authenticate returns null", async () => {
    const proxy = runflowProxy({
      apiKey: KEY,
      authenticate: () => null,
      fetch: mockUpstream(() => new Response("")),
    });
    const res = await proxy(new Request("http://app/api/runflow/v1/health"));
    expect(res.status).toBe(401);
  });

  it("respects rateLimit denial", async () => {
    const proxy = runflowProxy({
      apiKey: KEY,
      rateLimit: () => ({ status: 429, message: "Slow down", retryAfter: 5 }),
      fetch: mockUpstream(() => new Response("")),
    });
    const res = await proxy(new Request("http://app/api/runflow/v1/health"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("5");
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Slow down");
  });

  it("invokes onRun with the dispatched run id", async () => {
    const calls: Array<{ runId: string; model: string }> = [];
    const proxy = runflowProxy({
      apiKey: KEY,
      onRun: ({ runId, model }) => {
        calls.push({ runId, model });
      },
      fetch: mockUpstream(
        () =>
          new Response(JSON.stringify({ id: "run_x", status_code: "queued" }), {
            headers: { "Content-Type": "application/json" },
          }),
      ),
    });
    await proxy(
      new Request("http://app/api/runflow/v1/models/runflow/background-removal/runs", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(calls).toEqual([{ runId: "run_x", model: "runflow/background-removal" }]);
  });
});

describe("runflowProxy — limits", () => {
  it("returns 413 when body exceeds maxBodyBytes", async () => {
    const proxy = runflowProxy({
      apiKey: KEY,
      maxBodyBytes: 16,
      fetch: mockUpstream(() => new Response("")),
    });
    const res = await proxy(
      new Request("http://app/api/runflow/v1/models/runflow/background-removal/runs", {
        method: "POST",
        body: JSON.stringify({ input: { image_url: "x".repeat(64) } }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(413);
  });
});
