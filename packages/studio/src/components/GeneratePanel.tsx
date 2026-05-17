"use client";

// Inline text-to-image generation panel. Replaces the asset list in
// the left rail when active — same pattern as the recipe editor
// replacing the workflow grid in the right rail.
//
// The panel is a CONTROLLED FORM only. All generation lifecycle
// (asset creation, per-variation dispatch, sentinel) lives in
// StudioShell.dispatchGenerationSession. When the user clicks
// Generate, we hand the params up; StudioShell creates a new asset
// with N pending versions and switches the canvas to it. The user
// then watches the canvas (skeleton + prompt) and the version stripe
// (Variation 1, 2, 3, 4) fill in.
//
// Three inputs only: prompt, aspect, resolution, count. Resolution
// doubles as a quality dial — the gateway in _lib/generation.ts
// maps each bucket to a different model behind the scenes; the user
// never picks a model. Cost estimate sits on the Generate button.
//
// While a session is in flight, the panel switches to a compact
// summary view: the prompt the user just sent, the variation count,
// and a "+ New generation" button that resets the form so they can
// fire off another batch without leaving the panel.

import { useState } from "react";
import {
  estimateGenerationCost,
  formatCostUsd,
  type GenerationResolution,
} from "../lib/generation";
import { Icon } from "./icons";

const ASPECT_OPTIONS: { value: string; label: string }[] = [
  { value: "1:1", label: "1:1 — square" },
  { value: "4:5", label: "4:5 — portrait feed" },
  { value: "3:4", label: "3:4 — portrait" },
  { value: "9:16", label: "9:16 — stories" },
  { value: "16:9", label: "16:9 — banner" },
  { value: "3:2", label: "3:2 — landscape" },
];

const RESOLUTION_OPTIONS: GenerationResolution[] = ["1K", "2K", "4K"];

export type GenerationFormValues = {
  prompt: string;
  aspectRatio: string;
  resolution: GenerationResolution;
  count: number;
};

export function GeneratePanel({
  onClose,
  onGenerate,
  inFlight,
  inFlightCount,
  inFlightPrompt,
}: {
  onClose: () => void;
  /** Hand the params up to StudioShell, which creates the session
   * asset and dispatches each variation. The panel doesn't poll or
   * track results — it just renders an in-flight summary while
   * `inFlight` is true. */
  onGenerate: (params: GenerationFormValues) => void;
  /** True while at least one variation in the most recently launched
   * session is still pending. */
  inFlight: boolean;
  /** Number of variations the in-flight session was launched with. */
  inFlightCount: number;
  /** The prompt the in-flight session is generating. Surfaced in the
   * summary so the user remembers what they asked for. */
  inFlightPrompt: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState<GenerationResolution>("2K");
  const [count, setCount] = useState(4);

  const cost = estimateGenerationCost(resolution, count);
  const canGenerate = prompt.trim().length > 0;

  const onSubmit = () => {
    if (!canGenerate) return;
    onGenerate({
      prompt: prompt.trim(),
      aspectRatio,
      resolution,
      count,
    });
    // Don't clear the form — the user can hit Generate again to
    // make another batch with the same params, or tweak inputs and
    // fire off a different one. "+ New generation" (below) clears
    // explicitly when the in-flight summary is showing.
  };

  return (
    <div className="rfs-generate-panel">
      <div className="rfs-generate-panel-header">
        <button
          type="button"
          className="rfs-link rfs-generate-back"
          onClick={onClose}
          title="Back to assets"
        >
          {Icon.back}
          <span>Back</span>
        </button>
        <div className="rfs-generate-panel-title">
          {Icon.generate}
          <span>Generate</span>
        </div>
      </div>

      {inFlight ? (
        <div className="rfs-generate-inflight">
          <div className="rfs-generate-inflight-status">
            <span className="rfs-canvas-pending-spinner" aria-hidden />
            <span>
              Generating <strong>{inFlightCount}</strong> variation
              {inFlightCount === 1 ? "" : "s"}
            </span>
          </div>
          {inFlightPrompt ? (
            <div className="rfs-generate-inflight-prompt">
              {inFlightPrompt}
            </div>
          ) : null}
          <div className="rfs-generate-inflight-hint">
            Watch the canvas — each variation will fill in as the model finishes.
          </div>
          <button
            type="button"
            className="rfs-btn rfs-generate-newrun"
            onClick={() => setPrompt("")}
            title="Start another generation with a new prompt"
          >
            {Icon.generate}
            New generation
          </button>
        </div>
      ) : null}

      <div className="rfs-generate-panel-body">
        <div className="rfs-input-group">
          <label className="rfs-label">Prompt</label>
          <textarea
            className="rfs-textarea"
            placeholder="e.g. premium minimalist white sneaker on a clean off-white backdrop, studio lighting"
            maxLength={400}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            autoFocus
          />
        </div>

        <div className="rfs-input-group">
          <label className="rfs-label">Aspect ratio</label>
          <select
            className="rfs-select"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
          >
            {ASPECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="rfs-input-group">
          <label className="rfs-label">Resolution</label>
          <div className="rfs-generate-res-row">
            {RESOLUTION_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`rfs-generate-res-btn${resolution === r ? " is-selected" : ""}`}
                onClick={() => setResolution(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="rfs-help">
            {resolution === "1K"
              ? "Fast preview — explore ideas cheaply"
              : resolution === "2K"
                ? "Balanced — recommended for most shots"
                : "Top quality — slowest, best detail"}
          </div>
        </div>

        <div className="rfs-input-group">
          <label className="rfs-label">
            Variations
            <span className="rfs-label-meta">{count} image{count === 1 ? "" : "s"}</span>
          </label>
          <input
            type="range"
            min={1}
            max={8}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10))}
            className="rfs-generate-count"
          />
        </div>
      </div>

      <div className="rfs-generate-footer">
        <button
          type="button"
          className="rfs-btn rfs-btn-primary rfs-generate-go"
          onClick={onSubmit}
          disabled={!canGenerate}
          title={
            !canGenerate
              ? "Enter a prompt"
              : `Generate ${count} image${count === 1 ? "" : "s"}`
          }
        >
          {Icon.generate}
          Generate · ≈ {formatCostUsd(cost)}
        </button>
      </div>
    </div>
  );
}
