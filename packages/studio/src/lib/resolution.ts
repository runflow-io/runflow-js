// Resolution helpers — bucket pixel dims into 1K / 2K / 4K labels and
// pre-load an image URL to read its natural dimensions. Used by the
// canvas pill, version thumbs, workflow input annotations, and the
// upload + workflow-output hooks that capture dims into asset state.
//
// Bucket boundaries (long edge):
//   ≤ 1280 → 1K   (anything from 512² up through 1280px)
//   ≤ 2560 → 2K   (the typical "balanced" model output)
//   > 2560 → 4K   (print-ready)

export type ResBucket = "1K" | "2K" | "4K";

export function resBucket(width: number, height: number): ResBucket {
  const maxEdge = Math.max(width, height);
  if (maxEdge <= 1280) return "1K";
  if (maxEdge <= 2560) return "2K";
  return "4K";
}

// True iff the value is one of our three supported bucket strings.
// Lets the rest of the app accept Version.request.values.resolution
// (`string | undefined`) without leaking `as` casts.
export function isResBucket(v: unknown): v is ResBucket {
  return v === "1K" || v === "2K" || v === "4K";
}

// Bucket to show on the canvas / version pill. Prefers the bucket the
// user explicitly asked for over the one derived from the returned
// pixel dimensions: a "2K" run on a 9:16 ratio can come back at e.g.
// 1620×2880, whose long edge crosses the 2560 boundary and would read
// as "4K" by raw pixels — confusing because the chat agent (which
// honors the requested param) just confirmed "2K". When `requested`
// is missing (uploaded photos, samples, workflows that don't take a
// resolution input), we fall back to the dimension-derived bucket.
export function displayBucket(width: number, height: number, requested?: string): ResBucket {
  if (isResBucket(requested)) return requested;
  return resBucket(width, height);
}

export function formatDims(width: number, height: number): string {
  return `${width}×${height}`;
}

export function formatRes(width: number, height: number): string {
  return `${formatDims(width, height)} · ${resBucket(width, height)}`;
}

// Snap actual w/h to a common label (1:1, 4:5, 9:16, 16:9, 21:9, 3:4,
// 4:3, 2:3, 3:2) when within ~2.5% — image generators typically pad by
// a few pixels, so e.g. 1024×768 (4.000:3.001) should still read "4:3".
// Falls back to the reduced gcd form for anything unusual.
const COMMON_RATIOS: Array<[number, number]> = [
  [1, 1],
  [4, 5],
  [5, 4],
  [9, 16],
  [16, 9],
  [9, 21],
  [21, 9],
  [3, 4],
  [4, 3],
  [2, 3],
  [3, 2],
];
export function aspectRatioLabel(width: number, height: number): string {
  if (!width || !height) return "";
  const r = width / height;
  let best: [number, number] | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const [w, h] of COMMON_RATIOS) {
    const diff = Math.abs(r - w / h) / (w / h);
    if (diff < bestDiff) {
      best = [w, h];
      bestDiff = diff;
    }
  }
  if (best && bestDiff <= 0.025) return `${best[0]}:${best[1]}`;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(width, height);
  return `${width / g}:${height / g}`;
}

// True if asking the model to generate at `target` would mean upscaling
// past the source's native resolution.
export function isUpscale(sourceBucket: ResBucket, target: ResBucket): boolean {
  const order: Record<ResBucket, number> = { "1K": 1, "2K": 2, "4K": 4 };
  return order[target] > order[sourceBucket];
}

// Topaz Upscale (topaz/upscale/image) caps output at 24 megapixels.
// Source × factor² has to stay under this or the API rejects the run.
export const TOPAZ_MAX_OUTPUT_MP = 24;

export function topazOutputMP(width: number, height: number, factor: number): number {
  return (width * height * factor * factor) / 1_000_000;
}

export function topazExceedsCap(width: number, height: number, factor: number): boolean {
  return topazOutputMP(width, height, factor) > TOPAZ_MAX_OUTPUT_MP;
}

// Probe a URL's natural dimensions by pre-loading an Image. Resolves to
// null if the image errors out — callers should keep going regardless,
// the dim is purely informational.
export function probeImageDims(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
