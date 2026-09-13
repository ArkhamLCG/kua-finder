import { copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePluginRadar } from "vite-plugin-radar";

const root = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.BASE_PATH || "/";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const metrikaId = env.VITE_YANDEX_METRIKA_ID?.trim();

  return {
    base,
    plugins: [
      react(),
      ...(metrikaId
        ? [
            VitePluginRadar({
              metrica: [
                {
                  id: metrikaId,
                  config: {
                    clickmap: true,
                    trackLinks: true,
                    accurateTrackBounce: true,
                    webvisor: true,
                    ecommerce: "dataLayer",
                  },
                },
              ],
            }),
          ]
        : []),
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
  };
});
