import type { AnyInput } from "@runflow/sdk";
import type { AnyTool } from "./types.js";

export interface Version {
  id: string;
  sourceUrl: string;
  outputUrl: string;
  toolId: string;
  runId?: string;
  createdAt: number;
}

export interface StudioState {
  /** Currently selected source image URL. */
  sourceUrl: string | null;
  /** Currently selected tool. */
  selectedTool: AnyTool | null;
  /** Form values for the selected tool, keyed by input name. */
  formValues: Record<string, unknown>;
  /** Run state. */
  runStatus: "idle" | "queued" | "running" | "complete" | "error";
  /** Run progress message (free-form). */
  runMessage: string;
  /** Last error if `runStatus === "error"`. */
  runError: string | null;
  /** Result versions, newest last. */
  versions: Version[];
  /** Index of the currently-displayed version, or -1 for "source". */
  currentVersion: number;
}

export type StudioAction =
  | { type: "set-source"; url: string }
  | { type: "select-tool"; tool: AnyTool }
  | { type: "set-form-value"; key: string; value: unknown }
  | { type: "reset-form" }
  | { type: "run-start" }
  | { type: "run-progress"; status: "queued" | "running"; message: string }
  | {
      type: "run-complete";
      toolId: string;
      runId: string;
      sourceUrl: string;
      outputUrl: string;
    }
  | { type: "run-error"; message: string }
  | { type: "show-version"; index: number };

export function initialState(): StudioState {
  return {
    sourceUrl: null,
    selectedTool: null,
    formValues: {},
    runStatus: "idle",
    runMessage: "",
    runError: null,
    versions: [],
    currentVersion: -1,
  };
}

export function reducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "set-source":
      return { ...state, sourceUrl: action.url, versions: [], currentVersion: -1 };
    case "select-tool":
      return { ...state, selectedTool: action.tool, formValues: defaults(action.tool) };
    case "set-form-value":
      return { ...state, formValues: { ...state.formValues, [action.key]: action.value } };
    case "reset-form":
      return state.selectedTool
        ? { ...state, formValues: defaults(state.selectedTool) }
        : state;
    case "run-start":
      return { ...state, runStatus: "queued", runMessage: "Dispatching…", runError: null };
    case "run-progress":
      return { ...state, runStatus: action.status, runMessage: action.message };
    case "run-complete": {
      const version: Version = {
        id: `v${state.versions.length + 1}`,
        sourceUrl: action.sourceUrl,
        outputUrl: action.outputUrl,
        toolId: action.toolId,
        runId: action.runId,
        createdAt: Date.now(),
      };
      return {
        ...state,
        runStatus: "complete",
        runMessage: "Done",
        versions: [...state.versions, version],
        currentVersion: state.versions.length,
      };
    }
    case "run-error":
      return { ...state, runStatus: "error", runError: action.message, runMessage: "" };
    case "show-version":
      return { ...state, currentVersion: action.index };
    default:
      return state;
  }
}

function defaults(tool: AnyTool): Record<string, unknown> {
  const vals: Record<string, unknown> = {};
  const entries = Object.entries(tool.inputs as Record<string, AnyInput>);
  for (const [k, def] of entries) {
    if (def.source === "preset") continue;
    if (def.default !== undefined) vals[k] = def.default;
    else if (def.type === "color") vals[k] = "#FFFFFF";
    else if (def.type === "text" || def.type === "select") vals[k] = "";
  }
  return vals;
}
