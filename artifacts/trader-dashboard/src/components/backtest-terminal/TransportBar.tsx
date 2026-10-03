// ─── Replay transport bar ────────────────────────────────────────────────────
// Mockup layout: restart · step-back · play/pause · step-forward, speed group
// (0.25×–4×), draggable scrubber, clock + candle counter, date-jump input.
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { formatBarTime } from "./format";
import { REPLAY_SPEEDS, type ReplayEngine } from "./useReplayEngine";

export function TransportBar({ engine }: { engine: ReplayEngine }) {
  const { language } = useLanguage();
  const scrubRef = useRef<HTMLDivElement>(null);

  const onScrubPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const bar = scrubRef.current;
    if (!bar) return;
    bar.setPointerCapture(event.pointerId);
    const seek = (clientX: number) => {
      const rect = bar.getBoundingClientRect();
      engine.seekFraction((clientX - rect.left) / rect.width);
    };
    seek(event.clientX);
    const onMove = (moveEvent: PointerEvent) => seek(moveEvent.clientX);
    const onUp = () => {
      bar.removeEventListener("pointermove", onMove);
      bar.removeEventListener("pointerup", onUp);
    };
    bar.addEventListener("pointermove", onMove);
    bar.addEventListener("pointerup", onUp);
  };

  const progressPct = `${(engine.progress * 100).toFixed(2)}%`;
  const dateBounds = (() => {
    const first = engine.meta?.warehouse?.firstTs;
    const min = first != null ? new Date(first * 1000).toISOString().slice(0, 10) : undefined;
    const max = new Date().toISOString().slice(0, 10);
    return { min, max };
  })();

  return (
    <footer className="btm-transport">
      <button
        type="button"
        className="btm-transport-btn"
        onClick={engine.restart}
        title={uiText("backtest_terminal.restart")}
        aria-label={uiText("backtest_terminal.restart")}
      >
        <RotateCcw size={15} />
      </button>
      <button
        type="button"
        className="btm-transport-btn"
        onClick={engine.stepBack}
        title={uiText("backtest_terminal.step_back")}
        aria-label={uiText("backtest_terminal.step_back")}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        className="btm-transport-btn btm-play"
        onClick={engine.togglePlay}
        title={uiText(engine.playing ? "backtest_terminal.pause" : "backtest_terminal.play")}
        aria-label={uiText(engine.playing ? "backtest_terminal.pause" : "backtest_terminal.play")}
      >
        {engine.playing ? <Pause size={17} /> : <Play size={17} />}
      </button>
      <button
        type="button"
        className="btm-transport-btn"
        onClick={engine.stepForward}
        title={uiText("backtest_terminal.step_forward")}
        aria-label={uiText("backtest_terminal.step_forward")}
      >
        <ChevronRight size={16} />
      </button>

      <div className="btm-speedgroup" role="group" aria-label={uiText("backtest_terminal.speed")}>
        {REPLAY_SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            className="btm-speedbtn"
            data-active={engine.speed === value}
            onClick={() => engine.changeSpeed(value)}
          >
            {value}×
          </button>
        ))}
      </div>

      <div
        ref={scrubRef}
        className="btm-scrub"
        onPointerDown={onScrubPointerDown}
        role="slider"
        aria-label={uiText("backtest_terminal.scrubber")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(engine.progress * 100)}
        tabIndex={-1}
      >
        <div className="btm-scrub-fill" style={{ width: progressPct }} />
        <div className="btm-scrub-head" style={{ left: progressPct }} />
      </div>

      <div className="btm-clock">
        <span className="btm-clock-time">
          {engine.currentBar
            ? formatBarTime(engine.currentBar.time, engine.intervalSeconds, language)
            : "—"}
        </span>
        <span className="btm-clock-count">
          {uiText("backtest_terminal.candle_counter", {
            current: Math.min(engine.cursor + 1, engine.candles.length),
            total: engine.candles.length,
          })}
        </span>
      </div>

      <input
        type="date"
        className="btm-datejump"
        min={dateBounds.min}
        max={dateBounds.max}
        value={engine.startDate ?? ""}
        onChange={(event) => engine.jumpToDate(event.target.value)}
        title={uiText("backtest_terminal.jump_date")}
        aria-label={uiText("backtest_terminal.jump_date")}
      />
    </footer>
  );
}
