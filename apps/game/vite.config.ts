import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/** Hosts a development preview may be served under. See `server.allowedHosts` above. */
function allowedHosts(): { allowedHosts?: string[] } {
  const hosts = process.env.DEV_ALLOWED_HOSTS?.split(",")
    .map((host) => host.trim())
    .filter((host) => host !== "");
  return hosts === undefined || hosts.length === 0 ? {} : { allowedHosts: hosts };
}

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
    // Vite 8 rejects any Host header it does not know. A tunnel or a hosted preview sets its own
    // host here, comma-separated (`DEV_ALLOWED_HOSTS=".e2b.app,play.example.test"`); a leading dot
    // allows the subdomains. Unset, Vite's default (localhost and IP addresses) applies.
    ...allowedHosts(),
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
