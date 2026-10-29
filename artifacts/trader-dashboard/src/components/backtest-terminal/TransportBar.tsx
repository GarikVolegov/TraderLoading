import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X, Headphones, Dices, Eye, EyeOff } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { formatBlindReplayDisplay, formatUtcReplayTime, parseUtcDateTimeInput, utcDateTimeInput } from "./dateTime";
import { terminalLocale } from "./format";
import { REPLAY_SPEEDS, type ReplayEngine } from "./useReplayEngine";
import { ReplayBioTelemetryHUD } from "./ReplayBioTelemetryHUD";
import {
  isDeepWorkAmbienceActive,
  toggleDeepWorkAmbience,
  subscribeDeepWorkAmbience,
  getDeepWorkAmbienceMode,
  type AmbienceFrequencyMode,
  synestheticClick,
} from "@/lib/soundFx";

export function TransportBar({ engine }: { engine: ReplayEngine }) {
  const { language } = useLanguage();
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const jumpRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const jumpButtonRef = useRef<HTMLButtonElement>(null);

  const [ambienceActive, setAmbienceActive] = useState(() => isDeepWorkAmbienceActive());
  const [ambienceMode, setAmbienceMode] = useState<AmbienceFrequencyMode>(() => getDeepWorkAmbienceMode());

  useEffect(() => {
    return subscribeDeepWorkAmbience((active) => {
      setAmbienceActive(active);
      setAmbienceMode(getDeepWorkAmbienceMode());
    });
  }, []);
  // Warehouse bounds are M1 OPEN times; a candle is observable after its close.
  const firstOpen = engine.meta?.warehouse?.firstTs;
  const lastOpen = engine.meta?.warehouse?.lastTs;
  const minimum = firstOpen != null ? firstOpen + 60 : null;
  const maximum = lastOpen != null ? lastOpen + 60 : null;
  const parsed = parseUtcDateTimeInput(jumpValue);
  // Dates before the archive start snap forward to the first quote instead of being rejected.
  const outsideBounds = parsed != null && maximum != null && parsed > maximum;
  const canJump = parsed != null && !outsideBounds && !engine.loading && !engine.executing;
  const firstYear = minimum != null ? new Date(minimum * 1000).getUTCFullYear() : 2020;
  const lastYear = maximum != null ? new Date(maximum * 1000).getUTCFullYear() : new Date().getUTCFullYear();
  const years = Array.from({ length: Math.max(0, lastYear - firstYear + 1) }, (_, i) => firstYear + i);
  const busy = engine.loading || engine.executing;

  useEffect(() => {
    if (!jumpOpen) return;
    inputRef.current?.focus();
    const close = (event: PointerEvent) => {
      if (!jumpRef.current?.contains(event.target as Node) && !jumpButtonRef.current?.contains(event.target as Node)) setJumpOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setJumpOpen(false);
      jumpButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape, { capture: true });
    };
  }, [jumpOpen]);

  const scrubRafRef = useRef<number | null>(null);
  const handleScrubChange = (fraction: number) => {
    if (scrubRafRef.current != null) {
      cancelAnimationFrame(scrubRafRef.current);
    }
    scrubRafRef.current = requestAnimationFrame(() => {
      scrubRafRef.current = null;
      engine.seekFraction(fraction);
    });
  };

  useEffect(() => {
    return () => {
      if (scrubRafRef.current != null) cancelAnimationFrame(scrubRafRef.current);
    };
  }, []);

  const openJump = () => {
    setJumpValue(utcDateTimeInput(engine.replayTime ?? engine.startTime));
    engine.stop();
    setJumpOpen((open) => !open);
  };

  return (
    <footer className="btm-transport">
      <div className="btm-playback-controls" role="group" aria-label={uiText("backtest_terminal.playback_controls")}>
        <button type="button" className="btm-transport-btn" onClick={engine.restart} disabled={engine.loading || engine.executing}
          title={uiText("backtest_terminal.restart")} aria-label={uiText("backtest_terminal.restart")}><RotateCcw size={17} /></button>
        <button type="button" className="btm-transport-btn" onClick={engine.stepBack} disabled={engine.loading || engine.executing || engine.noData}
          title={uiText("backtest_terminal.step_back")} aria-label={uiText("backtest_terminal.step_back")}><ChevronLeft size={19} /></button>
        <button type="button" className="btm-transport-btn btm-play" onClick={engine.togglePlay} disabled={engine.loading || engine.noData}
          title={uiText(engine.playing ? "backtest_terminal.pause" : "backtest_terminal.play")}
          aria-label={uiText(engine.playing ? "backtest_terminal.pause" : "backtest_terminal.play")}>
          {engine.playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" className="btm-transport-btn" onClick={engine.stepForward} disabled={engine.loading || engine.executing || engine.noData}
          title={uiText("backtest_terminal.step_forward")} aria-label={uiText("backtest_terminal.step_forward")}><ChevronRight size={19} /></button>
      </div>
      <select className="btm-speed-select" value={engine.speed} onChange={(event) => engine.changeSpeed(Number(event.target.value))}
        aria-label={uiText("backtest_terminal.speed")}>
        {REPLAY_SPEEDS.map((value) => <option key={value} value={value}>{value}×</option>)}
      </select>
      <span
        className="btm-simulated-pill"
        title="Importi simulati: il valore del pip segue il modello del replay, senza conversioni valutarie reali."
      >
        SIMULATO
      </span>
      <input className="btm-scrub-input" type="range" min={0} max={1000} step={1}
        value={Math.round(engine.progress * 1000)} disabled={engine.loading || engine.executing || engine.noData}
        onChange={(event) => handleScrubChange(Number(event.target.value) / 1000)}
        aria-label={uiText("backtest_terminal.scrubber")}
        aria-valuetext={`${Math.round(engine.progress * 100)}%`}
        style={{ "--btm-progress": `${engine.progress * 100}%` } as React.CSSProperties} />
      <div className="btm-clock" aria-live="off">
        <span className="btm-clock-time">{engine.replayTime != null ? formatBlindReplayDisplay(engine.replayTime, !engine.blindMasked, terminalLocale(language)) : "—"} {!engine.blindMasked && <span className="btm-timezone">CET</span>}</span>
        <span className="btm-clock-count">{engine.appending || engine.executing ? uiText("backtest_terminal.loading_history") : uiText("backtest_terminal.candle_counter", { current: Math.min(engine.cursor + 1, engine.candles.length), total: engine.candles.length })}</span>
      </div>
      <ReplayBioTelemetryHUD engine={engine} />
      {/* ── SELETTORE AUDIO SINESTETICO BINAURALE & SOLFEGGIO REPLAY ── */}
      <div className="btm-ambience-anchor">
        <button
          type="button"
          onClick={() => {
            synestheticClick();
            if (!ambienceActive) {
              toggleDeepWorkAmbience("432hz");
            } else if (ambienceMode === "432hz") {
              toggleDeepWorkAmbience("528hz");
            } else {
              toggleDeepWorkAmbience();
            }
          }}
          className={`btm-transport-btn btm-ambience-btn ${
            ambienceActive
              ? ambienceMode === "528hz"
                ? "btm-ambience-active btm-ambience-528"
                : "btm-ambience-active btm-ambience-432"
              : ""
          }`}
          title={
            !ambienceActive
              ? "Attiva Audio Frequenziale (Clicca per 432 Hz Calma Aurea)"
              : ambienceMode === "432hz"
              ? "Frequenza Aurea 432 Hz Attiva (Clicca per 528 Hz Solfeggio)"
              : "Frequenza Solfeggio 528 Hz Attiva (Clicca per Silenziare)"
          }
          aria-label="Tappeto Acustico Binaurale Replay"
        >
          <Headphones size={15} />
          <span>
            {ambienceActive ? (ambienceMode === "528hz" ? "528 Hz" : "432 Hz") : "Audio"}
          </span>
        </button>
      </div>
      <div className="btm-jump-anchor">
        <button ref={jumpButtonRef} type="button" className="btm-jump-trigger" onClick={openJump}
          aria-expanded={jumpOpen} aria-controls="btm-date-jump" title={uiText("backtest_terminal.jump_datetime")}>
          <CalendarDays size={16} /><span>{uiText("backtest_terminal.jump_datetime")}</span>
        </button>
        {jumpOpen && <div id="btm-date-jump" ref={jumpRef} className="btm-jump-popover" role="dialog" aria-label={uiText("backtest_terminal.jump_datetime")}>
          <div className="btm-jump-head"><strong>{uiText("backtest_terminal.jump_datetime")}</strong>
            <button type="button" className="btm-iconbtn" onClick={() => setJumpOpen(false)} aria-label={uiText("backtest_terminal.close")}><X size={16} /></button></div>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!canJump || parsed == null) return;
            engine.jumpToTime(minimum != null ? Math.max(parsed, minimum) : parsed);
            setJumpOpen(false);
            jumpButtonRef.current?.focus();
          }}>
            <div className="btm-jump-years" role="group" aria-label="Anno">
              {years.map((year) => (
                <button key={year} type="button" className="btm-year-chip" disabled={busy}
                  onClick={() => { engine.jumpToYear(year); setJumpOpen(false); }}>
                  {engine.blindMasked ? "····" : year}
                </button>
              ))}
            </div>
            <div className="btm-jump-random">
              <button type="button" className="btm-random-btn" disabled={busy}
                onClick={() => { engine.jumpToRandomDate(); setJumpOpen(false); }}>
                <Dices size={14} /><span>Data Casuale</span>
              </button>
              <button type="button" className="btm-random-btn btm-random-blind" disabled={busy}
                onClick={() => { engine.jumpToRandomDate({ blind: true }); setJumpOpen(false); }}>
                <EyeOff size={14} /><span>Casuale Cieca</span>
              </button>
            </div>
            {!engine.blindMasked && <>
            <label className="btm-field" htmlFor="btm-start-time"><span className="btm-field-label">{uiText("backtest_terminal.start_datetime")} · {uiText("backtest_terminal.timezone_utc")}</span>
              <input ref={inputRef} id="btm-start-time" className="btm-datejump" type="datetime-local" step={60} required
                max={utcDateTimeInput(maximum) || undefined}
                value={jumpValue} onChange={(event) => setJumpValue(event.target.value)} aria-invalid={outsideBounds} />
            </label>
            <p className="btm-muted">{uiText("backtest_terminal.jump_utc_hint")}</p>
            {minimum != null && maximum != null && <p className="btm-jump-range">{uiText("backtest_terminal.history_available")}:<br />{formatUtcReplayTime(minimum, terminalLocale(language))} → {formatUtcReplayTime(maximum, terminalLocale(language))} {uiText("backtest_terminal.timezone_utc")}</p>}
            {outsideBounds && <p className="btm-formula-error" role="alert">{uiText("backtest_terminal.date_outside_history")}</p>}
            <button className="btm-primary-btn" type="submit" disabled={!canJump}>{uiText("backtest_terminal.jump_confirm")}</button>
            </>}
          </form>
        </div>}
      </div>
      <button type="button" className={`btm-blind-toggle ${engine.blindMode ? "btm-blind-on" : ""}`}
        onClick={engine.blindMode ? engine.revealBlindPeriod : engine.toggleBlindMode}
        onDoubleClick={engine.blindMode ? engine.toggleBlindMode : undefined}
        title={engine.blindMode ? (engine.blindMasked ? "Svela il periodo (doppio clic: disattiva Replay Cieco)" : "Nascondi di nuovo il periodo (doppio clic: disattiva)") : "Attiva Replay Cieco: data nascosta, zero bias"}
        aria-pressed={engine.blindMode}>
        {engine.blindMasked ? <EyeOff size={15} /> : <Eye size={15} />}
        <span className="whitespace-nowrap">{engine.blindMode ? (engine.blindMasked ? "Svela" : "Celato ✓") : "Cieco"}</span>
      </button>
    </footer>
  );
}
