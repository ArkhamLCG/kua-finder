import { copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: "spa-github-pages-fallback",
      closeBundle() {
        const outDir = path.join(root, "dist");
        copyFileSync(
          path.join(outDir, "index.html"),
          path.join(outDir, "404.html"),
        );
      },
    },
  ],
  server: {
    port: 5173,
  },
});
