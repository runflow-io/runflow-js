"use client";

// Center canvas — image stage with overlays for pin marker, brush mask,
// generation spinner, error toast. The image lives inside an
// `image-frame` wrapper so absolute children share the image's exact
// bounding box (no off-by-letterbox drift on pin clicks).

import { type Ref, useState } from "react";
import { Icon } from "./icons";
import { displayBucket, aspectRatioLabel } from "../lib/resolution";
import { usePendingPhrase } from "../lib/workflow-progress";

export type Pin = { x: number; y: number };

export function StudioCanvas({
  imageUrl,
  imageTitle,
  imageWidth,
  imageHeight,
  requestedResolution,
  imgRef,
  isPinning,
  isPainting,
  pin,
  onImageClick,
  brushCanvasRef,
  onMaskDown,
  onMaskMove,
  onMaskUp,
  brushSize,
  onBrushSize,
  maskCoverage,
  onClearMask,
  hint,
  pending,
  pendingLabel,
  pendingWorkflowId,
  pendingKind,
  pendingPrompt,
  error,
  sentinelBadge,
  chatMaskMode,
  chatPinMode,
  onConfirmChatMask,
  onCancelChatMask,
  onCancelChatPin,
  onOpenCompare,
  compareEnabled,
  onDownloadAll,
  canDownloadAll,
}: {
  imageUrl: string | null;
  imageTitle: string;
  imageWidth?: number;
  imageHeight?: number;
  /** The bucket the user requested for this version ("1K"/"2K"/"4K"),
   * if any. When set, the resolution pill shows this label instead of
   * the dimension-derived bucket — so a "2K" run that comes back at
   * 1620×2880 still reads "2K", matching the chat agent's confirmation. */
  requestedResolution?: string;
  imgRef: Ref<HTMLImageElement>;
  isPinning: boolean;
  isPainting: boolean;
  pin: Pin | null;
  onImageClick: (e: React.MouseEvent<HTMLImageElement>) => void;
  brushCanvasRef: Ref<HTMLCanvasElement>;
  onMaskDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMaskMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMaskUp: () => void;
  brushSize: number;
  onBrushSize: (n: number) => void;
  maskCoverage: number;
  onClearMask: () => void;
  hint: string | null;
  pending: boolean;
  pendingLabel: string | null;
  pendingWorkflowId: string | null;
  /** When `pending` is true and the version has no source image yet
   * (text-to-image generations are URL-less while the model is
   * working), the canvas renders a generation skeleton instead of
   * the empty state. Defaults to "workflow" when omitted. */
  pendingKind?: "workflow" | "generation";
  /** The prompt the user typed, surfaced inside the generation
   * skeleton so they can read what they asked for while it loads. */
  pendingPrompt?: string | null;
  error: string | null;
  sentinelBadge?: React.ReactNode;
  chatMaskMode?: boolean;
  chatPinMode?: boolean;
  onConfirmChatMask?: () => void;
  onCancelChatMask?: () => void;
  onCancelChatPin?: () => void;
  onOpenCompare?: () => void;
  compareEnabled?: boolean;
  /** Bundles every non-pending version of the active asset into one
   * .zip download. Disabled (not hidden) when there are fewer than 2
   * downloadable versions so the affordance stays discoverable. */
  onDownloadAll?: () => void;
  canDownloadAll?: boolean;
}) {
  // Rotating microcopy for the pending pill so the user can see the
  // studio is doing something, instead of the same "Working…" label
  // sitting still for a minute. Hook called unconditionally; it only
  // ticks while pending=true.
  const pendingPhrase = usePendingPhrase(pendingWorkflowId, pending);

  // Copy-link affordance — flips the icon to a check for ~1500ms after
  // a successful clipboard write so the user gets unambiguous feedback
  // without us plumbing a toast prop through the canvas. On reject
  // (insecure context, permissions denied) we log and stay idle —
  // Track 3 keeps the canvas self-contained.
  const [copied, setCopied] = useState(false);
  const handleCopyLink = async () => {
    if (!imageUrl) return;
    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn("Copy link failed:", err);
    }
  };

  if (!imageUrl) {
    // Generation pending state — the active variation is being
    // generated from text, so there's no image yet. Show a skeleton
    // shimmer + the user's prompt + a rotating microcopy phrase, so
    // the canvas reflects "we're working on this for you" instead of
    // the cold empty state. The pendingPhrase rotation happens via
    // the shared workflow-progress hook (workflowId="generate").
    if (pending && pendingKind === "generation") {
      return (
        <div className="rfs-canvas">
          <div className="rfs-canvas-generation">
            <div className="rfs-canvas-generation-skeleton" aria-hidden>
              <div className="rfs-canvas-generation-shimmer" />
            </div>
            <div className="rfs-canvas-generation-overlay">
              {pendingPrompt ? (
                <div className="rfs-canvas-generation-prompt">{pendingPrompt}</div>
              ) : null}
              <div className="rfs-canvas-generation-status">
                <span className="rfs-canvas-pending-spinner" aria-hidden />
                <span className="rfs-canvas-pending-phrase">
                  {pendingPhrase}
                  <span className="rfs-canvas-pending-dots" aria-hidden>
                    <span /><span /><span />
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    // Failed generation state — the variation came back with an
    // error and no image. Show an explicit "this one didn't work"
    // surface with the prompt and the error, instead of falling
    // through to the cold "No image selected" empty state which
    // makes it look like the studio forgot what was asked.
    if (error) {
      return (
        <div className="rfs-canvas">
          <div className="rfs-canvas-generation rfs-canvas-generation-failed">
            <div className="rfs-canvas-generation-overlay">
              {pendingPrompt ? (
                <div className="rfs-canvas-generation-prompt">{pendingPrompt}</div>
              ) : null}
              <div className="rfs-canvas-generation-failed-pill">
                Couldn't generate this one — {error}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="rfs-canvas">
        <div className="rfs-canvas-empty">
          <h2>No image selected</h2>
          <p>Pick a sample from the left, or drop your own to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rfs-canvas${isPinning ? " is-pinning" : ""}${isPainting ? " is-painting" : ""}`}>
      <div className="rfs-image-frame">
        <img ref={imgRef} src={imageUrl} alt={imageTitle} draggable={false} onClick={onImageClick} />
        {pin && isPinning ? (
          <div
            className="rfs-pin"
            style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
            aria-hidden
          >
            <span className="rfs-pin-dot" />
            <span className="rfs-pin-pulse" />
          </div>
        ) : null}
        {isPainting ? (
          <canvas
            ref={brushCanvasRef}
            className="rfs-mask-canvas"
            onMouseDown={onMaskDown}
            onMouseMove={onMaskMove}
            onMouseUp={onMaskUp}
            onMouseLeave={onMaskUp}
          />
        ) : null}
        {/* Sentinel badge + judges panel — anchored bottom-left of image */}
        {sentinelBadge}
        {/* Compare — graduated out of the hover row. Customers never
            found it on hover-only, and side-by-side scrub is one of the
            studio's headline moments. Persistent top-right floating
            button on the canvas, subtle when idle, clear on hover. */}
        <button
          className="rfs-canvas-compare-btn"
          title={compareEnabled ? "Compare versions" : "Need at least 2 versions to compare"}
          onClick={onOpenCompare}
          disabled={!compareEnabled}
          aria-label="Compare versions"
        >
          {Icon.compare}
          <span className="rfs-canvas-compare-btn-label">Compare</span>
        </button>
        {/* Mobile-only info chip — tap the "?" to surface resolution
            + aspect + raw dimensions. Replaces the hover-only desktop
            tools row on phones where hover doesn't exist. <details>
            handles the toggle natively, no React state needed. */}
        {imageWidth && imageHeight ? (
          <details className="rfs-canvas-info">
            <summary className="rfs-canvas-info-btn" aria-label="Show image details">
              ?
            </summary>
            <div className="rfs-canvas-info-popover" role="status">
              {(() => {
                const bucket = displayBucket(imageWidth, imageHeight, requestedResolution);
                return (
                  <span className={`rfs-canvas-info-pill rfs-canvas-res-${bucket.toLowerCase()}`}>
                    {bucket}
                  </span>
                );
              })()}
              <span className="rfs-canvas-info-pill">{aspectRatioLabel(imageWidth, imageHeight)}</span>
              <span className="rfs-canvas-info-dim">
                {imageWidth}×{imageHeight}
              </span>
            </div>
          </details>
        ) : null}
        {/* Info + extra actions — hover-only, bottom-right.
            Resolution + aspect pills, Copy link, Download. Compare is
            no longer in this row (it's the persistent button above). */}
        <div className="rfs-canvas-tools">
          {imageWidth && imageHeight ? (
            <>
              {(() => {
                const bucket = displayBucket(imageWidth, imageHeight, requestedResolution);
                return (
                  <span
                    className={`rfs-canvas-tools-pill rfs-canvas-res-${bucket.toLowerCase()}`}
                    title={`${imageWidth}×${imageHeight}`}
                  >
                    {bucket}
                  </span>
                );
              })()}
              <span className="rfs-canvas-tools-pill rfs-canvas-tools-pill-muted">
                {aspectRatioLabel(imageWidth, imageHeight)}
              </span>
            </>
          ) : null}
          <button
            className="rfs-iconbtn"
            title={copied ? "Copied!" : "Copy image link"}
            onClick={handleCopyLink}
            aria-label="Copy image link"
          >
            {copied ? Icon.check : Icon.link}
          </button>
          <a className="rfs-iconbtn" href={imageUrl} target="_blank" rel="noreferrer" title="Download this version">
            {Icon.download}
          </a>
          {onDownloadAll ? (
            <button
              className="rfs-iconbtn"
              onClick={onDownloadAll}
              disabled={!canDownloadAll}
              title={canDownloadAll ? "Download all versions as .zip" : "Need at least 2 versions to bundle"}
              aria-label="Download all versions as .zip"
            >
              {Icon.downloadAll}
            </button>
          ) : null}
        </div>
      </div>

      {isPainting ? (
        <div className="rfs-brush-toolbar">
          <span className="rfs-brush-label">Brush</span>
          <input
            type="range"
            min={10}
            max={120}
            value={brushSize}
            onChange={(e) => onBrushSize(parseInt(e.target.value, 10))}
            className="rfs-brush-range"
          />
          <span className="rfs-brush-size">{brushSize}px</span>
          <button
            className="rfs-brush-clear"
            onClick={onClearMask}
            disabled={maskCoverage === 0}
          >
            Clear
          </button>
          {chatMaskMode ? (
            <>
              <span className="rfs-brush-divider" />
              <button
                className="rfs-brush-confirm"
                onClick={onConfirmChatMask}
                disabled={maskCoverage < 0.08}
              >
                Confirm mask
              </button>
              <button className="rfs-brush-clear" onClick={onCancelChatMask}>
                Cancel
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {chatPinMode ? (
        <button
          className="rfs-brush-clear"
          onClick={onCancelChatPin}
          style={{
            position: "absolute",
            right: "1.75rem",
            top: "1.75rem",
            background: "rgba(24,24,27,0.92)",
            border: "1px solid var(--rfs-bg-3)",
            color: "var(--rfs-ink-1)",
            padding: "0.4375rem 0.875rem",
            borderRadius: 999,
            zIndex: 3,
          }}
        >
          Cancel
        </button>
      ) : null}

      {hint ? (
        <div className="rfs-stage-hint">
          <span className="rfs-stage-hint-dot" />
          <span dangerouslySetInnerHTML={{ __html: hint }} />
        </div>
      ) : null}

      {pending ? (
        <div className="rfs-canvas-pending" role="status">
          <span className="rfs-canvas-pending-spinner" aria-hidden />
          <span className="rfs-canvas-pending-phrase">
            {pendingPhrase}
            <span className="rfs-canvas-pending-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </span>
        </div>
      ) : null}

      {error ? <div className="rfs-canvas-error">{error}</div> : null}
    </div>
  );
}
