import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudioShell } from "../src/components/StudioShell.js";
import { SAMPLES } from "../src/data/samples.js";
import { WORKFLOWS } from "../src/data/workflows.js";
import { taskDescription } from "../src/lib/sentinel.js";
import { DEFAULT_COPY, resolveShellConfig } from "../src/lib/shell-config.js";

describe("resolveShellConfig", () => {
  it("zero props resolves to the built-in catalogue, samples, sentinel on, default copy", () => {
    const c = resolveShellConfig({});
    expect(c.workflows).toBe(WORKFLOWS);
    expect(c.samples).toBe(SAMPLES);
    expect(c.sentinel.enabled).toBe(true);
    expect(c.sentinel.taskDescription).toBe(taskDescription);
    expect(c.copy).toEqual(DEFAULT_COPY);
  });

  it("tools replaces the workflow catalogue", () => {
    const custom = [WORKFLOWS[0], WORKFLOWS[1]].filter(Boolean);
    const c = resolveShellConfig({ tools: custom });
    expect(c.workflows).toBe(custom);
    expect(c.samples).toBe(SAMPLES); // other axes untouched
  });

  it("source as a URL string becomes a single starting asset", () => {
    const c = resolveShellConfig({ source: "https://cdn.example/photo.jpg" });
    expect(c.samples).toHaveLength(1);
    expect(c.samples[0]).toMatchObject({
      id: "source",
      url: "https://cdn.example/photo.jpg",
      tags: [],
    });
  });

  it("source as an array replaces the samples", () => {
    const custom = [{ id: "a", title: "A", url: "https://cdn/a.png", tags: ["on-model"] }];
    const c = resolveShellConfig({ source: custom });
    expect(c.samples).toBe(custom);
  });

  it("sentinel can be disabled and its task description overridden", () => {
    const fn = () => "judge against the brand guide";
    const c = resolveShellConfig({ sentinel: { enabled: false, taskDescription: fn } });
    expect(c.sentinel.enabled).toBe(false);
    expect(c.sentinel.taskDescription).toBe(fn);
  });

  it("copy shallow-merges over the defaults", () => {
    const c = resolveShellConfig({ copy: { brandName: "Estates", brandTag: "" } });
    expect(c.copy.brandName).toBe("Estates");
    expect(c.copy.brandTag).toBe("");
    expect(c.copy.assetsTitle).toBe(DEFAULT_COPY.assetsTitle);
  });
});

describe("StudioShell props (render smoke)", () => {
  it("renders with zero props — original branding and samples", () => {
    const html = renderToString(createElement(StudioShell, {}));
    expect(html).toContain("rfs-root");
    expect(html).toContain("flow"); // Run<span>flow</span>
    expect(html).toContain("BETA");
    expect(html).toContain("Assets");
  });

  it("applies copy + source + tools overrides", () => {
    const html = renderToString(
      createElement(StudioShell, {
        tools: WORKFLOWS.filter((w) => w.id === "background-removal"),
        source: "https://cdn.example/listing.jpg",
        sentinel: { enabled: false },
        copy: {
          brandName: "Estates Studio",
          brandTag: "",
          assetsTitle: "Listings",
          avatarInitials: "",
        },
      }),
    );
    expect(html).toContain("Estates Studio");
    expect(html).not.toContain("rfs-brand-tag");
    expect(html).toContain("Listings");
    expect(html).toContain("https://cdn.example/listing.jpg");
    expect(html).not.toContain("rfs-avatar");
  });
});
