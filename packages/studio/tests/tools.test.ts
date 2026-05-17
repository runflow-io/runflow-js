import { describe, expect, it } from "vitest";
import {
  BUILTIN_TOOLS,
  aiScene,
  backgroundColor,
  backgroundRemoval,
  findTool,
  smartResize,
} from "../src/tools/index.js";
import { mergeToolValues } from "@runflow/sdk";

describe("builtin tools catalogue", () => {
  it("covers every original workflow", () => {
    const ids = new Set(BUILTIN_TOOLS.map((t) => t.id));
    for (const id of [
      "ai-edit",
      "ai-scene",
      "reference-inpaint",
      "product-isolation",
      "smart-resize",
      "outpaint",
      "background-color",
      "background-removal",
      "tag-removal",
      "object-removal",
      "model-removal",
      "skin-fix",
      "topaz-upscale",
    ]) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
  });

  it("findTool returns by id", () => {
    expect(findTool("background-removal")?.model).toBe("runflow/background-removal");
    expect(findTool("nope")).toBeUndefined();
  });

  it("background-removal buildRequest produces a clean body", () => {
    const merged = mergeToolValues(backgroundRemoval, {
      image: "https://cdn/photo.png",
    } as never);
    const body = backgroundRemoval.buildRequest(merged) as { input: { image_url: string } };
    expect(body.input.image_url).toBe("https://cdn/photo.png");
  });

  it("background-color converts hex to RGB ints", () => {
    const merged = mergeToolValues(backgroundColor, {
      image: "https://cdn/photo.png",
      color: "#F1F1F1",
    } as never);
    const body = backgroundColor.buildRequest(merged) as {
      input: { color_red: number; color_green: number; color_blue: number };
    };
    expect(body.input).toMatchObject({ color_red: 241, color_green: 241, color_blue: 241 });
  });

  it("smart-resize honors aspect_ratio + resolution", () => {
    const merged = mergeToolValues(smartResize, {
      image: "https://cdn/photo.png",
      aspect_ratio: "9:16",
      resolution: "2K",
    } as never);
    const body = smartResize.buildRequest(merged) as {
      input: { aspect_ratio: string; resolution: string };
    };
    expect(body.input.aspect_ratio).toBe("9:16");
    expect(body.input.resolution).toBe("2K");
  });

  it("ai-scene wraps the user prompt in the editorial template", () => {
    const merged = mergeToolValues(aiScene, {
      image: "https://cdn/photo.png",
      prompt: "on a windswept rooftop at golden hour",
    } as never);
    const body = aiScene.buildRequest(merged) as { input: { prompt: string; image_urls: string[] } };
    expect(body.input.prompt).toMatch(/Place the subject of this image on a windswept rooftop/);
    expect(body.input.image_urls).toEqual(["https://cdn/photo.png"]);
  });
});
