/**
 * Brush-mask controller — the dual-canvas painting engine behind the
 * Studio shell's mask workflows, exposed as a framework-free primitive
 * so headless consumers (any framework, or none) get working brush +
 * mask creation without rebuilding it.
 *
 * The model: two canvases.
 *   - A *visible* overlay the host renders on top of the image. Strokes
 *     land here in a translucent highlight so the user sees what they've
 *     painted. Sized to the image's on-screen rect (DPR-aware).
 *   - A *hidden* canvas the controller owns, same CSS size, black
 *     background + white strokes — the actual mask source.
 *
 * `toMaskBlob(naturalWidth, naturalHeight)` scales the hidden canvas to
 * the image's natural resolution, thresholds to pure black/white, and
 * returns a PNG blob ready for `rf.assets.upload` / `mask_url` inputs.
 *
 * @example
 * ```ts
 * const mask = createMaskController({ brushSize: 45 });
 * mask.attach(overlayCanvas);
 * mask.syncToDisplay(rect.width, rect.height, window.devicePixelRatio);
 * canvas.onpointerdown = (e) => mask.beginStroke(e.offsetX, e.offsetY);
 * canvas.onpointermove = (e) => mask.strokeTo(e.offsetX, e.offsetY);
 * canvas.onpointerup = () => mask.endStroke();
 * const blob = await mask.toMaskBlob(img.naturalWidth, img.naturalHeight);
 * ```
 */

export interface MaskControllerOptions {
  /** Brush radius in display pixels. Default 45. */
  brushSize?: number;
  /** Fill style for the visible overlay strokes. Default amber at 55%. */
  overlayStyle?: string;
  /** Cap for the devicePixelRatio applied to the visible canvas. Default 2. */
  maxDevicePixelRatio?: number;
  /** Sample every Nth pixel when computing coverage. Default 8. */
  coverageSampleStep?: number;
  /**
   * Canvas factory for the internal (hidden/full-res) canvases.
   * Defaults to `document.createElement("canvas")` — override it in
   * non-DOM environments or tests.
   */
  createCanvas?: (width: number, height: number) => HTMLCanvasElement;
}

export interface MaskController {
  /** Connect the visible overlay canvas the host renders. */
  attach(visible: HTMLCanvasElement): void;
  /** Drop canvas references (e.g. on unmount). */
  detach(): void;
  /**
   * Size both canvases to the image's displayed rect and reset the
   * mask. Call on image load and on resize.
   */
  syncToDisplay(width: number, height: number, devicePixelRatio?: number): void;
  setBrushSize(px: number): void;
  brushSize(): number;
  /** Begin a stroke at canvas-local display coordinates. */
  beginStroke(x: number, y: number): void;
  /** Continue the active stroke; interpolates so fast moves don't gap. */
  strokeTo(x: number, y: number): void;
  endStroke(): void;
  isStroking(): boolean;
  /** Stamp one brush dab without an active stroke. */
  paintAt(x: number, y: number): void;
  /** Wipe the mask (visible overlay cleared, hidden back to black). */
  clear(): void;
  /** Painted percentage of the canvas, 0..100 (sampled). */
  coverage(): number;
  /**
   * Render the mask at the image's natural resolution as a pure
   * black/white PNG blob. Null when nothing is attached/synced yet.
   */
  toMaskBlob(naturalWidth: number, naturalHeight: number): Promise<Blob | null>;
}

const DEFAULT_BRUSH_SIZE = 45;
const DEFAULT_OVERLAY_STYLE = "rgba(251,191,36,0.55)";
const DEFAULT_MAX_DPR = 2;
const DEFAULT_COVERAGE_STEP = 8;

function domCreateCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === "undefined") {
    throw new Error("createMaskController: no DOM available — pass `createCanvas` in the options.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createMaskController(opts: MaskControllerOptions = {}): MaskController {
  const overlayStyle = opts.overlayStyle ?? DEFAULT_OVERLAY_STYLE;
  const maxDpr = opts.maxDevicePixelRatio ?? DEFAULT_MAX_DPR;
  const sampleStep = opts.coverageSampleStep ?? DEFAULT_COVERAGE_STEP;
  const createCanvas = opts.createCanvas ?? domCreateCanvas;

  let size = opts.brushSize ?? DEFAULT_BRUSH_SIZE;
  let visible: HTMLCanvasElement | null = null;
  let hidden: HTMLCanvasElement | null = null;
  let stroking = false;
  let lastPos: { x: number; y: number } | null = null;

  const paintAt = (x: number, y: number) => {
    if (!visible || !hidden) return;
    const vctx = visible.getContext("2d");
    if (vctx) {
      vctx.fillStyle = overlayStyle;
      vctx.beginPath();
      vctx.arc(x, y, size, 0, Math.PI * 2);
      vctx.fill();
    }
    const hctx = hidden.getContext("2d");
    if (hctx) {
      hctx.fillStyle = "white";
      hctx.beginPath();
      hctx.arc(x, y, size, 0, Math.PI * 2);
      hctx.fill();
    }
  };

  return {
    attach(canvas) {
      visible = canvas;
    },
    detach() {
      visible = null;
      hidden = null;
      stroking = false;
      lastPos = null;
    },
    syncToDisplay(width, height, devicePixelRatio = 1) {
      if (!visible || width <= 0 || height <= 0) return;
      const dpr = Math.min(maxDpr, devicePixelRatio || 1);
      visible.width = Math.round(width * dpr);
      visible.height = Math.round(height * dpr);
      if (visible.style) {
        visible.style.width = `${width}px`;
        visible.style.height = `${height}px`;
      }
      const vctx = visible.getContext("2d");
      if (vctx) {
        vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        vctx.clearRect(0, 0, width, height);
      }
      hidden = createCanvas(Math.round(width), Math.round(height));
      hidden.width = Math.round(width);
      hidden.height = Math.round(height);
      const hctx = hidden.getContext("2d");
      if (hctx) {
        hctx.fillStyle = "black";
        hctx.fillRect(0, 0, hidden.width, hidden.height);
      }
      stroking = false;
      lastPos = null;
    },
    setBrushSize(px) {
      size = px;
    },
    brushSize() {
      return size;
    },
    beginStroke(x, y) {
      stroking = true;
      lastPos = { x, y };
      paintAt(x, y);
    },
    strokeTo(x, y) {
      if (!stroking) return;
      const last = lastPos;
      if (last) {
        // Interpolate between samples so a fast drag doesn't leave gaps;
        // step density scales with the brush so small brushes stay smooth.
        const dist = Math.hypot(x - last.x, y - last.y);
        const steps = Math.max(1, Math.ceil(dist / (size * 0.4)));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          paintAt(last.x + (x - last.x) * t, last.y + (y - last.y) * t);
        }
      } else {
        paintAt(x, y);
      }
      lastPos = { x, y };
    },
    endStroke() {
      stroking = false;
      lastPos = null;
    },
    isStroking() {
      return stroking;
    },
    paintAt,
    clear() {
      if (visible) {
        const vctx = visible.getContext("2d");
        vctx?.clearRect(0, 0, visible.width, visible.height);
      }
      if (hidden) {
        const hctx = hidden.getContext("2d");
        if (hctx) {
          hctx.fillStyle = "black";
          hctx.fillRect(0, 0, hidden.width, hidden.height);
        }
      }
      stroking = false;
      lastPos = null;
    },
    coverage() {
      if (!hidden) return 0;
      const ctx = hidden.getContext("2d");
      if (!ctx) return 0;
      const data = ctx.getImageData(0, 0, hidden.width, hidden.height).data;
      let white = 0;
      let total = 0;
      for (let yy = 0; yy < hidden.height; yy += sampleStep) {
        for (let xx = 0; xx < hidden.width; xx += sampleStep) {
          const i = (yy * hidden.width + xx) * 4;
          if ((data[i] ?? 0) > 200) white += 1;
          total += 1;
        }
      }
      return total === 0 ? 0 : (white / total) * 100;
    },
    async toMaskBlob(naturalWidth, naturalHeight) {
      if (!hidden || naturalWidth <= 0 || naturalHeight <= 0) return null;
      const out = createCanvas(naturalWidth, naturalHeight);
      out.width = naturalWidth;
      out.height = naturalHeight;
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(hidden, 0, 0, out.width, out.height);
      const id = ctx.getImageData(0, 0, out.width, out.height);
      // Threshold to pure B&W — inpaint models want a binary mask, not
      // the anti-aliased greys the scale-up introduces.
      for (let i = 0; i < id.data.length; i += 4) {
        const v = (id.data[i] ?? 0) > 127 ? 255 : 0;
        id.data[i] = v;
        id.data[i + 1] = v;
        id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
      return new Promise((resolve) => out.toBlob((b) => resolve(b), "image/png"));
    },
  };
}
