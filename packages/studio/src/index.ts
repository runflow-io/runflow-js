/**
 * @runflow/studio — Embeddable Runflow Studio.
 *
 * @example npm
 * ```ts
 * import { mount } from "@runflow/studio";
 * import "@runflow/studio/styles.css";
 *
 * const studio = mount("#studio", { baseUrl: "/api/runflow" });
 * ```
 *
 * @example script tag (CDN)
 * ```html
 * <link rel="stylesheet" href="https://cdn.runflow.io/studio.css" />
 * <script src="https://cdn.runflow.io/studio.js"></script>
 * <div id="studio"></div>
 * <script>
 *   RunflowStudio.mount('#studio', { baseUrl: '/api/runflow' });
 * </script>
 * ```
 */

import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { StudioShell } from "./components/StudioShell.js";
import { injectStyles } from "./styles.js";
import { BUILTIN_TOOLS } from "./tools/index.js";
import { DEFAULT_SAMPLES, type StudioInstance, type StudioOptions } from "./types.js";

/**
 * Mount the Studio into the given target. Returns an instance with
 * `unmount()` and `update()` controls.
 */
export function mount(
  target: string | HTMLElement,
  options: StudioOptions = {},
): StudioInstance {
  const el = resolveTarget(target);
  if (!el) {
    throw new Error(`@runflow/studio: target ${JSON.stringify(target)} not found in DOM.`);
  }
  if (options.injectStyles !== false) {
    injectStyles(el.ownerDocument ?? document);
  }
  el.classList.add("rfs-root");
  el.setAttribute("data-theme", resolveThemeMode(options.theme));

  applyThemeOverrides(el, options.theme);

  const root = createRoot(el);
  let current: StudioOptions = options;
  render(root, current);

  return {
    unmount() {
      root.unmount();
      el.classList.remove("rfs-root");
      el.removeAttribute("data-theme");
    },
    update(next) {
      current = { ...current, ...next };
      if (next.theme !== undefined) {
        el.setAttribute("data-theme", resolveThemeMode(next.theme));
        applyThemeOverrides(el, next.theme);
      }
      render(root, current);
    },
  };
}

function render(root: Root, options: StudioOptions) {
  const tools = options.tools ?? BUILTIN_TOOLS;
  const samples = options.samples ?? DEFAULT_SAMPLES;
  root.render(createElement(StudioShell, { options, tools, samples }));
}

function resolveTarget(target: string | HTMLElement): HTMLElement | null {
  if (typeof target === "string") return document.querySelector(target);
  return target;
}

function resolveThemeMode(theme: StudioOptions["theme"]): "dark" | "light" {
  if (theme === "light") return "light";
  if (theme === "dark" || theme === undefined) return "dark";
  if (theme === "auto") {
    return typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  // Object overrides — they layer on top of the dark base.
  return "dark";
}

function applyThemeOverrides(el: HTMLElement, theme: StudioOptions["theme"]) {
  if (!theme || typeof theme === "string") return;
  const map: Array<[keyof typeof theme, string]> = [
    ["bg0", "--rfs-bg-0"],
    ["bg1", "--rfs-bg-1"],
    ["bg2", "--rfs-bg-2"],
    ["bg3", "--rfs-bg-3"],
    ["ink0", "--rfs-ink-0"],
    ["ink1", "--rfs-ink-1"],
    ["ink2", "--rfs-ink-2"],
    ["accent", "--rfs-accent"],
  ];
  for (const [key, cssVar] of map) {
    const value = theme[key];
    if (typeof value === "string") el.style.setProperty(cssVar, value);
  }
}

export type { StudioOptions, StudioInstance, StudioSample, StudioTheme } from "./types.js";
export { BUILTIN_TOOLS, findTool } from "./tools/index.js";
