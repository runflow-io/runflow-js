/**
 * Input definitions for tools.
 *
 * Each input has a `source` that determines where its value comes from:
 *
 *  - `"preset"`  — baked into the tool definition (the `value` field).
 *                  Not collected at runtime, not exposed in the UI.
 *  - `"runtime"` — provided programmatically every call (e.g. the source
 *                  image). Required.
 *  - `"user"`    — collected from the end user via the Studio UI, or
 *                  passed programmatically. Required unless `optional`.
 *
 * Use the `*Input(...)` helper functions; they preserve type information
 * so `buildRequest` and the run helpers can be fully typed.
 */

export type InputSource = "preset" | "runtime" | "user";

interface BaseInput<V> {
  source: InputSource;
  /** Set on `source: "preset"` to bake a value into the tool. */
  value?: V;
  /** UI label (shown in the Studio for `source: "user"`). */
  label?: string;
  /** UI helper text. */
  help?: string;
  /** Initial value rendered in the Studio form. */
  default?: V;
  /** When true, the user can leave this blank. */
  optional?: boolean;
}

export interface ImageInput extends BaseInput<string> {
  type: "image";
}
export interface TextInput extends BaseInput<string> {
  type: "text";
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}
export interface NumberInput extends BaseInput<number> {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}
export interface ColorInput extends BaseInput<string> {
  type: "color";
}
export interface SelectInput<V extends string = string> extends BaseInput<V> {
  type: "select";
  options: ReadonlyArray<{ value: V; label: string; description?: string }>;
}
export interface ReferenceInput extends BaseInput<string> {
  type: "reference";
  /** MIME types accepted by the uploader. */
  accept?: string;
}
export interface MaskInput extends BaseInput<string> {
  type: "mask";
}
export interface PinInput extends BaseInput<{ x: number; y: number }> {
  type: "pin";
}

export type AnyInput =
  | ImageInput
  | TextInput
  | NumberInput
  | ColorInput
  | SelectInput<string>
  | ReferenceInput
  | MaskInput
  | PinInput;

/** TS-level value type for an input definition. */
export type InputValue<I> = I extends ImageInput
  ? string
  : I extends TextInput
    ? string
    : I extends NumberInput
      ? number
      : I extends ColorInput
        ? string
        : I extends SelectInput<infer V>
          ? V
          : I extends ReferenceInput
            ? string
            : I extends MaskInput
              ? string
              : I extends PinInput
                ? { x: number; y: number }
                : never;

/** All values, including presets. Passed to `buildRequest`. */
export type AllInputValues<T extends Record<string, AnyInput>> = {
  [K in keyof T]: InputValue<T[K]>;
};

/**
 * Values that callers must provide when running a tool — everything
 * except presets. Optional `user` inputs become optional here.
 */
export type RuntimeInputValues<T extends Record<string, AnyInput>> =
  // required: non-preset, non-optional
  {
    [K in keyof T as T[K]["source"] extends "preset"
      ? never
      : T[K]["optional"] extends true
        ? never
        : K]: InputValue<T[K]>;
  } & {
    // optional: source !== "preset" AND optional === true
    [K in keyof T as T[K]["source"] extends "preset"
      ? never
      : T[K]["optional"] extends true
        ? K
        : never]?: InputValue<T[K]>;
  };

// ── Input builders ─────────────────────────────────────────────────────

export function imageInput(opts: Omit<ImageInput, "type">): ImageInput {
  return { type: "image", ...opts };
}
export function textInput(opts: Omit<TextInput, "type">): TextInput {
  return { type: "text", ...opts };
}
export function numberInput(opts: Omit<NumberInput, "type">): NumberInput {
  return { type: "number", ...opts };
}
export function colorInput(opts: Omit<ColorInput, "type">): ColorInput {
  return { type: "color", ...opts };
}
export function selectInput<const V extends string>(
  opts: Omit<SelectInput<V>, "type">,
): SelectInput<V> {
  return { type: "select", ...opts };
}
export function referenceInput(opts: Omit<ReferenceInput, "type">): ReferenceInput {
  return { type: "reference", ...opts };
}
export function maskInput(opts: Omit<MaskInput, "type">): MaskInput {
  return { type: "mask", ...opts };
}
export function pinInput(opts: Omit<PinInput, "type">): PinInput {
  return { type: "pin", ...opts };
}
