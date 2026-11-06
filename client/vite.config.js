import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: true, // Listen on all network addresses (0.0.0.0)
    allowedHosts: true, // Allow wildcard subdomains such as *.localhost, *.lvh.me, *.bharatshopee.com
    proxy: {
      "/api": {
        target: "http://localhost:7002",
        changeOrigin: true,
      },
    },
  },
});
