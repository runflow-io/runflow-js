import { describe, expect, it } from "vitest";
import { Runflow } from "../src/index.js";

function mockFetch(handler: (req: Request) => Response | Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as string, init);
    return Promise.resolve(handler(req));
  }) as typeof fetch;
}

describe("auth mode — apiKey vs baseUrl", () => {
  it("server mode (apiKey only) sends the bearer header", async () => {
    let auth: string | null = null;
    const rf = new Runflow({
      apiKey: "rf_live_x",
      fetch: mockFetch((req) => {
        auth = req.headers.get("authorization");
        return Response.json({ ok: true });
      }),
    });
    await rf.health.check();
    expect(auth).toBe("Bearer rf_live_x");
  });

  it("proxy mode (baseUrl) never sends Authorization — even when apiKey is also passed", async () => {
    // The documented contract: "If both are set, baseUrl wins — the bearer
    // header is omitted." The key must not reach the proxy origin.
    let auth: string | null = "sentinel";
    const rf = new Runflow({
      apiKey: "rf_live_should_not_leak",
      baseUrl: "http://app.local/api/runflow",
      fetch: mockFetch((req) => {
        auth = req.headers.get("authorization");
        return Response.json({ ok: true });
      }),
    });
    await rf.health.check();
    expect(auth).toBeNull();
  });
});
