"use client";

// Side-by-side comparison modal — open from the canvas Compare button.
//
// Behaviour
//   - Two panes, each independently zoomable + pannable. Mouse wheel
//     zooms (cursor-anchored), click+drag pans, double-click resets.
//   - Sync View toggle (default ON) — when on, zoom + pan changes on
//     either pane apply to both. When the user flicks it off, each pane
//     keeps its own view; flicking back on snaps the right pane to the
//     left's current view.
//   - With 2 versions: defaults left = original (first), right = latest
//     (most recent). No selectors needed.
//   - With 3+ versions: each pane shows a dropdown so the user can pick
//     which two to compare.
//
// State note: panes use percentage-based pan within their own
// containers so resizing the modal doesn't break alignment.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Version } from "./WorkflowsPanel";
import { Icon } from "./icons";

type Transform = { zoom: number; panX: number; panY: number };
const IDENT: Transform = { zoom: 1, panX: 0, panY: 0 };

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

function clampZoom(z: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function ComparePanel({
  versions,
  initialLeftId,
  initialRightId,
  onClose,
}: {
  versions: Version[];
  initialLeftId: string;
  initialRightId: string;
  onClose: () => void;
}) {
  const [leftId, setLeftId] = useState(initialLeftId);
  const [rightId, setRightId] = useState(initialRightId);
  const [sync, setSync] = useState(true);
  const [leftT, setLeftT] = useState<Transform>(IDENT);
  const [rightT, setRightT] = useState<Transform>(IDENT);

  const left = useMemo(
    () => versions.find((v) => v.id === leftId) ?? versions[0],
    [versions, leftId],
  );
  const right = useMemo(
    () => versions.find((v) => v.id === rightId) ?? versions[versions.length - 1],
    [versions, rightId],
  );

  // When sync flips on, snap the right pane to the left pane's view.
  useEffect(() => {
    if (sync) setRightT(leftT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setT = (side: "left" | "right", next: Transform | ((p: Transform) => Transform)) => {
    if (sync) {
      setLeftT((p) => (typeof next === "function" ? next(p) : next));
      setRightT((p) => (typeof next === "function" ? next(p) : next));
      return;
    }
    if (side === "left") setLeftT((p) => (typeof next === "function" ? next(p) : next));
    else setRightT((p) => (typeof next === "function" ? next(p) : next));
  };

  const reset = () => {
    setLeftT(IDENT);
    setRightT(IDENT);
  };

  const showSelectors = versions.length > 2;

  return (
    <div className="rfs-compare-shell" role="dialog" aria-label="Compare versions">
      <header className="rfs-compare-header">
        <div className="rfs-compare-title">
          <span className="rfs-compare-title-mark" aria-hidden>
            {Icon.compare}
          </span>
          <span>Compare versions</span>
          <span className="rfs-compare-title-meta">
            {versions.length} version{versions.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="rfs-compare-header-actions">
          <button type="button" className="rfs-btn" onClick={reset}>
            Reset
          </button>
          <button type="button" className="rfs-iconbtn" onClick={onClose} aria-label="Close">
            {Icon.close}
          </button>
        </div>
      </header>

      <div className="rfs-compare-body">
        <ComparePane
          version={left}
          versions={versions}
          showSelector={showSelectors}
          onSelect={setLeftId}
          transform={leftT}
          onTransform={(next) => setT("left", next)}
        />
        <ComparePane
          version={right}
          versions={versions}
          showSelector={showSelectors}
          onSelect={setRightId}
          transform={rightT}
          onTransform={(next) => setT("right", next)}
        />
      </div>

      <footer className="rfs-compare-footer">
        <label className="rfs-compare-sync">
          <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} />
          <span>Sync View</span>
          <span className="rfs-compare-sync-hint">
            {sync ? "zoom + pan apply to both" : "each pane is independent"}
          </span>
        </label>
        <span className="rfs-compare-help">Wheel = zoom · drag = pan · double-click = reset</span>
      </footer>
    </div>
  );
}

function ComparePane({
  version,
  versions,
  showSelector,
  onSelect,
  transform,
  onTransform,
}: {
  version: Version;
  versions: Version[];
  showSelector: boolean;
  onSelect: (id: string) => void;
  transform: Transform;
  onTransform: (next: Transform | ((p: Transform) => Transform)) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    // Cursor-anchored zoom: keep the point under the cursor stable.
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    onTransform((prev) => {
      const nextZoom = clampZoom(prev.zoom * factor);
      const realFactor = nextZoom / prev.zoom;
      // Anchor: pixel position of cursor relative to stage center, with
      // the current pan applied. Adjust pan so the same image pixel
      // stays under the cursor after the zoom change.
      const stageCenterX = rect.width / 2;
      const stageCenterY = rect.height / 2;
      const ax = cx - stageCenterX;
      const ay = cy - stageCenterY;
      const nextPanX = ax - (ax - prev.panX) * realFactor;
      const nextPanY = ay - (ay - prev.panY) * realFactor;
      return { zoom: nextZoom, panX: nextPanX, panY: nextPanY };
    });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      px: transform.panX,
      py: transform.panY,
    };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    onTransform((prev) => ({
      ...prev,
      panX: drag.px + dx,
      panY: drag.py + dy,
    }));
  };
  const onMouseUp = () => {
    dragRef.current = null;
  };
  const onDoubleClick = () => {
    onTransform({ zoom: 1, panX: 0, panY: 0 });
  };

  return (
    <div className="rfs-compare-pane">
      <div className="rfs-compare-pane-header">
        {showSelector ? (
          <select
            className="rfs-compare-pane-select"
            value={version.id}
            onChange={(e) => onSelect(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
                {v.ts === 0 ? "" : ` · ${new Date(v.ts).toLocaleTimeString()}`}
              </option>
            ))}
          </select>
        ) : (
          <span className="rfs-compare-pane-label">{version.label}</span>
        )}
        <span className="rfs-compare-pane-zoom">{Math.round(transform.zoom * 100)}%</span>
      </div>
      <div
        ref={stageRef}
        className="rfs-compare-stage"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={onDoubleClick}
      >
        <img
          src={version.url}
          alt={version.label}
          draggable={false}
          style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </div>
  );
}
