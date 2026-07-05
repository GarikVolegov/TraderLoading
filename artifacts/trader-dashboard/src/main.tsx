import { createRoot } from "react-dom/client";
import App from "./App";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { initObservability } from "./lib/observability";
import { shouldReloadForPreloadError } from "./lib/preloadReload";
import "./index.css";

initObservability();

// After a deploy the old hashed chunks 404, so navigating to a lazy route throws
// `vite:preloadError` and the app crashes to a full-screen error. Reload once
// (guarded against loops) to fetch the fresh build instead of crashing.
window.addEventListener("vite:preloadError", (event) => {
  if (shouldReloadForPreloadError(window.sessionStorage, Date.now())) {
    event.preventDefault();
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`.replace(/\/+/g, "/");
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL || "/" })
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
