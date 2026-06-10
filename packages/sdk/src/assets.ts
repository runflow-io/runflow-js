import type { Runflow } from "./client.js";
import { RunflowError } from "./errors.js";

/** Matches the backend's asset-upload cap. */
const MAX_UPLOAD_BYTES = 52_428_800; // 50 MB

/** Storage PUTs move whole files; give them a roomier default than JSON calls. */
const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000;

/** A confirmed, ready-to-use uploaded asset. */
export interface UploadedAsset {
  /** Asset id (uuid). */
  id: string;
  /**
   * Short-TTL signed HTTPS URL for the file. Pass this directly to model
   * inputs (`image_url`, `image_urls`, `mask_url`, …) — every model accepts
   * HTTP(S) media URLs. Mint a fresh one via re-upload or `GET /v1/assets/{id}`
   * if you hold onto it past its expiry.
   */
  url: string;
  /**
   * Canonical stable reference (`runflow://assets/{id}`). Accepted today by
   * ComfyUI workflow file inputs; once the API resolves asset refs at model
   * dispatch, prefer this over the expiring `url`.
   */
  ref: string;
  /** Original filename. */
  name: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl: string | null;
  createdAt: string | null;
}

export interface UploadOptions {
  /** Required when uploading a raw `Blob`; defaults to `file.name` for `File`s. */
  filename?: string;
  /** Optional asset-library folder to file the upload under. */
  folderId?: string;
  /** Timeout for the storage PUT step. Default: 120 s. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface UploadSession {
  asset_id: string;
  upload_url: string;
}

interface RawAsset {
  id: string;
  name: string;
  url: string;
  thumbnail_url?: string | null;
  mime_type: string;
  size_bytes: number;
  created_at?: string | null;
}

/**
 * Asset uploads — the browser-safe path for getting a local file in front
 * of a model.
 *
 * Mirrors the Runflow platform's own upload flow:
 *   1. `POST /v1/asset-uploads` — create a presigned upload session
 *   2. `PUT <upload_url>` — send the bytes straight to storage (no auth)
 *   3. `POST /v1/asset-uploads/{id}/confirmations` — verify + create the asset
 *
 * Steps 1 and 3 go through the configured base (so they work through
 * `@runflow-io/proxy`, which allows them by default); step 2 goes directly
 * to the storage host using the presigned URL.
 *
 * @example Browser, through a proxy
 * ```ts
 * const rf = new Runflow({ baseUrl: "/api/runflow" });
 * const asset = await rf.assets.upload(fileInput.files[0]);
 * await rf.models.run("google/nano-banana-pro/edit", {
 *   input: { prompt, image_urls: [asset.url] },
 * });
 * ```
 */
export class AssetsResource {
  constructor(private readonly client: Runflow) {}

  async upload(file: File | Blob, opts: UploadOptions = {}): Promise<UploadedAsset> {
    const filename =
      opts.filename ??
      (typeof File !== "undefined" && file instanceof File ? file.name : undefined);
    if (!filename) {
      throw new RunflowError("assets.upload: pass `filename` when uploading a raw Blob", {
        code: "missing_filename",
      });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new RunflowError(
        `assets.upload: file is ${file.size} bytes; the limit is ${MAX_UPLOAD_BYTES} (50 MB)`,
        { code: "file_too_large" },
      );
    }
    const mimeType = file.type || "application/octet-stream";

    // 1. Create the presigned upload session.
    const session = await this.client.request<UploadSession>("POST", "/v1/asset-uploads", {
      body: { filename, mime_type: mimeType, size_bytes: file.size },
      signal: opts.signal,
    });
    if (!session?.asset_id || !session.upload_url) {
      throw new RunflowError("assets.upload: upload session response missing asset_id/upload_url", {
        code: "bad_upload_session",
      });
    }

    // 2. PUT the bytes to storage. Presigned URL — no auth header, and it
    // must NOT go through the API base, so this bypasses request().
    const putRes = await this.client.rawFetch(
      session.upload_url,
      { method: "PUT", headers: { "Content-Type": mimeType }, body: file, signal: opts.signal },
      opts.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS,
    );
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      throw new RunflowError(
        `assets.upload: storage PUT failed (HTTP ${putRes.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
        { status: putRes.status, code: "storage_put_failed" },
      );
    }

    // 3. Confirm — the backend HEADs the object, creates the asset record,
    // and returns it with `url` already signed for GET.
    const asset = await this.client.request<RawAsset>(
      "POST",
      `/v1/asset-uploads/${encodeURIComponent(session.asset_id)}/confirmations`,
      { body: { folder_id: opts.folderId ?? null }, signal: opts.signal },
    );
    if (!asset?.id || !asset.url) {
      throw new RunflowError("assets.upload: confirmation response missing id/url", {
        code: "bad_upload_confirmation",
      });
    }

    return {
      id: asset.id,
      url: asset.url,
      ref: `runflow://assets/${asset.id}`,
      name: asset.name,
      mimeType: asset.mime_type,
      sizeBytes: asset.size_bytes,
      thumbnailUrl: asset.thumbnail_url ?? null,
      createdAt: asset.created_at ?? null,
    };
  }
}
