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

const basePath = process.env.BASE_PATH ?? "/";
const apiTarget = process.env.VITE_API_BASE ?? "http://127.0.0.1:3001";

const clerkPublishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
const allowMissingClerkKey = process.env.ALLOW_MISSING_CLERK_KEY === "1";

function isValidClerkKey(key: string): boolean {
  return key.startsWith("pk_test_") || key.startsWith("pk_live_");
}

export default defineConfig(async ({ command }) => {
  const isServe = command === "serve";
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

  return {
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
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
    // No manualChunks: Rollup's default per-dynamic-import chunking is
    // topologically ordered (no circular chunk graphs), so page-only libraries
    // (recharts, @xyflow, lightweight-charts, @dnd-kit) load with their lazy
    // page instead of in an eager vendor mega-chunk. The old manual grouping
    // that black-screened (forwardRef undefined) is exactly what this avoids.
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
