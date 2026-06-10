import { describe, expect, it, vi } from "vitest";
import { RunFailedError, Runflow, RunflowError } from "../src/index.js";

function mockFetch(handler: (req: Request) => Response | Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as string, init);
    return Promise.resolve(handler(req));
  }) as typeof fetch;
}

describe("Runflow constructor", () => {
  it("throws when neither apiKey nor baseUrl is set", () => {
    expect(() => new Runflow({})).toThrow(/apiKey.*baseUrl/);
  });

  it("uses bearer auth when apiKey is set", async () => {
    const seen: { auth?: string | null } = {};
    const rf = new Runflow({
      apiKey: "rf_live_test",
      fetch: mockFetch((req) => {
        seen.auth = req.headers.get("authorization");
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }),
    });
    await rf.health.check();
    expect(seen.auth).toBe("Bearer rf_live_test");
  });

  it("omits auth header when baseUrl is set (proxy mode)", async () => {
    let auth: string | null = "unset";
    const rf = new Runflow({
      // Use an absolute URL so `new Request(...)` works in Node test env;
      // the SDK itself happily accepts relative baseUrls in the browser.
      baseUrl: "http://proxy.test/api/runflow",
      fetch: mockFetch((req) => {
        auth = req.headers.get("authorization");
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }),
    });
    await rf.health.check();
    expect(auth).toBeNull();
  });
});

describe("models.run + runs.wait", () => {
  it("dispatches a run, polls, and resolves with succeeded", async () => {
    let polls = 0;
    const rf = new Runflow({
      apiKey: "rf_live_x",
      fetch: mockFetch((req) => {
        const url = new URL(req.url);
        if (req.method === "POST" && url.pathname.endsWith("/runs")) {
          return new Response(JSON.stringify({ id: "run_1", status_code: "queued" }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        if (req.method === "GET" && url.pathname === "/v1/runs/run_1") {
          polls++;
          const status = polls < 2 ? "running" : "succeeded";
          return new Response(
            JSON.stringify({
              id: "run_1",
              status_code: status,
              output: { outputs: [{ url: "https://cdn/x.png" }] },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("not found", { status: 404 });
      }),
    });
    const dispatched = await rf.models.run("runflow/background-removal", {
      input: { image_url: "https://cdn/in.png" },
    });
    expect(dispatched.id).toBe("run_1");
    const final = await rf.runs.wait(dispatched.id, { pollIntervalMs: 1 });
    expect(final.status_code).toBe("succeeded");
  });

  it("throws RunFailedError when status_code is failed", async () => {
    const rf = new Runflow({
      apiKey: "rf_live_x",
      fetch: mockFetch(() => {
        return new Response(
          JSON.stringify({
            id: "run_2",
            status_code: "failed",
            error: { message: "bad input" },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }),
    });
    await expect(rf.runs.wait("run_2", { pollIntervalMs: 1 })).rejects.toBeInstanceOf(
      RunFailedError,
    );
  });

  it("surfaces HTTP errors as RunflowError with status", async () => {
    const rf = new Runflow({
      apiKey: "rf_live_x",
      fetch: mockFetch(
        () =>
          new Response(JSON.stringify({ error: { message: "rate limited" } }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    });
    try {
      await rf.health.check();
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RunflowError);
      expect((err as RunflowError).status).toBe(429);
    }
  });
});

describe("models.run + runs.get — path encoding", () => {
  it("encodes each model id segment", async () => {
    let seenUrl = "";
    const rf = new Runflow({
      apiKey: "rf_live_x",
      fetch: mockFetch((req) => {
        seenUrl = req.url;
        return new Response(JSON.stringify({ id: "r", status_code: "queued" }), {
          headers: { "Content-Type": "application/json" },
        });
      }),
    });
    await rf.models.run("space owner/has spaces/runs slug", {});
    expect(seenUrl).toMatch(/\/v1\/models\/space%20owner\/has%20spaces\/runs%20slug\/runs/);
  });

  it("rejects model id with empty / dot / dot-dot segments", async () => {
    const rf = new Runflow({ apiKey: "rf_live_x", fetch: mockFetch(() => new Response("")) });
    await expect(rf.models.run("runflow//background-removal", {})).rejects.toThrow(
      /invalid model id/,
    );
    await expect(rf.models.run("runflow/../secret", {})).rejects.toThrow(/invalid model id/);
    await expect(rf.models.run("./foo", {})).rejects.toThrow(/invalid model id/);
  });

  it("rejects empty model id", async () => {
    const rf = new Runflow({ apiKey: "rf_live_x", fetch: mockFetch(() => new Response("")) });
    await expect(rf.models.run("", {})).rejects.toThrow(/required/);
  });

  it("rejects run id with `/` or empty", async () => {
    const rf = new Runflow({ apiKey: "rf_live_x", fetch: mockFetch(() => new Response("")) });
    await expect(rf.runs.get("foo/bar")).rejects.toThrow(/invalid run id/);
    await expect(rf.runs.get("")).rejects.toThrow(/required/);
  });
});

describe("tools.run — type-contract enforcement", () => {
  it("throws when buildRequest returns a non-plain object", async () => {
    const { defineTool, imageInput, imageOutput } = await import("../src/tools/index.js");
    const tool = defineTool({
      id: "bad-body",
      name: "Bad body",
      model: "runflow/background-removal",
      inputs: { image: imageInput({ source: "runtime" }) },
      output: { image: imageOutput() },
      // @ts-expect-error — array is not a ToolRequestBody, but we want runtime guard too
      buildRequest: () => [],
    });
    const rf = new Runflow({ apiKey: "rf_live_x", fetch: mockFetch(() => new Response("")) });
    await expect(
      rf.tools.run(tool, { image: "https://cdn/x.png" }, { pollIntervalMs: 1 }),
    ).rejects.toThrow(/buildRequest must return a plain object/);
  });

  it("default extractor throws when no image URL is present in run.output", async () => {
    const { defineTool, imageInput, imageOutput } = await import("../src/tools/index.js");
    const tool = defineTool({
      id: "missing-image",
      name: "Missing image",
      model: "runflow/background-removal",
      inputs: { image: imageInput({ source: "runtime" }) },
      output: { image: imageOutput() },
      buildRequest: ({ image }) => ({ input: { image_url: image } }),
      // intentionally no extractOutput — default extractor handles it
    });
    const rf = new Runflow({
      apiKey: "rf_live_x",
      fetch: mockFetch((req) => {
        if (req.method === "POST") {
          return new Response(JSON.stringify({ id: "run_e", status_code: "queued" }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        // Run returns no image
        return new Response(
          JSON.stringify({ id: "run_e", status_code: "succeeded", output: { foo: "bar" } }),
          { headers: { "Content-Type": "application/json" } },
        );
      }),
    });
    await expect(
      rf.tools.run(tool, { image: "https://cdn/x.png" }, { pollIntervalMs: 1 }),
    ).rejects.toThrow(/could not find an image URL/);
  });
});

describe("tools.run", () => {
  it("merges presets and runtime args, then extracts output", async () => {
    const { defineTool, imageInput, textInput, imageOutput, extractFirstImageUrl } = await import(
      "../src/tools/index.js"
    );

    const tool = defineTool({
      id: "scene-test",
      name: "Scene test",
      model: "google/nano-banana-pro/edit",
      inputs: {
        image: imageInput({ source: "runtime" }),
        prompt: textInput({ source: "user", label: "Scene" }),
        style: textInput({ source: "preset", value: "editorial" }),
      },
      output: { image: imageOutput() },
      buildRequest: (vals) => ({
        input: { prompt: `${vals.prompt}, ${vals.style}`, image_urls: [vals.image] },
      }),
      extractOutput: (raw) => ({ image: extractFirstImageUrl(raw) ?? "" }),
    });

    const seen: { body?: unknown } = {};
    const rf = new Runflow({
      apiKey: "rf_live_x",
      fetch: mockFetch(async (req) => {
        const url = new URL(req.url);
        if (req.method === "POST") {
          seen.body = await req.json();
          return new Response(JSON.stringify({ id: "run_t", status_code: "queued" }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            id: "run_t",
            status_code: "succeeded",
            output: { outputs: [{ url: "https://cdn/out.png" }] },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }),
    });

    const result = await rf.tools.run(
      tool,
      { image: "https://cdn/in.png", prompt: "on a rooftop" },
      { pollIntervalMs: 1 },
    );
    expect(result.output.image).toBe("https://cdn/out.png");

    const sent = seen.body as { input: { prompt: string; image_urls: string[] } };
    expect(sent.input.prompt).toBe("on a rooftop, editorial");
    expect(sent.input.image_urls).toEqual(["https://cdn/in.png"]);
  });
});
