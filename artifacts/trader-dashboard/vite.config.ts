import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const apiTarget = process.env.VITE_API_BASE ?? "http://127.0.0.1:3001";

const clerkPublishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
const allowMissingClerkKey = process.env.ALLOW_MISSING_CLERK_KEY === "1";

function isValidClerkKey(key: string): boolean {
  return key.startsWith("pk_test_") || key.startsWith("pk_live_");
}

export default defineConfig(async ({ command }) => {
  const isServe = command === "serve";
  if (!isServe) {
    process.env.NODE_ENV = "production";
    // Vite inlines VITE_* env at build time. An empty key here produces a bundle
    // where ClerkProvider throws on load, blanking the app to a black screen.
    // Fail the build instead of shipping that. Set ALLOW_MISSING_CLERK_KEY=1 to
    // intentionally build an API-only/preview bundle.
    if (!allowMissingClerkKey && !isValidClerkKey(clerkPublishableKey)) {
      throw new Error(
        "VITE_CLERK_PUBLISHABLE_KEY is missing or invalid (expected pk_test_… or " +
          "pk_live_…). A production build without it ships a blank black screen. " +
          "Pass it to the build (e.g. docker build --build-arg " +
          "VITE_CLERK_PUBLISHABLE_KEY=pk_live_…), or set ALLOW_MISSING_CLERK_KEY=1 " +
          "to build a preview bundle on purpose.",
      );
    }
  }

  return {
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    ...(isServe ? [runtimeErrorOverlay()] : []),
    ...(isServe &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    cssMinify: true,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@clerk")) return "vendor-auth";
          if (id.includes("lightweight-charts")) return "vendor-lightweight-charts";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-recharts";
          if (id.includes("framer-motion") || id.includes("@dnd-kit")) return "vendor-motion";
          if (id.includes("@radix-ui") || id.includes("lucide-react")) return "vendor-ui";
          if (id.includes("react") || id.includes("react-dom") || id.includes("wouter")) return "vendor-react";
          return undefined;
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  };
});
