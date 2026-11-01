/**
 * AUREUS PROTOCOL — Motore di Presenza PWA Standalone (Native Display & Install Engine)
 *
 * Rileva con precisione geometrica lo stato di visualizzazione:
 * - Standalone nativo (iOS WebKit Home Screen, Android Chrome Standalone, Desktop PWA)
 * - Cattura l'evento standard `beforeinstallprompt` per installazione ad 1 tap su Android/Desktop
 * - Rileva ambiente iOS Safari per guidare l'Operatore all'aggiunta su Schermo Home
 */

import { useState, useEffect, useCallback } from "react";
import { synestheticConfirm } from "./soundFx.js";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

export function checkIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  
  // 1. Media query standard display-mode (Android Chrome, Edge, Safari macOS, etc.)
  const isDisplayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isDisplayModeFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;

  // 2. iOS Safari proprietario navigator.standalone
  const isIosStandalone = Boolean(
    (window.navigator as unknown as { standalone?: boolean }).standalone
  );

  return isDisplayModeStandalone || isDisplayModeFullscreen || isIosStandalone;
}

export function checkIsIos(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function usePwaStandalone() {
  const [isStandalone, setIsStandalone] = useState<boolean>(() => checkIsStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState<boolean>(() => checkIsIos());
  const [hasInstalled, setHasInstalled] = useState<boolean>(false);

  useEffect(() => {
    // Aggiorna lo stato standalone quando cambia la media query
    const mq = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches || checkIsStandalone());
    };

    if (mq.addEventListener) {
      mq.addEventListener("change", handleDisplayModeChange);
    }

    // Cattura dell'evento prima dell'installazione per browser compatibili (Chrome, Edge, Samsung Internet)
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Notifica di installazione completata con successo
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setHasInstalled(true);
      setIsStandalone(true);
      try {
        synestheticConfirm();
      } catch {
        // Silenzioso
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handleDisplayModeChange);
      }
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setHasInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [deferredPrompt]);

  return {
    isStandalone,
    isInstallable: Boolean(deferredPrompt),
    isIos,
    hasInstalled,
    promptInstall,
  };
}
