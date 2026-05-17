/**
 * Inlined default stylesheet.
 *
 * `mount()` injects a `<style>` tag into the document head the first
 * time the Studio is mounted on a page. That avoids consumers having
 * to remember a separate CSS import, and sidesteps bundler limitations
 * on cross-package CSS resolution (Next.js static export, etc.).
 *
 * Consumers can disable injection via `mount(target, { injectStyles: false })`
 * and ship their own stylesheet (the source is also exposed as
 * `@runflow/studio/styles.css` for the rare cases that prefer it).
 */

export const STUDIO_CSS = `
.rfs-root {
  --rfs-bg-0: #0a0a0b;
  --rfs-bg-1: #18181b;
  --rfs-bg-2: #27272a;
  --rfs-bg-3: #3f3f46;
  --rfs-ink-0: #fafafa;
  --rfs-ink-1: #d4d4d8;
  --rfs-ink-2: #a1a1aa;
  --rfs-ink-3: #71717a;
  --rfs-accent: #fbbf24;
  --rfs-success: #22c55e;
  --rfs-warn: #f59e0b;
  --rfs-danger: #f87171;
  color: var(--rfs-ink-0);
  background: var(--rfs-bg-0);
  font-family: "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.45;
  box-sizing: border-box;
  border-radius: 12px;
  overflow: hidden;
}
.rfs-root[data-theme="light"] {
  --rfs-bg-0: #ffffff;
  --rfs-bg-1: #f8f8f9;
  --rfs-bg-2: #ecedf0;
  --rfs-bg-3: #d9dade;
  --rfs-ink-0: #0f0f12;
  --rfs-ink-1: #2a2b30;
  --rfs-ink-2: #6b6c75;
  --rfs-ink-3: #b0b1b8;
}
.rfs-root *, .rfs-root *::before, .rfs-root *::after { box-sizing: inherit; }
.rfs-shell {
  display: grid;
  grid-template-columns: 240px 1fr 300px;
  gap: 1px;
  background: var(--rfs-bg-3);
  min-height: 600px;
}
@media (max-width: 800px) { .rfs-shell { grid-template-columns: 1fr; } }
.rfs-panel { background: var(--rfs-bg-1); padding: 16px; overflow: auto; }
.rfs-panel-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--rfs-ink-2); margin: 0 0 12px; font-weight: 600; }
.rfs-source-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.rfs-source-tile { border: 1px solid var(--rfs-bg-3); border-radius: 8px; overflow: hidden; cursor: pointer; background: var(--rfs-bg-2); transition: border-color 120ms ease; padding: 0; }
.rfs-source-tile:hover { border-color: var(--rfs-ink-3); }
.rfs-source-tile[data-active="true"] { border-color: var(--rfs-accent); }
.rfs-source-tile img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; }
.rfs-source-url-input { width: 100%; margin-top: 12px; background: var(--rfs-bg-2); color: var(--rfs-ink-0); border: 1px solid var(--rfs-bg-3); border-radius: 6px; padding: 8px; font: inherit; }
.rfs-canvas-wrap { display: flex; flex-direction: column; gap: 12px; align-items: stretch; justify-content: stretch; padding: 16px; background: var(--rfs-bg-1); }
.rfs-canvas { flex: 1; display: flex; align-items: center; justify-content: center; background: var(--rfs-bg-0); border: 1px solid var(--rfs-bg-3); border-radius: 12px; min-height: 360px; overflow: hidden; position: relative; }
.rfs-canvas img { max-width: 100%; max-height: 60vh; display: block; }
.rfs-canvas-empty { color: var(--rfs-ink-2); font-size: 13px; }
.rfs-canvas-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; color: var(--rfs-ink-0); flex-direction: column; gap: 8px; }
.rfs-spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.15); border-top-color: var(--rfs-accent); animation: rfs-spin 700ms linear infinite; }
@keyframes rfs-spin { to { transform: rotate(360deg); } }
.rfs-versions { display: flex; gap: 8px; flex-wrap: wrap; }
.rfs-version { border: 2px solid var(--rfs-bg-3); border-radius: 6px; width: 64px; height: 64px; background-size: cover; background-position: center; cursor: pointer; }
.rfs-version[data-active="true"] { border-color: var(--rfs-accent); }
.rfs-tool-group { margin-bottom: 16px; }
.rfs-tool-group-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--rfs-ink-3); margin: 0 0 6px; font-weight: 600; }
.rfs-tool-list { display: flex; flex-direction: column; gap: 4px; }
.rfs-tool-row { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; padding: 8px 10px; background: var(--rfs-bg-2); border: 1px solid transparent; border-radius: 6px; cursor: pointer; width: 100%; text-align: left; color: inherit; font: inherit; }
.rfs-tool-row:hover { background: var(--rfs-bg-3); }
.rfs-tool-row[data-active="true"] { border-color: var(--rfs-accent); background: var(--rfs-bg-2); }
.rfs-tool-name { font-weight: 600; font-size: 13px; color: var(--rfs-ink-0); }
.rfs-tool-desc { font-size: 11px; color: var(--rfs-ink-2); line-height: 1.35; }
.rfs-form { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--rfs-bg-3); }
.rfs-form-field { display: flex; flex-direction: column; gap: 4px; }
.rfs-form-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--rfs-ink-2); }
.rfs-form-input, .rfs-form-textarea, .rfs-form-select { background: var(--rfs-bg-2); color: var(--rfs-ink-0); border: 1px solid var(--rfs-bg-3); border-radius: 6px; padding: 8px 10px; font: inherit; width: 100%; }
.rfs-form-textarea { min-height: 80px; resize: vertical; }
.rfs-form-help { font-size: 11px; color: var(--rfs-ink-3); }
.rfs-form-color { display: flex; align-items: center; gap: 8px; }
.rfs-form-color input[type="color"] { width: 36px; height: 36px; padding: 0; border: none; border-radius: 6px; background: transparent; }
.rfs-form-unsupported { font-size: 11px; color: var(--rfs-warn); }
.rfs-run-button { margin-top: 12px; background: var(--rfs-accent); color: #18181b; border: none; border-radius: 8px; padding: 10px 14px; font-weight: 600; cursor: pointer; font: inherit; }
.rfs-run-button:disabled { opacity: 0.5; cursor: not-allowed; }
.rfs-error { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.35); color: var(--rfs-danger); padding: 8px 10px; border-radius: 6px; font-size: 12px; margin-top: 8px; }
`;

const STYLE_ID = "rfs-default-styles";

/**
 * Inject the default Studio stylesheet into the document head, exactly
 * once. Safe to call multiple times — subsequent calls are no-ops.
 */
export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STUDIO_CSS;
  doc.head.appendChild(style);
}
