/**
 * IIFE entry for the CDN bundle. Exposes `window.RunflowStudio.mount`.
 * React is bundled in for non-React hosts.
 */
export { mount, StudioShell, URLS, setStudioUrls } from "./index.js";
