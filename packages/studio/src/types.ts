import type { ToolDef } from "@runflow-io/sdk";

/** A tool with its specific input/output generics erased — what the UI
 *  iterates over. The original generics survive when used directly via
 *  `runflow.tools.run(tool, …)`. */
// biome-ignore lint/suspicious/noExplicitAny: existential — any specific tool fits.
export type AnyTool = ToolDef<any, any>;

export interface StudioSample {
  id: string;
  title: string;
  url: string;
  tags?: string[];
}

export interface StudioTheme {
  /** Background base (rfs-bg-0). */
  bg0?: string;
  /** Elevated surface (rfs-bg-1). */
  bg1?: string;
  /** Secondary surface (rfs-bg-2). */
  bg2?: string;
  /** Borders (rfs-bg-3). */
  bg3?: string;
  /** Primary text (rfs-ink-0). */
  ink0?: string;
  /** Secondary text (rfs-ink-1). */
  ink1?: string;
  /** Tertiary text (rfs-ink-2). */
  ink2?: string;
  /** Brand accent (rfs-accent). */
  accent?: string;
}

export interface StudioOptions {
  /** Base URL of your proxy. Default: `/api/runflow`. */
  baseUrl?: string;
  /** Tools to expose. Default: all built-in tools. */
  tools?: ReadonlyArray<AnyTool>;
  /** Source images shown in the picker. Default: a built-in starter set. */
  samples?: ReadonlyArray<StudioSample>;
  /** Light / dark / auto, or token overrides. */
  theme?: "light" | "dark" | "auto" | StudioTheme;
  /** Hide the source picker — caller supplies images via `update({ source })`. */
  hideSourcePicker?: boolean;
  /** Currently selected source URL. */
  source?: string;
  /**
   * Inject the default stylesheet into the document head when mounting.
   * Default: `true`. Pass `false` if you ship your own CSS.
   */
  injectStyles?: boolean;
  /** Attribution metadata sent on every run. */
  user?: { id: string; email?: string };
  /** Event callbacks. */
  on?: {
    ready?: () => void;
    sourceChange?: (url: string) => void;
    runStart?: (e: { toolId: string }) => void;
    runComplete?: (e: { toolId: string; runId: string; output: Record<string, unknown> }) => void;
    runError?: (e: { toolId: string; error: Error }) => void;
  };
}

export interface StudioInstance {
  /** Remove the embed from the DOM. */
  unmount(): void;
  /** Update options at runtime. */
  update(options: Partial<StudioOptions>): void;
}

/** Default starter samples — neutral product photos sourced from the
 *  prototype's `samples.generated.json`. URLs are CDN-immutable so they
 *  stay reachable across versions. */
export const DEFAULT_SAMPLES: ReadonlyArray<StudioSample> = [
  {
    id: "sneaker-white",
    title: "Sneaker",
    url: "https://v3b.fal.media/files/b/0a991a66/8YuTT7o8iAEI5FuH3u81m_2e00493442924f0f9a654023c4eda645.jpg",
    tags: ["product"],
  },
  {
    id: "watch-leather",
    title: "Wristwatch",
    url: "https://v3b.fal.media/files/b/0a991a67/WK4AAoEW-WP8uTMRHEBEv_b7b616e0f2e94cb8b9d1d98be0317e12.jpg",
    tags: ["product"],
  },
  {
    id: "perfume-bottle",
    title: "Perfume bottle",
    url: "https://v3b.fal.media/files/b/0a991a67/wspXRxZt1H_09O0vv1_88_8c0fd4daa8444042b2df13df274e0f6a.jpg",
    tags: ["product"],
  },
  {
    id: "headphones-matte",
    title: "Headphones",
    url: "https://v3b.fal.media/files/b/0a991a68/uT_0eO6uBMe5AZg49cS7G_80a503a1793e4c3d9287bed4cb415536.jpg",
    tags: ["product"],
  },
];
