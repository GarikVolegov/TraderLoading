import { createRoot } from "react-dom/client";
import App from "./App";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { initObservability } from "./lib/observability";
import { initRumTelemetry } from "./lib/rumTelemetry";
import { shouldReloadForPreloadError } from "./lib/preloadReload";
import { initPwaAutoUpdater } from "./lib/pwaAutoUpdater";
import "./index.css";
import "./styles/mobile.css";

initObservability();
initRumTelemetry();

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

initPwaAutoUpdater();
