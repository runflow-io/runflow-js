"use client";

// Right rail — tabs (Workflows / Chat / History) + workflow card grid +
// pinned action region for the selected card.
//
// The Chat tab is reserved for a future "describe what you want to do"
// agent; today it's an empty state.

import { useEffect, useMemo, useRef, useState } from "react";
import { SAMPLES, type SampleAsset } from "../data/samples";
import { WORKFLOWS, type Workflow } from "../data/workflows";
import {
  type CustomStep,
  type CustomWorkflow as CustomWfShape,
  chainForVersion,
  chainIsSavable,
  createCustomWorkflow,
  deleteCustomWorkflow,
  reasonChainNotSavable,
  saveCustomWorkflow,
  updateCustomWorkflow,
  useCustomWorkflows,
} from "../lib/custom-workflows";
import type { SentinelResult } from "../lib/sentinel";
import type { PartialStudioHandle } from "../lib/studio-handle";
import { summarizeRequest } from "../lib/version-summary";
import { ChatPanel } from "./ChatPanel";
import { SentinelChip } from "./SentinelBadge";
import { StepParamsForm, StepPicker, defaultStepValues } from "./StepEditor";
import { Icon } from "./icons";

// Snapshot of what the user actually asked for when this version was
// dispatched. Saved on the Version so the History tab can show
// "what did I ask for again?" — the chain of edits is otherwise just
// thumbnails with workflow names, no input context.
//
// We deliberately store value-types only (no Blob/File) — ref images
// are referenced by file name; mask blobs by a coverage stat. That
// keeps the version JSON-safe and the in-memory state lightweight.
export type VersionRequest = {
  workflowId: string;
  /** Free-form prompt the user typed (description, scene, "what to
   * isolate", reference-inpaint steering). Empty/undefined when the
   * workflow takes no text. */
  prompt?: string;
  /** Workflow-specific params keyed by input.key (aspect_ratio,
   * resolution, color, etc). May overlap with `prompt` for
   * product-isolation; the summarizer dedupes. */
  values?: Record<string, string>;
  /** Pin location in 0..1 normalized image coords. ai-edit only. */
  pin?: { x: number; y: number };
  /** Percentage of the canvas painted (card-flow only — chat-flow
   * captures masks as opaque blobs without coverage stats). */
  maskCoverage?: number;
  /** Just the file name; we don't persist the bytes. */
  referenceFileName?: string;
  /** URL of the version this run was based on, so the history card can
   * show "from this image" if we ever want a before/after thumb. */
  sourceUrl?: string;
};

// Editor mode draft — held in state by WorkflowsPanel and passed
// down to CustomEditorPanel. `isNew=true` means we're building a
// recipe from scratch (no id yet); otherwise we're editing the
// existing recipe with that id. The draft is independent from the
// persisted recipe until Save.
type EditorDraft = {
  isNew: boolean;
  id?: string;
  name: string;
  steps: CustomStep[];
};

export type Version = {
  id: string;
  url: string;
  label: string;
  ts: number;
  sentinel?: SentinelResult;
  /** Pixel dimensions of the rendered image. Captured when the URL
   * loads (samples carry these, uploads + workflow outputs probe). */
  width?: number;
  height?: number;
  /** True while the workflow is still running. URL is the source image
   * during this state — replaced with the output URL on success. */
  pending?: boolean;
  /** Latest progress message during a pending run, e.g. "Queued…", "Generating…". */
  progressMessage?: string;
  /** What kind of pending state this is.
   *   "workflow"   = a workflow is editing an existing image; URL points
   *                  at the source image until the output lands.
   *   "generation" = text-to-image; URL is empty until the model returns,
   *                  so the canvas needs to show a skeleton + the prompt
   *                  instead of falling back to the empty state.
   * Defaults to "workflow" when omitted (the historical case). */
  pendingKind?: "workflow" | "generation";
  /** Set if the run failed. Pending becomes false. */
  error?: string;
  /** Inputs the user supplied for this run — surfaced in History. */
  request?: VersionRequest;
};

export function WorkflowsPanel({
  selectedWorkflowId,
  onSelectWorkflow,
  photoTags,
  recommendedWorkflowIds,
  versions,
  currentVersionId,
  onPickVersion,
  // Children for the pinned action region — flow-specific UI passed in.
  selectedActionContent,
  selectedActionFooter,
  selectedActionMeta,
  studioHandle,
  activeAssetId,
  onRunCustom,
  onClearWorkflowSelection,
  onSelectAsset,
}: {
  selectedWorkflowId: string | null;
  onSelectWorkflow: (wf: Workflow) => void;
  photoTags: string[];
  /** Workflow ids that should light up because they're the editorial
   * "show this off on this image" demo for the active asset. Empty
   * array for uploaded photos that have no curated recommendation. */
  recommendedWorkflowIds: string[];
  versions: Version[];
  currentVersionId: string;
  onPickVersion: (id: string) => void;
  selectedActionContent: React.ReactNode | null;
  selectedActionFooter: React.ReactNode | null;
  selectedActionMeta: { name: string; desc: string; iconKey: string } | null;
  studioHandle: PartialStudioHandle;
  activeAssetId: string | null;
  /** Replays a saved custom workflow on the active asset. The
   * `overrides` map applies to the LAST step's values (typically
   * aspect_ratio / resolution); intermediate steps run with the
   * stored values verbatim. */
  onRunCustom: (custom: CustomWfShape, overrides: Record<string, string>) => void;
  /** Clear the parent's selectedWorkflowId. Called when the user
   * picks a recipe to replay or opens the recipe editor — keeps
   * "what's the focus right now?" unambiguous, since otherwise both
   * the workflow's action panel and the recipe panel try to render at
   * the same time. */
  onClearWorkflowSelection?: () => void;
  /** Switch the active asset. Lets the action panel's "Try on a
   * sample" affordance load a curated demo image with one click,
   * without making the user hunt the left rail. Optional so callers
   * that don't want this feature wire-out cleanly. */
  onSelectAsset?: (id: string) => void;
}) {
  const [tab, setTab] = useState<"workflows" | "chat" | "history">("workflows");
  const [query, setQuery] = useState("");
  const customWorkflows = useCustomWorkflows();
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const selectedCustom = useMemo(
    () => customWorkflows.find((c) => c.id === selectedCustomId) ?? null,
    [customWorkflows, selectedCustomId],
  );
  // Editor state — when non-null the right rail body shows the
  // CustomEditorPanel instead of the card grid + replay panel. Lives
  // here (not inside the editor component) so a stray tab switch
  // doesn't lose the draft inside React state, and so the +New tile
  // and pencil-on-card both feed the same slot.
  const [editorDraft, setEditorDraft] = useState<EditorDraft | null>(null);
  const openEditorForNew = () => {
    setSelectedCustomId(null);
    onClearWorkflowSelection?.();
    setEditorDraft({ isNew: true, name: "", steps: [] });
  };
  const openEditorForExisting = (cw: CustomWfShape) => {
    setSelectedCustomId(null);
    onClearWorkflowSelection?.();
    setEditorDraft({
      isNew: false,
      id: cw.id,
      name: cw.name,
      steps: cw.steps.map((s) => ({
        workflowId: s.workflowId,
        ...(s.prompt ? { prompt: s.prompt } : {}),
        ...(s.values ? { values: { ...s.values } } : {}),
        ...(s.pin ? { pin: { ...s.pin } } : {}),
      })),
    });
  };
  const closeEditor = () => setEditorDraft(null);
  // Mutex: a workflow card and a recipe can't both be selected at the
  // same time — otherwise the action region tries to render both
  // panels and the user can't read what's about to run. Whichever the
  // user picks last wins.
  //
  // Forward (workflow chosen → drop the recipe selection): a useEffect
  // on the parent's selectedWorkflowId, since the click happens in the
  // parent and we just react to the new prop.
  //
  // Reverse (recipe chosen / editor opened → drop the workflow): the
  // recipe-side handlers call onClearWorkflowSelection (above + below).
  // No effect on first render: the ref guards a stale value in
  // StrictMode and avoids clobbering the initial null.
  const prevSelectedWfRef = useRef<string | null>(selectedWorkflowId);
  useEffect(() => {
    const prev = prevSelectedWfRef.current;
    prevSelectedWfRef.current = selectedWorkflowId;
    if (selectedWorkflowId && selectedWorkflowId !== prev) {
      setSelectedCustomId(null);
      setEditorDraft(null);
    }
  }, [selectedWorkflowId]);

  const filtered = useMemo(() => {
    if (!query) return WORKFLOWS;
    const q = query.toLowerCase();
    return WORKFLOWS.filter(
      (w) => w.name.toLowerCase().includes(q) || w.desc.toLowerCase().includes(q),
    );
  }, [query]);

  const groups: Array<{ id: string; label: string; items: Workflow[] }> = [
    // Packages first — they're the "all-in-one" outputs, the headline
    // result for marketplace prep. Below them sit the individual
    // primitives that the packages chain under the hood.
    {
      id: "package",
      label: "Marketplace packages",
      items: filtered.filter((w) => w.group === "package"),
    },
    { id: "magic", label: "Magic", items: filtered.filter((w) => w.group === "magic") },
    { id: "compose", label: "Compose", items: filtered.filter((w) => w.group === "compose") },
    { id: "cleanup", label: "Cleanup", items: filtered.filter((w) => w.group === "cleanup") },
    { id: "enhance", label: "Enhance", items: filtered.filter((w) => w.group === "enhance") },
  ].filter((g) => g.items.length);
  // "Coming soon" lives in a footer disclosure rather than the main
  // grid — its cards aren't actionable, so they don't earn the same
  // visual weight as the live ones.
  const soonItems = filtered.filter((w) => w.group === "soon");
  const [showSoon, setShowSoon] = useState(false);
  // "+ Create a recipe" is a footer link unless the user already has
  // recipes (in which case the Custom group renders inline as before).
  // Hides the empty Custom block on first load — that section was a
  // major source of "what is all this stuff?" feedback.
  const hasRecipes = customWorkflows.length > 0;

  const recommendedSet = useMemo(() => new Set(recommendedWorkflowIds), [recommendedWorkflowIds]);

  // Breadcrumb context for the focused configure view. Derived here
  // (not in the JSX) because both the breadcrumb and the back button
  // need the same group label.
  const selectedWf = useMemo(
    () =>
      selectedWorkflowId ? (WORKFLOWS.find((w) => w.id === selectedWorkflowId) ?? null) : null,
    [selectedWorkflowId],
  );
  const groupLabelFor: Record<string, string> = {
    package: "Marketplace",
    magic: "Magic",
    compose: "Compose",
    cleanup: "Cleanup",
    enhance: "Enhance",
    soon: "Coming soon",
  };
  const isFocused = !!selectedWf || !!selectedCustom;
  const breadcrumb = selectedWf
    ? { group: groupLabelFor[selectedWf.group] ?? "Edits", name: selectedWf.name }
    : selectedCustom
      ? { group: "Custom", name: selectedCustom.name }
      : null;
  const exitFocus = () => {
    if (selectedCustom) setSelectedCustomId(null);
    if (selectedWorkflowId) onClearWorkflowSelection?.();
  };

  return (
    <aside className="rfs-right">
      <div className="rfs-tabs">
        <button
          type="button"
          className={`rfs-tab${tab === "workflows" ? " is-active" : ""}`}
          onClick={() => setTab("workflows")}
        >
          {Icon.workflows}
          Edits
          <span className="rfs-tab-count">{WORKFLOWS.filter((w) => w.kind !== "soon").length}</span>
        </button>
        <button
          type="button"
          className={`rfs-tab${tab === "chat" ? " is-active" : ""}`}
          onClick={() => setTab("chat")}
        >
          {Icon.chat}
          Chat
          <span
            className="rfs-tab-soon"
            style={{ background: "var(--rfs-accent-soft)", color: "var(--rfs-accent)" }}
          >
            BETA
          </span>
        </button>
        <button
          type="button"
          className={`rfs-tab${tab === "history" ? " is-active" : ""}`}
          onClick={() => setTab("history")}
        >
          {Icon.history}
          History
          <span className="rfs-tab-count">{versions.length}</span>
        </button>
      </div>

      {tab === "workflows" ? (
        editorDraft ? (
          <CustomEditorPanel
            draft={editorDraft}
            setDraft={setEditorDraft}
            onCancel={closeEditor}
            onSave={() => {
              if (editorDraft.steps.length === 0) return;
              if (editorDraft.isNew) {
                createCustomWorkflow(editorDraft.name, editorDraft.steps);
              } else if (editorDraft.id) {
                updateCustomWorkflow(editorDraft.id, {
                  name: editorDraft.name,
                  steps: editorDraft.steps,
                });
              }
              closeEditor();
            }}
          />
        ) : isFocused ? (
          // Focused configure view: hide the search + card grid entirely
          // so the user can attend to one thing at a time. The breadcrumb
          // is the only way back to browse mode (clicking the canvas or
          // a tab also clears selection from the parent).
          <>
            <div className="rfs-breadcrumb">
              <button
                type="button"
                className="rfs-breadcrumb-back"
                onClick={exitFocus}
                aria-label="Back to all edits"
              >
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="rfs-breadcrumb-trail">
                <button type="button" className="rfs-breadcrumb-link" onClick={exitFocus}>
                  {breadcrumb?.group ?? "Edits"}
                </button>
                <span className="rfs-breadcrumb-sep" aria-hidden>
                  ·
                </span>
                <span className="rfs-breadcrumb-current">{breadcrumb?.name ?? ""}</span>
              </span>
            </div>
            {selectedCustom ? (
              <CustomReplayPanel
                custom={selectedCustom}
                onCancel={() => setSelectedCustomId(null)}
                onApply={(overrides) => {
                  onRunCustom(selectedCustom, overrides);
                  setSelectedCustomId(null);
                }}
              />
            ) : selectedActionContent ? (
              <div className="rfs-action-pin is-focused">
                {selectedActionMeta ? (
                  <ActionHeaderWithExamples
                    meta={selectedActionMeta}
                    workflowId={selectedWorkflowId}
                    activeAssetId={activeAssetId}
                    onSelectAsset={onSelectAsset}
                  />
                ) : null}
                <div className="rfs-action-pin-body">{selectedActionContent}</div>
              </div>
            ) : null}
            {selectedCustom ? null : selectedActionFooter ? (
              <footer className="rfs-action-footer">{selectedActionFooter}</footer>
            ) : null}
          </>
        ) : (
          <>
            <div className="rfs-search">
              <input
                placeholder="Search edits…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="rfs-cards">
              {/* Custom group only renders when the user already has
                saved recipes. The empty-state +New tile was the
                loudest first-impression of the panel and shipped no
                value until the user had run a chain through History
                first — moved to a quieter footer link instead. */}
              {hasRecipes ? (
                <div className="rfs-cards-group">
                  <div className="rfs-cards-group-label">
                    <span>Custom</span>
                  </div>
                  <button
                    type="button"
                    className="rfs-card rfs-card-custom-new"
                    onClick={openEditorForNew}
                    title="Build a recipe from scratch"
                  >
                    <div className="rfs-card-icon rfs-card-icon-custom" aria-hidden>
                      <svg
                        aria-hidden="true"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </div>
                    <div className="rfs-card-text">
                      <div className="rfs-card-name">New recipe</div>
                      <div className="rfs-card-desc">Build another chain from scratch</div>
                    </div>
                  </button>
                  {customWorkflows.map((cw) => {
                    const isSelected = selectedCustomId === cw.id;
                    return (
                      <div
                        key={cw.id}
                        className={`rfs-card rfs-card-custom${isSelected ? " is-selected" : ""}`}
                      >
                        <button
                          type="button"
                          className="rfs-card-custom-body"
                          onClick={() => {
                            const next = isSelected ? null : cw.id;
                            setSelectedCustomId(next);
                            if (next) onClearWorkflowSelection?.();
                          }}
                        >
                          <div className="rfs-card-icon rfs-card-icon-custom" aria-hidden>
                            <svg
                              aria-hidden="true"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="3" y="3" width="7" height="7" rx="1" />
                              <rect x="14" y="3" width="7" height="7" rx="1" />
                              <rect x="14" y="14" width="7" height="7" rx="1" />
                              <rect x="3" y="14" width="7" height="7" rx="1" />
                            </svg>
                          </div>
                          <div className="rfs-card-text">
                            <div className="rfs-card-name">{cw.name}</div>
                            <div className="rfs-card-desc">
                              {cw.steps.length} step{cw.steps.length === 1 ? "" : "s"}
                              {": "}
                              {cw.steps
                                .map(
                                  (s) =>
                                    WORKFLOWS.find((w) => w.id === s.workflowId)?.name ??
                                    s.workflowId,
                                )
                                .join(" · ")}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="rfs-card-custom-edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditorForExisting(cw);
                          }}
                          title="Edit recipe (rename, reorder, add or remove steps)"
                          aria-label={`Edit recipe ${cw.name}`}
                        >
                          <svg
                            aria-hidden="true"
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="rfs-card-custom-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete custom edit "${cw.name}"?`)) {
                              deleteCustomWorkflow(cw.id);
                              if (isSelected) setSelectedCustomId(null);
                            }
                          }}
                          title="Delete custom edit"
                          aria-label="Delete custom edit"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {groups.map((g) => (
                <div key={g.id} className="rfs-cards-group">
                  <div className="rfs-cards-group-label">
                    <span>{g.label}</span>
                  </div>
                  {g.items.map((wf) => {
                    const applic = wf.applicableHint?.(photoTags);
                    // Tri-state: "soon" (not built yet) vs.
                    // "not-applicable" (built, but wrong photo for it)
                    // vs. enabled. Both disabled states block the click,
                    // but they read differently — soon is "come back
                    // later", not-applicable is "swap your photo".
                    const isSoon = wf.kind === "soon";
                    const isNotApplicable = !isSoon && !!applic && !applic.ok;
                    const disabled = isSoon || isNotApplicable;
                    const isSelected = selectedWorkflowId === wf.id;
                    // Recommended = the editorial "this is the demo for
                    // this image" flag from the active asset. Replaces
                    // the static `wf.feature` always-yellow that used to
                    // mark ai-edit + reference-inpaint regardless of
                    // what was on the canvas.
                    const isRecommended = !disabled && !isSelected && recommendedSet.has(wf.id);
                    // Native `title` tooltips don't fire on `disabled`
                    // buttons (and child elements inside them are also
                    // pointer-events:none in most browsers). For the
                    // not-applicable case we wrap the disabled button in
                    // a span carrying the tooltip — the wrapper isn't
                    // disabled, so the tooltip surfaces normally on
                    // hover. Soon cards don't need a tooltip.
                    const cardButton = (
                      <button
                        type="button"
                        key={wf.id}
                        className={`rfs-card${isSelected ? " is-selected" : ""}${isRecommended ? " is-recommended" : ""}${isNotApplicable ? " is-not-applicable" : ""}`}
                        onClick={() => onSelectWorkflow(wf)}
                        disabled={disabled}
                      >
                        <div className="rfs-card-icon">
                          {Icon[wf.id as keyof typeof Icon] ?? null}
                        </div>
                        <div className="rfs-card-text">
                          <div className="rfs-card-name">
                            {wf.name}
                            {isSoon ? <span className="rfs-card-soon">SOON</span> : null}
                            {isNotApplicable ? (
                              <span
                                className="rfs-card-swap"
                                aria-label="Different photo would unlock this"
                              >
                                ?
                              </span>
                            ) : null}
                          </div>
                          <div className="rfs-card-desc">
                            {isNotApplicable && applic?.reason ? applic.reason : wf.desc}
                          </div>
                        </div>
                      </button>
                    );
                    return isNotApplicable ? (
                      <span
                        key={wf.id}
                        className="rfs-card-wrap"
                        title={`${applic?.reason ?? "Not applicable"} — try a different photo`}
                      >
                        {cardButton}
                      </span>
                    ) : (
                      cardButton
                    );
                  })}
                </div>
              ))}
              {/* Quiet footer disclosures for things that don't earn
                first-class card real estate: pre-release workflows
                (no actions to take) and the create-recipe entry
                point when the user has none yet. */}
              {soonItems.length > 0 ? (
                <div className="rfs-cards-footer">
                  <button
                    type="button"
                    className="rfs-cards-disclosure"
                    onClick={() => setShowSoon((v) => !v)}
                    aria-expanded={showSoon}
                  >
                    <svg
                      aria-hidden="true"
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: showSoon ? "rotate(90deg)" : "none",
                        transition: "transform 120ms ease",
                      }}
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                    Coming soon ({soonItems.length})
                  </button>
                  {showSoon ? (
                    <div className="rfs-cards-group rfs-cards-group-soon">
                      {soonItems.map((wf) => (
                        <button key={wf.id} className="rfs-card" disabled type="button">
                          <div className="rfs-card-icon">
                            {Icon[wf.id as keyof typeof Icon] ?? null}
                          </div>
                          <div className="rfs-card-text">
                            <div className="rfs-card-name">
                              {wf.name}
                              <span className="rfs-card-soon">SOON</span>
                            </div>
                            <div className="rfs-card-desc">{wf.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!hasRecipes ? (
                <div className="rfs-cards-footer">
                  <button type="button" className="rfs-cards-link" onClick={openEditorForNew}>
                    + Create a recipe
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )
      ) : tab === "chat" ? (
        <ChatPanel studioHandle={studioHandle} activeAssetId={activeAssetId} />
      ) : (
        <div className="rfs-cards" style={{ paddingTop: "1rem" }}>
          {versions.length === 0 ? (
            <div className="rfs-empty">
              <div className="rfs-empty-icon">{Icon.history}</div>
              <h3>No versions yet</h3>
              <p>Apply any workflow to start building a version history for this image.</p>
            </div>
          ) : (
            <div className="rfs-cards-group">
              {versions
                .slice()
                .reverse()
                .map((v) => {
                  const chain = chainForVersion(versions, v.id);
                  const savable = chainIsSavable(chain);
                  const blockReason = !savable ? reasonChainNotSavable(chain) : null;
                  return (
                    <HistoryCard
                      key={v.id}
                      version={v}
                      isCurrent={v.id === currentVersionId}
                      onClick={() => onPickVersion(v.id)}
                      chainLength={chain.length}
                      canSaveChain={savable}
                      cannotSaveReason={blockReason}
                      onSaveChain={(name) => saveCustomWorkflow(name, chain)}
                    />
                  );
                })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

// History card. Outer is a div (not a button) so we can nest a real
// "Save chain" button inside without breaking HTML semantics. The
// thumb + label section is itself a button that selects the version.
function HistoryCard({
  version,
  isCurrent,
  onClick,
  chainLength,
  canSaveChain,
  cannotSaveReason,
  onSaveChain,
}: {
  version: Version;
  isCurrent: boolean;
  onClick: () => void;
  chainLength: number;
  canSaveChain: boolean;
  cannotSaveReason: string | null;
  onSaveChain: (name: string) => void;
}) {
  const rows = version.request ? summarizeRequest(version.request) : [];
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const showSaveAffordance = chainLength > 0;
  // v0 (the original) has no request and no sentinel — don't pretend
  // it was skipped. Anything else with a request but no sentinel is
  // an intermediate step the gating toggle bypassed.
  const sentinelSkipped = !!version.request && !version.sentinel && !version.error;
  const showSentinelChip = !!version.sentinel || sentinelSkipped;

  const submitSave = () => {
    const name = draftName.trim();
    if (!name) return;
    onSaveChain(name);
    setSavePromptOpen(false);
    setDraftName("");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  return (
    <div className={`rfs-card rfs-history-card${isCurrent ? " is-selected" : ""}`}>
      <button type="button" className="rfs-history-card-head" onClick={onClick}>
        <div
          className="rfs-card-icon"
          style={{ background: "transparent", padding: 0, width: 44, height: 44 }}
        >
          <img
            src={version.url}
            alt={version.label}
            style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }}
          />
        </div>
        <div className="rfs-card-text">
          <div className="rfs-history-card-name-row">
            <div className="rfs-card-name">{version.label}</div>
            {showSentinelChip ? (
              <SentinelChip result={version.sentinel} skipped={sentinelSkipped} size="sm" />
            ) : null}
          </div>
          <div className="rfs-card-desc">
            {version.ts === 0 ? "Original" : new Date(version.ts).toLocaleTimeString()}
            {version.error ? ` · ${version.error}` : ""}
          </div>
        </div>
      </button>
      {rows.length > 0 ? (
        <dl className="rfs-history-request">
          {rows.map((r) => (
            <div key={r.key} className={`rfs-history-row rfs-history-row-${r.kind}`}>
              <dt className="rfs-history-row-label">{r.label}</dt>
              <dd className="rfs-history-row-value">
                {r.kind === "swatch" ? (
                  <span className="rfs-history-swatch-row">
                    <span className="rfs-history-swatch" style={{ background: r.value }} />
                    <span style={{ fontFamily: "ui-monospace, SF Mono, Menlo, monospace" }}>
                      {r.value}
                    </span>
                  </span>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {showSaveAffordance ? (
        <div className="rfs-history-save-row">
          {savedFlash ? (
            <span className="rfs-history-save-flash">Saved as custom edit</span>
          ) : !savePromptOpen ? (
            <button
              type="button"
              className="rfs-history-save-trigger"
              onClick={() => setSavePromptOpen(true)}
              disabled={!canSaveChain}
              title={
                canSaveChain
                  ? `Save these ${chainLength} step${chainLength === 1 ? "" : "s"} as a custom edit you can replay`
                  : (cannotSaveReason ?? "")
              }
            >
              Save these {chainLength} step{chainLength === 1 ? "" : "s"} as custom edit
            </button>
          ) : (
            <div className="rfs-history-save-form">
              <input
                autoFocus
                type="text"
                className="rfs-history-save-input"
                placeholder="Name this edit (e.g. Zalando packshot)"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSave();
                  if (e.key === "Escape") {
                    setSavePromptOpen(false);
                    setDraftName("");
                  }
                }}
                maxLength={64}
              />
              <button
                type="button"
                className="rfs-btn rfs-btn-primary"
                onClick={submitSave}
                disabled={!draftName.trim()}
              >
                Save
              </button>
              <button
                type="button"
                className="rfs-btn"
                onClick={() => {
                  setSavePromptOpen(false);
                  setDraftName("");
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// CustomReplayPanel — shown in the action region when a saved custom
// edit is selected. Lists the steps read-only, optionally exposes
// final-step aspect_ratio and resolution as overridable, and applies
// the chain via onApply. Mirrors the look of the normal action panel.
function CustomReplayPanel({
  custom,
  onCancel,
  onApply,
}: {
  custom: CustomWfShape;
  onCancel: () => void;
  onApply: (overrides: Record<string, string>) => void;
}) {
  const lastStep = custom.steps[custom.steps.length - 1];
  // Currently overridable params: aspect_ratio + resolution on the
  // final step, when present. Other workflow params are taken from
  // the saved values verbatim.
  const overridableKeys: ("aspect_ratio" | "resolution")[] = [];
  if (lastStep?.values?.aspect_ratio) overridableKeys.push("aspect_ratio");
  if (lastStep?.values?.resolution) overridableKeys.push("resolution");
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const k of overridableKeys) o[k] = lastStep?.values?.[k] ?? "";
    return o;
  });
  const [showOverride, setShowOverride] = useState(false);

  // The override selects pull their option lists from the workflow
  // definition for the last step, so we always reflect the real
  // allowed values (not a hard-coded list that drifts).
  const lastWf = WORKFLOWS.find((w) => w.id === lastStep?.workflowId);
  const aspectInput = lastWf?.inputs?.find((i) => i.key === "aspect_ratio" && i.type === "select");
  const resolutionInput = lastWf?.inputs?.find(
    (i) => i.key === "resolution" && i.type === "select",
  );

  // Pre-flight: surface missing required inputs BEFORE dispatch so the
  // chain doesn't fail mid-step with a vague "Prompt is required" toast.
  const validationError = useMemo(() => validateRecipeSteps(custom.steps), [custom.steps]);

  return (
    <>
      <div className="rfs-action-pin is-focused">
        <header className="rfs-action-pin-header">
          <div className="rfs-action-pin-header-row">
            <div className="rfs-action-pin-icon" aria-hidden>
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div className="rfs-action-pin-title">
              <div className="rfs-action-pin-name">{custom.name}</div>
              <div className="rfs-action-pin-desc">
                Replay these {custom.steps.length} step{custom.steps.length === 1 ? "" : "s"} on the
                current image
              </div>
            </div>
          </div>
        </header>
        <div className="rfs-action-pin-body">
          <ol className="rfs-custom-steps">
            {custom.steps.map((step, i) => {
              const wf = WORKFLOWS.find((w) => w.id === step.workflowId);
              const params: string[] = [];
              if (step.values?.aspect_ratio) params.push(step.values.aspect_ratio);
              if (step.values?.resolution) params.push(step.values.resolution);
              if (step.values?.color) params.push(step.values.color);
              if (step.prompt)
                params.push(`"${step.prompt.slice(0, 40)}${step.prompt.length > 40 ? "…" : ""}"`);
              return (
                <li key={i} className="rfs-custom-step">
                  <span className="rfs-custom-step-num">{i + 1}</span>
                  <div className="rfs-custom-step-text">
                    <div className="rfs-custom-step-name">{wf?.name ?? step.workflowId}</div>
                    {params.length ? (
                      <div className="rfs-custom-step-params">{params.join(" · ")}</div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          {validationError ? (
            <div className="rfs-custom-replay-validation" role="alert">
              {validationError.message}
            </div>
          ) : null}
          {overridableKeys.length > 0 ? (
            <div className="rfs-custom-override">
              <button
                type="button"
                className="rfs-custom-override-toggle"
                onClick={() => setShowOverride((v) => !v)}
              >
                {showOverride ? "Use saved settings" : "Override final settings"}
              </button>
              {showOverride ? (
                <div className="rfs-custom-override-body">
                  {aspectInput &&
                  aspectInput.type === "select" &&
                  overridableKeys.includes("aspect_ratio") ? (
                    <div className="rfs-input-group">
                      <label className="rfs-label">Aspect ratio</label>
                      <select
                        className="rfs-select"
                        value={overrides.aspect_ratio ?? ""}
                        onChange={(e) =>
                          setOverrides((s) => ({ ...s, aspect_ratio: e.target.value }))
                        }
                      >
                        {aspectInput.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {resolutionInput &&
                  resolutionInput.type === "select" &&
                  overridableKeys.includes("resolution") ? (
                    <div className="rfs-input-group">
                      <label className="rfs-label">Resolution</label>
                      <select
                        className="rfs-select"
                        value={overrides.resolution ?? ""}
                        onChange={(e) =>
                          setOverrides((s) => ({ ...s, resolution: e.target.value }))
                        }
                      >
                        {resolutionInput.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <footer className="rfs-action-footer">
        <button type="button" className="rfs-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="rfs-btn rfs-btn-primary"
          onClick={() => onApply(showOverride ? overrides : {})}
          disabled={!!validationError}
          title={validationError ? validationError.message : undefined}
        >
          Apply
        </button>
      </footer>
    </>
  );
}

// CustomEditorPanel — full-rail recipe editor. Replaces the card grid
// while open. Handles both "build from scratch" (draft.isNew=true) and
// "edit existing" (draft.id set). Steps support reorder ↑↓, delete ×,
// per-step parameter editing, and an "+ Add step" picker.
//
// Stateful workflows (reference-inpaint) are excluded from the picker
// because their runtime inputs (mask/reference) can't be persisted.
// Pin workflows (ai-edit) are excluded for the same reason — without a
// pin you can't replay the edit. Packages aren't pickable either; a
// recipe-of-packages is a future thing.
function CustomEditorPanel({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: EditorDraft;
  setDraft: (d: EditorDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const moveStep = (idx: number, dir: -1 | 1) => {
    const next = [...draft.steps];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft({ ...draft, steps: next });
    if (expandedStep === idx) setExpandedStep(target);
    else if (expandedStep === target) setExpandedStep(idx);
  };

  const deleteStep = (idx: number) => {
    const next = draft.steps.filter((_, i) => i !== idx);
    setDraft({ ...draft, steps: next });
    if (expandedStep === idx) setExpandedStep(null);
    else if (expandedStep !== null && expandedStep > idx) setExpandedStep(expandedStep - 1);
  };

  const addStep = (wf: Workflow) => {
    // Pre-fill values from each input's default so the step is
    // immediately runnable. The user can tweak inline before saving.
    const defaults = defaultStepValues(wf);
    const newStep: CustomStep = {
      workflowId: wf.id,
      ...(Object.keys(defaults).length ? { values: defaults } : {}),
    };
    const nextSteps = [...draft.steps, newStep];
    setDraft({ ...draft, steps: nextSteps });
    setExpandedStep(nextSteps.length - 1);
    setPickerOpen(false);
  };

  const updateStepValues = (idx: number, key: string, value: string) => {
    const next = draft.steps.map((s, i) => {
      if (i !== idx) return s;
      const nextValues = { ...(s.values ?? {}), [key]: value };
      return { ...s, values: nextValues };
    });
    setDraft({ ...draft, steps: next });
  };

  const updateStepPrompt = (idx: number, prompt: string) => {
    const next = draft.steps.map((s, i) => (i !== idx ? s : { ...s, prompt }));
    setDraft({ ...draft, steps: next });
  };

  // Same pre-flight as the replay panel: block Save when any step has
  // a required text/prompt input that's empty. The existing canSave
  // check already gates "no name" / "no steps"; this is the additive
  // case ("steps exist but a required input is blank").
  const stepValidationError = useMemo(() => validateRecipeSteps(draft.steps), [draft.steps]);
  const canSave = draft.steps.length > 0 && draft.name.trim().length > 0 && !stepValidationError;

  return (
    <>
      <div className="rfs-action-pin rfs-custom-editor">
        <header className="rfs-action-pin-header">
          <div className="rfs-action-pin-header-row">
            <div className="rfs-action-pin-icon" aria-hidden>
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </div>
            <div className="rfs-action-pin-title">
              <div className="rfs-action-pin-name">
                {draft.isNew ? "New recipe" : "Edit recipe"}
              </div>
              <div className="rfs-action-pin-desc">
                {draft.isNew
                  ? "Chain edits, save them as a recipe you can replay on any image"
                  : "Rename, reorder, add or remove steps"}
              </div>
            </div>
          </div>
        </header>
        <div className="rfs-action-pin-body">
          <div className="rfs-input-group">
            <label className="rfs-label">Recipe name</label>
            <input
              className="rfs-text"
              placeholder="e.g. Catalog cleanup"
              maxLength={60}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              autoFocus={draft.isNew}
            />
          </div>

          <div className="rfs-custom-editor-steps-label">
            Steps {draft.steps.length > 0 ? `(${draft.steps.length})` : null}
          </div>

          {draft.steps.length === 0 ? (
            <div className="rfs-help" style={{ padding: "0.625rem", textAlign: "center" }}>
              No steps yet. Tap <b>+ Add step</b> to start chaining.
            </div>
          ) : (
            <div className="rfs-package-list">
              {draft.steps.map((step, i) => {
                const wf = WORKFLOWS.find((w) => w.id === step.workflowId);
                const isExpanded = expandedStep === i;
                const summary = stepSummaryText(step, wf);
                return (
                  <div key={`${step.workflowId}-${i}`} className="rfs-custom-editor-row">
                    <div className="rfs-package-row">
                      <span className="rfs-package-row-num">{i + 1}</span>
                      <button
                        type="button"
                        className="rfs-custom-editor-row-text"
                        onClick={() => setExpandedStep(isExpanded ? null : i)}
                        aria-expanded={isExpanded}
                      >
                        <div className="rfs-package-row-name">{wf?.name ?? step.workflowId}</div>
                        <div className="rfs-package-row-file">{summary || "(no params)"}</div>
                      </button>
                      <div className="rfs-package-row-actions">
                        <button
                          type="button"
                          className="rfs-package-row-btn"
                          onClick={() => moveStep(i, -1)}
                          disabled={i === 0}
                          title="Move up"
                          aria-label={`Move ${wf?.name ?? "step"} up`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="rfs-package-row-btn"
                          onClick={() => moveStep(i, 1)}
                          disabled={i === draft.steps.length - 1}
                          title="Move down"
                          aria-label={`Move ${wf?.name ?? "step"} down`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="rfs-package-row-btn rfs-package-row-btn-danger"
                          onClick={() => deleteStep(i)}
                          title="Remove this step"
                          aria-label={`Remove ${wf?.name ?? "step"}`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {isExpanded && wf ? (
                      <div className="rfs-custom-editor-step-params">
                        <StepParamsForm
                          wf={wf}
                          values={{
                            ...(step.values ?? {}),
                            ...(step.prompt ? { prompt: step.prompt } : {}),
                          }}
                          onValueChange={(k, v) => {
                            // Recipe steps store the freeform prompt
                            // separately from values; route the
                            // shared form's `prompt` writes into
                            // step.prompt so the saved schema doesn't
                            // shift under us.
                            if (k === "prompt") updateStepPrompt(i, v);
                            else updateStepValues(i, k, v);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <StepPicker
            open={pickerOpen}
            onOpen={() => setPickerOpen(true)}
            onCancel={() => setPickerOpen(false)}
            onPick={addStep}
          />
          {stepValidationError ? (
            <div className="rfs-custom-replay-validation" role="alert">
              {stepValidationError.message}
            </div>
          ) : null}
        </div>
      </div>
      <footer className="rfs-action-footer">
        <button type="button" className="rfs-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="rfs-btn rfs-btn-primary"
          onClick={onSave}
          disabled={!canSave}
          title={
            !canSave
              ? draft.steps.length === 0
                ? "Add at least one step"
                : draft.name.trim().length === 0
                  ? "Give the recipe a name"
                  : (stepValidationError?.message ?? "")
              : undefined
          }
        >
          {draft.isNew ? "Create recipe" : "Save changes"}
        </button>
      </footer>
    </>
  );
}

// Walk a recipe's steps and surface the first input that's required
// but empty. We only check `text`, `textarea`, and the implicit
// `prompt`-keyed inputs on `prompt` / `prompt-zip` workflows — `select`
// and `color` always carry a default so they can't be empty here.
//
// Returns null when every step is valid, or a one-line message ready
// to render inline above the action button. Used by both the replay
// panel (Apply) and the editor (Save) so the operator sees the gap
// before they dispatch the chain.
type RecipeValidationError = {
  stepIndex: number;
  message: string;
};
function validateRecipeSteps(steps: CustomStep[]): RecipeValidationError | null {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const wf = WORKFLOWS.find((w) => w.id === step.workflowId);
    if (!wf) continue;

    // Implicit prompt requirement: prompt/prompt-zip workflows store
    // the user-typed instruction on `step.prompt` (separate from
    // `step.values`) and won't dispatch correctly without it.
    const needsPrompt = wf.kind === "prompt" || wf.kind === "prompt-zip";
    if (needsPrompt && !(step.prompt ?? "").trim()) {
      // Find the prompt input to get a label; fall back to "Prompt".
      const promptInput = wf.inputs?.find((inp) => inp.key === "prompt");
      const label = promptInput?.label ?? "Prompt";
      return {
        stepIndex: i,
        message: `Step ${i + 1} (${wf.name}): ${label} is required.`,
      };
    }

    // Explicit text/textarea required check — `optional: true` opts
    // out (see WorkflowInput in _data/workflows.ts).
    for (const inp of wf.inputs ?? []) {
      if (inp.type !== "text" && inp.type !== "textarea") continue;
      if (inp.type === "text" && inp.optional) continue;
      // The form panel writes prompt-keyed text values into
      // `step.prompt`; everything else lives in `step.values`. Check
      // both so we don't false-positive on the prompt input.
      const v = inp.key === "prompt" ? step.prompt : step.values?.[inp.key];
      if (!(v ?? "").trim()) {
        return {
          stepIndex: i,
          message: `Step ${i + 1} (${wf.name}): ${inp.label} is required.`,
        };
      }
    }
  }
  return null;
}

// One-line summary of a step's configured params, used as the
// secondary line on the editor row when collapsed.
function stepSummaryText(step: CustomStep, wf: Workflow | undefined): string {
  const bits: string[] = [];
  const v = step.values ?? {};
  if (step.prompt?.trim()) {
    const p = step.prompt.trim();
    bits.push(`"${p.length > 30 ? `${p.slice(0, 30)}…` : p}"`);
  }
  if (v.aspect_ratio) bits.push(v.aspect_ratio);
  if (v.resolution) bits.push(v.resolution);
  if (v.color) bits.push(v.color.toUpperCase());
  if (v.model) bits.push(v.model);
  if (v.upscale_factor) bits.push(`${v.upscale_factor}×`);
  if (bits.length === 0 && wf?.inputs && wf.inputs.length > 0) {
    return "click to configure";
  }
  return bits.join(" · ");
}

// Action panel header that doubles as the "Try on a sample" surface.
// Each curated sample in samples.ts has a recommendedWorkflows list —
// editorial pairing of "this image is a great demo for these
// workflows". We reverse-index that here so when the user picks a
// workflow card, the header can offer the curated demo images
// without burying them in the left rail.
//
// Closed by default and only renders the affordance when there's at
// least one sample that recommends this workflow AND the active
// asset isn't already one of those samples — speed users see a
// neutral header, demo users see a sparkle they can poke. The expand
// strip drops thumbnails into the header, click loads the sample.
function ActionHeaderWithExamples({
  meta,
  workflowId,
  activeAssetId,
  onSelectAsset,
}: {
  meta: { name: string; desc: string; iconKey: string };
  workflowId: string | null;
  activeAssetId: string | null;
  onSelectAsset?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Recompute matching samples when the workflow changes; reset the
  // open state so an expanded strip from one workflow doesn't bleed
  // into the next selection.
  useEffect(() => {
    setOpen(false);
  }, [workflowId]);

  const samples = useMemo<SampleAsset[]>(() => {
    if (!workflowId) return [];
    return SAMPLES.filter(
      (s) => s.recommendedWorkflows?.includes(workflowId) && s.id !== activeAssetId,
    ).slice(0, 4);
  }, [workflowId, activeAssetId]);

  const hasSamples = samples.length > 0 && !!onSelectAsset;

  return (
    <header className={`rfs-action-pin-header${open ? " is-expanded" : ""}`}>
      <div className="rfs-action-pin-header-row">
        <div className="rfs-action-pin-icon">{Icon[meta.iconKey as keyof typeof Icon] ?? null}</div>
        <div className="rfs-action-pin-title">
          <div className="rfs-action-pin-name">{meta.name}</div>
          <div className="rfs-action-pin-desc">{meta.desc}</div>
        </div>
        {hasSamples ? (
          <button
            type="button"
            className={`rfs-action-examples-toggle${open ? " is-open" : ""}`}
            onClick={() => setOpen((v) => !v)}
            title={
              open
                ? "Hide examples"
                : `See ${samples.length} sample${samples.length === 1 ? "" : "s"} this works on`
            }
            aria-expanded={open}
          >
            <span aria-hidden>✨</span>
            <span className="rfs-action-examples-toggle-label">{open ? "Hide" : "Examples"}</span>
          </button>
        ) : null}
      </div>
      {open && hasSamples ? (
        <div className="rfs-action-examples">
          <div className="rfs-action-examples-hint">Try this workflow on a curated demo image:</div>
          <div className="rfs-action-examples-strip">
            {samples.map((s) => (
              <button
                key={s.id}
                type="button"
                className="rfs-action-example"
                onClick={() => {
                  onSelectAsset?.(s.id);
                  setOpen(false);
                }}
                title={`Load "${s.title}"`}
              >
                <img src={s.url} alt={s.title} loading="lazy" />
                <span className="rfs-action-example-label">{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
