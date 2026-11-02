// ─── Terminal hotkeys ────────────────────────────────────────────────────────
// Bindings: Space play/pause, ←/→ step, ↑/↓ speed, B/S market buy/sell,
// C close at market, X cancel pending order, R rewind, +/− zoom, 1..8
// timeframe. Skipped while typing in a form field or when a dialog is open.
import { useEffect } from "react";
import { REPLAY_TIMEFRAMES, type ReplayEngine } from "./useReplayEngine";
import { soundClick } from "@/lib/soundFx";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useReplayHotkeys(
  engine: ReplayEngine,
  options: { enabled: boolean; zoomIn: () => void; zoomOut: () => void },
): void {
  const { enabled, zoomIn, zoomOut } = options;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          soundClick();
          engine.togglePlay();
          return;
        case "ArrowRight":
          event.preventDefault();
          soundClick();
          engine.stepForward();
          return;
        case "ArrowLeft":
          event.preventDefault();
          soundClick();
          engine.stepBack();
          return;
        case "ArrowUp":
          event.preventDefault();
          soundClick();
          engine.bumpSpeed(1);
          return;
        case "ArrowDown":
          event.preventDefault();
          soundClick();
          engine.bumpSpeed(-1);
          return;
        case "+":
        case "=":
          event.preventDefault();
          soundClick();
          zoomIn();
          return;
        case "-":
          event.preventDefault();
          soundClick();
          zoomOut();
          return;
        default:
          break;
      }

      const key = event.key.toLowerCase();
      if (key === "r") {
        soundClick();
        engine.restart();
        return;
      }
      if (key === "b") {
        soundClick();
        engine.buy();
        return;
      }
      if (key === "s") {
        soundClick();
        engine.sell();
        return;
      }
      if (key === "c") {
        soundClick();
        engine.closeMarket();
        return;
      }
      if (key === "x") {
        soundClick();
        engine.cancelOrder();
        return;
      }
      const timeframeIndex = Number.parseInt(event.key, 10);
      if (timeframeIndex >= 1 && timeframeIndex <= REPLAY_TIMEFRAMES.length) {
        soundClick();
        engine.changeInterval(REPLAY_TIMEFRAMES[timeframeIndex - 1]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, engine, zoomIn, zoomOut]);
}
