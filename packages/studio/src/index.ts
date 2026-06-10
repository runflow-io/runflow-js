/**
 * @runflow-io/studio — Embeddable Runflow Studio.
 *
 * The mount API is intentionally tiny — the heavy lifting (state,
 * dispatch, sentinel, chat, packages) lives in the StudioShell and the
 * lib/ modules.
 *
 * @example
 * ```ts
 * import { mount } from "@runflow-io/studio";
 * const studio = mount("#studio", {
 *   urls: { runflowProxy: "/api/runflow" },
 *   theme: "auto",
 * });
 * ```
 */

import { createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { StudioShell } from "./components/StudioShell.js";
import { type StudioUrls, setStudioUrls } from "./lib/urls.js";
import { injectStyles } from "./styles.js";

export interface ThemeOverrides {
  accent?: string;
  bg0?: string;
  bg1?: string;
  bg2?: string;
  bg3?: string;
  ink0?: string;
  ink1?: string;
  ink2?: string;
  ink3?: string;
}

export interface StudioMountOptions {
  /** Endpoint overrides. See `StudioUrls` for the full shape. */
  urls?: Partial<StudioUrls>;
  /** `light` | `dark` | `auto` | per-token overrides. Default `dark`. */
  theme?: "light" | "dark" | "auto" | ThemeOverrides;
  /** Inject the default stylesheet into <head>. Default true. */
  injectStyles?: boolean;
}

export interface StudioInstance {
  unmount(): void;
}

export function mount(
  target: string | HTMLElement,
  options: StudioMountOptions = {},
): StudioInstance {
  const el = resolveTarget(target);
  if (!el) {
    throw new Error(`@runflow-io/studio: target ${JSON.stringify(target)} not found.`);
  }
  if (options.urls) setStudioUrls(options.urls);
  if (options.injectStyles !== false) {
    injectStyles(el.ownerDocument ?? document);
  }
  applyThemeAttribute(el, options.theme);
  applyThemeOverrides(el, options.theme);

  const root = createRoot(el);
  root.render(createElement(StudioShell));

  return {
    unmount() {
      root.unmount();
      el.removeAttribute("data-theme");
    },
  };
}

function resolveTarget(target: string | HTMLElement): HTMLElement | null {
  if (typeof target === "string") return document.querySelector(target);
  return target;
}

function applyThemeAttribute(el: HTMLElement, theme: StudioMountOptions["theme"]): void {
  let mode: "dark" | "light" = "dark";
  if (theme === "light") mode = "light";
  else if (theme === "auto") {
    mode =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
  }
  el.setAttribute("data-theme", mode);
}

function applyThemeOverrides(el: HTMLElement, theme: StudioMountOptions["theme"]): void {
  if (!theme || typeof theme === "string") return;
  const map: Array<[keyof ThemeOverrides, string]> = [
    ["accent", "--rfs-accent"],
    ["bg0", "--rfs-bg-0"],
    ["bg1", "--rfs-bg-1"],
    ["bg2", "--rfs-bg-2"],
    ["bg3", "--rfs-bg-3"],
    ["ink0", "--rfs-ink-0"],
    ["ink1", "--rfs-ink-1"],
    ["ink2", "--rfs-ink-2"],
    ["ink3", "--rfs-ink-3"],
  ];
  for (const [key, cssVar] of map) {
    const v = theme[key];
    if (typeof v === "string") el.style.setProperty(cssVar, v);
  }
}

export { StudioShell } from "./components/StudioShell.js";
export { setStudioUrls, URLS } from "./lib/urls.js";
export type { StudioUrls } from "./lib/urls.js";
