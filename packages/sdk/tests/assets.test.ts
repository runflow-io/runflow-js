import { describe, expect, it } from "vitest";
import { Runflow, RunflowError } from "../src/index.js";

function mockFetch(handler: (req: Request) => Response | Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as string, init);
    return Promise.resolve(handler(req));
  }) as typeof fetch;
}

const ASSET_ID = "11111111-2222-3333-4444-555555555555";
const SIGNED_URL = `https://storage.example/org/assets/${ASSET_ID}/photo.png?X-Amz-Signature=abc`;

function uploadBackend(
  opts: { onPut?: (req: Request) => void; onConfirm?: (body: unknown) => void } = {},
) {
  const calls: string[] = [];
  const fetch = mockFetch(async (req) => {
    const url = new URL(req.url);
    calls.push(`${req.method} ${url.host}${url.pathname}`);
    if (req.method === "POST" && url.pathname.endsWith("/v1/asset-uploads")) {
      return Response.json(
        { asset_id: ASSET_ID, upload_url: "https://storage.example/presigned-put?sig=xyz" },
        { status: 201 },
      );
    }
    if (
      req.method === "PUT" &&
      url.host === "storage.example" &&
      url.pathname === "/presigned-put"
    ) {
      opts.onPut?.(req);
      return new Response(null, { status: 200 });
    }
    if (
      req.method === "POST" &&
      url.pathname.endsWith(`/v1/asset-uploads/${ASSET_ID}/confirmations`)
    ) {
      opts.onConfirm?.(await req.json());
      return Response.json(
        {
          id: ASSET_ID,
          name: "photo.png",
          url: SIGNED_URL,
          thumbnail_url: null,
          asset_type: "image",
          mime_type: "image/png",
          size_bytes: 3,
          created_at: "2026-06-10T00:00:00Z",
        },
        { status: 201 },
      );
    }
    return new Response("not found", { status: 404 });
  });
  return { fetch, calls };
}

describe("rf.assets.upload", () => {
  it("runs the 3-step presigned flow and returns a signed https url + stable ref", async () => {
    let putAuth: string | null = "sentinel";
    let putContentType: string | null = null;
    let confirmBody: unknown;
    const backend = uploadBackend({
      onPut: (req) => {
        putAuth = req.headers.get("authorization");
        putContentType = req.headers.get("content-type");
      },
      onConfirm: (body) => {
        confirmBody = body;
      },
    });
    const rf = new Runflow({ apiKey: "rf_live_x", fetch: backend.fetch });

    const asset = await rf.assets.upload(
      new File([new Uint8Array(3)], "photo.png", { type: "image/png" }),
    );

    expect(asset.id).toBe(ASSET_ID);
    expect(asset.url).toBe(SIGNED_URL);
    expect(asset.url.startsWith("https://")).toBe(true);
    expect(asset.ref).toBe(`runflow://assets/${ASSET_ID}`);
    expect(asset.mimeType).toBe("image/png");
    expect(asset.sizeBytes).toBe(3);
    // The presigned PUT must not leak the API key — the URL is the auth.
    expect(putAuth).toBeNull();
    expect(putContentType).toBe("image/png");
    expect(confirmBody).toEqual({ folder_id: null });
    expect(backend.calls).toEqual([
      "POST api.runflow.io/v1/asset-uploads",
      "PUT storage.example/presigned-put",
      `POST api.runflow.io/v1/asset-uploads/${ASSET_ID}/confirmations`,
    ]);
  });

  it("works through a proxy base for the API steps while the PUT stays absolute", async () => {
    const backend = uploadBackend();
    const rf = new Runflow({
      baseUrl: "http://app.local/api/runflow",
      fetch: backend.fetch,
    });
    const asset = await rf.assets.upload(new File(["x"], "a.png", { type: "image/png" }));
    expect(asset.id).toBe(ASSET_ID);
    expect(backend.calls[0]).toBe("POST app.local/api/runflow/v1/asset-uploads");
    expect(backend.calls[1]).toBe("PUT storage.example/presigned-put");
    expect(backend.calls[2]).toBe(
      `POST app.local/api/runflow/v1/asset-uploads/${ASSET_ID}/confirmations`,
    );
  });

  it("uploads a raw Blob when filename is provided, and rejects one without", async () => {
    const backend = uploadBackend();
    const rf = new Runflow({ apiKey: "rf_live_x", fetch: backend.fetch });
    const blob = new Blob([new Uint8Array(2)], { type: "image/png" });
    await expect(rf.assets.upload(blob)).rejects.toThrow(/filename/);
    const asset = await rf.assets.upload(blob, { filename: "mask.png" });
    expect(asset.id).toBe(ASSET_ID);
  });

  it("passes folderId through to the confirmation", async () => {
    let confirmBody: unknown;
    const backend = uploadBackend({
      onConfirm: (b) => {
        confirmBody = b;
      },
    });
    const rf = new Runflow({ apiKey: "rf_live_x", fetch: backend.fetch });
    await rf.assets.upload(new File(["x"], "a.png", { type: "image/png" }), { folderId: "fold_1" });
    expect(confirmBody).toEqual({ folder_id: "fold_1" });
  });

  it("rejects files over the 50 MB cap without any network call", async () => {
    let called = false;
    const rf = new Runflow({
      apiKey: "rf_live_x",
      fetch: mockFetch(() => {
        called = true;
        return new Response("nope");
      }),
    });
    const big = { size: 52_428_801, type: "image/png", name: "big.png" } as File;
    await expect(rf.assets.upload(big, { filename: "big.png" })).rejects.toThrow(/50 MB/);
    expect(called).toBe(false);
  });

  it("surfaces a failed storage PUT with status and code", async () => {
    const rf = new Runflow({
      apiKey: "rf_live_x",
      fetch: mockFetch((req) => {
        const url = new URL(req.url);
        if (req.method === "POST" && url.pathname === "/v1/asset-uploads") {
          return Response.json({ asset_id: ASSET_ID, upload_url: "https://storage.example/p" });
        }
        if (req.method === "PUT") return new Response("denied", { status: 403 });
        return new Response("not found", { status: 404 });
      }),
    });
    const err = await rf.assets
      .upload(new File(["x"], "a.png", { type: "image/png" }))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RunflowError);
    expect((err as RunflowError).status).toBe(403);
    expect((err as RunflowError).message).toMatch(/storage PUT failed/);
  });

  it("rejects a malformed upload-session response", async () => {
    const rf = new Runflow({
      apiKey: "rf_live_x",
      fetch: mockFetch(() => Response.json({ nope: true })),
    });
    await expect(rf.assets.upload(new File(["x"], "a.png", { type: "image/png" }))).rejects.toThrow(
      /upload session/,
    );
  });
});
