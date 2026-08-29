import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import path from "node:path";

export default defineConfig({
  plugins: [
    // Cast: monorepo has two Vite installs (root + workspace); plugin types
    // resolve to root's while vite.config binds to the workspace one. Runtime
    // is fine (same major); we widen the type to unblock the check.
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      quoteStyle: "double",
    }) as PluginOption,
    react(),
  ],
  resolve: {
    // Alias the workspace packages to their SOURCE, not the CommonJS `dist/`.
    // Rationale:
    //   • `@virundhu/shared` is dual-consumed by NestJS (CJS) and the SPA (ESM).
    //     Its published `dist` is CJS which rollup cannot statically tree-shake.
    //   • Aliasing to source lets Vite bundle straight from `.ts`, gives HMR on
    //     package edits, and produces a smaller, tree-shaken output.
    //   • Zero runtime cost; TS project references still verify types in CI.
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@virundhu/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@virundhu/client": path.resolve(__dirname, "../../packages/client/src/index.ts"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-router": ["@tanstack/react-router"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          // Loaded via dynamic import (QR page only) — the `async-` prefix
          // excludes it from CI's INITIAL-JS bundle budget.
          "async-qrcode": ["qrcode"],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
