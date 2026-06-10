/**
 * Endpoint configuration for the Studio's network calls.
 *
 * All URLs are relative to the host page so the Studio works behind any
 * proxy the customer mounts. They default to a single base path
 * (`/api/runflow`) with sub-paths the proxy package routes; callers can
 * override individually via `mount(target, { urls: { ... } })`.
 *
 * Module-level so the assorted lib files (runflow, sentinel, chat,
 * generation) can read them without threading URLs through every
 * function signature. `setStudioUrls` is called once by `mount()` per
 * embed.
 */
export const URLS = {
  /** Runflow API proxy. Forwards to `api.runflow.io`. */
  runflowProxy: "/api/runflow",
  /** Optional dev-only proxy for unreleased models (logo-fix, etc.). Empty disables. */
  runflowDevProxy: "",
  /** Same-origin proxy for cross-origin source images (dodges CORS). */
  imageProxy: "/api/runflow/image",
  /** Multipart upload endpoint (writes to customer storage, returns a public URL). */
  upload: "/api/runflow/upload",
  /** Chat agent SSE endpoint. */
  chat: "/api/runflow/chat",
  /** Sentinel evaluation API. */
  sentinel: "/api/runflow/sentinel",
};

export type StudioUrls = typeof URLS;

const DEFAULT_URLS: StudioUrls = { ...URLS };
const customized = new Set<keyof StudioUrls>();

export function setStudioUrls(overrides: Partial<StudioUrls>): void {
  for (const key of Object.keys(overrides) as Array<keyof StudioUrls>) {
    const v = overrides[key];
    if (typeof v === "string") {
      URLS[key] = v;
      // Passing the default value back (e.g. a full urls object copied
      // from the docs) is not a customization — only a real override
      // should switch behavior (like uploads off the presigned path).
      if (v === DEFAULT_URLS[key]) customized.delete(key);
      else customized.add(key);
    }
  }
}

/** Whether the host overrode an endpoint to a non-default value. */
export function isUrlCustomized(key: keyof StudioUrls): boolean {
  return customized.has(key);
}
