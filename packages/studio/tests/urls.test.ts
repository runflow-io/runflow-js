import { describe, expect, it } from "vitest";
import { URLS, isUrlCustomized, setStudioUrls } from "../src/lib/urls.js";

describe("setStudioUrls customization tracking", () => {
  it("re-passing the default value is not a customization", () => {
    setStudioUrls({ upload: "/api/runflow/upload" });
    expect(isUrlCustomized("upload")).toBe(false);
  });

  it("a non-default value marks the endpoint customized; defaults restore it", () => {
    setStudioUrls({ upload: "/my/custom/upload" });
    expect(isUrlCustomized("upload")).toBe(true);
    expect(URLS.upload).toBe("/my/custom/upload");
    setStudioUrls({ upload: "/api/runflow/upload" });
    expect(isUrlCustomized("upload")).toBe(false);
  });
});
