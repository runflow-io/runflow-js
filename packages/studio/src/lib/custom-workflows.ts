// Custom workflows = saved chains of edits the user can replay on any
// asset without re-doing the chat or re-clicking the cards. Stored
// per-user in localStorage; rendered as cards at the top of the Edits
// tab when at least one is saved.
//
// v1 limitation: stateless-only. We cannot persist Blob masks or File
// references through localStorage, so workflows that NEED a runtime
// canvas input (reference-inpaint) can't be part of a saved chain.
// The save action in History inspects the chain and disables itself
// when any step requires runtime input.

"use client";

import { useEffect, useState } from "react";
import type { VersionRequest } from "../components/WorkflowsPanel";

const STORAGE_KEY = "rfs-custom-workflows";

export type CustomStep = {
  workflowId: string;
  prompt?: string;
  values?: Record<string, string>;
  pin?: { x: number; y: number };
};

export type CustomWorkflow = {
  id: string;
  name: string;
  steps: CustomStep[];
  createdAt: number;
};

// Workflows that need runtime canvas input. Any chain containing one
// of these can't be saved as a custom in v1.
const STATEFUL_WORKFLOW_IDS = new Set(["reference-inpaint"]);

// True if a candidate chain (list of VersionRequests pulled from a
// version's history) can be persisted verbatim. Used by the Save
// affordance in the History tab.
export function chainIsSavable(steps: VersionRequest[]): boolean {
  if (steps.length === 0) return false;
  return steps.every((s) => !STATEFUL_WORKFLOW_IDS.has(s.workflowId));
}

export function reasonChainNotSavable(steps: VersionRequest[]): string | null {
  if (steps.length === 0) return "No steps to save";
  const stateful = steps.find((s) => STATEFUL_WORKFLOW_IDS.has(s.workflowId));
  if (stateful) {
    return `Can't save chains that include ${stateful.workflowId} yet (the brush mask and reference image only live during the run).`;
  }
  return null;
}

// Load + save + sub/unsub
function read(): CustomWorkflow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CustomWorkflow[];
  } catch {
    return [];
  }
}

function write(list: CustomWorkflow[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* private mode etc */
  }
}

let cached: CustomWorkflow[] = [];
if (typeof window !== "undefined") cached = read();

type Listener = (xs: CustomWorkflow[]) => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(cached);
}

export function listCustomWorkflows(): CustomWorkflow[] {
  return cached;
}

export function saveCustomWorkflow(name: string, steps: VersionRequest[]): CustomWorkflow {
  // Strip non-serialisable bits. mask/reference were already filtered
  // by chainIsSavable, but we belt-and-braces here.
  const cleanedSteps: CustomStep[] = steps.map((s) => ({
    workflowId: s.workflowId,
    ...(s.prompt ? { prompt: s.prompt } : {}),
    ...(s.values ? { values: { ...s.values } } : {}),
    ...(s.pin ? { pin: { ...s.pin } } : {}),
  }));
  return createCustomWorkflow(name, cleanedSteps);
}

// Create a recipe from already-cleaned CustomStep[]. Used by the
// editor, which builds steps directly (not from VersionRequest
// history) and has its own validation pass.
export function createCustomWorkflow(name: string, steps: CustomStep[]): CustomWorkflow {
  const id = `cw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const wf: CustomWorkflow = {
    id,
    name: name.trim() || "Custom edit",
    steps: cloneSteps(steps),
    createdAt: Date.now(),
  };
  cached = [wf, ...cached];
  write(cached);
  emit();
  return wf;
}

// Update an existing recipe's name and/or step list in place. The
// editor calls this on Save when editing a previously saved recipe.
// No-op if the id doesn't resolve.
export function updateCustomWorkflow(
  id: string,
  patch: { name?: string; steps?: CustomStep[] },
): CustomWorkflow | null {
  let updated: CustomWorkflow | null = null;
  cached = cached.map((w) => {
    if (w.id !== id) return w;
    const next: CustomWorkflow = {
      ...w,
      ...(patch.name !== undefined ? { name: patch.name.trim() || w.name } : {}),
      ...(patch.steps !== undefined ? { steps: cloneSteps(patch.steps) } : {}),
    };
    updated = next;
    return next;
  });
  if (!updated) return null;
  write(cached);
  emit();
  return updated;
}

function cloneSteps(steps: CustomStep[]): CustomStep[] {
  return steps.map((s) => ({
    workflowId: s.workflowId,
    ...(s.prompt ? { prompt: s.prompt } : {}),
    ...(s.values ? { values: { ...s.values } } : {}),
    ...(s.pin ? { pin: { ...s.pin } } : {}),
  }));
}

export function deleteCustomWorkflow(id: string) {
  cached = cached.filter((w) => w.id !== id);
  write(cached);
  emit();
}

export function renameCustomWorkflow(id: string, name: string) {
  updateCustomWorkflow(id, { name });
}

export function useCustomWorkflows(): CustomWorkflow[] {
  const [state, setState] = useState<CustomWorkflow[]>(() =>
    typeof window === "undefined" ? [] : read(),
  );
  useEffect(() => {
    const listener: Listener = (xs) => setState(xs);
    listeners.add(listener);
    setState(cached);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}

// Helper: from an asset's full version list and a target version id,
// return the chain that produced the target (skipping v0). Walks
// backwards from target along the version order; we treat the asset's
// versions as a linear sequence (which they are today; if a fork ever
// gets added this needs revisiting).
export function chainForVersion(
  versions: Array<{ id: string; request?: VersionRequest }>,
  targetVersionId: string,
): VersionRequest[] {
  const idx = versions.findIndex((v) => v.id === targetVersionId);
  if (idx <= 0) return []; // v0 has no request
  const chain: VersionRequest[] = [];
  for (let i = 1; i <= idx; i += 1) {
    const r = versions[i].request;
    if (r) chain.push(r);
  }
  return chain;
}
