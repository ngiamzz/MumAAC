import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "MumAAC",
        short_name: "Talk",
        description: "Tap letters, pick a word, and the device speaks it.",
        display: "standalone",
        orientation: "any",
        background_color: "#fbf8f3",
        theme_color: "#fbf8f3",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,json}"] },
    }),
  ],
});
