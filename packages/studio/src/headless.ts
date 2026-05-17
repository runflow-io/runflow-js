/**
 * Headless primitives — for callers who want their own UI but want
 * the SDK's tool catalogue, the state reducer, and default styles.
 *
 * This is the "option C" escape hatch from the original brainstorm.
 */

export { BUILTIN_TOOLS, findTool } from "./tools/index.js";
export type {
  StudioOptions,
  StudioSample,
  StudioInstance,
  StudioTheme,
  AnyTool,
} from "./types.js";
export { DEFAULT_SAMPLES } from "./types.js";
export {
  type StudioState,
  type StudioAction,
  type Version,
  reducer,
  initialState,
} from "./state.js";
