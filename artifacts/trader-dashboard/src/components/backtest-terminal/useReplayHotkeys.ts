// ─── Terminal hotkeys ────────────────────────────────────────────────────────
// Mockup bindings: Space play/pause, ←/→ step, ↑/↓ speed, B/S buy/sell,
// C close, R restart, +/− zoom, 1..6 timeframe. Skipped while typing in a
// form field or when a dialog is open.
import { useEffect } from "react";
import { REPLAY_TIMEFRAMES, type ReplayEngine } from "./useReplayEngine";

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
          engine.togglePlay();
          return;
        case "ArrowRight":
          event.preventDefault();
          engine.stepForward();
          return;
        case "ArrowLeft":
          event.preventDefault();
          engine.stepBack();
          return;
        case "ArrowUp":
          event.preventDefault();
          engine.bumpSpeed(1);
          return;
        case "ArrowDown":
          event.preventDefault();
          engine.bumpSpeed(-1);
          return;
        case "+":
        case "=":
          event.preventDefault();
          zoomIn();
          return;
        case "-":
          event.preventDefault();
          zoomOut();
          return;
        default:
          break;
      }

      const key = event.key.toLowerCase();
      if (key === "r") {
        engine.restart();
        return;
      }
      if (key === "b") {
        engine.buy();
        return;
      }
      if (key === "s") {
        engine.sell();
        return;
      }
      if (key === "c") {
        engine.closeMarket();
        return;
      }
      const timeframeIndex = Number.parseInt(event.key, 10);
      if (timeframeIndex >= 1 && timeframeIndex <= REPLAY_TIMEFRAMES.length) {
        engine.changeInterval(REPLAY_TIMEFRAMES[timeframeIndex - 1]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, engine, zoomIn, zoomOut]);
}
