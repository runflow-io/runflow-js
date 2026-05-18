import { defineConfig } from "tsup";

export default defineConfig([
  // npm entries — React stays external so customers' bundlers dedupe.
  {
    entry: {
      index: "src/index.ts",
      tools: "src/tools/index.ts",
      headless: "src/headless.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    treeshake: true,
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    // Inline @runflow-io/sdk so consumers don't need to install it as a
    // separate dep. The cost is ~12 KB of duplicated bytes for users
    // who already use the SDK directly; the win is one-package install.
    noExternal: ["@runflow-io/sdk"],
  },
  // CDN bundle — React bundled in, IIFE, exposes window.RunflowStudio.
  {
    entry: { "studio.cdn": "src/cdn.ts" },
    format: ["iife"],
    globalName: "RunflowStudio",
    minify: true,
    sourcemap: true,
    target: "es2020",
    treeshake: true,
    platform: "browser",
    outExtension: () => ({ js: ".js" }),
  },
]);
