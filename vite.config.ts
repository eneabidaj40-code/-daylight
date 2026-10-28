import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// configure-pages provides "/repository" (or "" for a user/organization site).
// The workflow adds the trailing slash. Local development remains at "/".
const base = process.env.VITE_BASE_PATH || "/";
if (
  !base.startsWith("/") ||
  !base.endsWith("/") ||
  /[?#\\\s]/.test(base) ||
  base.includes("//")
) {
  throw new Error(
    'VITE_BASE_PATH must be an absolute path with a trailing slash, such as "/daylight/" or "/".',
  );
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      base,
      scope: base,
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "Daylight — Study & Life Planner",
        short_name: "Daylight",
        description:
          "A little structure. A lot of possibility. Your private, offline study and life planner.",
        theme_color: "#254d3f",
        background_color: "#f6f7f2",
        display: "standalone",
        start_url: base,
        scope: base,
        id: base,
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}icons/maskable-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  base,
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
