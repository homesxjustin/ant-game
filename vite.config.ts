import { defineConfig } from "vite";

// The web build is the reference "PC edition" target. It ships as static
// assets that can be wrapped by Electron/Tauri for desktop distribution, or
// hosted directly. Console editions replace the platform/ adapters, not this
// config. See docs/PORTING.md.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});
