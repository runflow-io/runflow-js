"use client";

// Sentinel badge for the canvas — a small pill bottom-left of the image
// with a click-to-expand panel showing the full eval verdict. The panel
// surfaces the rich Sentinel response (per-judge reasoning, detected
// issues, confidence, top strengths) so the user understands WHY a
// shot scored the way it did, not just whether it passed.

import { useEffect, useRef, useState } from "react";
import type { Judge, SentinelResult } from "../lib/sentinel";

// Format elapsed seconds for the pending badge. Under a minute we
// just show "Ys"; past 60s we collapse into "Xm Ys" so the user
// gets a bounded, scannable count instead of "127s".
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// Headline labels for the canvas badge. Pay attention to the split
// between `red` and `failed` — they're semantically different states
// the original badge was conflating:
//   - red    → judges actually voted "this image fails 2+ checks"
//              (a real, actionable verdict; show in danger colour).
//   - failed → eval crashed / timed out / Vertex unavailable
//              (an infrastructure error; show in neutral so a perfect
//              image doesn't get blamed for the eval pipeline being
//              down). The existing CSS classes already split these —
//              this map drives the user-facing wording.
const LABEL: Record<SentinelResult["state"], string> = {
  pending: "Sentinel checking…",
  green: "Quality: all checks pass",
  amber: "Quality: minor issue",
  red: "Quality check failed",
  failed: "Quality check error",
};

// Tooltip detail when the user hovers — same disambiguation as LABEL,
// but a sentence longer because the tooltip has room.
const TOOLTIP: Record<SentinelResult["state"], string> = {
  pending: "Sentinel is running its judges on this image.",
  green: "All Sentinel judges passed this image.",
  amber: "One Sentinel judge raised a minor flag.",
  red: "Two or more Sentinel judges failed this image.",
  failed:
    "Sentinel couldn't finish the eval (network, timeout, or upstream error). The image itself is unaffected — only the quality score is missing.",
};

export function SentinelDot({ state }: { state: SentinelResult["state"] }) {
  return <span className={`rfs-sentinel-dot is-${state}`} />;
}

// Compact pill used in places that aren't the canvas (version stripe
// thumbs, history rows). Same dot + state colours as the badge, but
// flatter and tooltip-only — clicking is the badge's job. Pass
// `result=null` to render a "skipped" chip with explanation tooltip
// (intermediate steps where Sentinel didn't run).
export function SentinelChip({
  result,
  skipped,
  size = "sm",
}: {
  result?: SentinelResult;
  /** When true, render a muted "Skipped" chip even though there's no
   * SentinelResult. Used for intermediate chain steps that bypassed
   * Sentinel because the gating toggle was off. */
  skipped?: boolean;
  size?: "xs" | "sm";
}) {
  if (!result && !skipped) return null;

  if (skipped || !result) {
    const skipTooltip =
      "Sentinel skipped on this intermediate step. Turn on “Run Sentinel between steps” in Settings to gate every step.";
    if (size === "xs") {
      return (
        <span
          className="rfs-sentinel-chip-xs is-skipped"
          title={skipTooltip}
          aria-label="Sentinel skipped"
        >
          <span className="rfs-sentinel-dot is-failed" />
        </span>
      );
    }
    return (
      <span
        className={`rfs-sentinel-chip is-skipped rfs-sentinel-chip-${size}`}
        title={skipTooltip}
      >
        <span className="rfs-sentinel-dot is-failed" />
        <span>skipped</span>
      </span>
    );
  }

  const passes = result.judges?.filter((j) => j.pass).length ?? 0;
  const total = result.judges?.length ?? 0;
  const score = typeof result.score === "number" ? Math.round(result.score * 100) : null;

  const summary: Record<SentinelResult["state"], string> = {
    pending: "Sentinel checking",
    green: "All checks pass",
    amber: "Minor issue",
    red: "Quality check failed",
    failed: "Quality check error",
  };

  const tooltipParts: string[] = [summary[result.state]];
  if (total > 0) tooltipParts.push(`${passes}/${total} judges passed`);
  if (score !== null) tooltipParts.push(`score ${score}%`);
  if (result.hardGateFailures && result.hardGateFailures.length > 0) {
    tooltipParts.push(
      `${result.hardGateFailures.length} hard-gate ${result.hardGateFailures.length === 1 ? "failure" : "failures"}`,
    );
  }
  if (result.topIssues && result.topIssues.length > 0) {
    tooltipParts.push(`Top issue: ${result.topIssues[0]}`);
  }
  if (result.state === "failed" && result.error) {
    tooltipParts.push(`Error: ${result.error}`);
  }
  const tooltip = tooltipParts.join(" · ");

  // xs is dot-only — the version stripe thumbs are 56px and any text
  // would overflow. Score lives in the tooltip. `failed` swaps the dot
  // for a "?" mark so a glance at the version stripe distinguishes
  // "eval errored" (neutral question mark) from "judges failed" (red
  // dot) without reading the tooltip.
  if (size === "xs") {
    return (
      <span
        className={`rfs-sentinel-chip-xs is-${result.state}`}
        title={tooltip}
        aria-label={tooltip}
      >
        {result.state === "failed" ? (
          <span className="rfs-sentinel-badge-icon" aria-hidden>
            ?
          </span>
        ) : (
          <span className={`rfs-sentinel-dot is-${result.state}`} />
        )}
      </span>
    );
  }

  // Body: prefer score, fall back to pass/total, fall back to a state
  // word for pending/failed. The `failed` chip uses "?" to signal "we
  // don't know" (eval crashed) — distinct from `red` which shows a
  // real numeric score.
  let body: React.ReactNode;
  if (result.state === "pending") body = <span>checking</span>;
  else if (result.state === "failed") body = <span aria-label="Quality check error">?</span>;
  else if (score !== null) body = <span>{score}%</span>;
  else if (total > 0)
    body = (
      <span>
        {passes}/{total}
      </span>
    );
  else body = <span>{result.state}</span>;

  return (
    <span
      className={`rfs-sentinel-chip is-${result.state} rfs-sentinel-chip-${size}`}
      title={tooltip}
    >
      {result.state === "failed" ? (
        <span className="rfs-sentinel-badge-icon" aria-hidden>
          ?
        </span>
      ) : (
        <span className={`rfs-sentinel-dot is-${result.state}`} />
      )}
      {body}
    </span>
  );
}

export function SentinelBadge({
  result,
  open,
  onToggle,
  versionId,
  onRetry,
  retryInFlight,
}: {
  result: SentinelResult;
  open: boolean;
  onToggle: () => void;
  /** Identity for the pending elapsed-time clock. When this changes,
   * the clock resets — so navigating between versions doesn't carry
   * an old "1m 23s" forward, and a fresh retry starts at 0s. */
  versionId?: string;
  /** Re-fire the eval against the same image. Only meaningful when
   * `state === "failed"` (eval crashed/timed out — image is fine).
   * Skipped if not provided. */
  onRetry?: () => void;
  /** True while a retry is mid-flight. The retry button disables to
   * prevent double-clicks; the parent has already flipped state back
   * to "pending" so the badge body reflects "Sentinel checking" with
   * the elapsed clock spinning up from 0. */
  retryInFlight?: boolean;
}) {
  const passes = result.judges?.filter((j) => j.pass).length ?? 0;
  const total = result.judges?.length ?? 0;

  // Elapsed-time tick for the pending state. Self-contained: only the
  // pending state mounts the interval, and we key the start time by
  // versionId so jumping between versions resets the counter cleanly.
  const [elapsedSec, setElapsedSec] = useState(0);
  // Track which version we're currently timing — when the user
  // navigates to a different pending version the clock should reset
  // to 0 instead of continuing where the last one left off.
  const startRef = useRef<{ key: string; startedAt: number } | null>(null);
  useEffect(() => {
    if (result.state !== "pending") {
      startRef.current = null;
      setElapsedSec(0);
      return;
    }
    const key = `${versionId ?? "anon"}`;
    // (Re)anchor on entry to pending OR when the version changes.
    if (!startRef.current || startRef.current.key !== key) {
      startRef.current = { key, startedAt: Date.now() };
      setElapsedSec(0);
    }
    const tick = () => {
      const anchor = startRef.current;
      if (!anchor) return;
      setElapsedSec(Math.max(0, Math.floor((Date.now() - anchor.startedAt) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [result.state, versionId]);

  return (
    <>
      <button
        type="button"
        className={`rfs-sentinel-badge is-${result.state}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-label={LABEL[result.state]}
        title={TOOLTIP[result.state]}
      >
        {result.state === "failed" ? (
          <span className="rfs-sentinel-badge-icon" aria-hidden>
            ?
          </span>
        ) : (
          <span
            className={`rfs-sentinel-dot is-${result.state}${result.state === "pending" ? " is-pulsing" : ""}`}
          />
        )}
        <span>{LABEL[result.state]}</span>
        {result.state === "pending" ? (
          <span
            className="rfs-sentinel-badge-elapsed"
            aria-label={`Elapsed ${formatElapsed(elapsedSec)}`}
          >
            {formatElapsed(elapsedSec)}
          </span>
        ) : null}
        {result.state !== "failed" && result.state !== "pending" && total > 0 ? (
          <span style={{ color: "var(--rfs-ink-3)", fontWeight: 500 }}>
            {passes}/{total}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="rfs-sentinel-panel" role="dialog" aria-label="Sentinel verdict">
          <header className="rfs-sentinel-panel-header">
            <span className="rfs-sentinel-panel-title">
              {result.state === "failed" ? (
                <span className="rfs-sentinel-badge-icon" aria-hidden>
                  ?
                </span>
              ) : (
                <span className={`rfs-sentinel-dot is-${result.state}`} />
              )}
              {result.state === "failed"
                ? "Quality check error"
                : result.state === "red"
                  ? "Quality check failed"
                  : "Sentinel checks"}
            </span>
            {typeof result.score === "number" ? (
              <span className="rfs-sentinel-panel-score">{Math.round(result.score * 100)}%</span>
            ) : null}
          </header>

          {/* Hard-gate banner — appears only if a critical check failed. */}
          {result.hardGateFailures && result.hardGateFailures.length > 0 ? (
            <div className="rfs-sentinel-hardgate">
              <strong>Critical:</strong> {result.hardGateFailures.length} hard-gate{" "}
              {result.hardGateFailures.length === 1 ? "failure" : "failures"}
            </div>
          ) : null}

          {result.judges?.length ? (
            <div className="rfs-sentinel-judges">
              {result.judges.map((j) => (
                <JudgeRow key={j.name} judge={j} />
              ))}
            </div>
          ) : result.state === "pending" ? (
            <div className="rfs-sentinel-panel-empty">
              Running judges — typically 2–4 minutes. The verdict will appear here when it lands.
              <div className="rfs-sentinel-panel-elapsed" aria-live="polite">
                Evaluating · {formatElapsed(elapsedSec)}
              </div>
            </div>
          ) : (
            <div className="rfs-sentinel-panel-empty">
              {result.error ? (
                <>
                  Couldn&apos;t reach Sentinel: <code>{result.error}</code>. The image still works —
                  only the quality score is missing. If this keeps happening, ping Ziad (ML) with
                  the error above.
                </>
              ) : (
                "Sentinel returned no judges for this run."
              )}
              {/* Retry path for failed/errored evals — reruns the eval
                  against the SAME image (no workflow re-dispatch). The
                  parent flips state back to "pending" while the call
                  is in flight; we just guard the click. */}
              {result.state === "failed" && onRetry ? (
                <div className="rfs-sentinel-panel-actions">
                  <button
                    type="button"
                    className="rfs-btn rfs-btn-primary rfs-sentinel-retry-btn"
                    onClick={onRetry}
                    disabled={!!retryInFlight}
                    title={
                      retryInFlight
                        ? "Quality check already retrying"
                        : "Re-run Sentinel against this image without re-running the workflow"
                    }
                  >
                    {retryInFlight ? "Retrying…" : "Retry quality check"}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Curated narrative summaries — collapsed by default since they're long.
             Only render the section if there's content. */}
          {result.topIssues && result.topIssues.length > 0 ? (
            <CollapsibleSummary
              title={`${result.topIssues.length} top ${result.topIssues.length === 1 ? "issue" : "issues"}`}
              items={result.topIssues}
              kind="issue"
            />
          ) : null}
          {result.topStrengths && result.topStrengths.length > 0 ? (
            <CollapsibleSummary
              title={`${result.topStrengths.length} strength${result.topStrengths.length === 1 ? "" : "s"}`}
              items={result.topStrengths}
              kind="strength"
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// Per-judge row — collapsed shows the verdict + confidence; expanded
// shows detected_issues (specific findings) + reasoning text.
function JudgeRow({ judge }: { judge: Judge }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!judge.reasoning || (judge.detectedIssues && judge.detectedIssues.length > 0);
  const conf = typeof judge.confidence === "number" ? Math.round(judge.confidence * 100) : null;

  return (
    <div className={`rfs-sentinel-judge${judge.pass ? " is-pass" : " is-fail"}`}>
      <button
        type="button"
        className="rfs-sentinel-judge-header"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        disabled={!hasDetail}
        aria-expanded={expanded}
      >
        <span className="rfs-sentinel-judge-mark" aria-hidden>
          {judge.pass ? "✓" : "✗"}
        </span>
        <span className="rfs-sentinel-judge-name">{judge.name}</span>
        {conf !== null ? (
          <span className="rfs-sentinel-judge-conf" title="Sentinel confidence">
            {conf}%
          </span>
        ) : null}
        {hasDetail ? (
          <span className={`rfs-sentinel-judge-chev${expanded ? " is-open" : ""}`} aria-hidden>
            ▾
          </span>
        ) : null}
      </button>
      {expanded && hasDetail ? (
        <div className="rfs-sentinel-judge-body">
          {judge.detectedIssues && judge.detectedIssues.length > 0 ? (
            <div className="rfs-sentinel-judge-section">
              <div className="rfs-sentinel-judge-section-label">Detected</div>
              <ul className="rfs-sentinel-judge-issues">
                {judge.detectedIssues.map((iss, i) => (
                  <li key={i}>
                    <span className="rfs-sentinel-judge-tag">{iss.subcategory}</span>
                    {iss.detail ? (
                      <span className="rfs-sentinel-judge-detail"> — {iss.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {judge.reasoning ? (
            <div className="rfs-sentinel-judge-section">
              <div className="rfs-sentinel-judge-section-label">Reasoning</div>
              <p className="rfs-sentinel-judge-reasoning">{judge.reasoning}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Curated top-level summaries from Sentinel (top_issues / top_strengths).
// Each item is roughly one paragraph; collapsed by default to keep the
// panel scannable. Click to reveal the full text.
function CollapsibleSummary({
  title,
  items,
  kind,
}: {
  title: string;
  items: string[];
  kind: "issue" | "strength";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rfs-sentinel-summary rfs-sentinel-summary-${kind}`}>
      <button
        type="button"
        className="rfs-sentinel-summary-header"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="rfs-sentinel-summary-icon" aria-hidden>
          {kind === "strength" ? "✓" : "!"}
        </span>
        <span className="rfs-sentinel-summary-title">{title}</span>
        <span className={`rfs-sentinel-judge-chev${open ? " is-open" : ""}`} aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul className="rfs-sentinel-summary-list">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
