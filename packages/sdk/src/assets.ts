import type { Runflow } from "./client.js";
import { RunflowError } from "./errors.js";

/**
 * Pre-flight mirror of the backend's asset-upload cap (the backend stays
 * authoritative — it re-validates `size_bytes` at session create).
 */
const MAX_UPLOAD_BYTES = 52_428_800; // 50 MB

/**
 * Floor for the storage PUT timeout. The effective default scales with
 * file size (assumes a ~2 Mbit/s uplink floor) so a 50 MB file on a slow
 * connection isn't doomed by a fixed cap.
 */
const MIN_UPLOAD_TIMEOUT_MS = 120_000;
const UPLOAD_BYTES_PER_SECOND_FLOOR = 256 * 1024; // ~2 Mbit/s

/**
 * Transient-failure retry schedule, mirroring the studio shell's upload
 * path: a flaky network mid-flow (e.g. after the user painted a mask)
 * shouldn't lose the work. Applies to network errors, timeouts, and 5xx.
 */
const RETRY_DELAYS_MS = [250, 750];

/** A confirmed, ready-to-use uploaded asset. */
export interface UploadedAsset {
  /** Asset id (uuid). The durable identifier — store THIS, not `url`. */
  id: string;
  /**
   * Short-TTL signed HTTPS URL for the file. Pass it directly to model
   * inputs (`image_url`, `image_urls`, `mask_url`, …) right away. Do not
   * persist it — it expires; re-mint a fresh one with `rf.assets.get(id)`
   * (allowed through the proxy by default).
   */
  url: string;
  /**
   * Canonical stable reference (`runflow://assets/{id}`). Accepted today by
   * ComfyUI workflow file inputs; once the API resolves asset refs at model
   * dispatch (RUN-418), prefer this over the expiring `url`.
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
  /**
   * Timeout for the storage PUT step only (the JSON steps use the
   * client's `requestTimeoutMs`). Default: scales with file size,
   * minimum 120 s.
   */
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface UploadSession {
  asset_id: string;
  upload_url: string;
}

/**
 * Raw asset shape from the API (see
 * docs/plans/run-384-sdk-gaps/backend-contract.md for the contract this
 * mirrors — `Asset.FullValidator` with `url` signed on confirm/get).
 */
interface RawAsset {
  id: string;
  name: string;
  url: string;
  thumbnail_url?: string | null;
  mime_type: string;
  size_bytes: number;
  created_at?: string | null;
}

function isTransient(err: unknown): boolean {
  if (!(err instanceof RunflowError)) return false;
  if (err.code === "network_error" || err.code === "request_timeout") return true;
  return (err.status ?? 0) >= 500;
}

function abortError(): RunflowError {
  return new RunflowError("assets: aborted by signal", { code: "aborted" });
}

/** Sleep that wakes up immediately when the signal aborts. */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      if (signal?.aborted) throw abortError();
      await abortableSleep(RETRY_DELAYS_MS[attempt - 1] ?? 0, signal);
      if (signal?.aborted) throw abortError();
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || signal?.aborted) throw err;
    }
  }
  throw lastErr;
}

function mapAsset(asset: RawAsset): UploadedAsset {
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
 * to the storage host using the presigned URL. Every step retries
 * transient failures (network/timeout/5xx) twice with backoff.
 *
 * @example Browser, through a proxy
 * ```ts
 * const rf = new Runflow({ baseUrl: "/api/runflow" });
 * const asset = await rf.assets.upload(fileInput.files[0]);
 * await rf.models.run("google/nano-banana-pro/edit", {
 *   input: { prompt, image_urls: [asset.url] },
 * });
 * // Later, if you stored asset.id and the signed url expired:
 * const fresh = await rf.assets.get(asset.id);
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
    const session = await withRetry(
      () =>
        this.client.request<UploadSession>("POST", "/v1/asset-uploads", {
          body: { filename, mime_type: mimeType, size_bytes: file.size },
          signal: opts.signal,
        }),
      opts.signal,
    );
    if (!session?.asset_id || !session.upload_url) {
      throw new RunflowError("assets.upload: upload session response missing asset_id/upload_url", {
        code: "bad_upload_session",
      });
    }
    if (!session.upload_url.startsWith("https://")) {
      throw new RunflowError("assets.upload: refusing non-https upload_url from the API", {
        code: "insecure_upload_url",
      });
    }

    // 2. PUT the bytes to storage. Presigned URL — no auth header, and it
    // must NOT go through the API base, so this bypasses request(). The
    // presigned URL stays valid across retries.
    const putTimeoutMs =
      opts.timeoutMs ??
      Math.max(MIN_UPLOAD_TIMEOUT_MS, Math.ceil(file.size / UPLOAD_BYTES_PER_SECOND_FLOOR) * 1000);
    await withRetry(async () => {
      const putRes = await this.client.rawFetch(
        session.upload_url,
        { method: "PUT", headers: { "Content-Type": mimeType }, body: file, signal: opts.signal },
        putTimeoutMs,
      );
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        throw new RunflowError(
          `assets.upload: storage PUT failed (HTTP ${putRes.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
          { status: putRes.status, code: "storage_put_failed" },
        );
      }
    }, opts.signal);

    // 3. Confirm — the backend HEADs the object, creates the asset record,
    // and returns it with `url` already signed for GET.
    const asset = await withRetry(
      () =>
        this.client.request<RawAsset>(
          "POST",
          `/v1/asset-uploads/${encodeURIComponent(session.asset_id)}/confirmations`,
          { body: { folder_id: opts.folderId ?? null }, signal: opts.signal },
        ),
      opts.signal,
    );
    if (!asset?.id || !asset.url) {
      throw new RunflowError("assets.upload: confirmation response missing id/url", {
        code: "bad_upload_confirmation",
      });
    }

    return mapAsset(asset);
  }

  /**
   * Fetch an asset by id with a freshly signed `url`. Use this instead of
   * persisting `UploadedAsset.url`, which expires. Allowed through
   * `@runflow-io/proxy` by default (`GET /v1/assets/:id`).
   */
  async get(id: string, opts: { signal?: AbortSignal } = {}): Promise<UploadedAsset> {
    if (!id || id.includes("/") || id === "." || id === "..") {
      throw new RunflowError(`assets.get: invalid asset id ${JSON.stringify(id)}`, {
        code: "invalid_asset_id",
      });
    }
    const asset = await this.client.request<RawAsset>(
      "GET",
      `/v1/assets/${encodeURIComponent(id)}`,
      { signal: opts.signal },
    );
    if (!asset?.id || !asset.url) {
      throw new RunflowError("assets.get: response missing id/url", { code: "bad_asset_response" });
    }
    return mapAsset(asset);
  }
}
