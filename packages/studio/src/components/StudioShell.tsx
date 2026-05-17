import { Runflow } from "@runflow/sdk";
import { useEffect, useMemo, useReducer, useState } from "react";
import { InputForm } from "./InputForm.js";
import { initialState, reducer } from "../state.js";
import type { AnyTool, StudioOptions, StudioSample } from "../types.js";

interface StudioShellProps {
  options: StudioOptions;
  tools: ReadonlyArray<AnyTool>;
  samples: ReadonlyArray<StudioSample>;
}

export function StudioShell({ options, tools, samples }: StudioShellProps) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [externalSource, setExternalSource] = useState(options.source ?? null);

  const rf = useMemo(() => {
    return new Runflow({ baseUrl: options.baseUrl ?? "/api/runflow" });
  }, [options.baseUrl]);

  // Initial source: external, then first sample.
  useEffect(() => {
    if (externalSource) {
      dispatch({ type: "set-source", url: externalSource });
    } else if (samples.length > 0 && !state.sourceUrl) {
      const first = samples[0];
      if (first) dispatch({ type: "set-source", url: first.url });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSource, samples]);

  useEffect(() => {
    options.on?.ready?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => groupTools(tools), [tools]);
  const sourceUrl = state.sourceUrl;
  const displayUrl =
    state.currentVersion >= 0
      ? state.versions[state.currentVersion]?.outputUrl ?? sourceUrl
      : sourceUrl;

  const onRun = async () => {
    if (!state.selectedTool || !sourceUrl) return;
    options.on?.runStart?.({ toolId: state.selectedTool.id });
    dispatch({ type: "run-start" });
    try {
      const args = { image: sourceUrl, ...state.formValues } as Record<string, unknown>;
      // Cast tool + args to bypass generic erasure; the SDK validates at the API boundary.
      const result = await rf.tools.run(
        state.selectedTool as Parameters<typeof rf.tools.run>[0],
        args as Parameters<typeof rf.tools.run>[1],
        {
          onPoll: (run) => {
            if (run.status_code === "running") {
              dispatch({ type: "run-progress", status: "running", message: "Generating…" });
            } else if (run.status_code === "queued") {
              dispatch({ type: "run-progress", status: "queued", message: "Queued…" });
            }
          },
        },
      );
      const out = result.output as Record<string, unknown>;
      const outUrl = typeof out.image === "string" ? out.image : "";
      dispatch({
        type: "run-complete",
        toolId: state.selectedTool.id,
        runId: result.runId,
        sourceUrl,
        outputUrl: outUrl,
      });
      options.on?.runComplete?.({
        toolId: state.selectedTool.id,
        runId: result.runId,
        output: out,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "run failed";
      dispatch({ type: "run-error", message });
      options.on?.runError?.({
        toolId: state.selectedTool.id,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  };

  return (
    <div className="rfs-shell">
      {!options.hideSourcePicker && (
        <aside className="rfs-panel" aria-label="Source picker">
          <h2 className="rfs-panel-title">Source</h2>
          <div className="rfs-source-list">
            {samples.map((s) => (
              <button
                key={s.id}
                type="button"
                className="rfs-source-tile"
                data-active={s.url === sourceUrl}
                onClick={() => {
                  setExternalSource(null);
                  dispatch({ type: "set-source", url: s.url });
                  options.on?.sourceChange?.(s.url);
                }}
                aria-label={s.title}
              >
                <img src={s.url} alt={s.title} />
              </button>
            ))}
          </div>
          <input
            className="rfs-source-url-input"
            type="url"
            placeholder="Paste an image URL…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const value = (e.target as HTMLInputElement).value.trim();
                if (value) {
                  dispatch({ type: "set-source", url: value });
                  options.on?.sourceChange?.(value);
                }
              }
            }}
          />
        </aside>
      )}

      <section className="rfs-canvas-wrap">
        <div className="rfs-canvas">
          {displayUrl ? (
            <img src={displayUrl} alt="" />
          ) : (
            <span className="rfs-canvas-empty">Pick a source to begin.</span>
          )}
          {(state.runStatus === "queued" || state.runStatus === "running") && (
            <div className="rfs-canvas-overlay" role="status" aria-live="polite">
              <div className="rfs-spinner" />
              <div>{state.runMessage}</div>
            </div>
          )}
        </div>
        {state.versions.length > 0 && (
          <div className="rfs-versions">
            <div
              className="rfs-version"
              data-active={state.currentVersion === -1}
              style={{ backgroundImage: `url(${sourceUrl})` }}
              onClick={() => dispatch({ type: "show-version", index: -1 })}
              role="button"
              tabIndex={0}
              aria-label="Source"
            />
            {state.versions.map((v, i) => (
              <div
                key={v.id}
                className="rfs-version"
                data-active={state.currentVersion === i}
                style={{ backgroundImage: `url(${v.outputUrl})` }}
                onClick={() => dispatch({ type: "show-version", index: i })}
                role="button"
                tabIndex={0}
                aria-label={`Version ${v.id}`}
              />
            ))}
          </div>
        )}
      </section>

      <aside className="rfs-panel" aria-label="Tools">
        <h2 className="rfs-panel-title">Tools</h2>
        {Object.entries(grouped).map(([group, items]) => (
          <div className="rfs-tool-group" key={group}>
            <h3 className="rfs-tool-group-title">{group}</h3>
            <div className="rfs-tool-list">
              {items.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className="rfs-tool-row"
                  data-active={state.selectedTool?.id === tool.id}
                  onClick={() => dispatch({ type: "select-tool", tool })}
                >
                  <span className="rfs-tool-name">{tool.name}</span>
                  {tool.description && (
                    <span className="rfs-tool-desc">{tool.description}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {state.selectedTool && (
          <>
            <InputForm
              tool={state.selectedTool}
              values={state.formValues}
              onChange={(k, v) => dispatch({ type: "set-form-value", key: k, value: v })}
            />
            <button
              type="button"
              className="rfs-run-button"
              disabled={!sourceUrl || state.runStatus === "queued" || state.runStatus === "running"}
              onClick={onRun}
            >
              {state.runStatus === "queued" || state.runStatus === "running"
                ? state.runMessage
                : "Run"}
            </button>
            {state.runError && <div className="rfs-error">{state.runError}</div>}
          </>
        )}
      </aside>
    </div>
  );
}

function groupTools(tools: ReadonlyArray<AnyTool>): Record<string, AnyTool[]> {
  const order = ["magic", "compose", "cleanup", "enhance", "package", "other"];
  const groups: Record<string, AnyTool[]> = {};
  for (const t of tools) {
    const g = t.group ?? "other";
    (groups[g] ??= []).push(t);
  }
  // Sort by canonical order, putting unknown groups last.
  const sorted: Record<string, AnyTool[]> = {};
  for (const g of order) if (groups[g]) sorted[g] = groups[g];
  for (const g of Object.keys(groups)) if (!sorted[g]) sorted[g] = groups[g] as AnyTool[];
  return sorted;
}
