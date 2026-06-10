import { describe, expect, it } from "vitest";
import { createMaskController } from "../src/lib/mask.js";

/**
 * Minimal canvas fake with a real(ish) rasterizer: fills arcs and rects
 * onto an RGBA pixel grid so coverage() and the B&W threshold are
 * exercised on actual pixels, not mocks.
 */
function fakeCanvas(width = 0, height = 0) {
  let data = new Uint8ClampedArray(0);
  let fillStyleValue = "";
  let pendingArc: { x: number; y: number; r: number } | null = null;

  const canvas = {
    width,
    height,
    style: {} as Record<string, string>,
    getContext(kind: string) {
      if (kind !== "2d") return null;
      ensure();
      return ctx;
    },
    toBlob(cb: (b: Blob | null) => void, type?: string) {
      ensure();
      cb(new Blob([new Uint8Array(data)], { type: type ?? "image/png" }));
    },
  };

  function ensure() {
    const want = canvas.width * canvas.height * 4;
    if (data.length !== want) data = new Uint8ClampedArray(want);
  }
  function setPixel(x: number, y: number, v: number) {
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
    const i = (y * canvas.width + x) * 4;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  function styleToValue(): number {
    return fillStyleValue === "white" ? 255 : 0;
  }

  const ctx = {
    set fillStyle(v: string) {
      fillStyleValue = v;
    },
    get fillStyle() {
      return fillStyleValue;
    },
    setTransform() {},
    clearRect() {
      ensure();
      data.fill(0);
    },
    fillRect(x: number, y: number, w: number, h: number) {
      ensure();
      const v = styleToValue();
      for (let yy = Math.floor(y); yy < y + h; yy++)
        for (let xx = Math.floor(x); xx < x + w; xx++) setPixel(xx, yy, v);
    },
    beginPath() {
      pendingArc = null;
    },
    arc(x: number, y: number, r: number) {
      pendingArc = { x, y, r };
    },
    fill() {
      ensure();
      if (!pendingArc) return;
      const v = styleToValue();
      const { x, y, r } = pendingArc;
      for (let yy = Math.floor(y - r); yy <= y + r; yy++)
        for (let xx = Math.floor(x - r); xx <= x + r; xx++)
          if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r) setPixel(xx, yy, v);
    },
    getImageData(_x: number, _y: number, w: number, h: number) {
      ensure();
      // Return a live copy of the grid clipped to the request.
      const out = new Uint8ClampedArray(w * h * 4);
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) {
          const si = (yy * canvas.width + xx) * 4;
          const di = (yy * w + xx) * 4;
          out[di] = data[si] ?? 0;
          out[di + 1] = data[si + 1] ?? 0;
          out[di + 2] = data[si + 2] ?? 0;
          out[di + 3] = data[si + 3] ?? 0;
        }
      return { data: out, width: w, height: h };
    },
    putImageData(id: { data: Uint8ClampedArray; width: number; height: number }) {
      ensure();
      for (let yy = 0; yy < id.height; yy++)
        for (let xx = 0; xx < id.width; xx++) {
          const si = (yy * id.width + xx) * 4;
          setPixel(xx, yy, id.data[si] ?? 0);
        }
    },
    drawImage(
      src: ReturnType<typeof fakeCanvas>,
      _dx: number,
      _dy: number,
      dw: number,
      dh: number,
    ) {
      ensure();
      // Nearest-neighbour scale of the source fake onto this canvas.
      const sctx = src.getContext("2d");
      if (!sctx) return;
      const sdata = sctx.getImageData(0, 0, src.width, src.height);
      for (let yy = 0; yy < dh; yy++)
        for (let xx = 0; xx < dw; xx++) {
          const sx = Math.min(src.width - 1, Math.floor((xx / dw) * src.width));
          const sy = Math.min(src.height - 1, Math.floor((yy / dh) * src.height));
          const si = (sy * src.width + sx) * 4;
          setPixel(xx, yy, sdata.data[si] ?? 0);
        }
    },
  };

  return canvas;
}

type AnyCanvas = ReturnType<typeof fakeCanvas>;

function setup(brushSize = 20) {
  const created: AnyCanvas[] = [];
  const ctl = createMaskController({
    brushSize,
    createCanvas: (w, h) => {
      const c = fakeCanvas(w, h);
      created.push(c);
      return c as unknown as HTMLCanvasElement;
    },
  });
  const visible = fakeCanvas();
  ctl.attach(visible as unknown as HTMLCanvasElement);
  ctl.syncToDisplay(200, 100, 1);
  return { ctl, visible, created };
}

describe("createMaskController", () => {
  it("starts empty and reports 0 coverage", () => {
    const { ctl } = setup();
    expect(ctl.coverage()).toBe(0);
  });

  it("a stroke raises coverage; clear() resets it", () => {
    const { ctl } = setup(20);
    ctl.beginStroke(100, 50);
    ctl.endStroke();
    const after = ctl.coverage();
    expect(after).toBeGreaterThan(0);
    ctl.clear();
    expect(ctl.coverage()).toBe(0);
  });

  it("strokeTo interpolates so a fast drag has no gaps", () => {
    const { ctl } = setup(10);
    ctl.beginStroke(10, 50);
    // One big jump — interpolation should paint the span between.
    ctl.strokeTo(190, 50);
    ctl.endStroke();
    // A point midway along the drag must be painted.
    const mid = ctl.coverage();
    expect(mid).toBeGreaterThan(5); // a long painted band, not two dots
  });

  it("ignores strokeTo without beginStroke and tracks isStroking", () => {
    const { ctl } = setup();
    expect(ctl.isStroking()).toBe(false);
    ctl.strokeTo(50, 50);
    expect(ctl.coverage()).toBe(0);
    ctl.beginStroke(50, 50);
    expect(ctl.isStroking()).toBe(true);
    ctl.endStroke();
    expect(ctl.isStroking()).toBe(false);
  });

  it("toMaskBlob produces a full-res, thresholded mask", async () => {
    const { ctl, created } = setup(20);
    ctl.beginStroke(100, 50);
    ctl.endStroke();
    const blob = await ctl.toMaskBlob(400, 200);
    expect(blob).not.toBeNull();
    // The out canvas is the last one created by the factory (after the
    // hidden canvas); inspect its pixels: only 0 or 255, with both present.
    const out = created[created.length - 1];
    expect(out?.width).toBe(400);
    expect(out?.height).toBe(200);
    const ctx = out?.getContext("2d");
    const px = ctx ? ctx.getImageData(0, 0, 400, 200).data : new Uint8ClampedArray(0);
    let whites = 0;
    let blacks = 0;
    for (let i = 0; i < px.length; i += 4) {
      const v = px[i] ?? 0;
      expect(v === 0 || v === 255).toBe(true);
      if (v === 255) whites++;
      else blacks++;
    }
    expect(whites).toBeGreaterThan(0);
    expect(blacks).toBeGreaterThan(0);
  });

  it("toMaskBlob is null before any sync", async () => {
    const ctl = createMaskController({
      createCanvas: (w, h) => fakeCanvas(w, h) as unknown as HTMLCanvasElement,
    });
    expect(await ctl.toMaskBlob(100, 100)).toBeNull();
  });

  it("syncToDisplay applies the devicePixelRatio cap to the visible canvas", () => {
    const { visible, ctl } = setup();
    ctl.syncToDisplay(200, 100, 3); // capped at 2
    expect(visible.width).toBe(400);
    expect(visible.height).toBe(200);
    expect(visible.style.width).toBe("200px");
  });

  it("setBrushSize changes the painted dab size", () => {
    const { ctl } = setup(4);
    ctl.beginStroke(100, 50);
    ctl.endStroke();
    const small = ctl.coverage();
    ctl.clear();
    ctl.setBrushSize(40);
    ctl.beginStroke(100, 50);
    ctl.endStroke();
    const big = ctl.coverage();
    expect(big).toBeGreaterThan(small);
  });
});
