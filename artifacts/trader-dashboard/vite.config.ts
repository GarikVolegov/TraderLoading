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

export function packageNameFromModuleId(id: string): string | undefined {
  const normalized = id.replaceAll(path.sep, "/");
  const marker = "/node_modules/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) return undefined;

  const packagePath = normalized.slice(markerIndex + marker.length);
  const [first, second] = packagePath.split("/");
  if (!first) return undefined;
  return first.startsWith("@") && second ? `${first}/${second}` : first;
}

export function getManualChunkName(id: string): string | undefined {
  const packageName = packageNameFromModuleId(id);
  if (!packageName) return undefined;

  if (packageName === "react" || packageName === "react-dom" || packageName === "scheduler") {
    return "vendor-react";
  }
  if (packageName === "wouter") return "vendor-router";
  if (packageName.startsWith("@clerk/")) return "vendor-auth";
  if (packageName === "lightweight-charts") return "vendor-lightweight-charts";
  if (packageName === "recharts" || packageName.startsWith("d3-")) return "vendor-recharts";
  if (packageName === "framer-motion" || packageName.startsWith("@dnd-kit/")) return "vendor-motion";
  if (packageName.startsWith("@radix-ui/") || packageName === "lucide-react") return "vendor-ui";

  return undefined;
}

export default defineConfig(async ({ command }) => {
  const isServe = command === "serve";
  if (!isServe) {
    process.env.NODE_ENV = "production";
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
        manualChunks: getManualChunkName,
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
