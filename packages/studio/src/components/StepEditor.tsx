"use client";

// Shared building blocks for inline step editing — used by both the
// recipe editor (CustomEditorPanel in WorkflowsPanel.tsx) and the
// package action panel (renderSelectedActionContent in
// StudioShell.tsx).
//
// StepParamsForm renders a workflow's `inputs` array as an inline form
// against a flat `values` map. It's intentionally values-only so each
// caller can adapt it to their own step shape: recipe steps split
// `prompt` into its own slot, packages keep `prompt` inside `params`.
// The workflow_id / picker layer above decides which kinds are
// addable to a chain.
//
// StepPicker renders the buildable-workflows list for "+ Add step".
// Buildable = simple / prompt / prompt-zip; pin (ai-edit needs a
// runtime click), mask-only / mask-ref (need brush + reference at
// runtime), packages (no nested chains for now), and `soon` are
// excluded.

import { WORKFLOWS, type Workflow } from "../data/workflows";
import { useShellConfig } from "../lib/shell-config";
import { Icon } from "./icons";

export function buildableWorkflowsForChain(
  workflows: ReadonlyArray<Workflow> = WORKFLOWS,
): Workflow[] {
  return workflows.filter(
    (w) =>
      (w.kind === "simple" || w.kind === "prompt" || w.kind === "prompt-zip") &&
      w.id !== "reference-inpaint",
  );
}

// Inline params form for one step. Renders the workflow's inputs as
// the matching control type (color / text / textarea / select), bound
// to the supplied flat `values` map. Caller decides where each value
// is persisted (e.g. CustomStep.values vs PackageRecipeStep.params).
export function StepParamsForm({
  wf,
  values,
  onValueChange,
}: {
  wf: Workflow;
  values: Record<string, string>;
  onValueChange: (key: string, value: string) => void;
}) {
  const inputs = wf.inputs ?? [];
  if (inputs.length === 0) {
    return (
      <div className="rfs-help">
        No parameters. This step runs as-is on the previous step's output.
      </div>
    );
  }
  return (
    <>
      {inputs.map((inp) => {
        const value = values[inp.key] ?? "";
        const setValue = (v: string) => onValueChange(inp.key, v);
        if (inp.type === "color") {
          const color = value || ("default" in inp ? inp.default : undefined) || "#FFFFFF";
          return (
            <div key={inp.key} className="rfs-input-group">
              <label className="rfs-label">{inp.label}</label>
              <div className="rfs-color-row">
                <input type="color" value={color} onChange={(e) => setValue(e.target.value)} />
                <span className="rfs-color-hex">{color.toUpperCase()}</span>
              </div>
              {inp.help ? <div className="rfs-help">{inp.help}</div> : null}
            </div>
          );
        }
        if (inp.type === "text") {
          return (
            <div key={inp.key} className="rfs-input-group">
              <label className="rfs-label">{inp.label}</label>
              <input
                className="rfs-text"
                placeholder={inp.placeholder}
                maxLength={inp.maxlength}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              {inp.help ? <div className="rfs-help">{inp.help}</div> : null}
            </div>
          );
        }
        if (inp.type === "textarea") {
          return (
            <div key={inp.key} className="rfs-input-group">
              <label className="rfs-label">{inp.label}</label>
              <textarea
                className="rfs-textarea"
                placeholder={inp.placeholder}
                maxLength={inp.maxlength}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              {inp.help ? <div className="rfs-help">{inp.help}</div> : null}
            </div>
          );
        }
        if (inp.type === "select") {
          const current = value || inp.default || inp.options[0]?.value || "";
          return (
            <div key={inp.key} className="rfs-input-group">
              <label className="rfs-label">{inp.label}</label>
              <select
                className="rfs-select"
                value={current}
                onChange={(e) => setValue(e.target.value)}
              >
                {inp.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {inp.help ? <div className="rfs-help">{inp.help}</div> : null}
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

// Workflow picker for "+ Add step". Shows the buildable list filtered
// to the chain-safe kinds, and calls onPick when the user chooses
// one. Cancel collapses back to the "+ Add step" button.
export function StepPicker({
  open,
  onOpen,
  onCancel,
  onPick,
}: {
  open: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onPick: (wf: Workflow) => void;
}) {
  const { workflows } = useShellConfig();
  if (!open) {
    return (
      <button type="button" className="rfs-custom-editor-add" onClick={onOpen}>
        + Add step
      </button>
    );
  }
  const choices = buildableWorkflowsForChain(workflows);
  return (
    <div className="rfs-custom-editor-picker">
      <div className="rfs-custom-editor-picker-header">
        <span>Pick a workflow</span>
        <button type="button" className="rfs-link" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="rfs-custom-editor-picker-list">
        {choices.map((wf) => (
          <button
            key={wf.id}
            type="button"
            className="rfs-custom-editor-picker-item"
            onClick={() => onPick(wf)}
          >
            <div className="rfs-card-icon">{Icon[wf.id as keyof typeof Icon] ?? null}</div>
            <div className="rfs-card-text">
              <div className="rfs-card-name">{wf.name}</div>
              <div className="rfs-card-desc">{wf.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Build a step's default values map by reading the workflow's input
// defaults. Used by both the recipe editor and the package action
// panel when adding a new step so the row is immediately runnable.
export function defaultStepValues(wf: Workflow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const inp of wf.inputs ?? []) {
    if (inp.type === "select" && inp.default) out[inp.key] = inp.default;
    else if (inp.type === "color" && inp.default) out[inp.key] = inp.default;
  }
  return out;
}
