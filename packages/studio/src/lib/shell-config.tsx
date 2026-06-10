/**
 * StudioShell customization — the props surface that makes "fork the
 * shell for your vertical" real, and the context that distributes the
 * resolved configuration to every component in the tree.
 *
 * Zero props ⇒ identical behavior to the original shell: the built-in
 * workflow catalogue, the bundled sample assets, Sentinel on, default
 * copy. Each prop overrides exactly one axis.
 */

import { createContext, useContext } from "react";
import { SAMPLES, type SampleAsset } from "../data/samples";
import { WORKFLOWS, type Workflow } from "../data/workflows";
import { taskDescription as defaultTaskDescription } from "./sentinel";

export interface StudioSentinelOptions {
  /**
   * Run Sentinel quality evaluation on workflow outputs. Default true.
   * When false, no evals are dispatched and no quality badges render.
   */
  enabled?: boolean;
  /**
   * Override how the eval's task description is derived from a run.
   * Defaults to the built-in per-workflow templates.
   */
  taskDescription?: (
    workflowId: string,
    values: Record<string, string>,
    promptText?: string,
  ) => string;
}

export interface StudioCopy {
  /** Header brand name. Default "Runflow". */
  brandName: string;
  /** Small tag next to the brand. Default "BETA"; "" hides it. */
  brandTag: string;
  /** Header avatar initials. Default "RG"; "" hides the avatar. */
  avatarInitials: string;
  /** Left rail title. Default "Assets". */
  assetsTitle: string;
  /** Canvas empty-state heading. */
  emptyTitle: string;
  /** Canvas empty-state subline. */
  emptySubtitle: string;
}

/**
 * StudioShell customization. Two contracts to know:
 *
 * - `source` seeds the canvas at MOUNT — changing it later does not
 *   reset the user's assets (their edit history would be lost).
 * - Pass stable references for `tools`, `source` arrays, and
 *   `sentinel.taskDescription`; inline object literals for `copy` and
 *   `sentinel` are fine (compared field-wise).
 */
export interface StudioShellProps {
  /**
   * The workflow catalogue the shell offers — cards, chat-agent tools,
   * package steps. Defaults to the built-in `WORKFLOWS` (import it from
   * `@runflow-io/studio/headless` to filter/extend). Takes `Workflow[]`
   * — the card catalogue — NOT the SDK's `ToolDef`s.
   */
  tools?: ReadonlyArray<Workflow>;
  /**
   * Initial canvas content, read once at mount. A URL string loads as a
   * single starting asset; an array of `SampleAsset`s replaces the
   * bundled samples.
   */
  source?: string | ReadonlyArray<SampleAsset>;
  /** Sentinel (quality evaluation) configuration. */
  sentinel?: StudioSentinelOptions;
  /** Copy overrides, shallow-merged over the defaults. */
  copy?: Partial<StudioCopy>;
}

export interface ResolvedShellConfig {
  workflows: ReadonlyArray<Workflow>;
  samples: ReadonlyArray<SampleAsset>;
  sentinel: {
    enabled: boolean;
    taskDescription: (
      workflowId: string,
      values: Record<string, string>,
      promptText?: string,
    ) => string;
  };
  copy: StudioCopy;
}

export const DEFAULT_COPY: StudioCopy = {
  brandName: "Runflow",
  brandTag: "BETA",
  avatarInitials: "RG",
  assetsTitle: "Assets",
  emptyTitle: "No image selected",
  emptySubtitle: "Pick a sample from the left, or drop your own to get started.",
};

export function resolveShellConfig(props: StudioShellProps = {}): ResolvedShellConfig {
  const samples: ReadonlyArray<SampleAsset> =
    typeof props.source === "string"
      ? [{ id: "source", title: "Source", url: props.source, tags: [] }]
      : (props.source ?? SAMPLES);
  return {
    workflows: props.tools ?? WORKFLOWS,
    samples,
    sentinel: {
      enabled: props.sentinel?.enabled ?? true,
      taskDescription: props.sentinel?.taskDescription ?? defaultTaskDescription,
    },
    copy: { ...DEFAULT_COPY, ...(props.copy ?? {}) },
  };
}

const ShellConfigContext = createContext<ResolvedShellConfig | null>(null);

export const ShellConfigProvider = ShellConfigContext.Provider;

let fallbackConfig: ResolvedShellConfig | null = null;
let warnedFallback = false;

/**
 * Read the shell configuration. Components rendered outside a
 * StudioShell (storybooks, tests) fall back to the defaults — loudly,
 * because in an app that passed custom props this means the component
 * silently ignores them.
 */
export function useShellConfig(): ResolvedShellConfig {
  const fromContext = useContext(ShellConfigContext);
  if (fromContext) return fromContext;
  const isTest = typeof process !== "undefined" && process.env?.NODE_ENV === "test";
  if (!warnedFallback && typeof console !== "undefined" && !isTest) {
    warnedFallback = true;
    console.warn(
      "[@runflow-io/studio] a component rendered outside <StudioShell> is using the built-in defaults — custom tools/source/sentinel/copy props do not reach it.",
    );
  }
  if (!fallbackConfig) fallbackConfig = resolveShellConfig({});
  return fallbackConfig;
}
