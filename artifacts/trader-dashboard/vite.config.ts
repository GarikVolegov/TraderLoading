import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const rawPort = process.env.PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

import fs from "fs";

const basePath = process.env.BASE_PATH ?? "/";
const apiTarget = process.env.VITE_API_BASE ?? "http://127.0.0.1:3001";

function resolveClerkKey(): string {
  if (process.env.VITE_CLERK_PUBLISHABLE_KEY) {
    return process.env.VITE_CLERK_PUBLISHABLE_KEY.trim();
  }
  const candidateUrls = [
    new URL(".env.local", import.meta.url),
    new URL("../../.env.local", import.meta.url),
  ];
  for (const candidate of candidateUrls) {
    if (fs.existsSync(candidate)) {
      try {
        const content = fs.readFileSync(candidate, "utf8");
        const match = content.match(/^(?:export\s+)?VITE_CLERK_PUBLISHABLE_KEY\s*=\s*([^\s#]+)/m);
        if (match && match[1]) {
          const key = match[1].trim().replace(/^["']|["']$/g, "");
          process.env.VITE_CLERK_PUBLISHABLE_KEY = key;
          return key;
        }
      } catch {
        // Fallback
      }
    }
  }
  return "";
}

const clerkPublishableKey = resolveClerkKey();
const allowMissingClerkKey = process.env.ALLOW_MISSING_CLERK_KEY === "1";

function isValidClerkKey(key: string): boolean {
  return key.startsWith("pk_test_") || key.startsWith("pk_live_");
}

function resolveBuildVersion(): string {
  const candidate =
    process.env.VITE_APP_VERSION ||
    process.env.APP_VERSION ||
    process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    `build-${Date.now()}`;
  return candidate.trim();
}

export default defineConfig(async ({ command }) => {
  const isServe = command === "serve";
  const buildVersion = resolveBuildVersion();
  // Upload sourcemaps to Sentry only on a production build WITH a token configured —
  // so prod stack traces symbolicate. Without the token the build behaves exactly as
  // before (no maps emitted, nothing uploaded). Maps are deleted after upload so they
  // are never served to clients.
  const uploadSourcemaps = !isServe && Boolean(process.env.SENTRY_AUTH_TOKEN);
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

  const outDir = path.resolve(import.meta.dirname, "dist/public");

  return {
  base: basePath,
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "aureus-pwa-version-manifest",
      configureServer(server) {
        server.middlewares.use("/version.json", (_req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.end(JSON.stringify({ version: buildVersion, builtAt: new Date().toISOString() }));
        });
      },
      closeBundle() {
        if (isServe) return;
        try {
          fs.mkdirSync(outDir, { recursive: true });
          const versionFile = path.join(outDir, "version.json");
          fs.writeFileSync(
            versionFile,
            JSON.stringify({ version: buildVersion, builtAt: new Date().toISOString() }),
            "utf8",
          );
          const swFile = path.join(outDir, "sw.js");
          if (fs.existsSync(swFile)) {
            const currentSw = fs.readFileSync(swFile, "utf8");
            if (!currentSw.includes("aureus-build-version:")) {
              fs.writeFileSync(
                swFile,
                `${currentSw.trimEnd()}\n// aureus-build-version: ${buildVersion}\n`,
                "utf8",
              );
            }
          }
        } catch (err) {
          console.warn("[aureus-pwa-version-manifest] Failed to stamp build version:", err);
        }
      },
    },
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
    ...(uploadSourcemaps
      ? sentryVitePlugin({
          // Region-aware: EU orgs (o…ingest.de.sentry.io) need the de.sentry.io URL,
          // otherwise the upload 401/404s against the US control silo.
          url: process.env.SENTRY_URL,
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: { name: process.env.VITE_APP_VERSION },
          sourcemaps: { filesToDeleteAfterUpload: ["**/*.map"] },
        })
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
    // 'hidden' emits maps but adds no //# sourceMappingURL to the bundles, so the
    // Sentry plugin can upload them without the browser ever fetching them.
    sourcemap: uploadSourcemaps ? "hidden" : false,
    minify: "esbuild",
    cssMinify: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/scheduler/")) {
              return "vendor-react";
            }
            if (id.includes("@clerk")) {
              return "vendor-clerk";
            }
            if (id.includes("three")) {
              return "vendor-three";
            }
            if (id.includes("lightweight-charts")) {
              return "vendor-charts";
            }
            if (id.includes("recharts")) {
              return "vendor-recharts";
            }
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
            if (id.includes("d3-") || id.includes("/d3/")) {
              return "vendor-d3";
            }
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            if (id.includes("@tanstack")) {
              return "vendor-query";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("date-fns")) {
              return "vendor-date";
            }
          }
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
