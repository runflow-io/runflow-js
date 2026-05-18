/**
 * Inlined Studio stylesheet (full version ported from the prototype).
 *
 * `mount()` injects this into the host page's <head> on first call so
 * customers don't have to remember a separate CSS import. Source lives
 * alongside in `styles.css` for direct consumption.
 */

export const STUDIO_CSS = `/* Runflow AI Studio — flagship design system. Dark base, yellow accent,
   Outfit type. Inspired by Linear/Figma — surfaces float over a dark
   canvas, generous spacing, sharp typography.

   Token palette:
     bg-0   #0A0A0B   page background
     bg-1   #18181B   surface
     bg-2   #27272A   elevated surface
     bg-3   #3F3F46   borders / dividers
     ink-0  #FAFAFA   primary text
     ink-1  #D4D4D8   secondary text
     ink-2  #A1A1AA   tertiary text
     ink-3  #71717A   muted
     accent #FBBF24   yellow brand
     accent-dim #F59E0B
     accent-soft rgba(251,191,36,0.12)
*/

.rfs-root {
  --rfs-bg-0: #0A0A0B;
  --rfs-bg-1: #18181B;
  --rfs-bg-2: #27272A;
  --rfs-bg-3: #3F3F46;
  --rfs-ink-0: #FAFAFA;
  --rfs-ink-1: #D4D4D8;
  --rfs-ink-2: #A1A1AA;
  --rfs-ink-3: #71717A;
  --rfs-accent: #FBBF24;
  --rfs-accent-dim: #F59E0B;
  --rfs-accent-soft: rgba(251,191,36,0.12);
  --rfs-success: #22C55E;
  --rfs-danger:  #F87171;
  --rfs-radius:  12px;
  --rfs-radius-lg: 16px;
  --rfs-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2);

  --rfs-left-w: 268px;
  font-family: Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--rfs-ink-0);
  background: var(--rfs-bg-0);
  /* Lock to viewport so version stripe always sits in view on a 13"
     laptop. Internal regions handle their own overflow. */
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: grid;
  grid-template-columns: var(--rfs-left-w) minmax(0, 1fr) clamp(340px, 28vw, 420px);
  grid-template-rows: 52px minmax(0, 1fr);
  grid-template-areas:
    "header header header"
    "left   center right";
  transition: grid-template-columns 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
.rfs-root.is-rail-collapsed {
  --rfs-left-w: 0px;
}

/* ============ Header ============ */
.rfs-header {
  grid-area: header;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 1rem;
  border-bottom: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-0);
  position: relative;
  z-index: 5;
}
.rfs-brand {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.25rem 0.375rem;
}
.rfs-brand-mark {
  width: 36px; height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #09090B, var(--rfs-accent));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
}
.rfs-brand-name {
  font-weight: 800; font-size: 1rem; letter-spacing: -0.03em;
}
.rfs-brand-name span { color: var(--rfs-accent); }
.rfs-brand-tag {
  margin-left: 0.5rem;
  padding: 2px 6px;
  background: var(--rfs-bg-2);
  color: var(--rfs-ink-2);
  font-size: 0.6875rem; font-weight: 600;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.rfs-project {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--rfs-ink-2);
}
.rfs-project-name {
  color: var(--rfs-ink-0);
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  font-family: inherit;
  font-size: inherit;
  cursor: pointer;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rfs-project-name:hover:not(:disabled) {
  background: var(--rfs-bg-2);
  border-color: var(--rfs-bg-3);
}
.rfs-project-name:disabled { cursor: default; opacity: 0.6; }
.rfs-project-name-input {
  color: var(--rfs-ink-0);
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-accent);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  outline: none;
  width: 240px;
}

.rfs-header-right { display: flex; align-items: center; gap: 0.375rem; }
.rfs-iconbtn {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--rfs-ink-2);
  cursor: pointer;
  transition: background 120ms, color 120ms, border-color 120ms;
}
.rfs-iconbtn:hover { background: var(--rfs-bg-2); color: var(--rfs-ink-0); }
.rfs-iconbtn:disabled { opacity: 0.35; cursor: not-allowed; }
.rfs-btn {
  display: inline-flex; align-items: center; gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--rfs-bg-3);
  border-radius: 8px;
  background: var(--rfs-bg-1);
  color: var(--rfs-ink-0);
  font-family: inherit; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
}
.rfs-btn:hover { background: var(--rfs-bg-2); border-color: var(--rfs-bg-3); }
.rfs-btn-primary {
  background: var(--rfs-accent);
  border-color: var(--rfs-accent);
  color: #09090B;
}
.rfs-btn-primary:hover { background: var(--rfs-accent-dim); border-color: var(--rfs-accent-dim); }
.rfs-btn-primary:disabled { background: var(--rfs-bg-3); color: var(--rfs-ink-3); border-color: var(--rfs-bg-3); cursor: not-allowed; }
.rfs-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.rfs-avatar {
  width: 28px; height: 28px;
  border-radius: 999px;
  background: linear-gradient(135deg, #FCD34D, #F59E0B);
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.75rem;
  color: #09090B;
  margin-left: 0.25rem;
}

/* ============ Left rail (project explorer) ============ */
.rfs-left {
  grid-area: left;
  border-right: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-0);
  display: flex; flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
/* Unified inner padding (14px sides) so header / upload / thumbs all
   line up against the same vertical axis. Each child carries its own
   box-sizing: border-box (set globally) so width:100% includes padding. */
.rfs-left-header {
  flex-shrink: 0;
  padding: 0.875rem 0.875rem 0.5rem;
  display: flex; align-items: center; justify-content: space-between;
}
.rfs-left-title {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rfs-ink-3);
}
.rfs-left-upload {
  flex-shrink: 0;
  /* Right padding = base + reserved scrollbar gutter so the button's
     right edge aligns with the asset thumbnails below. */
  padding: 0 calc(0.875rem + 6px) 0.75rem 0.875rem;
  box-sizing: border-box;
}
.rfs-left-upload-btn {
  width: 100%;
  box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  background: var(--rfs-bg-1);
  border: 1px dashed var(--rfs-bg-3);
  border-radius: 10px;
  color: var(--rfs-ink-1);
  font-family: inherit; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer;
  transition: border-color 120ms, color 120ms, background 120ms;
}
.rfs-left-upload-btn:hover {
  border-color: var(--rfs-accent);
  color: var(--rfs-accent);
  background: var(--rfs-accent-soft);
}
.rfs-left-upload-btn input[type="file"] { display: none; }

/* Two-button "+ New asset" row — Upload + Generate. Lays out as a
   flex row so each button takes 50% of the rail. Generate inherits
   the same chrome as Upload but adds a subtle accent on the icon
   so the sparkle reads as the AI-creates-something affordance
   without being loud. */
.rfs-left-newasset {
  flex-shrink: 0;
  padding: 0 calc(0.875rem + 6px) 0.75rem 0.875rem;
  display: flex; gap: 0.4375rem;
  box-sizing: border-box;
}
.rfs-left-newasset-btn {
  flex: 1; min-width: 0;
  box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
  padding: 0.5rem 0.5rem;
  background: var(--rfs-bg-1);
  border: 1px dashed var(--rfs-bg-3);
  border-radius: 10px;
  color: var(--rfs-ink-1);
  font-family: inherit; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer;
  transition: border-color 120ms, color 120ms, background 120ms;
}
.rfs-left-newasset-btn:hover {
  border-color: var(--rfs-accent);
  color: var(--rfs-accent);
  background: var(--rfs-accent-soft);
}
.rfs-left-newasset-btn input[type="file"] { display: none; }
.rfs-left-newasset-generate {
  /* Slight accent on idle so the sparkle reads as the "creative"
     option vs. Upload's neutral file-bring-your-own affordance.
     Hover already sweeps both into accent territory. */
  border-style: solid;
  border-color: var(--rfs-accent-soft);
  color: var(--rfs-accent);
}

/* Generate panel — fills the left rail (replacing the asset list)
   when active. Same structural pattern as the recipe editor in the
   right rail: single scroll context, fixed header, scrollable body,
   pinned footer for the primary CTA. */
.rfs-generate-panel {
  flex: 1;
  min-height: 0;
  display: flex; flex-direction: column;
  background: var(--rfs-bg-0);
}
.rfs-generate-panel-header {
  flex-shrink: 0;
  display: flex; flex-direction: column; gap: 0.4375rem;
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid var(--rfs-bg-2);
}
.rfs-generate-back {
  display: inline-flex; align-items: center; gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  align-self: flex-start;
}
.rfs-generate-panel-title {
  display: inline-flex; align-items: center; gap: 0.5rem;
  font-size: 0.9375rem; font-weight: 700;
  color: var(--rfs-ink-0);
}
.rfs-generate-panel-title svg { color: var(--rfs-accent); }
.rfs-generate-panel-body {
  flex-shrink: 0;
  display: flex; flex-direction: column; gap: 0.75rem;
  padding: 0.875rem;
  border-bottom: 1px solid var(--rfs-bg-2);
}
.rfs-generate-res-row {
  display: flex; gap: 0.375rem;
}
.rfs-generate-res-btn {
  flex: 1;
  padding: 0.4375rem 0.5rem;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 8px;
  color: var(--rfs-ink-2);
  font-family: inherit; font-size: 0.75rem; font-weight: 700;
  cursor: pointer;
  transition: background 120ms, color 120ms, border-color 120ms;
}
.rfs-generate-res-btn:hover { color: var(--rfs-ink-0); border-color: var(--rfs-bg-3); }
.rfs-generate-res-btn.is-selected {
  background: var(--rfs-accent-soft);
  color: var(--rfs-accent);
  border-color: var(--rfs-accent);
}
.rfs-generate-count {
  width: 100%;
  accent-color: var(--rfs-accent);
}
.rfs-generate-footer {
  flex-shrink: 0;
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid var(--rfs-bg-2);
}
.rfs-generate-go {
  width: 100%;
  display: inline-flex; align-items: center; justify-content: center; gap: 0.4375rem;
}

/* In-flight summary — shown above the form while at least one
   variation in the current session is still pending. Tells the user
   "we're working on it; watch the canvas" and gives them a quick
   way to launch a brand-new batch without leaving the panel. */
.rfs-generate-inflight {
  flex-shrink: 0;
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: rgba(251,191,36,0.06);
  border-bottom: 1px solid var(--rfs-bg-2);
}
.rfs-generate-inflight-status {
  display: inline-flex; align-items: center; gap: 0.4375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--rfs-ink-0);
}
.rfs-generate-inflight-status strong {
  color: var(--rfs-accent);
  font-weight: 700;
}
.rfs-generate-inflight-prompt {
  font-size: 0.75rem;
  color: var(--rfs-ink-2);
  font-style: italic;
  line-height: 1.4;
  /* Cap to 3 lines to keep the summary compact even with long
     prompts; the canvas overlay shows the full prompt anyway. */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rfs-generate-inflight-hint {
  font-size: 0.6875rem;
  color: var(--rfs-ink-3);
  line-height: 1.45;
}
.rfs-generate-newrun {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 0.375rem;
  margin-top: 0.25rem;
  font-size: 0.75rem;
}

/* Results region — scrolls inside the panel so the params block
   stays anchored at the top during long batches. */
.rfs-generate-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.875rem;
  display: flex; flex-direction: column; gap: 0.625rem;
}
.rfs-generate-results-label {
  font-size: 0.625rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--rfs-ink-3);
  display: flex; gap: 0.4375rem;
}
.rfs-generate-tiles {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem;
}
.rfs-generate-tile {
  display: flex; flex-direction: column; gap: 0.4375rem;
  padding: 0.4375rem;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 10px;
  transition: border-color 140ms;
}
.rfs-generate-tile:hover { border-color: var(--rfs-bg-3); }
.rfs-generate-tile-img {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--rfs-bg-0);
}
.rfs-generate-tile-img img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.rfs-generate-tile-pending,
.rfs-generate-tile-failed {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem;
  text-align: center;
}
.rfs-generate-tile-spinner {
  width: 24px; height: 24px;
  border: 2px solid var(--rfs-bg-3);
  border-top-color: var(--rfs-accent);
  border-radius: 999px;
  animation: rfs-spin 1s linear infinite;
}
@keyframes rfs-spin { to { transform: rotate(360deg); } }
.rfs-generate-tile-phrase {
  font-size: 0.6875rem;
  color: var(--rfs-ink-2);
  line-height: 1.3;
}
.rfs-generate-tile-failed-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--rfs-danger);
}
.rfs-generate-tile-failed-body {
  font-size: 0.625rem;
  color: var(--rfs-ink-3);
  line-height: 1.3;
  word-break: break-word;
}
.rfs-generate-tile-sentinel {
  position: absolute;
  top: 0.4375rem; right: 0.4375rem;
}
.rfs-generate-tile-sentinel-pending {
  width: 18px; height: 18px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55);
  color: var(--rfs-ink-1);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 700;
}
.rfs-generate-tile-hint {
  font-size: 0.625rem;
  line-height: 1.35;
  padding: 0.25rem 0.4375rem;
  border-radius: 6px;
}
.rfs-generate-tile-hint-red {
  background: rgba(248,113,113,0.12);
  color: var(--rfs-danger);
}
.rfs-generate-tile-hint-failed {
  background: rgba(161,161,170,0.12);
  color: var(--rfs-ink-2);
}
.rfs-generate-tile-actions {
  display: flex; align-items: center; gap: 0.25rem;
}
.rfs-generate-tile-keep {
  flex: 1;
  display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem;
  padding: 0.4375rem 0.5rem;
  font-size: 0.75rem;
}

.rfs-asset-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* Outer padding matches inter-card gap so spacing is fully uniform —
     edge-to-edge of the rail looks identical to card-to-card. */
  padding: 1rem;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  align-content: start;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--rfs-bg-3) transparent;
}
.rfs-asset-list::-webkit-scrollbar { width: 6px; }
.rfs-asset-list::-webkit-scrollbar-track { background: transparent; }
.rfs-asset-list::-webkit-scrollbar-thumb {
  background: var(--rfs-bg-3); border-radius: 999px;
}
.rfs-asset-list::-webkit-scrollbar-thumb:hover { background: var(--rfs-ink-3); }

/* Asset cards — square, image fills the entire card edge-to-edge.
   The 1rem grid gap between cards is doing the visual-separation
   work; no internal matte needed. */
.rfs-asset {
  display: block;
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--rfs-bg-1);
  border: none;
  border-radius: 14px;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  transition: transform 120ms;
  box-sizing: border-box;
}
.rfs-asset > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  /* Cast-shadows in product photos sometimes extend past the pixel
     bounds; isolation:isolate clips them within the card. */
  isolation: isolate;
}
.rfs-asset:hover {
  transform: translateY(-1px);
}
.rfs-asset.is-current {
  /* Outline sits outside the image but doesn't take layout space, so
     uniform card spacing is preserved. */
  outline: 2px solid var(--rfs-accent);
  outline-offset: 0;
}

/* Edit-count badge — replaces the per-asset Sentinel dot. Only shown
   when an asset has more than one version (i.e. has been edited at
   least once). The number is the total number of frames "behind" this
   thumbnail. */
.rfs-asset-count {
  position: absolute;
  bottom: 6px; right: 6px;
  min-width: 22px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(9,9,11,0.88);
  backdrop-filter: blur(6px);
  color: var(--rfs-ink-0);
  border: 1px solid var(--rfs-bg-3);
  font-size: 0.6875rem;
  font-weight: 700;
  text-align: center;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

/* Re-open the rail when collapsed — small floating button */
.rfs-rail-toggle-floating {
  position: absolute;
  left: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 6;
}

/* ============ Center canvas ============ */
.rfs-center {
  grid-area: center;
  display: flex; flex-direction: column;
  min-height: 0;
  background: var(--rfs-bg-0);
}
.rfs-canvas {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  align-items: center; justify-content: center;
  padding: 1.5rem;
  overflow: hidden;
}
.rfs-canvas-empty {
  text-align: center;
  color: var(--rfs-ink-2);
}
.rfs-canvas-empty h2 {
  font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em;
  color: var(--rfs-ink-0);
  margin: 0 0 0.5rem;
}
.rfs-canvas-empty p {
  margin: 0; font-size: 0.875rem;
  max-width: 360px;
}
.rfs-image-frame {
  position: relative;
  display: flex;
  max-width: 100%;
  max-height: 100%;
  border-radius: var(--rfs-radius-lg);
  overflow: hidden;
  box-shadow: var(--rfs-shadow);
}
.rfs-image-frame img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}
.rfs-canvas.is-pinning .rfs-image-frame img { cursor: crosshair; }
.rfs-canvas.is-painting .rfs-image-frame img { cursor: cell; }

/* Persistent Compare button — graduated out of the hover tools row so
   the side-by-side scrub is discoverable without the user knowing to
   hover. Anchored top-right of the image, subtle when idle (low
   contrast tile) and clear on hover. Disabled state still rendered so
   the user can hover the button and read why ("Need at least 2
   versions to compare"). */
.rfs-canvas-compare-btn {
  position: absolute;
  top: 0.625rem;
  right: 0.625rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 32px;
  padding: 0 0.625rem;
  background: rgba(24,24,27,0.78);
  backdrop-filter: blur(8px);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 8px;
  color: var(--rfs-ink-2);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  z-index: 4;
  transition: color 120ms, background 120ms, border-color 120ms;
}
.rfs-canvas-compare-btn:hover:not(:disabled) {
  color: var(--rfs-ink-0);
  background: rgba(39,39,42,0.92);
  border-color: var(--rfs-accent);
}
.rfs-canvas-compare-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.rfs-canvas-compare-btn-label {
  white-space: nowrap;
}

/* Canvas tools (resolution / aspect / copy / download) — only visible
   on hover, anchored to the bottom-right of the image itself so they
   don't fight with the sentinel badge or the brush toolbar. Compare
   used to live here; it's now a persistent floating button. */
.rfs-canvas-tools {
  position: absolute;
  right: 0.625rem; bottom: 0.625rem;
  display: flex; gap: 0.25rem;
  background: rgba(24,24,27,0.78);
  backdrop-filter: blur(8px);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 10px;
  padding: 0.25rem;
  z-index: 4;
  opacity: 0;
  transition: opacity 140ms ease;
}
.rfs-image-frame:hover .rfs-canvas-tools,
.rfs-canvas-tools:hover,
.rfs-canvas-tools:focus-within {
  opacity: 1;
}
.rfs-canvas-tools .rfs-iconbtn { color: var(--rfs-ink-1); width: 30px; height: 30px; border-radius: 8px; }
.rfs-canvas-tools .rfs-iconbtn:hover { background: var(--rfs-bg-2); color: var(--rfs-ink-0); }

/* Info pills inside the canvas-tools group — resolution bucket
   (1K/2K/4K, colour-coded) and aspect ratio. Hover the resolution pill
   for exact dims via the native title tooltip. Sit alongside the
   compare/download icon buttons so the canvas stays calm when nobody's
   hovering — info reveals together with the actions. */
.rfs-canvas-tools-pill {
  display: inline-flex; align-items: center; justify-content: center;
  height: 30px;
  padding: 0 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-radius: 8px;
  color: var(--rfs-ink-1);
  user-select: none;
}
.rfs-canvas-tools-pill[title] { cursor: help; }
.rfs-canvas-tools-pill-muted { color: var(--rfs-ink-2); font-weight: 600; }
.rfs-canvas-res-1k { color: #94A3B8; }
.rfs-canvas-res-2k { color: #38BDF8; }
.rfs-canvas-res-4k { color: var(--rfs-accent); }

.rfs-stage-hint {
  position: absolute;
  left: 50%; bottom: 1.75rem;
  transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: rgba(24,24,27,0.92);
  backdrop-filter: blur(8px);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 999px;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--rfs-ink-1);
  box-shadow: var(--rfs-shadow);
  z-index: 3;
}
.rfs-stage-hint b { color: var(--rfs-accent); font-weight: 600; }
.rfs-stage-hint-dot {
  width: 8px; height: 8px;
  border-radius: 999px;
  background: var(--rfs-accent);
  animation: rfs-pulse-dot 1400ms ease-in-out infinite;
}
@keyframes rfs-pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.rfs-canvas-overlay {
  position: absolute; inset: 1.5rem;
  background: rgba(10,10,11,0.82);
  backdrop-filter: blur(12px);
  border-radius: var(--rfs-radius-lg);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.625rem;
  color: var(--rfs-ink-0);
  z-index: 4;
}
.rfs-spinner {
  width: 36px; height: 36px;
  border-radius: 999px;
  border: 3px solid var(--rfs-bg-3);
  border-top-color: var(--rfs-accent);
  animation: rfs-spin 800ms linear infinite;
}

/* Bottom-center pill that appears on the canvas while the current
   version is still working. Replaces the old big-overlay so the
   user can keep navigating while a run finishes in the background.
   Visual chrome matches the persistent Compare button up top — same
   subtle dark frame, same hover-accent, same height — so the canvas
   has a coherent "studio overlay" look. */
.rfs-canvas-pending {
  position: absolute;
  left: 50%; bottom: 1rem;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 32px;
  padding: 0 0.75rem;
  background: rgba(24,24,27,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 8px;
  /* Strong-contrast ink so the rotating microcopy is comfortably
     readable on top of any image, not the previous ink-1 mush. */
  color: var(--rfs-ink-0);
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  z-index: 4;
  /* Accent border ring on hover keeps it consistent with the
     Compare button visual language. */
  transition: border-color 120ms ease, background 120ms ease;
  /* Cap width on narrow viewports without truncating the phrase
     mid-word — wrap to two lines instead. */
  max-width: calc(100% - 2.5rem);
}
.rfs-canvas-pending:hover { border-color: var(--rfs-accent); }
.rfs-canvas-pending strong { color: var(--rfs-ink-0); font-weight: 700; }
.rfs-canvas-pending-spinner {
  width: 12px; height: 12px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,0.18);
  border-top-color: var(--rfs-accent);
  animation: rfs-spin 800ms linear infinite;
}
@keyframes rfs-spin { to { transform: rotate(360deg); } }

/* Animated trailing dots after the rotating microcopy phrase. Three
   dots that pulse one after another, like Claude Code's status line.
   Conveys "still working" without a static spinner being the only
   life sign. */
.rfs-canvas-pending-phrase { display: inline-flex; align-items: baseline; }
.rfs-canvas-pending-dots {
  display: inline-flex;
  gap: 2px;
  margin-left: 4px;
  align-items: center;
}
.rfs-canvas-pending-dots span {
  width: 3px; height: 3px;
  border-radius: 999px;
  background: var(--rfs-ink-2);
  animation: rfs-pending-dot 1.2s infinite ease-in-out;
}
.rfs-canvas-pending-dots span:nth-child(2) { animation-delay: 0.18s; }
.rfs-canvas-pending-dots span:nth-child(3) { animation-delay: 0.36s; }
@keyframes rfs-pending-dot {
  0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-1px); }
}
.rfs-canvas-overlay strong { font-size: 1rem; letter-spacing: -0.01em; }
.rfs-canvas-overlay-sub { color: var(--rfs-ink-2); font-size: 0.8125rem; }

/* Generation skeleton — shown when the active version is a pending
   text-to-image generation (no source image yet). A shimmering
   gradient block fills the image-frame area, with the user's
   prompt + a rotating phrase overlaid in the center so they can
   read what they asked for while the model is drafting. */
.rfs-canvas-generation {
  position: relative;
  width: min(640px, 80%);
  aspect-ratio: 1 / 1;
  margin: auto;
  border-radius: var(--rfs-radius-lg);
  overflow: hidden;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-2);
}
.rfs-canvas-generation-skeleton {
  position: absolute; inset: 0;
  background: linear-gradient(
    100deg,
    rgba(39,39,42,0.6) 30%,
    rgba(63,63,70,0.85) 50%,
    rgba(39,39,42,0.6) 70%
  );
  background-size: 200% 100%;
  animation: rfs-shimmer 2.4s ease-in-out infinite;
}
.rfs-canvas-generation-shimmer {
  position: absolute; inset: 0;
  background: radial-gradient(
    600px 240px at center,
    rgba(251,191,36,0.06),
    transparent 70%
  );
}
@keyframes rfs-shimmer {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
.rfs-canvas-generation-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1.25rem;
  padding: 2rem;
  text-align: center;
}
.rfs-canvas-generation-prompt {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--rfs-ink-1);
  line-height: 1.45;
  max-width: 480px;
  /* Quote-style framing so the prompt reads like the user's words,
     not a hardcoded label. */
  font-style: italic;
}
.rfs-canvas-generation-prompt::before { content: "“"; opacity: 0.5; margin-right: 2px; }
.rfs-canvas-generation-prompt::after  { content: "”"; opacity: 0.5; margin-left: 2px; }
.rfs-canvas-generation-status {
  display: inline-flex; align-items: center; gap: 0.5rem;
  height: 32px;
  padding: 0 0.75rem;
  background: rgba(24,24,27,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 8px;
  color: var(--rfs-ink-0);
  font-size: 0.8125rem;
  font-weight: 500;
}
/* Failed generation surface — replaces the shimmer with a static
   neutral panel and surfaces the prompt + error inline so the user
   can read what they asked for and what went wrong. */
.rfs-canvas-generation-failed {
  background: var(--rfs-bg-1);
}
.rfs-canvas-generation-failed .rfs-canvas-generation-skeleton { display: none; }
.rfs-canvas-generation-failed-pill {
  display: inline-block;
  max-width: 480px;
  padding: 0.5rem 0.875rem;
  background: rgba(248,113,113,0.12);
  border: 1px solid rgba(248,113,113,0.32);
  border-radius: 8px;
  color: var(--rfs-danger);
  font-size: 0.75rem;
  line-height: 1.45;
}

/* Skeleton placeholders for URL-less pending tiles — used by both
   the rail asset card (rfs-asset-skeleton) and the version stripe
   thumb (rfs-version-thumb-skeleton) while a text-to-image
   generation is still in flight. Same shimmer as the canvas
   placeholder so the visual language is consistent. */
.rfs-asset-skeleton,
.rfs-version-thumb-skeleton {
  display: block;
  width: 100%; height: 100%;
  background: linear-gradient(
    100deg,
    rgba(39,39,42,0.6) 30%,
    rgba(63,63,70,0.85) 50%,
    rgba(39,39,42,0.6) 70%
  );
  background-size: 200% 100%;
  animation: rfs-shimmer 2.4s ease-in-out infinite;
}

.rfs-canvas-error {
  position: absolute;
  left: 50%; top: 1.75rem;
  transform: translateX(-50%);
  background: #7F1D1D;
  border: 1px solid #B91C1C;
  border-radius: 10px;
  padding: 0.5rem 0.875rem;
  color: #FECACA;
  font-size: 0.8125rem;
  font-weight: 500;
  max-width: 80%;
  z-index: 4;
}

/* ============ Sentinel quality indicators ============
   Sentinel runs after every successful workflow and produces a
   green/amber/red verdict. We surface that in three places:
     - small dot bottom-right of each thumb (asset rail + version stripe
       + history list)
     - bottom-left badge on the canvas with click-to-expand judges panel
*/
.rfs-sentinel-dot {
  position: absolute;
  bottom: 5px; right: 5px;
  width: 11px; height: 11px;
  border-radius: 999px;
  border: 2px solid var(--rfs-bg-0);
  box-sizing: content-box;
  z-index: 1;
}
.rfs-sentinel-dot.is-pending {
  background: var(--rfs-accent);
  animation: rfs-pulse-dot 1400ms ease-in-out infinite;
}
/* Slightly stronger pulse for the canvas badge dot — the badge sits
   on top of the image so a subtle scale change on top of the opacity
   pulse makes the "Sentinel is doing something" beat readable from
   across the canvas without being aggressive. */
.rfs-sentinel-dot.is-pulsing {
  animation: rfs-sentinel-pulse 1600ms ease-in-out infinite;
}
@keyframes rfs-sentinel-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.55; transform: scale(0.82); }
}
.rfs-sentinel-dot.is-green  { background: var(--rfs-success); }
.rfs-sentinel-dot.is-amber  { background: #F59E0B; }
.rfs-sentinel-dot.is-red    { background: var(--rfs-danger); }
.rfs-sentinel-dot.is-failed { background: var(--rfs-bg-3); }

/* Question-mark glyph for the \`failed\` (eval errored) state — visually
   distinct from the solid red dot of \`red\` (judges actually failed) so
   a perfect image doesn't read as failed when Sentinel itself crashed. */
.rfs-sentinel-badge-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  border-radius: 999px;
  background: var(--rfs-bg-3);
  color: var(--rfs-ink-1);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}

/* Canvas Sentinel badge — bottom-left, opens the judges panel on click.
   Designed to ALWAYS be visible (unlike canvas-tools) so quality state
   is the first thing the user sees on a generated frame. */
.rfs-sentinel-badge {
  position: absolute;
  left: 0.625rem; bottom: 0.625rem;
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.4375rem 0.75rem 0.4375rem 0.625rem;
  background: rgba(24,24,27,0.92);
  backdrop-filter: blur(8px);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 999px;
  color: var(--rfs-ink-0);
  font-family: inherit; font-size: 0.75rem; font-weight: 600;
  cursor: pointer;
  z-index: 4;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.rfs-sentinel-badge:hover { border-color: var(--rfs-accent); }
.rfs-sentinel-badge .rfs-sentinel-dot {
  position: static;
  width: 8px; height: 8px;
  border: none;
  flex-shrink: 0;
}
.rfs-sentinel-badge.is-green  { color: var(--rfs-success); }
.rfs-sentinel-badge.is-amber  { color: #F59E0B; }
.rfs-sentinel-badge.is-red    { color: var(--rfs-danger); }
.rfs-sentinel-badge.is-pending { color: var(--rfs-accent); }
.rfs-sentinel-badge.is-failed { color: var(--rfs-ink-3); }
.rfs-sentinel-badge.is-skipped { color: var(--rfs-ink-3); cursor: help; }
/* Elapsed-time chip on the pending badge — neutral monospace so it
   reads as a clock without competing with the colored state label. */
.rfs-sentinel-badge-elapsed {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--rfs-ink-3);
  font-variant-numeric: tabular-nums;
}

/* Compact Sentinel chip — used in version stripe thumbs and history
   cards. Same dot palette as the badge but flatter and tooltip-only.
   .sm sits inside a card row; .xs is small enough to overlay a thumb. */
.rfs-sentinel-chip {
  display: inline-flex; align-items: center; gap: 0.3125rem;
  padding: 0.1875rem 0.4375rem;
  background: rgba(24,24,27,0.92);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 999px;
  font-family: inherit; font-weight: 600;
  cursor: help;
  white-space: nowrap;
  line-height: 1;
}
.rfs-sentinel-chip-sm { font-size: 0.6875rem; }
.rfs-sentinel-chip .rfs-sentinel-dot {
  position: static;
  width: 7px; height: 7px;
  border: none;
  flex-shrink: 0;
}
.rfs-sentinel-chip.is-green   { color: var(--rfs-success); border-color: rgba(34,197,94,0.4); }
.rfs-sentinel-chip.is-amber   { color: #F59E0B; border-color: rgba(245,158,11,0.4); }
.rfs-sentinel-chip.is-red     { color: var(--rfs-danger); border-color: rgba(248,113,113,0.4); }
.rfs-sentinel-chip.is-pending { color: var(--rfs-accent); border-color: var(--rfs-bg-3); }
.rfs-sentinel-chip.is-failed  { color: var(--rfs-ink-3); border-color: var(--rfs-bg-3); }
.rfs-sentinel-chip.is-skipped { color: var(--rfs-ink-3); border-color: var(--rfs-bg-3); }

/* xs variant — dot-only, used on version stripe thumbs where text
   would overflow the 56px tile. Hover the dot to read the full
   sentinel state (state label · judges passed · score · top issue). */
.rfs-sentinel-chip-xs {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px;
  background: rgba(24,24,27,0.92);
  border: 1.5px solid var(--rfs-bg-3);
  border-radius: 999px;
  cursor: help;
  flex-shrink: 0;
}
.rfs-sentinel-chip-xs .rfs-sentinel-dot {
  position: static;
  width: 7px; height: 7px;
  border: none;
}
.rfs-sentinel-chip-xs.is-green   { border-color: var(--rfs-success); }
.rfs-sentinel-chip-xs.is-amber   { border-color: #F59E0B; }
.rfs-sentinel-chip-xs.is-red     { border-color: var(--rfs-danger); }
.rfs-sentinel-chip-xs.is-pending {
  border-color: var(--rfs-accent);
  animation: rfs-sentinel-chip-pulse 1600ms ease-in-out infinite;
}
.rfs-sentinel-chip-xs.is-failed,
.rfs-sentinel-chip-xs.is-skipped { border-color: var(--rfs-bg-3); }
/* Same pulse for the sm chip used in compact contexts. */
.rfs-sentinel-chip.is-pending {
  animation: rfs-sentinel-chip-pulse 1600ms ease-in-out infinite;
}
@keyframes rfs-sentinel-chip-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.0); }
  50%      { box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18); }
}

/* Position the chip in the top-left of a version thumb (top-right is
   already taken by the resolution bucket). Pointer-events stay on so
   the title tooltip works without stealing the click from the thumb. */
.rfs-version-thumb-sentinel {
  position: absolute;
  top: 6px; left: 6px;
  z-index: 2;
}

/* History card head: name on the left, sentinel chip pulled to the
   right. The whole head is still a click target — chip relies on the
   native title tooltip so it doesn't need its own click handler. */
.rfs-history-card-name-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
}

.rfs-sentinel-panel {
  position: absolute;
  left: 0.625rem; bottom: 3.25rem;
  width: 280px;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.4);
  z-index: 5;
  overflow: hidden;
}
.rfs-sentinel-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid var(--rfs-bg-2);
}
.rfs-sentinel-panel-title {
  font-size: 0.8125rem; font-weight: 700;
  letter-spacing: -0.01em;
  display: flex; align-items: center; gap: 0.5rem;
}
.rfs-sentinel-panel-score {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.6875rem;
  color: var(--rfs-ink-2);
}
.rfs-sentinel-judges {
  padding: 0.5rem;
  display: flex; flex-direction: column; gap: 0.25rem;
  max-height: 320px;
  overflow-y: auto;
}
/* Each judge row is a collapsible panel: the header is always visible
   (mark + name + confidence + chevron), the body reveals reasoning +
   detected_issues on click. */
.rfs-sentinel-judge {
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--rfs-ink-1);
}
.rfs-sentinel-judge.is-pass { background: transparent; }
.rfs-sentinel-judge.is-fail { background: rgba(248,113,113,0.07); color: var(--rfs-ink-0); }
.rfs-sentinel-judge-header {
  width: 100%;
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.rfs-sentinel-judge-header:disabled { cursor: default; }
.rfs-sentinel-judge-header:hover:not(:disabled) {
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
}
.rfs-sentinel-judge-mark {
  width: 16px; height: 16px;
  border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.625rem; font-weight: 800;
  flex-shrink: 0;
}
.rfs-sentinel-judge.is-pass .rfs-sentinel-judge-mark { background: rgba(34,197,94,0.18); color: var(--rfs-success); }
.rfs-sentinel-judge.is-fail .rfs-sentinel-judge-mark { background: rgba(248,113,113,0.18); color: var(--rfs-danger); }
.rfs-sentinel-judge-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rfs-sentinel-judge-conf {
  flex-shrink: 0;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.625rem;
  color: var(--rfs-ink-3);
  background: var(--rfs-bg-2);
  padding: 1px 5px;
  border-radius: 4px;
}
.rfs-sentinel-judge-chev {
  flex-shrink: 0;
  color: var(--rfs-ink-3);
  font-size: 0.6875rem;
  transition: transform 120ms;
}
.rfs-sentinel-judge-chev.is-open { transform: rotate(180deg); }
.rfs-sentinel-judge-body {
  padding: 0 0.625rem 0.625rem 2.125rem;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.rfs-sentinel-judge-section { display: flex; flex-direction: column; gap: 0.25rem; }
.rfs-sentinel-judge-section-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rfs-ink-3);
}
.rfs-sentinel-judge-issues {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex; flex-direction: column; gap: 4px;
}
.rfs-sentinel-judge-issues li {
  font-size: 0.75rem;
  color: var(--rfs-ink-1);
  line-height: 1.4;
}
.rfs-sentinel-judge-tag {
  display: inline-block;
  background: var(--rfs-bg-2);
  color: var(--rfs-ink-1);
  font-size: 0.625rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  margin-right: 4px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.rfs-sentinel-judge-detail {
  color: var(--rfs-ink-2);
}
.rfs-sentinel-judge-reasoning {
  margin: 0;
  font-size: 0.75rem;
  color: var(--rfs-ink-2);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Hard-gate banner */
.rfs-sentinel-hardgate {
  margin: 0 0.5rem;
  padding: 0.5rem 0.625rem;
  background: rgba(248,113,113,0.12);
  border: 1px solid rgba(248,113,113,0.35);
  border-radius: 8px;
  font-size: 0.75rem;
  color: var(--rfs-danger);
}
.rfs-sentinel-hardgate strong { color: #FCA5A5; }

/* Curated top_issues / top_strengths summaries — collapsible. */
.rfs-sentinel-summary {
  border-top: 1px solid var(--rfs-bg-2);
  padding: 0.375rem 0.5rem;
}
.rfs-sentinel-summary-header {
  width: 100%;
  display: flex; align-items: center; gap: 0.5rem;
  background: transparent; border: none;
  padding: 0.375rem 0.5rem;
  font-family: inherit;
  font-size: 0.75rem;
  color: var(--rfs-ink-1);
  cursor: pointer;
  border-radius: 6px;
}
.rfs-sentinel-summary-header:hover { background: rgba(255,255,255,0.03); }
.rfs-sentinel-summary-icon {
  width: 16px; height: 16px;
  border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.6875rem; font-weight: 800;
  flex-shrink: 0;
}
.rfs-sentinel-summary-issue .rfs-sentinel-summary-icon { background: rgba(248,113,113,0.18); color: var(--rfs-danger); }
.rfs-sentinel-summary-strength .rfs-sentinel-summary-icon { background: rgba(34,197,94,0.18); color: var(--rfs-success); }
.rfs-sentinel-summary-title { flex: 1; }
.rfs-sentinel-summary-list {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0.5rem 0.5rem;
  display: flex; flex-direction: column; gap: 0.5rem;
  max-height: 220px;
  overflow-y: auto;
}
.rfs-sentinel-summary-list li {
  font-size: 0.75rem;
  color: var(--rfs-ink-2);
  line-height: 1.5;
  white-space: pre-wrap;
}
.rfs-sentinel-panel-empty {
  padding: 0.875rem 1rem 1rem;
  font-size: 0.75rem;
  color: var(--rfs-ink-2);
  line-height: 1.45;
}
/* Live elapsed-time line inside the pending panel body. Tabular nums
   so the second digit doesn't jitter as the clock counts. */
.rfs-sentinel-panel-elapsed {
  margin-top: 0.5rem;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.6875rem;
  color: var(--rfs-ink-3);
  font-variant-numeric: tabular-nums;
}
/* Retry-block beneath the failure copy. Pulled flush-right so the
   primary action sits where the user expects a CTA. */
.rfs-sentinel-panel-actions {
  margin-top: 0.625rem;
  display: flex;
  justify-content: flex-end;
}
.rfs-sentinel-retry-btn {
  font-size: 0.75rem;
  padding: 0.375rem 0.625rem;
}
.rfs-sentinel-panel-empty code {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.6875rem;
  color: var(--rfs-ink-1);
  background: var(--rfs-bg-2);
  padding: 1px 5px;
  border-radius: 4px;
}

/* Pin marker */
.rfs-pin {
  position: absolute;
  width: 0; height: 0;
  pointer-events: none;
  z-index: 5;
}
.rfs-pin-dot {
  position: absolute;
  left: -7px; top: -7px;
  width: 14px; height: 14px;
  border-radius: 999px;
  background: var(--rfs-accent);
  border: 2px solid #0A0A0B;
  box-shadow: 0 2px 12px rgba(251,191,36,0.55);
}
.rfs-pin-pulse {
  position: absolute;
  left: -16px; top: -16px;
  width: 32px; height: 32px;
  border-radius: 999px;
  border: 2px solid var(--rfs-accent);
  opacity: 0.6;
  animation: rfs-pulse 1500ms ease-out infinite;
}
@keyframes rfs-pulse {
  0%   { transform: scale(0.6); opacity: 0.6; }
  100% { transform: scale(1.3); opacity: 0; }
}

/* Brush mask canvas */
.rfs-mask-canvas {
  position: absolute; inset: 0;
  pointer-events: auto;
  cursor: cell;
  touch-action: none;
}
.rfs-brush-toolbar {
  position: absolute;
  left: 1.75rem; top: 1.75rem;
  display: inline-flex; align-items: center; gap: 0.625rem;
  background: rgba(24,24,27,0.92);
  backdrop-filter: blur(8px);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  z-index: 3;
}
.rfs-brush-label {
  font-size: 0.6875rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--rfs-ink-3);
}
.rfs-brush-range { width: 100px; accent-color: var(--rfs-accent); }
.rfs-brush-size {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.75rem;
  color: var(--rfs-ink-2);
  min-width: 36px; text-align: right;
}
.rfs-brush-clear {
  background: none; border: none;
  color: var(--rfs-accent);
  font-family: inherit; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; padding: 0.125rem 0.375rem; border-radius: 6px;
}
.rfs-brush-clear:hover:not(:disabled) { background: var(--rfs-accent-soft); }
.rfs-brush-clear:disabled { opacity: 0.4; cursor: not-allowed; }
.rfs-brush-divider {
  width: 1px;
  height: 18px;
  background: var(--rfs-bg-3);
  margin: 0 0.125rem;
}
.rfs-brush-confirm {
  background: var(--rfs-accent);
  border: none;
  color: #09090B;
  font-family: inherit; font-size: 0.75rem; font-weight: 700;
  padding: 0.3125rem 0.625rem;
  border-radius: 6px;
  cursor: pointer;
}
.rfs-brush-confirm:hover:not(:disabled) { background: var(--rfs-accent-dim); }
.rfs-brush-confirm:disabled { opacity: 0.4; cursor: not-allowed; }

/* Version stripe under canvas */
.rfs-version-stripe {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-top: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-0);
  overflow-x: auto;
}
.rfs-version-stripe-label {
  font-size: 0.6875rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--rfs-ink-3);
  flex-shrink: 0;
}
.rfs-version-thumb {
  flex-shrink: 0;
  width: 56px; height: 56px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--rfs-bg-1);
  /* Default border is thin grey. Sentinel-state modifiers override the
     border color (green/amber/red/pending) so the thumb itself signals
     quality without needing an extra dot overlay. */
  border: 2px solid var(--rfs-bg-3);
  cursor: pointer;
  position: relative;
  padding: 0;
  transition: border-color 160ms;
}
.rfs-version-thumb img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
/* In-flight workflow — image at low opacity, ring pulses, spinner
   centred on the thumb. Visually distinct from a sentinel-pending
   thumb (which uses the same pulsing border but has the real image). */
.rfs-version-thumb.is-pending img { opacity: 0.4; }
.rfs-version-thumb.is-pending {
  border-color: var(--rfs-accent);
  animation: rfs-border-pulse 1500ms ease-in-out infinite;
}
.rfs-version-thumb.is-error {
  border-color: var(--rfs-danger);
}
.rfs-version-thumb-spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.rfs-version-thumb-spinner-ring {
  width: 18px; height: 18px;
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: var(--rfs-accent);
  border-radius: 999px;
  animation: rfs-spin 800ms linear infinite;
}

.rfs-version-thumb.sentinel-pending {
  border-color: var(--rfs-accent);
  animation: rfs-border-pulse 1500ms ease-in-out infinite;
}
.rfs-version-thumb.sentinel-green  { border-color: var(--rfs-success); }
.rfs-version-thumb.sentinel-amber  { border-color: #F59E0B; }
.rfs-version-thumb.sentinel-red    { border-color: var(--rfs-danger); }
.rfs-version-thumb.sentinel-failed { border-color: var(--rfs-bg-3); }
/* Selection ring sits OUTSIDE the border so a sentinel-colored frame
   can coexist with the selected affordance. */
.rfs-version-thumb.is-current {
  box-shadow: 0 0 0 2px var(--rfs-accent);
}
@keyframes rfs-border-pulse {
  0%, 100% { border-color: var(--rfs-accent); }
  50%      { border-color: rgba(251,191,36,0.4); }
}
.rfs-version-thumb-label {
  position: absolute;
  inset: auto 0 0 0;
  background: linear-gradient(180deg, transparent 0%, rgba(9,9,11,0.85) 100%);
  color: var(--rfs-ink-0);
  font-size: 0.625rem;
  font-weight: 600;
  padding: 8px 4px 3px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Resolution bucket chip — tiny corner pill on the thumb so users can
   see at a glance whether a workflow downsampled (e.g. 4K → 2K) or
   left things alone. Mirrors the canvas-res palette so a 4K thumb
   matches a 4K canvas badge. */
.rfs-version-thumb-res {
  position: absolute;
  top: 3px; right: 3px;
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 14px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: rgba(24,24,27,0.9);
  color: var(--rfs-ink-0);
  pointer-events: none;
}
.rfs-version-thumb-res-1k { color: #94A3B8; }
.rfs-version-thumb-res-2k { color: #38BDF8; }
.rfs-version-thumb-res-4k { color: var(--rfs-accent); }

/* ============ Right rail (workflows / chat / history) ============ */
.rfs-right {
  grid-area: right;
  border-left: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-0);
  display: flex; flex-direction: column;
  min-height: 0;
}
.rfs-tabs {
  flex-shrink: 0;
  display: flex;
  border-bottom: 1px solid var(--rfs-bg-2);
}
.rfs-tab {
  flex: 1;
  display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
  background: transparent; border: none;
  padding: 0.875rem 0.5rem;
  font-family: inherit; font-size: 0.8125rem; font-weight: 600;
  color: var(--rfs-ink-3);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 120ms, border-color 120ms;
}
.rfs-tab:hover:not(:disabled) { color: var(--rfs-ink-0); }
.rfs-tab.is-active { color: var(--rfs-ink-0); border-bottom-color: var(--rfs-accent); }
.rfs-tab:disabled { color: var(--rfs-ink-3); cursor: not-allowed; }
.rfs-tab-soon {
  display: inline-block;
  background: var(--rfs-bg-2);
  color: var(--rfs-ink-2);
  font-size: 0.5625rem; font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.04em;
  margin-left: 4px;
}
.rfs-tab-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 16px;
  padding: 0 5px;
  background: var(--rfs-bg-2);
  border-radius: 999px;
  font-size: 0.625rem;
  color: var(--rfs-ink-2);
}
.rfs-tab.is-active .rfs-tab-count { background: var(--rfs-accent-soft); color: var(--rfs-accent); }

.rfs-search {
  flex-shrink: 0;
  padding: 0.75rem 0.875rem 0.5rem;
}
.rfs-search input {
  /* Border-box so the 1px border + horizontal padding stay inside the
     rail's content box. Without this, width:100% + padding pushed the
     right edge past the aside's border-left and the input bled out. */
  box-sizing: border-box;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 8px;
  color: var(--rfs-ink-0);
  font-family: inherit; font-size: 0.8125rem;
}
.rfs-search input:focus {
  outline: none;
  border-color: var(--rfs-accent);
  background: var(--rfs-bg-0);
}
.rfs-search input::placeholder { color: var(--rfs-ink-3); }

/* Breadcrumb shown in the focused configure view — replaces the
   search bar + card grid so the user can attend to one workflow at
   a time. Back button has a generous tap target; the trail is
   click-through so either the chevron or the group label returns
   to browse. */
.rfs-breadcrumb {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-0);
}
.rfs-breadcrumb-back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: transparent;
  border: 1px solid var(--rfs-bg-2);
  border-radius: 8px;
  color: var(--rfs-ink-2);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 120ms, border-color 120ms, background 120ms;
}
.rfs-breadcrumb-back:hover {
  color: var(--rfs-ink-0);
  border-color: var(--rfs-ink-3);
  background: var(--rfs-bg-1);
}
.rfs-breadcrumb-trail {
  display: inline-flex; align-items: baseline; gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--rfs-ink-2);
  min-width: 0;
}
.rfs-breadcrumb-link {
  background: none; border: none; padding: 0;
  font: inherit;
  color: var(--rfs-ink-2);
  cursor: pointer;
}
.rfs-breadcrumb-link:hover { color: var(--rfs-ink-0); }
.rfs-breadcrumb-sep { color: var(--rfs-ink-3); }
.rfs-breadcrumb-current {
  color: var(--rfs-ink-0);
  font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  min-width: 0;
}

.rfs-cards {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0.875rem 0.5rem;
  display: flex; flex-direction: column; gap: 1rem;
}
.rfs-cards-group-label {
  font-size: 0.625rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--rfs-ink-3);
  padding: 0 0.125rem;
  margin-top: 0.25rem;
  display: flex; align-items: center; justify-content: space-between;
}
.rfs-cards-group {
  display: flex; flex-direction: column; gap: 0.375rem;
}

/* Quiet footer rows below the live workflow groups — house the
   "Coming soon" disclosure and the "+ Create a recipe" link when
   the user has no saved recipes yet. They sit inside the same
   scrollable rfs-cards container so they only show when scrolled
   into view, keeping the first impression tight. */
.rfs-cards-footer {
  display: flex; flex-direction: column; gap: 0.5rem;
  margin-top: 0.25rem;
}
.rfs-cards-disclosure {
  display: inline-flex; align-items: center; gap: 0.375rem;
  align-self: flex-start;
  padding: 0.375rem 0.5rem;
  background: transparent;
  border: none;
  color: var(--rfs-ink-3);
  font-family: inherit;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  border-radius: 6px;
  transition: color 120ms, background 120ms;
}
.rfs-cards-disclosure:hover {
  color: var(--rfs-ink-0);
  background: var(--rfs-bg-1);
}
.rfs-cards-group-soon {
  opacity: 0.85;
}
.rfs-cards-link {
  align-self: flex-start;
  padding: 0.375rem 0.5rem;
  background: transparent;
  border: none;
  color: var(--rfs-ink-2);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
  transition: color 120ms, background 120ms;
}
.rfs-cards-link:hover {
  color: var(--rfs-accent);
  background: var(--rfs-accent-soft);
}

.rfs-card {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.625rem;
  background: var(--rfs-bg-1);
  border: 1px solid transparent;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  position: relative;
  transition: background 120ms, border-color 120ms;
}
.rfs-card:hover:not(:disabled) { background: var(--rfs-bg-2); }
/* Selected state is purely a transitional cue now — the cards grid
   collapses into the focused configure view as soon as a card is
   picked, so the chrome only flashes for one frame. Border-only,
   no background tint or shadow, matches the calmer browse view. */
.rfs-card.is-selected {
  border-color: var(--rfs-accent);
}
/* Recommended = "this card is the demo path for the active image".
   Same yellow icon-tile as the old static \`.is-feature\` rule, but
   driven by the asset's recommendedWorkflows instead of a permanent
   flag on the workflow definition. Defaults to grey when the active
   asset has no recommendation for this card. */
.rfs-card.is-recommended .rfs-card-icon {
  background: var(--rfs-accent);
  color: #09090B;
}
.rfs-card:disabled { cursor: not-allowed; opacity: 0.5; }
/* Wrapper around a disabled card — carries the tooltip that a
   disabled <button> can't surface natively. \`display: contents\` so
   the wrapper doesn't add a layout box; the card sits in the
   cards-group flex column exactly as before. */
.rfs-card-wrap {
  display: contents;
}
/* Disabled-by-applicability — visually distinct from a \`soon\` card.
   "soon" means "feature isn't built yet, come back later"; not-applicable
   means "feature is live, just wrong photo for it". Slightly higher
   opacity than the bare \`:disabled\` so the user can read the reason,
   plus a dashed border to signal "swap-able" rather than "permanent". */
.rfs-card.is-not-applicable:disabled {
  opacity: 0.7;
  border-color: var(--rfs-bg-3);
  border-style: dashed;
  background: transparent;
}
.rfs-card-swap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--rfs-bg-2);
  color: var(--rfs-ink-2);
  font-size: 0.625rem;
  font-weight: 700;
  cursor: help;
  flex-shrink: 0;
}
.rfs-card-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: var(--rfs-bg-2);
  display: flex; align-items: center; justify-content: center;
  color: var(--rfs-ink-1);
  flex-shrink: 0;
}
.rfs-card-text { flex: 1; min-width: 0; }
.rfs-card-name {
  font-weight: 600; font-size: 0.8125rem;
  color: var(--rfs-ink-0);
  display: flex; align-items: center; gap: 0.375rem;
}
.rfs-card-desc {
  font-size: 0.6875rem;
  color: var(--rfs-ink-2);
  margin-top: 1px;
  line-height: 1.35;
}
.rfs-card-soon {
  display: inline-block;
  background: var(--rfs-bg-2);
  color: var(--rfs-ink-2);
  font-size: 0.5625rem; font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.04em;
}

/* Custom workflow cards (saved recipes). Layout differs from the
   normal cards: a flex row with a clickable body button on the left
   and a small delete affordance on the right. */
.rfs-card-custom {
  padding: 0;
  display: flex; align-items: stretch; gap: 0;
}
.rfs-card-custom-body {
  flex: 1;
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.625rem;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  min-width: 0;
}
.rfs-card-icon-custom {
  background: var(--rfs-bg-2);
  color: var(--rfs-ink-1);
}
.rfs-card-custom .rfs-card-desc {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rfs-card-custom-edit,
.rfs-card-custom-delete {
  flex-shrink: 0;
  width: 28px;
  background: transparent;
  border: none;
  border-left: 1px solid var(--rfs-bg-2);
  color: var(--rfs-ink-3);
  cursor: pointer;
  opacity: 0;
  transition: opacity 140ms, color 140ms, background 140ms;
  display: inline-flex; align-items: center; justify-content: center;
}
.rfs-card-custom-edit { font-size: 0.875rem; }
.rfs-card-custom-delete { font-size: 1.25rem; font-weight: 400; }
.rfs-card-custom:hover .rfs-card-custom-edit,
.rfs-card-custom:hover .rfs-card-custom-delete { opacity: 1; }
.rfs-card-custom-edit:hover { color: var(--rfs-ink-0); background: var(--rfs-bg-2); }
.rfs-card-custom-delete:hover { color: var(--rfs-danger); }

/* "+ New recipe" tile — first item in the Custom group, always
   visible so the user can build a recipe from scratch without first
   running a chain through History. Visually a normal card with a
   dashed-accent border so it reads as a creative affordance, not a
   saved item. */
.rfs-card-custom-new {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.625rem;
  background: transparent;
  border: 1px dashed var(--rfs-bg-3);
  border-radius: 10px;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms, background 140ms;
}
.rfs-card-custom-new:hover {
  border-color: var(--rfs-accent);
  background: rgba(24,24,27,0.4);
}
.rfs-card-custom-new .rfs-card-icon-custom {
  background: var(--rfs-accent-soft);
  color: var(--rfs-accent);
}

/* Custom replay panel — list of saved steps + optional override
   block. Reuses .rfs-action-pin chrome so it visually matches the
   normal action region. */
.rfs-custom-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex; flex-direction: column; gap: 0.4375rem;
}
.rfs-custom-step {
  display: flex; align-items: flex-start; gap: 0.5rem;
  padding: 0.4375rem 0.5rem;
  background: rgba(24,24,27,0.4);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 8px;
}
.rfs-custom-step-num {
  flex-shrink: 0;
  width: 18px; height: 18px;
  border-radius: 999px;
  background: var(--rfs-bg-2);
  color: var(--rfs-ink-1);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.625rem;
  font-weight: 700;
}
.rfs-custom-step-text { flex: 1; min-width: 0; }
.rfs-custom-step-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--rfs-ink-0);
}
.rfs-custom-step-params {
  margin-top: 2px;
  font-size: 0.6875rem;
  color: var(--rfs-ink-3);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  letter-spacing: 0.02em;
  word-break: break-word;
}
.rfs-custom-override {
  margin-top: 0.625rem;
  padding-top: 0.625rem;
  border-top: 1px dashed var(--rfs-bg-3);
}
.rfs-custom-override-toggle {
  background: transparent;
  border: none;
  color: var(--rfs-accent);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.rfs-custom-override-toggle:hover { text-decoration: underline; }
.rfs-custom-override-body {
  display: flex; flex-direction: column; gap: 0.5rem;
  margin-top: 0.5rem;
}
/* Pre-flight validation for recipes — surfaces "step N: input is
   required" before Apply / Save. Subtle red so it reads as a
   correctable warning, not a hard error pop. */
.rfs-custom-replay-validation {
  margin-top: 0.625rem;
  padding: 0.4375rem 0.625rem;
  background: rgba(248,113,113,0.10);
  border: 1px solid rgba(248,113,113,0.32);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--rfs-danger);
  line-height: 1.4;
}

/* Inline header toggle — replaces the cog popover that used to wrap
   the single gateBetweenSteps switch. Native checkbox is hidden in
   favor of a CSS-styled track + knob; the wrapping <label> carries
   the title attribute so the explanation surfaces on hover over any
   part of the control. */
.rfs-header-toggle {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 0.75rem;
  color: var(--rfs-ink-2);
  transition: color 120ms ease, background 120ms ease;
}
.rfs-header-toggle:hover { color: var(--rfs-ink-0); background: var(--rfs-bg-1); }
.rfs-header-toggle input[type="checkbox"] {
  /* Hide the native control; the styled track below is the visual. */
  position: absolute;
  width: 1px; height: 1px;
  opacity: 0;
  pointer-events: none;
}
.rfs-header-toggle-track {
  position: relative;
  width: 28px; height: 16px;
  border-radius: 999px;
  background: var(--rfs-bg-3);
  transition: background 140ms ease;
  flex-shrink: 0;
}
.rfs-header-toggle-knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 12px; height: 12px;
  border-radius: 999px;
  background: var(--rfs-ink-1);
  transition: transform 140ms ease, background 140ms ease;
}
.rfs-header-toggle input:checked ~ .rfs-header-toggle-track {
  background: var(--rfs-accent);
}
.rfs-header-toggle input:checked ~ .rfs-header-toggle-track .rfs-header-toggle-knob {
  transform: translateX(12px);
  background: #09090B;
}
.rfs-header-toggle input:focus-visible ~ .rfs-header-toggle-track {
  outline: 2px solid var(--rfs-accent);
  outline-offset: 2px;
}
.rfs-header-toggle-label {
  font-weight: 600;
}

/* History tab — request block beneath each card. The card wraps the
   thumb + workflow name + a dl of "what was asked for" rows so a user
   coming back later can answer "did I really ask for that?" without
   leaving the History tab. */
.rfs-history-card {
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
}
.rfs-history-card-head {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: inherit;
  width: 100%;
}
/* Save chain row at the bottom of each non-v0 history card. Trigger
   reads as a small low-emphasis link by default; opens an inline
   form when clicked. The Save flash sits in for ~2s after a
   successful save. */
.rfs-history-save-row {
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 0.4375rem;
  padding-top: 0.25rem;
}
.rfs-history-save-trigger {
  background: transparent;
  border: 1px dashed var(--rfs-bg-3);
  color: var(--rfs-ink-2);
  font-family: inherit;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.3125rem 0.5625rem;
  border-radius: 999px;
  cursor: pointer;
  transition: color 140ms, border-color 140ms, background 140ms;
}
.rfs-history-save-trigger:hover:not(:disabled) {
  color: var(--rfs-ink-0);
  border-color: var(--rfs-accent);
  background: var(--rfs-accent-soft);
}
.rfs-history-save-trigger:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.rfs-history-save-form {
  display: flex; align-items: center; gap: 0.375rem;
  width: 100%;
}
.rfs-history-save-input {
  flex: 1;
  min-width: 0;
  padding: 0.4375rem 0.5625rem;
  background: var(--rfs-bg-0);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 6px;
  color: var(--rfs-ink-0);
  font-family: inherit;
  font-size: 0.75rem;
}
.rfs-history-save-input:focus { outline: none; border-color: var(--rfs-accent); }
.rfs-history-save-flash {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--rfs-success);
  padding: 0.25rem 0.5rem;
}
.rfs-history-request {
  display: flex; flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0.5rem 0.625rem;
  background: rgba(24,24,27,0.4);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 8px;
}
.rfs-history-row {
  display: flex; align-items: baseline; gap: 0.5rem;
  font-size: 0.6875rem;
  line-height: 1.4;
}
.rfs-history-row-label {
  flex-shrink: 0;
  width: 78px;
  color: var(--rfs-ink-3);
  font-weight: 600;
  letter-spacing: 0.01em;
}
.rfs-history-row-value {
  flex: 1;
  margin: 0;
  color: var(--rfs-ink-1);
  word-break: break-word;
  min-width: 0;
}
.rfs-history-row-mono .rfs-history-row-value {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  letter-spacing: 0.02em;
}
.rfs-history-row-quote .rfs-history-row-value {
  font-style: italic;
  color: var(--rfs-ink-0);
}
.rfs-history-row-quote .rfs-history-row-value::before { content: "“"; color: var(--rfs-ink-3); }
.rfs-history-row-quote .rfs-history-row-value::after { content: "”"; color: var(--rfs-ink-3); }
.rfs-history-swatch-row { display: inline-flex; align-items: center; gap: 0.4375rem; }
.rfs-history-swatch {
  width: 14px; height: 14px;
  border-radius: 4px;
  border: 1px solid var(--rfs-bg-3);
  flex-shrink: 0;
}
.rfs-history-card.is-selected .rfs-history-request {
  background: rgba(251,191,36,0.06);
  border-color: rgba(251,191,36,0.25);
}

/* Pinned action region (visible when a card is selected) */
.rfs-action-pin {
  flex-shrink: 0;
  max-height: min(50vh, 460px);
  display: flex; flex-direction: column;
  border-top: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-1);
}
/* Focused mode: action panel is the only thing in the right rail
   below the breadcrumb, so it gets to fill the whole height
   instead of capping at 50vh + sitting below a card grid.
   \`min-height: 0\` is critical — without it, default min-height:auto
   forces the panel to be at least its content height, the body
   inside never scrolls, and the Apply footer gets pushed below the
   viewport on long forms. */
.rfs-action-pin.is-focused {
  flex: 1;
  min-height: 0;
  max-height: none;
  border-top: none;
}
.rfs-action-pin-header {
  flex-shrink: 0;
  display: flex; flex-direction: column; gap: 0.625rem;
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid var(--rfs-bg-2);
}
.rfs-action-pin-header-row {
  display: flex; align-items: center; gap: 0.625rem;
}
/* Examples affordance — collapsed = a subtle pill in the header row;
   expanded = a horizontal strip of curated demo thumbnails the user
   can click to swap their active asset. Only renders when there's
   at least one curated sample for the selected workflow, and it
   never auto-opens. Speed users see a quiet sparkle and ignore it. */
.rfs-action-examples-toggle {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--rfs-bg-3);
  border-radius: 999px;
  color: var(--rfs-ink-2);
  font-family: inherit;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
}
.rfs-action-examples-toggle:hover {
  color: var(--rfs-accent);
  border-color: var(--rfs-accent);
  background: var(--rfs-accent-soft);
}
.rfs-action-examples-toggle.is-open {
  color: var(--rfs-accent);
  border-color: var(--rfs-accent);
  background: var(--rfs-accent-soft);
}
.rfs-action-examples-toggle-label { letter-spacing: 0.02em; }
.rfs-action-examples {
  display: flex; flex-direction: column; gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--rfs-bg-2);
}
.rfs-action-examples-hint {
  font-size: 0.6875rem;
  color: var(--rfs-ink-3);
  line-height: 1.4;
}
.rfs-action-examples-strip {
  display: flex; gap: 0.5rem;
  overflow-x: auto;
  margin: 0 -0.25rem; padding: 0 0.25rem 0.25rem;
}
.rfs-action-example {
  flex: 0 0 auto;
  width: 88px;
  display: flex; flex-direction: column; gap: 0.25rem;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: inherit;
}
.rfs-action-example img {
  width: 88px; height: 88px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--rfs-bg-2);
  transition: border-color 140ms ease, transform 140ms ease;
}
.rfs-action-example:hover img {
  border-color: var(--rfs-accent);
  transform: translateY(-1px);
}
.rfs-action-example-label {
  font-size: 0.625rem;
  color: var(--rfs-ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rfs-action-pin-icon {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: var(--rfs-accent);
  color: #09090B;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.rfs-action-pin-title { flex: 1; min-width: 0; }
.rfs-action-pin-name {
  font-size: 0.875rem; font-weight: 700;
  letter-spacing: -0.01em;
}
.rfs-action-pin-desc {
  font-size: 0.6875rem; color: var(--rfs-ink-2);
  margin-top: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rfs-action-pin-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.875rem;
  display: flex; flex-direction: column; gap: 0.875rem;
}
.rfs-action-footer {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  border-top: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-0);
}

/* ============ Form inputs ============ */
.rfs-input-group { display: flex; flex-direction: column; gap: 0.375rem; }
.rfs-label {
  font-size: 0.75rem; font-weight: 600;
  color: var(--rfs-ink-1);
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 0.5rem;
}
.rfs-label-meta {
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--rfs-ink-3);
  letter-spacing: 0.02em;
}
.rfs-help { font-size: 0.6875rem; color: var(--rfs-ink-3); line-height: 1.4; }
.rfs-help-warn {
  color: #F59E0B;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.22);
  border-radius: 6px;
  padding: 0.4375rem 0.5625rem;
}
.rfs-text, .rfs-textarea, .rfs-select {
  /* Border-box so width:100% includes padding + border. The action
     panel padding hid the overflow before, but the recipe editor's
     name input made it visible — same pattern, same fix. */
  box-sizing: border-box;
  width: 100%;
  padding: 0.5rem 0.625rem;
  background: var(--rfs-bg-0);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 8px;
  color: var(--rfs-ink-0);
  font-family: inherit; font-size: 0.8125rem;
}
.rfs-text::placeholder, .rfs-textarea::placeholder { color: var(--rfs-ink-3); }
.rfs-text:focus, .rfs-textarea:focus, .rfs-select:focus {
  outline: none;
  border-color: var(--rfs-accent);
}
.rfs-textarea {
  /* Fixed height so the action drawer never balloons past the viewport.
     Long input scrolls inside the textarea, not by growing the drawer. */
  resize: none;
  height: 84px;
  line-height: 1.4;
}
.rfs-color-row { display: flex; align-items: center; gap: 0.5rem; }
.rfs-color-row input[type="color"] {
  width: 40px; height: 32px; padding: 0;
  background: transparent;
  border: 1px solid var(--rfs-bg-3); border-radius: 6px;
  cursor: pointer;
}
.rfs-color-hex {
  flex: 1;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.75rem;
  color: var(--rfs-ink-2);
}

/* Step indicator */
.rfs-step {
  display: flex; align-items: flex-start; gap: 0.625rem;
  padding: 0.625rem;
  background: var(--rfs-bg-0);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 10px;
}
.rfs-step-num {
  width: 22px; height: 22px;
  border-radius: 999px;
  background: var(--rfs-bg-2);
  color: var(--rfs-ink-2);
  font-size: 0.6875rem; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.rfs-step-num.is-active { background: var(--rfs-accent); color: #09090B; }
.rfs-step-num.is-done { background: var(--rfs-success); color: #052e16; }
.rfs-step-num.is-done { font-size: 0; }
.rfs-step-num.is-done::before {
  content: "";
  width: 9px; height: 5px;
  border-left: 2px solid #052e16;
  border-bottom: 2px solid #052e16;
  transform: rotate(-45deg) translate(1px, -2px);
}
.rfs-step-text {
  display: flex; flex-direction: column; gap: 0.25rem;
  min-width: 0;
}
.rfs-step-title { font-size: 0.8125rem; font-weight: 600; color: var(--rfs-ink-0); }
.rfs-step-sub { font-size: 0.6875rem; color: var(--rfs-ink-2); }
.rfs-link {
  background: none; border: none;
  color: var(--rfs-accent);
  font-family: inherit; font-size: inherit; font-weight: 600;
  cursor: pointer; padding: 0;
  text-decoration: none;
}
.rfs-link:hover:not(:disabled) { text-decoration: underline; }
.rfs-link:disabled { color: var(--rfs-ink-3); cursor: not-allowed; }

/* Reference uploader */
.rfs-drop {
  display: block;
  padding: 1rem;
  border: 1.5px dashed var(--rfs-bg-3);
  border-radius: 10px;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--rfs-ink-2);
  cursor: pointer;
  transition: border-color 120ms, color 120ms, background 120ms;
}
.rfs-drop:hover {
  border-color: var(--rfs-accent);
  color: var(--rfs-accent);
  background: var(--rfs-accent-soft);
}
.rfs-drop input[type="file"] { display: none; }
.rfs-ref-preview {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.5rem;
  border: 1px solid var(--rfs-bg-3);
  border-radius: 10px;
  background: var(--rfs-bg-0);
}
.rfs-ref-preview img {
  width: 56px; height: 56px;
  object-fit: cover; border-radius: 8px;
  background: var(--rfs-bg-2);
}

/* Multi-slot reference gallery — used by mask-ref workflows that
   accept up to N reference images per run. Tiles wrap onto two rows
   on a narrow panel; the add button takes the slot after the last
   filled tile and goes away once the cap is hit. */
.rfs-ref-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.rfs-ref-tile {
  position: relative;
  width: 84px;
  height: 84px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--rfs-bg-2);
  border: 1px solid var(--rfs-bg-3);
}
.rfs-ref-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.rfs-ref-tile-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgba(9, 9, 11, 0.82);
  border: 1px solid var(--rfs-bg-3);
  color: var(--rfs-ink-0);
  font-size: 0.875rem;
  line-height: 1;
  font-family: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rfs-ref-tile-remove:hover {
  background: var(--rfs-danger);
  border-color: var(--rfs-danger);
}
.rfs-ref-add {
  width: 84px;
  height: 84px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.375rem;
  background: var(--rfs-bg-0);
  border: 1px dashed var(--rfs-bg-3);
  border-radius: 10px;
  color: var(--rfs-ink-2);
  font-family: inherit;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  transition: border-color 120ms, color 120ms, background 120ms;
}
.rfs-ref-add:hover {
  border-color: var(--rfs-accent);
  color: var(--rfs-accent);
  background: var(--rfs-accent-soft);
}
.rfs-ref-add input[type="file"] { display: none; }
.rfs-ref-add-icon {
  font-size: 1.25rem;
  font-weight: 400;
  line-height: 1;
  color: var(--rfs-ink-1);
}
.rfs-ref-add:hover .rfs-ref-add-icon { color: var(--rfs-accent); }
.rfs-ref-cap-note {
  align-self: center;
  font-size: 0.6875rem;
  color: var(--rfs-ink-3);
  padding: 0 0.25rem;
}

/* Chat / history empty states */
.rfs-empty {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 2rem 1.5rem;
  text-align: center;
  color: var(--rfs-ink-2);
}
.rfs-empty-icon {
  width: 48px; height: 48px;
  border-radius: 999px;
  background: var(--rfs-bg-1);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 0.75rem;
  color: var(--rfs-ink-3);
}
.rfs-empty h3 {
  font-size: 0.9375rem; font-weight: 700;
  color: var(--rfs-ink-0);
  margin: 0 0 0.375rem;
}
.rfs-empty p {
  margin: 0;
  font-size: 0.8125rem;
  max-width: 240px;
  line-height: 1.4;
}

/* ============ Chat panel ============ */
.rfs-chat {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.rfs-chat-transcript {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
.rfs-chat-msg {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.rfs-chat-msg-user { align-items: flex-end; }
.rfs-chat-msg-assistant { align-items: flex-start; }
.rfs-chat-msg-system { align-items: stretch; }
.rfs-chat-bubble {
  max-width: 85%;
  padding: 0.5rem 0.75rem;
  border-radius: 14px;
  font-size: 0.8125rem;
  line-height: 1.45;
  word-break: break-word;
  white-space: pre-wrap;
}
.rfs-chat-msg-user .rfs-chat-bubble {
  background: var(--rfs-accent);
  color: #09090B;
  border-bottom-right-radius: 4px;
  font-weight: 500;
}
.rfs-chat-msg-assistant .rfs-chat-bubble {
  background: var(--rfs-bg-1);
  color: var(--rfs-ink-0);
  border-bottom-left-radius: 4px;
}
.rfs-chat-tool-call {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 3px 8px;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 999px;
  font-size: 0.6875rem;
  color: var(--rfs-ink-2);
}
.rfs-chat-tool-icon { font-size: 0.6875rem; opacity: 0.7; }
.rfs-chat-tool-result {
  font-size: 0.6875rem;
  color: var(--rfs-ink-3);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  padding: 4px 8px;
  background: rgba(255,255,255,0.02);
  border-radius: 6px;
  border-left: 2px solid var(--rfs-bg-2);
}
.rfs-chat-tool-result.is-error {
  color: var(--rfs-danger);
  border-left-color: var(--rfs-danger);
}

/* Plan card */
.rfs-chat-plan {
  width: 100%;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 12px;
  padding: 0.75rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.rfs-chat-plan-header { display: flex; flex-direction: column; gap: 4px; }
.rfs-chat-plan-eyebrow {
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--rfs-accent);
  font-weight: 700;
}
.rfs-chat-plan-rationale {
  font-size: 0.8125rem;
  color: var(--rfs-ink-1);
  line-height: 1.4;
}
.rfs-chat-plan-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.rfs-chat-plan-steps li {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 6px;
  background: var(--rfs-bg-0);
  border-radius: 8px;
}
.rfs-chat-plan-num {
  width: 22px; height: 22px;
  border-radius: 999px;
  background: var(--rfs-accent);
  color: #09090B;
  font-size: 0.6875rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.rfs-chat-plan-step-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rfs-chat-plan-step-desc { font-size: 0.8125rem; color: var(--rfs-ink-0); line-height: 1.35; }
.rfs-chat-plan-step-id {
  font-size: 0.625rem;
  color: var(--rfs-ink-3);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.rfs-chat-plan-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
  margin-top: 0.25rem;
}

/* Retry card — inline error after a run_workflow tool failed. Same
   shape as the plan card so the eye reads it as a sibling control,
   tinted with the danger border so the failure registers without
   shouting. Primary Retry button uses the existing accent style. */
.rfs-chat-retry {
  width: 100%;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-danger);
  border-radius: 12px;
  padding: 0.75rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.rfs-chat-retry-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rfs-chat-retry-eyebrow {
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--rfs-danger);
  font-weight: 700;
}
.rfs-chat-retry-workflow {
  font-size: 0.8125rem;
  color: var(--rfs-ink-0);
  font-weight: 600;
}
.rfs-chat-retry-error {
  font-size: 0.75rem;
  color: var(--rfs-ink-1);
  line-height: 1.4;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  padding: 6px 8px;
  background: var(--rfs-bg-0);
  border-radius: 6px;
}
.rfs-chat-retry-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
  margin-top: 0.25rem;
}

/* Thinking dots */
.rfs-chat-thinking {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 14px;
  align-self: flex-start;
}
.rfs-chat-thinking-dot {
  width: 6px; height: 6px;
  border-radius: 999px;
  background: var(--rfs-ink-3);
  animation: rfs-chat-bounce 1200ms infinite ease-in-out;
}
.rfs-chat-thinking-dot:nth-child(2) { animation-delay: 150ms; }
.rfs-chat-thinking-dot:nth-child(3) { animation-delay: 300ms; }
@keyframes rfs-chat-bounce {
  0%, 60%, 100% { opacity: 0.35; transform: scale(0.85); }
  30%           { opacity: 1; transform: scale(1.1); }
}
.rfs-chat-error {
  background: rgba(248,113,113,0.1);
  color: var(--rfs-danger);
  border: 1px solid rgba(248,113,113,0.4);
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  margin-top: 4px;
}

/* Footer / input */
.rfs-chat-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-0);
  padding: 0.5rem 0.625rem 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.rfs-chat-input {
  width: 100%;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 10px;
  padding: 0.5rem 0.625rem;
  font-family: inherit;
  font-size: 0.8125rem;
  color: var(--rfs-ink-0);
  resize: none;
  line-height: 1.4;
}
.rfs-chat-input:focus {
  outline: none;
  border-color: var(--rfs-accent);
  background: var(--rfs-bg-0);
}
.rfs-chat-input::placeholder { color: var(--rfs-ink-3); }
.rfs-chat-input:disabled { opacity: 0.5; cursor: not-allowed; }
.rfs-chat-footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.375rem;
}
.rfs-chat-send { margin-left: auto; }

/* Chat header — thin strip above the transcript with the Reset
   button. Always visible inside the Chat tab so a stuck transcript
   can be wiped without hunting through the footer. */
.rfs-chat-header {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-0);
}
.rfs-chat-header-title {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rfs-ink-3);
}
.rfs-chat-reset {
  display: inline-flex; align-items: center; gap: 0.375rem;
  background: none;
  border: 1px solid transparent;
  color: var(--rfs-ink-2);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 140ms, background 140ms, border-color 140ms;
}
.rfs-chat-reset:hover:not(:disabled) {
  color: var(--rfs-ink-0);
  background: var(--rfs-bg-2);
  border-color: var(--rfs-bg-3);
}
.rfs-chat-reset:disabled { opacity: 0.4; cursor: not-allowed; }

/* Color picker bubble — preset swatches + native picker + hex input */
.rfs-chat-color {
  display: flex; flex-direction: column;
  gap: 0.5rem;
  margin-top: 4px;
  padding: 0.625rem;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 12px;
}
.rfs-chat-color-presets {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
}
.rfs-chat-color-swatch {
  aspect-ratio: 1 / 1;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  cursor: pointer;
  padding: 0;
  position: relative;
  transition: transform 80ms;
}
.rfs-chat-color-swatch:hover { transform: scale(1.08); }
.rfs-chat-color-swatch.is-picked {
  border-color: var(--rfs-accent);
  box-shadow: 0 0 0 2px var(--rfs-accent), 0 0 0 4px var(--rfs-bg-1);
}
.rfs-chat-color-row {
  display: flex; align-items: center; gap: 6px;
}
.rfs-chat-color-native {
  width: 32px; height: 32px;
  padding: 0;
  border: 1px solid var(--rfs-bg-3);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.rfs-chat-color-hex {
  flex: 1;
  background: var(--rfs-bg-0);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 8px;
  padding: 0.4375rem 0.5rem;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.75rem;
  color: var(--rfs-ink-0);
  text-transform: uppercase;
}
.rfs-chat-color-hex:focus { outline: none; border-color: var(--rfs-accent); }

/* ============ Chat: aspect-ratio bubble ============
   Wrapping pill row of "[shape] [label]" buttons. Each pill is
   compact (28px tall) so 4 to 6 fit per row even in the narrow chat
   panel; pills wrap onto more rows as the option list grows. The
   shape preview is a tiny rectangle sized to the actual ratio so
   users can pick a shape, not parse a W:H string. Container
   stretches to fill the chat-message column so wrapping works. */
.rfs-chat-aspect {
  align-self: stretch;
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.375rem 0 0;
}
.rfs-chat-aspect-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rfs-chat-aspect-tile {
  display: inline-flex; align-items: center; gap: 6px;
  height: 28px;
  padding: 0 10px 0 6px;
  border: 1px solid var(--rfs-bg-3);
  border-radius: 999px;
  background: var(--rfs-bg-1);
  cursor: pointer;
  transition: border-color 140ms, background 140ms;
  font-family: inherit;
}
.rfs-chat-aspect-tile:hover {
  border-color: var(--rfs-accent);
  background: var(--rfs-bg-2);
}
.rfs-chat-aspect-tile.is-picked {
  border-color: var(--rfs-accent);
  background: var(--rfs-accent-soft);
}
/* Fixed-size box around the shape so pills with very narrow ratios
   (e.g. 21:9) don't shift the label horizontally. The shape itself
   centres inside this box. */
.rfs-chat-aspect-shape-wrap {
  display: inline-flex;
  align-items: center; justify-content: center;
  width: 16px; height: 16px;
  flex-shrink: 0;
}
.rfs-chat-aspect-shape {
  display: block;
  background: var(--rfs-ink-2);
  border-radius: 2px;
}
.rfs-chat-aspect-tile.is-picked .rfs-chat-aspect-shape {
  background: var(--rfs-accent);
}
.rfs-chat-aspect-label {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--rfs-ink-1);
  letter-spacing: 0.02em;
}
.rfs-chat-aspect-tile.is-picked .rfs-chat-aspect-label {
  color: var(--rfs-ink-0);
}
.rfs-chat-aspect-custom {
  display: flex; align-items: center; gap: 0.375rem;
  padding: 0.4375rem 0.5625rem;
  border: 1px dashed var(--rfs-bg-3);
  border-radius: 8px;
}
.rfs-chat-aspect-custom-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--rfs-ink-2);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.rfs-chat-aspect-custom-sep {
  color: var(--rfs-ink-3);
  font-weight: 700;
}
.rfs-chat-aspect-num {
  width: 56px;
  padding: 0.3125rem 0.4375rem;
  background: var(--rfs-bg-0);
  border: 1px solid var(--rfs-bg-3);
  border-radius: 6px;
  color: var(--rfs-ink-0);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.8125rem;
  text-align: center;
}
.rfs-chat-aspect-num:focus { outline: none; border-color: var(--rfs-accent); }
.rfs-chat-aspect-num::-webkit-inner-spin-button,
.rfs-chat-aspect-num::-webkit-outer-spin-button {
  -webkit-appearance: none; margin: 0;
}

/* ============ Chat: resolution bubble ============
   Three-button segmented control — colour-coded to match the canvas
   resolution pill (1K=slate, 2K=sky, 4K=amber). Source-bucket meta sits
   below the segments; upscale warning reuses .rfs-help-warn. */
.rfs-chat-resolution {
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.5rem 0;
}
.rfs-chat-resolution-segmented {
  display: inline-flex;
  border: 1px solid var(--rfs-bg-3);
  border-radius: 10px;
  padding: 3px;
  background: var(--rfs-bg-1);
  align-self: flex-start;
}
.rfs-chat-resolution-btn {
  border: none;
  background: transparent;
  color: var(--rfs-ink-2);
  padding: 0.4375rem 0.875rem;
  border-radius: 7px;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 140ms, color 140ms;
}
.rfs-chat-resolution-btn:hover { color: var(--rfs-ink-0); }
.rfs-chat-resolution-btn.is-picked {
  background: var(--rfs-bg-3);
  color: var(--rfs-ink-0);
}
.rfs-chat-resolution-btn-1k.is-picked { color: #94A3B8; background: rgba(148,163,184,0.18); }
.rfs-chat-resolution-btn-2k.is-picked { color: #38BDF8; background: rgba(56,189,248,0.18); }
.rfs-chat-resolution-btn-4k.is-picked { color: var(--rfs-accent); background: var(--rfs-accent-soft); }
.rfs-chat-resolution-meta {
  font-size: 0.6875rem;
  color: var(--rfs-ink-3);
  letter-spacing: 0.01em;
}
.rfs-chat-resolution-meta strong { color: var(--rfs-ink-1); font-weight: 700; }
.rfs-chat-resolution-actions {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.5rem;
}

/* ============ Chat: choice bubble (generic enum) ============
   Vertical button stack — single-click submits. Falls back when no
   workflow-specific tool fits. */
.rfs-chat-choice {
  display: flex; flex-direction: column; gap: 0.375rem;
  padding: 0.5rem 0;
}
.rfs-chat-choice-btn {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--rfs-bg-3);
  border-radius: 8px;
  background: var(--rfs-bg-1);
  color: var(--rfs-ink-0);
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 140ms, background 140ms;
}
.rfs-chat-choice-btn:hover {
  border-color: var(--rfs-accent);
  background: var(--rfs-bg-2);
}
.rfs-chat-choice-btn.is-default {
  border-color: var(--rfs-accent);
}

/* ============ Compare modal ============
   Full-screen overlay with two side-by-side panes. Each pane is its
   own zoom/pan surface; the Sync View toggle (default on) makes both
   panes share their transform so the user can zoom both into the same
   region simultaneously. */
.rfs-compare-shell {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(10,10,11,0.92);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
}
.rfs-compare-header {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-0);
}
.rfs-compare-title {
  display: inline-flex; align-items: center; gap: 0.625rem;
  font-size: 0.9375rem; font-weight: 700;
  letter-spacing: -0.01em;
}
.rfs-compare-title-mark {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: var(--rfs-accent);
  color: #09090B;
  display: inline-flex; align-items: center; justify-content: center;
}
.rfs-compare-title-meta {
  margin-left: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rfs-ink-3);
}
.rfs-compare-header-actions { display: flex; gap: 0.5rem; align-items: center; }

.rfs-compare-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  padding: 1.25rem;
}

/* Per-pane: header (label or selector) + zoomable stage */
.rfs-compare-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 0.625rem;
}
.rfs-compare-pane-header {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.5rem;
}
.rfs-compare-pane-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--rfs-ink-0);
  letter-spacing: -0.01em;
}
.rfs-compare-pane-select {
  min-width: 0;
  flex: 0 1 auto;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-3);
  color: var(--rfs-ink-0);
  border-radius: 8px;
  padding: 0.375rem 0.625rem;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
}
.rfs-compare-pane-zoom {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.6875rem;
  color: var(--rfs-ink-3);
  background: var(--rfs-bg-1);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

/* Stage: dashed border (matches BetterStudio reference), centred image
   that transforms via translate + scale. Mouse events for pan/zoom. */
.rfs-compare-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  background: var(--rfs-bg-1);
  border: 2px dashed var(--rfs-bg-3);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  user-select: none;
}
.rfs-compare-stage:active { cursor: grabbing; }
.rfs-compare-stage img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: none;
  transition: none;
  -webkit-user-drag: none;
}

.rfs-compare-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--rfs-bg-2);
  background: var(--rfs-bg-0);
  gap: 1rem;
}
.rfs-compare-sync {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--rfs-ink-1);
  cursor: pointer;
  user-select: none;
}
.rfs-compare-sync input[type="checkbox"] {
  width: 16px; height: 16px;
  accent-color: var(--rfs-accent);
  cursor: pointer;
}
.rfs-compare-sync-hint {
  color: var(--rfs-ink-3);
  font-size: 0.6875rem;
  margin-left: 0.25rem;
}
.rfs-compare-help {
  font-size: 0.6875rem;
  color: var(--rfs-ink-3);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}

@media (max-width: 900px) {
  .rfs-compare-body { grid-template-columns: 1fr; }
}

/* ============ Toasts ============
   Top-right stack — non-blocking surface for completed background runs.
   Auto-dismiss after 8s; click View to navigate to the new version. */
.rfs-toasts {
  position: fixed;
  top: 64px;
  right: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 50;
  pointer-events: none;
  max-width: 380px;
}
.rfs-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.5rem 0.625rem 0.625rem;
  background: var(--rfs-bg-1);
  border: 1px solid var(--rfs-bg-3);
  border-left-width: 3px;
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.5);
  animation: rfs-toast-in 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
.rfs-toast-success { border-left-color: var(--rfs-success); }
.rfs-toast-warning { border-left-color: #F59E0B; }
.rfs-toast-error   { border-left-color: var(--rfs-danger); }
@keyframes rfs-toast-in {
  from { transform: translateX(40px); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
.rfs-toast-thumb {
  width: 40px; height: 40px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
  background: var(--rfs-bg-2);
}
.rfs-toast-text { flex: 1; min-width: 0; }
.rfs-toast-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--rfs-ink-0);
  letter-spacing: -0.01em;
}
.rfs-toast-body {
  font-size: 0.6875rem;
  color: var(--rfs-ink-2);
  margin-top: 2px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rfs-toast-action {
  flex-shrink: 0;
  background: var(--rfs-accent);
  color: #09090B;
  border: none;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
}
.rfs-toast-action:hover { background: var(--rfs-accent-dim); }
.rfs-toast-close {
  flex-shrink: 0;
  width: 24px; height: 24px;
  background: transparent;
  border: none;
  color: var(--rfs-ink-3);
  cursor: pointer;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rfs-toast-close:hover { background: var(--rfs-bg-2); color: var(--rfs-ink-0); }

/* Focus ring on all interactive */
.rfs-root button:focus-visible,
.rfs-root a:focus-visible,
.rfs-root input:focus-visible,
.rfs-root select:focus-visible,
.rfs-root textarea:focus-visible {
  outline: 2px solid var(--rfs-accent);
  outline-offset: 2px;
}

/* Package action UI — editable chain rendered when a package
   workflow is selected. Each row is one recipe step the chain will
   run, with up/down arrows + a delete X so the user can reorder or
   skip steps before clicking Apply. Per-run only; the workflow
   definition isn't mutated. */
.rfs-package-list {
  display: flex; flex-direction: column; gap: 0.375rem;
}
.rfs-package-row {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  background: var(--rfs-bg-0);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 10px;
}
.rfs-package-row-num {
  width: 22px; height: 22px;
  border-radius: 999px;
  background: var(--rfs-bg-2);
  color: var(--rfs-ink-2);
  font-size: 0.6875rem; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.rfs-package-row-text {
  display: flex; flex-direction: column; gap: 0.125rem;
  min-width: 0;
  flex: 1;
}
.rfs-package-row-name {
  font-size: 0.8125rem; font-weight: 600; color: var(--rfs-ink-0);
}
.rfs-package-row-file {
  font-size: 0.6875rem; color: var(--rfs-ink-3);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rfs-package-row-actions {
  display: inline-flex; align-items: center; gap: 0.25rem;
  flex-shrink: 0;
}
.rfs-package-row-btn {
  width: 24px; height: 24px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--rfs-bg-2);
  color: var(--rfs-ink-2);
  font-size: 0.875rem; line-height: 1;
  font-family: inherit;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.rfs-package-row-btn:hover:not(:disabled) {
  background: var(--rfs-bg-2);
  color: var(--rfs-ink-0);
}
.rfs-package-row-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.rfs-package-row-btn-danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
  color: #fff;
}

/* Section header used inside the package action panel to separate the
   "Clean up the shot" prep chain from the "Where it ships" variants.
   Subtle uppercase title + a muted meta count (e.g. "3 steps" or
   "5 of 5 selected"). */
.rfs-package-section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin: 0.25rem 0 0.5rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid var(--rfs-bg-2);
}
.rfs-package-section-title {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--rfs-ink-1);
}
.rfs-package-section-meta {
  font-size: 0.6875rem;
  color: var(--rfs-ink-3);
  font-variant-numeric: tabular-nums;
}

/* Creative-direction picker — top section of the package action panel
   for packages that declare a \`creativeDirection\`. Chip row of quick
   picks above a custom textarea; selecting a chip writes its prompt
   into the textarea, typing custom text deselects all chips. */
.rfs-package-creative {
  display: flex; flex-direction: column;
}
.rfs-package-creative-chips {
  display: flex; flex-wrap: wrap; gap: 0.375rem;
  margin-bottom: 0.5rem;
}
.rfs-package-creative-chip {
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.375rem 0.75rem;
  border-radius: 999px;
  background: var(--rfs-bg-0);
  border: 1px solid var(--rfs-bg-2);
  color: var(--rfs-ink-1);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}
.rfs-package-creative-chip:hover {
  background: var(--rfs-bg-1);
  color: var(--rfs-ink-0);
}
.rfs-package-creative-chip.is-on {
  background: var(--rfs-accent, #FBBF24);
  border-color: var(--rfs-accent, #FBBF24);
  color: #09090B;
}
.rfs-package-creative-textarea {
  font-family: inherit;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--rfs-ink-0);
  background: var(--rfs-bg-0);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 10px;
  padding: 0.5rem 0.625rem;
  resize: vertical;
  min-height: 4.5rem;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 120ms ease;
}
.rfs-package-creative-textarea:focus {
  outline: none;
  border-color: var(--rfs-accent, #FBBF24);
}
.rfs-package-creative-textarea::placeholder {
  color: var(--rfs-ink-3);
}

/* Variant fan-out — read-only composition: the user toggles channels
   on/off but doesn't reorder them (channels aren't a pipeline). Each
   row is itself the clickable target (label-wrapped) so hits register
   anywhere from the checkbox to the ratio chip. */
.rfs-package-variant-list {
  display: flex; flex-direction: column; gap: 0.3125rem;
}
.rfs-package-variant-row {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  background: var(--rfs-bg-0);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  transition: background 120ms ease, border-color 120ms ease;
}
.rfs-package-variant-row:hover {
  background: var(--rfs-bg-1);
}
.rfs-package-variant-row.is-on {
  border-color: var(--rfs-accent, #4f46e5);
  background: color-mix(in srgb, var(--rfs-accent, #4f46e5) 6%, var(--rfs-bg-0));
}
.rfs-package-variant-row input[type="checkbox"] {
  width: 16px; height: 16px;
  flex-shrink: 0;
  accent-color: var(--rfs-accent, #4f46e5);
  cursor: pointer;
}
.rfs-package-variant-name {
  flex: 1;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--rfs-ink-0);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rfs-package-variant-ratio {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--rfs-ink-2);
  font-variant-numeric: tabular-nums;
  background: var(--rfs-bg-2);
  padding: 0.125rem 0.4375rem;
  border-radius: 999px;
  flex-shrink: 0;
}
.rfs-package-variant-row.is-on .rfs-package-variant-ratio {
  background: var(--rfs-accent, #4f46e5);
  color: #fff;
}

/* Recipe editor — full-rail panel that replaces the card grid while
   open. Reuses .rfs-package-row chrome for step rows so reorder/delete
   feel identical to the package action panel; adds an expand drawer
   for per-step parameter editing and a workflow picker for "+ Add
   step".

   The base .rfs-action-pin caps at min(50vh, 460px) because as a
   "pinned action" below the cards it shouldn't eat the rail. In edit
   mode there are no cards above — the editor IS the rail content —
   so we override to fill all remaining height. The body becomes the
   single scroll context for steps + picker, no nested scrollers. */
.rfs-custom-editor.rfs-action-pin {
  flex: 1;
  min-height: 0;
  max-height: none;
  border-top: none;
}
.rfs-custom-editor .rfs-action-pin-body {
  display: flex; flex-direction: column; gap: 0.875rem;
}
.rfs-custom-editor-steps-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--rfs-ink-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 0.125rem;
}
.rfs-custom-editor-row {
  display: flex; flex-direction: column; gap: 0;
}
.rfs-custom-editor-row .rfs-package-row {
  border-radius: 10px;
}
.rfs-custom-editor-row:has(.rfs-custom-editor-step-params) .rfs-package-row {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-color: transparent;
}
.rfs-custom-editor-row-text {
  flex: 1;
  display: flex; flex-direction: column; gap: 0.125rem;
  min-width: 0;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  color: inherit;
}
.rfs-custom-editor-row-text:focus-visible {
  outline: 2px solid var(--rfs-accent);
  outline-offset: 2px;
  border-radius: 4px;
}
.rfs-custom-editor-step-params {
  display: flex; flex-direction: column; gap: 0.625rem;
  padding: 0.625rem;
  background: rgba(24,24,27,0.45);
  border: 1px solid var(--rfs-bg-2);
  border-top: none;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}
.rfs-custom-editor-add {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.5rem 0.625rem;
  background: transparent;
  border: 1px dashed var(--rfs-bg-3);
  border-radius: 10px;
  color: var(--rfs-ink-2);
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 140ms, color 140ms, background 140ms;
}
.rfs-custom-editor-add:hover {
  border-color: var(--rfs-accent);
  color: var(--rfs-accent);
  background: rgba(24,24,27,0.4);
}
.rfs-custom-editor-picker {
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.625rem;
  background: rgba(24,24,27,0.45);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 10px;
}
.rfs-custom-editor-picker-header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--rfs-ink-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rfs-custom-editor-picker-list {
  display: flex; flex-direction: column; gap: 0.375rem;
  /* No inner scroll: the editor body is the single scroll context,
     so the picker can grow to its content and the user scrolls the
     whole rail. Inside the package action panel (capped pin) the
     body still scrolls; nothing renders cropped here. */
}
.rfs-custom-editor-picker-item {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  background: var(--rfs-bg-0);
  border: 1px solid var(--rfs-bg-2);
  border-radius: 8px;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 120ms, background 120ms;
}
.rfs-custom-editor-picker-item:hover {
  border-color: var(--rfs-accent);
  background: rgba(24,24,27,0.6);
}

@media (max-width: 1100px) {
  .rfs-root {
    grid-template-columns: 200px minmax(0, 1fr) 360px;
  }
}

/* Mobile-only chrome is hidden on desktop. The mobile @media block below
   un-hides what it needs. */
.rfs-mobile-fab,
.rfs-mobile-backdrop,
.rfs-sheet-close,
.rfs-canvas-info { display: none; }

/* ============================================================
   Mobile (≤768px)
   The 3-column grid (assets / canvas / workflows) collapses into a
   single column. Both rails become overlays:
     • Left rail is a slide-over drawer (hamburger toggle reuses the
       existing \`is-rail-collapsed\` semantics — collapsed = closed).
     • Right panel is a bottom sheet (\`is-right-open\` on the root).
   Touch targets bump to ≥40px; hover-only chrome (canvas tools,
   reveal-on-hover delete buttons) become persistent so they're
   reachable with a tap.
   ============================================================ */
@media (max-width: 768px) {
  .rfs-root {
    --rfs-left-w: 0px;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 48px minmax(0, 1fr);
    grid-template-areas:
      "header"
      "center";
    /* Avoid jank on iOS bounces when the bottom sheet animates. */
    overscroll-behavior: contain;
  }

  /* ---------- Header trim ----------
     Mobile header keeps: hamburger · Runflow mark · project name · Export.
     Everything else (BETA tag, settings toggle, undo/redo, share, avatar)
     moves out of the header so the title doesn't collide with chrome on
     narrow viewports. The version stripe + Edits sheet cover the dropped
     actions. */
  .rfs-header {
    padding: 0 0.5rem;
    gap: 0.5rem;
  }
  .rfs-header > div:first-child {
    gap: 0.375rem;
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }
  .rfs-brand-tag,
  .rfs-avatar,
  .rfs-header-toggle {
    display: none;
  }
  .rfs-brand-mark { width: 24px; height: 10px; flex-shrink: 0; }
  .rfs-brand-name { font-size: 0.875rem; flex-shrink: 0; }
  .rfs-project { min-width: 0; flex: 1; }
  .rfs-project-name {
    max-width: 100%;
    padding: 0.25rem 0.375rem;
    font-size: 0.8125rem;
  }
  .rfs-project-name-input { width: 100%; max-width: 220px; }
  .rfs-header-right { gap: 0.125rem; flex-shrink: 0; }
  /* Hide undo/redo + share on mobile. Versions stripe is the canonical
     undo/redo affordance; share is rarely needed mid-edit on a phone. */
  .rfs-header-right .rfs-iconbtn[aria-label="Step to previous version"],
  .rfs-header-right .rfs-iconbtn[aria-label="Step to next version"],
  .rfs-header-right .rfs-btn:not(.rfs-btn-primary) {
    display: none;
  }
  .rfs-header-right .rfs-btn-primary {
    padding: 0.4375rem 0.625rem;
    font-size: 0.8125rem;
  }
  .rfs-iconbtn { width: 36px; height: 36px; }

  /* ---------- Left rail as slide-over drawer ---------- */
  .rfs-left {
    position: fixed;
    top: 48px; left: 0; bottom: 0;
    width: min(86vw, 340px);
    border-right: 1px solid var(--rfs-bg-2);
    transform: translateX(-100%);
    transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
    z-index: 30;
    box-shadow: 8px 0 32px rgba(0,0,0,0.5);
    /* Cover bottom safe area on devices with home indicators. */
    padding-bottom: env(safe-area-inset-bottom);
    visibility: hidden;
  }
  .rfs-root:not(.is-rail-collapsed) .rfs-left {
    transform: translateX(0);
    visibility: visible;
  }
  /* On phones the assets drawer is a single-column list — each card is
     full-width with a generous aspect ratio so the image isn't cropped
     beyond recognition. Two-column on mobile produced tiny, hard-to-
     scan tiles that visually merged with each other. */
  /* Mobile asset drawer: same square thumbnail look as the desktop
     2-col grid, just a single column with a comfortable gap between
     cards. Background, rounded corners, and the is-current outline
     come from the base .rfs-asset rule — no extra chrome needed.
     \`grid-auto-rows: max-content\` is critical: without it, grid sizes
     each row to the img's intrinsic size (~38px for an unloaded /
     slow-loading image), and the cards' aspect-ratio:1/1 makes them
     overflow into the next row — visually stacking on each other. */
  .rfs-asset-list {
    grid-template-columns: 1fr;
    grid-auto-rows: max-content;
    padding: 0.875rem;
    gap: 1rem;
  }
  .rfs-left-newasset-btn { padding: 0.625rem 0.5rem; min-height: 40px; }

  /* ---------- Center / canvas ---------- */
  .rfs-center { grid-area: center; }
  .rfs-canvas { padding: 0.5rem; }
  .rfs-canvas-empty p { max-width: 320px; }

  /* Mobile chrome cleanup. The desktop canvas-tools row (resolution +
     aspect + copy-link + download + copy-as-file) collided with the
     Sentinel badge and duplicated actions that live elsewhere: the
     version stripe thumbs carry a 1K/2K/4K badge, Export in the header
     is the canonical download CTA. Hide it on phones — info that's
     still useful (quality + size) moves into a small "?" toggle. */
  .rfs-canvas-tools { display: none; }
  .rfs-canvas-compare-btn { top: 0.5rem; right: 0.5rem; height: 36px; padding: 0 0.75rem; }
  .rfs-canvas-compare-btn-label { display: inline; }

  /* "?" info chip — tap to reveal resolution / aspect / dimensions.
     Uses the native <details>/<summary> toggle so no React state is
     needed. Sits bottom-right of the image where the old tools row
     used to live; the popover anchors above the button so it doesn't
     clip against the canvas bottom edge. */
  .rfs-canvas-info {
    display: block;
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    z-index: 4;
  }
  .rfs-canvas-info-btn {
    list-style: none;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(24, 24, 27, 0.85);
    backdrop-filter: blur(8px);
    border: 1px solid var(--rfs-bg-3);
    border-radius: 999px;
    color: var(--rfs-ink-1);
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    user-select: none;
  }
  .rfs-canvas-info-btn::-webkit-details-marker { display: none; }
  .rfs-canvas-info[open] .rfs-canvas-info-btn {
    color: var(--rfs-ink-0);
    border-color: var(--rfs-accent);
  }
  .rfs-canvas-info-popover {
    position: absolute;
    right: 0;
    bottom: 40px;
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.4375rem 0.625rem;
    background: rgba(24, 24, 27, 0.94);
    backdrop-filter: blur(8px);
    border: 1px solid var(--rfs-bg-3);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    white-space: nowrap;
    animation: rfs-fade-in 140ms ease-out;
  }
  .rfs-canvas-info-pill {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--rfs-ink-0);
  }
  .rfs-canvas-info-dim {
    font-size: 0.6875rem;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    color: var(--rfs-ink-2);
    padding-left: 0.375rem;
    border-left: 1px solid var(--rfs-bg-3);
    margin-left: 0.125rem;
  }
  .rfs-image-frame { border-radius: var(--rfs-radius); }
  .rfs-stage-hint { bottom: 1rem; font-size: 0.75rem; padding: 0.4375rem 0.75rem; }

  /* Sentinel badge moves to the TOP-LEFT corner so it no longer fights
     the bottom-right hover tools (now hidden anyway) and isn't covered
     by the stage hint that appears in pin/mask mode. Top-left is the
     only quadrant that's free — Compare lives top-right. Slightly
     tighter padding + smaller type so the badge respects the image. */
  .rfs-sentinel-badge {
    left: 0.5rem;
    top: 0.5rem;
    bottom: auto;
    padding: 0.375rem 0.625rem 0.375rem 0.5rem;
    font-size: 0.6875rem;
  }

  /* ---------- Version stripe ---------- */
  .rfs-version-stripe {
    padding: 0.5rem 0.625rem;
    gap: 0.5rem;
    /* Add safe-area bottom so the stripe doesn't sit under the home indicator. */
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
    /* Stripe sits above the floating Edits FAB — reserve room on the right
       so the last thumb isn't covered by the button. */
    scroll-padding-right: 7rem;
  }
  .rfs-version-stripe-label { display: none; }
  .rfs-version-thumb { width: 60px; height: 60px; }

  /* ---------- Right panel as bottom sheet ---------- */
  .rfs-right {
    position: fixed;
    left: 0; right: 0;
    /* Anchor with top + height (both in dvh) so the sheet's bottom
       tracks the dynamic viewport. Using \`bottom: 0\` on iOS Safari
       sticks to the LARGE viewport bottom — i.e. underneath the URL
       toolbar — which hides the Apply footer. dvh excludes the
       toolbar so the footer stays reachable. */
    top: 12vh;
    top: 12dvh;
    height: 88vh;
    height: 88dvh;
    border: none;
    border-top: 1px solid var(--rfs-bg-2);
    border-top-left-radius: 18px;
    border-top-right-radius: 18px;
    background: var(--rfs-bg-0);
    box-shadow: 0 -16px 48px rgba(0,0,0,0.55);
    transform: translateY(100%);
    transition: transform 260ms cubic-bezier(0.32, 0.72, 0, 1);
    z-index: 35;
    isolation: isolate;
    will-change: transform;
    padding-bottom: env(safe-area-inset-bottom);
    visibility: hidden;
  }
  /* While the sheet is open, keep the canvas-tools row hidden behind
     the sheet so its semi-transparent surface can't bleed through. The
     stripe stays in DOM; the sheet fully covers it. */
  .rfs-root.is-right-open .rfs-canvas-tools,
  .rfs-root.is-right-open .rfs-canvas-compare-btn,
  .rfs-root.is-right-open .rfs-canvas-info {
    display: none;
  }
  .rfs-root.is-right-open .rfs-right {
    transform: translateY(0);
    visibility: visible;
  }
  /* Drag-handle visual on the sheet — purely cosmetic affordance. */
  .rfs-right::before {
    content: "";
    position: absolute;
    top: 8px; left: 50%;
    width: 36px; height: 4px;
    margin-left: -18px;
    background: var(--rfs-bg-3);
    border-radius: 999px;
    z-index: 4;
    pointer-events: none;
  }
  /* Push the first child of the sheet down so the drag handle has room. */
  .rfs-right > .rfs-tabs,
  .rfs-right > .rfs-breadcrumb {
    padding-top: 18px;
  }
  .rfs-tab { padding: 1rem 0.5rem; font-size: 0.875rem; min-height: 52px; }
  /* The pinned action region stops being capped at 50vh — inside the
     sheet there's nothing above it competing for space. */
  .rfs-action-pin { max-height: none; flex: 1; }
  .rfs-action-pin-body { padding: 1rem; gap: 1rem; }
  .rfs-action-footer {
    padding: 0.875rem 1rem;
    padding-bottom: max(0.875rem, env(safe-area-inset-bottom));
  }
  .rfs-action-footer .rfs-btn {
    padding: 0.625rem 1rem;
    min-height: 44px;
    font-size: 0.875rem;
  }

  /* Chat input row — comfortable height + safe-area bottom so iOS
     keyboard inset stays predictable. */
  .rfs-chat-footer {
    padding-bottom: max(0.625rem, env(safe-area-inset-bottom));
  }

  /* ---------- Floating FAB to open the sheet ---------- */
  .rfs-mobile-fab {
    position: fixed;
    right: 16px;
    bottom: max(16px, calc(env(safe-area-inset-bottom) + 16px));
    z-index: 25;
    display: inline-flex;
    align-items: center;
    gap: 0.4375rem;
    height: 48px;
    padding: 0 1.125rem;
    background: var(--rfs-accent);
    color: #09090B;
    font-family: inherit;
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    border: none;
    border-radius: 999px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05);
    cursor: pointer;
  }
  .rfs-mobile-fab svg { color: #09090B; }
  .rfs-mobile-fab:active { transform: translateY(1px); }
  /* Tuck the FAB away while a sheet or drawer is up so it doesn't
     overlap the active surface. */
  .rfs-root.is-right-open .rfs-mobile-fab,
  .rfs-root:not(.is-rail-collapsed) .rfs-mobile-fab {
    display: none;
  }

  /* ---------- Backdrops + sheet close ---------- */
  .rfs-mobile-backdrop {
    display: block;
    position: fixed;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(2px);
    border: none;
    padding: 0;
    cursor: default;
    animation: rfs-fade-in 160ms ease-out;
  }
  .rfs-mobile-backdrop-left { top: 48px; left: 0; right: 0; bottom: 0; z-index: 25; }
  .rfs-mobile-backdrop-right { inset: 0; z-index: 32; }
  @keyframes rfs-fade-in { from { opacity: 0; } to { opacity: 1; } }

  .rfs-sheet-close {
    position: fixed;
    top: 8px; right: 12px;
    width: 36px; height: 36px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--rfs-bg-1);
    border: 1px solid var(--rfs-bg-3);
    border-radius: 999px;
    color: var(--rfs-ink-1);
    z-index: 40;
    cursor: pointer;
  }
  .rfs-sheet-close:active { transform: scale(0.95); }

  /* ---------- Toasts span the top edge so they're tappable ---------- */
  .rfs-toasts {
    top: 56px;
    left: 0.5rem;
    right: 0.5rem;
    max-width: none;
  }
  .rfs-toast { padding: 0.75rem; }
  .rfs-toast-action { padding: 0.5rem 0.875rem; min-height: 40px; }

  /* ---------- Misc tap-target bumps inside the sheet ---------- */
  .rfs-card { padding: 0.875rem; }
  .rfs-package-row-btn { width: 32px; height: 32px; font-size: 1rem; }
  /* Custom recipe delete/edit buttons appear on hover on desktop — show
     them on mobile so they're reachable with a tap. */
  .rfs-card-custom-edit,
  .rfs-card-custom-delete {
    opacity: 1 !important;
  }
}

/* Smaller phones: tighten the project name. */
@media (max-width: 380px) {
  .rfs-project-name { max-width: 96px; }
  .rfs-project-name-input { width: 96px; }
}

/* Honor reduced-motion for the sheet/drawer slide. */
@media (prefers-reduced-motion: reduce) {
  .rfs-left, .rfs-right { transition: none; }
}

/* Stop the body from rubber-banding when a sheet is open on iOS Safari. */
.rfs-root.is-right-open,
.rfs-root:not(.is-rail-collapsed):not([class~="rfs-root--desktop"]) {
  /* No-op on desktop because rfs-root always has is-rail-collapsed cleared
     while the rail is visible in-grid — this rule only "bites" when an
     overlay is up under the mobile media query. */
}
`;

const STYLE_ID = "rfs-default-styles";

export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STUDIO_CSS;
  doc.head.appendChild(style);
}
