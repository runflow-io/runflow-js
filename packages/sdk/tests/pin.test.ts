import { describe, expect, it } from "vitest";
import { composePinPrompt, composeRegionPrompt, pinRegion } from "../src/tools/pin.js";

describe("pinRegion", () => {
  it("maps all nine grid regions", () => {
    expect(pinRegion({ x: 0.1, y: 0.1 })).toBe("upper-left");
    expect(pinRegion({ x: 0.5, y: 0.1 })).toBe("upper-center");
    expect(pinRegion({ x: 0.9, y: 0.1 })).toBe("upper-right");
    expect(pinRegion({ x: 0.1, y: 0.5 })).toBe("middle-left");
    expect(pinRegion({ x: 0.5, y: 0.5 })).toBe("middle-center");
    expect(pinRegion({ x: 0.9, y: 0.5 })).toBe("middle-right");
    expect(pinRegion({ x: 0.1, y: 0.9 })).toBe("lower-left");
    expect(pinRegion({ x: 0.5, y: 0.9 })).toBe("lower-center");
    expect(pinRegion({ x: 0.9, y: 0.9 })).toBe("lower-right");
  });

  it("puts exact band boundaries into the next band (matches the shell's historical behavior)", () => {
    expect(pinRegion({ x: 0.33, y: 0.33 })).toBe("middle-center");
    expect(pinRegion({ x: 0.66, y: 0.66 })).toBe("lower-right");
    expect(pinRegion({ x: 0, y: 0 })).toBe("upper-left");
    expect(pinRegion({ x: 1, y: 1 })).toBe("lower-right");
  });
});

describe("composeRegionPrompt / composePinPrompt", () => {
  it("produces the verbatim template the studio shell has always dispatched", () => {
    // This exact string is the contract with google/nano-banana-pro/edit.
    // If it changes, pin edits behave differently for every consumer.
    expect(composeRegionPrompt("upper-center", "remove the price tag")).toBe(
      "Edit the upper-center area of this image: remove the price tag. Photoreal product photography, preserve the rest of the image, true colors and lighting.",
    );
  });

  it("composePinPrompt is composeRegionPrompt over pinRegion", () => {
    const pin = { x: 0.25, y: 0.25 };
    expect(composePinPrompt(pin, "remove the price tag")).toBe(
      composeRegionPrompt(pinRegion(pin), "remove the price tag"),
    );
    expect(composePinPrompt(pin, "remove the price tag")).toContain("Edit the upper-left area");
  });
});
