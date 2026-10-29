import { shouldReloadForPreloadError } from "./preloadReload";

declare const __APP_BUILD_VERSION__: string | undefined;

const UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_RELOAD_COOLDOWN_MS = 15_000;

export const AUREUS_UPDATE_EVENT = "aureus:update-available";

let criticalSessionActive = false;
let pendingUpdateAvailable = false;
let pendingRegistration: ServiceWorkerRegistration | null = null;

/**
 * Flags whether a critical trading or backtest session is active.
 * When true, automatic intrusive reloads are strictly suppressed.
 */
export function setCriticalSessionActive(active: boolean): void {
  criticalSessionActive = active;
}

export function isCriticalSessionActive(): boolean {
  return criticalSessionActive;
}

export function isPendingUpdateAvailable(): boolean {
  return pendingUpdateAvailable;
}

export function getClientBuildVersion(): string | null {
  try {
    if (typeof __APP_BUILD_VERSION__ === "string" && __APP_BUILD_VERSION__.trim().length > 0) {
      return __APP_BUILD_VERSION__.trim();
    }
  } catch {
    // Ignore when not defined in test environment
  }
  return null;
}

export function hasBuildVersionChanged(
  currentVersion: string | null | undefined,
  remotePayload: unknown,
): boolean {
  if (!currentVersion || typeof currentVersion !== "string" || !currentVersion.trim()) {
    return false;
  }
  if (!remotePayload || typeof remotePayload !== "object") {
    return false;
  }
  const remoteVersion = (remotePayload as { version?: unknown }).version;
  if (typeof remoteVersion !== "string" || !remoteVersion.trim()) {
    return false;
  }
  return remoteVersion.trim() !== currentVersion.trim();
}

export function isUserTypingInEditableElement(activeElement: unknown): boolean {
  if (!activeElement || typeof activeElement !== "object") {
    return false;
  }
  const el = activeElement as {
    tagName?: unknown;
    type?: unknown;
    isContentEditable?: unknown;
    readOnly?: unknown;
    disabled?: unknown;
  };
  if (el.isContentEditable === true) {
    return true;
  }
  if (el.readOnly === true || el.disabled === true) {
    return false;
  }
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  if (tag === "TEXTAREA") {
    return true;
  }
  if (tag === "INPUT") {
    const inputType = typeof el.type === "string" ? el.type.toLowerCase() : "text";
    const nonTextTypes = new Set([
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "radio",
      "range",
      "reset",
      "submit",
    ]);
    return !nonTextTypes.has(inputType);
  }
  return false;
}

export function isChunkLoadFailure(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : typeof reason === "string"
        ? reason
        : "";
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("importing a module script failed") ||
    normalized.includes("error loading dynamically imported module") ||
    normalized.includes("chunkloaderror") ||
    normalized.includes("unable to preload css")
  );
}

/**
 * Checks if the user is in a view or flow where unexpected reloads
 * would disrupt calculations, trades, or backtest playback.
 */
export function shouldSuppressAutomaticReload(currentPath?: string): boolean {
  if (criticalSessionActive) return true;
  const path = currentPath || (typeof window !== "undefined" ? window.location?.pathname : "");
  if (path && path.includes("/backtest/") && path.includes("/replay")) {
    return true;
  }
  return false;
}

/**
 * Gracefully notifies the application and user that a new version of the protocol
 * is ready, without violently reloading the screen.
 */
export function notifyUpdateAvailable(newVersion?: string): void {
  pendingUpdateAvailable = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(AUREUS_UPDATE_EVENT, {
        detail: { version: newVersion },
      }),
    );
  }
}

/**
 * Explicitly applies the pending update when the operator chooses to reload.
 */
export function applyPendingUpdate(): void {
  if (pendingRegistration?.waiting) {
    pendingRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("tl:preload-reload-at");
      window.location.reload();
    }
  } catch {
    window?.location?.reload();
  }
}

export function initPwaAutoUpdater(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (import.meta.env?.DEV) {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          void reg.unregister();
        }
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) {
            void caches.delete(key);
          }
        });
      }
    }
    return () => {};
  }

  const baseUrl = (import.meta.env?.BASE_URL || "/").replace(/\/+$/, "/");
  let knownVersion = getClientBuildVersion();
  let swRegistration: ServiceWorkerRegistration | null = null;
  let checkInFlight = false;

  const checkForUpdates = async () => {
    if (checkInFlight) return;
    checkInFlight = true;
    try {
      if (swRegistration) {
        await swRegistration.update().catch(() => {});
        if (swRegistration.waiting) {
          pendingRegistration = swRegistration;
          notifyUpdateAvailable();
        }
      }

      const versionUrl = `${baseUrl}version.json?t=${Date.now()}`.replace(/\/+/g, "/");
      const res = await fetch(versionUrl, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (!res.ok) return;

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) return;

      const payload = (await res.json()) as { version?: unknown };
      if (!knownVersion && typeof payload?.version === "string" && payload.version.trim()) {
        knownVersion = payload.version.trim();
        return;
      }

      if (hasBuildVersionChanged(knownVersion, payload)) {
        knownVersion = String(payload.version).trim();
        notifyUpdateAvailable(knownVersion);
      }
    } catch {
      // Offline or transient network error — ignore cleanly
    } finally {
      checkInFlight = false;
    }
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (isChunkLoadFailure(event.reason)) {
      if (shouldReloadForPreloadError(window.sessionStorage, Date.now(), UPDATE_RELOAD_COOLDOWN_MS)) {
        event.preventDefault();
        window.location.reload();
      }
    }
  };

  window.addEventListener("unhandledrejection", onUnhandledRejection);

  const hadControllerInitially =
    "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);

  const onControllerChange = () => {
    if (hadControllerInitially) {
      if (shouldSuppressAutomaticReload()) {
        notifyUpdateAvailable();
      } else if (!isUserTypingInEditableElement(document.activeElement)) {
        // Safe passive reload only if not in active session
        notifyUpdateAvailable();
      }
    }
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const registerSw = () => {
      const swUrl = `${baseUrl}sw.js`.replace(/\/+/g, "/");
      navigator.serviceWorker
        .register(swUrl, {
          scope: baseUrl,
          updateViaCache: "none",
        })
        .then((reg) => {
          swRegistration = reg;
          pendingRegistration = reg;

          if (reg.waiting) {
            notifyUpdateAvailable();
          }

          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                // New update installed into waiting state — do NOT forcefully skip waiting,
                // give operator the choice to update!
                pendingRegistration = reg;
                notifyUpdateAvailable();
              }
            });
          });
        })
        .catch((err) => console.warn("SW registration failed:", err));
    };

    if (document.readyState === "complete") {
      registerSw();
    } else {
      window.addEventListener("load", registerSw, { once: true });
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void checkForUpdates();
    }
  };

  const onOnline = () => {
    void checkForUpdates();
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", onOnline);

  const pollTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void checkForUpdates();
    }
  }, UPDATE_POLL_INTERVAL_MS);

  return () => {
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("online", onOnline);
    window.clearInterval(pollTimer);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    }
  };
}
