/**
 * IIFE entry for the CDN bundle. Exposes a single global:
 * `window.RunflowStudio` with `mount` + `BUILTIN_TOOLS`.
 *
 * Built with React inlined so customers don't have to install or bundle
 * it themselves.
 */
export { mount, BUILTIN_TOOLS, findTool } from "./index.js";
