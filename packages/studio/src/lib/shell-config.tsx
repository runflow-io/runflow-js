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

export interface StudioShellProps {
  /**
   * The workflow catalogue the shell offers — cards, chat-agent tools,
   * package steps. Defaults to the built-in `WORKFLOWS`. Pass a filtered
   * or extended list to build a vertical studio.
   */
  tools?: ReadonlyArray<Workflow>;
  /**
   * Initial canvas content. A URL string loads as a single starting
   * asset; an array of `SampleAsset`s replaces the bundled samples.
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

/**
 * Read the shell configuration. Components rendered outside a
 * StudioShell (storybooks, tests) fall back to the defaults.
 */
export function useShellConfig(): ResolvedShellConfig {
  const fromContext = useContext(ShellConfigContext);
  if (fromContext) return fromContext;
  if (!fallbackConfig) fallbackConfig = resolveShellConfig({});
  return fallbackConfig;
}
