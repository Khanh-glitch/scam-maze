import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@scammaze/shared-types": path.resolve(import.meta.dirname, "../../packages/shared-types/src"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    // The live preview is served from a proxied host under *.e2b.app; without this the dev server
    // answers 403 and the preview is a blank page.
    allowedHosts: [".e2b.app"],
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
