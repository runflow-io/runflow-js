import type { AnyInput } from "@runflow/sdk";
import type { AnyTool } from "../types.js";

interface InputFormProps {
  tool: AnyTool;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Renders a form for the user-collected inputs on a tool. Inputs with
 * `source: "preset"` or `source: "runtime"` are not shown.
 */
export function InputForm({ tool, values, onChange }: InputFormProps) {
  const inputs = tool.inputs as Record<string, AnyInput>;
  const userFields = Object.entries(inputs).filter(([, def]) => def.source === "user");
  if (userFields.length === 0) return null;
  return (
    <div className="rfs-form">
      {userFields.map(([key, def]) => (
        <Field
          key={key}
          name={key}
          def={def}
          value={values[key]}
          onChange={(v) => onChange(key, v)}
        />
      ))}
    </div>
  );
}

function Field({
  name,
  def,
  value,
  onChange,
}: {
  name: string;
  def: AnyInput;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = def.label ?? humanize(name);

  if (def.type === "text") {
    return (
      <div className="rfs-form-field">
        <label className="rfs-form-label">
          {label}
          {def.optional ? " (optional)" : ""}
        </label>
        {def.multiline ? (
          <textarea
            className="rfs-form-textarea"
            placeholder={def.placeholder}
            maxLength={def.maxLength}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            className="rfs-form-input"
            type="text"
            placeholder={def.placeholder}
            maxLength={def.maxLength}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {def.help ? <div className="rfs-form-help">{def.help}</div> : null}
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <div className="rfs-form-field">
        <label className="rfs-form-label">{label}</label>
        <select
          className="rfs-form-select"
          value={(value as string) ?? def.default ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {def.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {def.help ? <div className="rfs-form-help">{def.help}</div> : null}
      </div>
    );
  }

  if (def.type === "color") {
    return (
      <div className="rfs-form-field">
        <label className="rfs-form-label">{label}</label>
        <div className="rfs-form-color">
          <input
            type="color"
            value={(value as string) ?? def.default ?? "#FFFFFF"}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            className="rfs-form-input"
            type="text"
            value={(value as string) ?? def.default ?? "#FFFFFF"}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        {def.help ? <div className="rfs-form-help">{def.help}</div> : null}
      </div>
    );
  }

  if (def.type === "number") {
    return (
      <div className="rfs-form-field">
        <label className="rfs-form-label">{label}</label>
        <input
          className="rfs-form-input"
          type="number"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value === undefined ? "" : String(value)}
          onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        />
      </div>
    );
  }

  // pin / mask / reference / image — these require richer interaction
  // (canvas overlay, brush tool, file upload pipeline). Not yet wired in
  // the default Studio UI; consumers can run these tools programmatically
  // via `runflow.tools.run(tool, ...)`.
  return (
    <div className="rfs-form-field">
      <label className="rfs-form-label">{label}</label>
      <div className="rfs-form-unsupported">
        Input type "{def.type}" is not yet supported in the default Studio UI.
        Run this tool programmatically via runflow.tools.run().
      </div>
    </div>
  );
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (s) => s.toUpperCase())
    .trim();
}
