import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ShieldCheck,
  ZoomIn,
} from "lucide-react";
import {
  cockpitContextReady,
  cockpitDay,
  cockpitRequirements,
  cockpitTriggers,
  cockpitWindow,
  type CockpitAnalysis,
} from "../../../../../contracts/cockpit";
import { getCockpitSchematic, type CockpitSchematic } from "@/lib/cockpitSchematics";
import { ReferenceSchemaSvg } from "./CockpitVisualChoice";
import { synestheticClick } from "@/lib/soundFx";

export interface ImminentNewsInfo {
  title: string;
  country: string;
  time: number;
  countdownMin: number;
}

export interface CockpitMobileVerdict {
  state: "default" | "green" | "amber" | "red";
  signal: "⌁" | "✓" | "!" | "✕";
  eyebrow: string;
  title: string;
  detail: string;
}

export function computeMobileCopilotVerdict(
  a: CockpitAnalysis,
  tfs: string[],
  isConfirmed: boolean,
  limitReached: boolean,
  mgmtChecks: { be: boolean; tp1: boolean; congestion: boolean; invalidation: boolean },
  now: Date,
): CockpitMobileVerdict {
  const missing = cockpitRequirements(a, now);

  if (limitReached) {
    return {
      state: "red",
      signal: "✕",
      eyebrow: "CIRCUIT BREAKER",
      title: "STOP OPERATIVITÀ PER OGGI",
      detail: "Raggiunto il limite di protezione giornaliera (Custode della Soglia). Chiudi i grafici.",
    };
  }

  if (a.context === "compression") {
    return {
      state: "red",
      signal: "✕",
      eyebrow: "NO TRADE / COMPRESSIONE",
      title: "MERCATO IN COMPRESSIONE",
      detail: "Liquidità sopra e sotto: attendi prima lo sweep certificato di un estremo.",
    };
  }

  if (isConfirmed) {
    if (mgmtChecks.invalidation) {
      return {
        state: "red",
        signal: "✕",
        eyebrow: "USCITA OBBLIGATORIA",
        title: "CHIUDI O GESTISCI SUBITO",
        detail: "Schematica contraria o violazione strutturale: il motivo d'ingresso non è più valido.",
      };
    }
    if (mgmtChecks.congestion) {
      return {
        state: "amber",
        signal: "!",
        eyebrow: "GESTIONE ATTIVA",
        title: "CONGESTIONE SUL LIVELLO",
        detail: "Riduci il rischio (Break-Even / parziale) o chiudi la posizione se la spinta si esaurisce.",
      };
    }
    return {
      state: "green",
      signal: "✓",
      eyebrow: "POSITION MONITOR",
      title: `${a.market} · ${a.trigger || "IN CORSO"} ATTIVO`,
      detail: "Difendi il capitale: il mercato deve reagire con spinta entro le prime 3 candele M1.",
    };
  }

  if (!cockpitContextReady(a)) {
    return {
      state: "default",
      signal: "⌁",
      eyebrow: "CONTEXT FIRST",
      title: `DEFINISCI DOVE SIAMO (${tfs[0]})`,
      detail: `Identifica il ciclo ${tfs[0]} e verifica che la liquidità sia stata presa.`,
    };
  }

  if (!a.scenario) {
    return {
      state: "default",
      signal: "⌁",
      eyebrow: "ZONE ROUTER",
      title: "CONTROLLA COSA HA PRESO A SINISTRA",
      detail: "Solo liquidità, zona valida o box intermedi determinano l'unico scenario ammesso.",
    };
  }

  if (!a.itfSchema || !a.ltfSchema || !a.trigger) {
    return {
      state: "amber",
      signal: "!",
      eyebrow: "ATTENDI SCHEMATICA",
      title: `CONFERMA ${tfs[1]} + ${tfs[2]} + TRIGGER`,
      detail: `Non anticipare la zona: servono chiusura del ciclo ${tfs[1]} e trigger ${tfs[2]}.`,
    };
  }

  if (!a.area) {
    return {
      state: "amber",
      signal: "!",
      eyebrow: "CONTROLLO AREA VERGINE",
      title: "VERIFICA LO STORICO A SINISTRA",
      detail: "Distingui tra area con storico e area vergine prima di validare il target.",
    };
  }

  if (a.area === "virgin" && !a.imbalance) {
    return {
      state: "red",
      signal: "✕",
      eyebrow: "FILTRO 10%",
      title: "AREA VERGINE SENZA SBILANCIAMENTO",
      detail: "In area vergine senza sbilanciamento ≥ 10% non si entra.",
    };
  }

  if (!a.targetConfirmed || !a.target.trim()) {
    return {
      state: "amber",
      signal: "!",
      eyebrow: "TARGET LIQUIDITY",
      title: "DEFINISCI E CONFERMA IL POOL OPPOSTO",
      detail: "Scrivi il livello/pool target e accendi la conferma del quarto LED.",
    };
  }

  if (missing.length > 0) {
    return {
      state: "amber",
      signal: "!",
      eyebrow: "EXECUTION CHECK",
      title: "MANCA CONFERMA DI CONTESTO",
      detail: `Completa: ${missing.join(" · ")}.`,
    };
  }

  const scenarioLabel =
    a.scenario === "valid_zone"
      ? "Inversione da zona HTF"
      : a.scenario === "no_zone"
      ? "Continuazione post-sweep"
      : "Re-accumuli / box intermedi";

  return {
    state: "green",
    signal: "✓",
    eyebrow: "GO TRADE / 4 DOMANDE VALIDATE",
    title: `${a.market} · ${a.trigger} AUTORIZZATO`,
    detail: `${scenarioLabel} verso ${a.target}. Rischio sotto controllo.`,
  };
}

interface CockpitMobileCopilotFlowProps {
  analysis: CockpitAnalysis;
  setAnalysis: (patch: Partial<CockpitAnalysis>) => void;
  phase: 1 | 2 | 3 | 4;
  onSelectPhase: (p: 1 | 2 | 3 | 4) => void;
  tfs: string[];
  isConfirmed: boolean;
  limitReached: boolean;
  tradesToday: number;
  maxTrades: number;
  evidenceCount: number;
  plansCount: number;
  imminentRedNews: ImminentNewsInfo | null;
  localEntry: string;
  localStop: string;
  localRisk: string;
  onEntryChange: (val: string) => void;
  onStopChange: (val: string) => void;
  onRiskChange: (val: string) => void;
  mgmtChecks: { be: boolean; tp1: boolean; congestion: boolean; invalidation: boolean };
  onUpdateMgmtCheck: (key: "be" | "tp1" | "congestion" | "invalidation", val: boolean) => void;
  mgmtNote: string;
  onUpdateMgmtNote: (val: string) => void;
  onSelectMode: (mode: "scalp" | "swing") => void;
  onOpenDialog: (
    d:
      | "protection"
      | "news"
      | "examples"
      | "next_session_plan"
      | "operative_plan"
      | "broker_hub"
      | null,
  ) => void;
  onOpenJournal: () => void;
  onOpenTradeRegister: () => void;
  onConfirmOpenPosition: () => void;
  onResetSetup: () => void;
  onInspectSchematic: (s: CockpitSchematic) => void;
  onSwitchToChart: (tf?: string) => void;
  onExportMt5Setup: () => void;
}

const CYCLE_OPTIONS: Array<{
  id: NonNullable<CockpitAnalysis["cycle"]>;
  label: string;
  schematicId: string;
}> = [
  { id: "up", label: "Impulso / ciclo rialzista", schematicId: "cycle_up" },
  { id: "down", label: "Impulso / ciclo ribassista", schematicId: "cycle_down" },
  { id: "end_up", label: "Fine ciclo rialzista", schematicId: "end_up" },
  { id: "end_down", label: "Fine ciclo ribassista", schematicId: "end_down" },
];

const LIQUIDITY_OPTIONS: Array<{
  id: "compression" | "swept" | "intermediate";
  title: string;
  desc: string;
  icon: string;
  schematicId: string;
}> = [
  {
    id: "compression",
    title: "Liquidità sopra e sotto",
    desc: "Compressione attiva. Nessun ingresso.",
    icon: "compression",
    schematicId: "compression",
  },
  {
    id: "swept",
    title: "Liquidity swept",
    desc: "Caccia avvenuta e verificata sul grafico.",
    icon: "sweep",
    schematicId: "sweep",
  },
  {
    id: "intermediate",
    title: "Zona estrema non raggiunta (Re-accumuli in corso)",
    desc: "Box intermedi confermati: prosegui solo sul percorso Re-accumuli.",
    icon: "boxes",
    schematicId: "intermediate",
  },
];

const SCENARIO_OPTIONS: Array<{
  id: "no_zone" | "valid_zone" | "reaccum";
  title: string;
  desc: string;
  icon: string;
  schematicId: string;
}> = [
  {
    id: "no_zone",
    title: "Solo liquidità",
    desc: "Nessuna zona HTF: inversione vietata, solo BTI o JTC.",
    icon: "liquidity",
    schematicId: "no_zone",
  },
  {
    id: "valid_zone",
    title: "Zona HTF toccata e mitigata",
    desc: "Autorizza la ricerca d'inversione dopo la schematica ITF.",
    icon: "zone",
    schematicId: "valid_zone",
  },
  {
    id: "reaccum",
    title: "Re-accumuli / ri-distribuzioni",
    desc: "Box intermedi: esclusivamente JTC verso la zona opposta.",
    icon: "boxes",
    schematicId: "reaccum",
  },
];

export function CockpitMobileCopilotFlow({
  analysis: a,
  setAnalysis: set,
  phase,
  onSelectPhase,
  tfs,
  isConfirmed,
  limitReached,
  tradesToday,
  maxTrades,
  evidenceCount,
  plansCount,
  imminentRedNews,
  localEntry,
  localStop,
  localRisk,
  onEntryChange,
  onStopChange,
  onRiskChange,
  mgmtChecks,
  onUpdateMgmtCheck,
  mgmtNote,
  onUpdateMgmtNote,
  onSelectMode,
  onOpenDialog,
  onOpenJournal,
  onOpenTradeRegister,
  onConfirmOpenPosition,
  onResetSetup,
  onInspectSchematic,
  onSwitchToChart,
  onExportMt5Setup,
}: CockpitMobileCopilotFlowProps) {
  // Live 1-second Rome clock + 3-minute M1 reactivity countdown
  const [tickNow, setTickNow] = useState<Date>(() => new Date());
  const [openedAtMs, setOpenedAtMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`tl_cockpit_opened_at_${a.market}`);
      return saved ? Number(saved) : Date.now();
    } catch {
      return Date.now();
    }
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setTickNow(new Date());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (isConfirmed) {
      try {
        const key = `tl_cockpit_opened_at_${a.market}`;
        const existing = localStorage.getItem(key);
        if (existing) {
          setOpenedAtMs(Number(existing));
        } else {
          const ts = Date.now();
          localStorage.setItem(key, String(ts));
          setOpenedAtMs(ts);
        }
      } catch {
        setOpenedAtMs(Date.now());
      }
    }
  }, [isConfirmed, a.market]);

  const romeClockStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("it-IT", {
        timeZone: "Europe/Rome",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(tickNow);
    } catch {
      return tickNow.toLocaleTimeString("it-IT", { hour12: false });
    }
  }, [tickNow]);

  const win = useMemo(() => cockpitWindow(a, tickNow), [a, tickNow]);
  const verdict = useMemo(
    () => computeMobileCopilotVerdict(a, tfs, isConfirmed, limitReached, mgmtChecks, tickNow),
    [a, tfs, isConfirmed, limitReached, mgmtChecks, tickNow],
  );

  const isNewsVerified = a.news === "clear" || a.news === "post";

  // 4 LEDs state ("Le quattro domande")
  const led1Lit = cockpitContextReady(a);
  const led2Lit = Boolean(a.scenario);
  const led3Lit = Boolean(a.itfSchema && a.ltfSchema && a.trigger);
  const led4Lit = Boolean(
    a.targetConfirmed && a.target.trim().length > 0 && (a.area !== "virgin" || a.imbalance),
  );

  // Accordion state: current phase is open by default, user can also expand/collapse completed phases
  const [manualOpenPhase, setManualOpenPhase] = useState<number | null>(null);
  useEffect(() => {
    setManualOpenPhase(null);
  }, [phase, isConfirmed]);

  const activeAccordionPhase = manualOpenPhase ?? (isConfirmed ? 4 : phase);

  // 3-minute M1 energy timer in Phase 4
  const elapsedSec = Math.max(0, Math.floor((tickNow.getTime() - openedAtMs) / 1000));
  const remainSec = Math.max(0, 180 - elapsedSec);
  const energyPct = mgmtChecks.be ? 100 : Math.round((remainSec / 180) * 100);
  const energyTimerLabel = mgmtChecks.be
    ? "CONFERMATA"
    : remainSec > 0
    ? `${String(Math.floor(remainSec / 60)).padStart(2, "0")}:${String(remainSec % 60).padStart(2, "0")}`
    : "SCADUTA";

  // Summaries for collapsed phase headers
  const cycleLabelMap: Record<string, string> = {
    up: "Ciclo ↑",
    down: "Ciclo ↓",
    end_up: "Fine ↑",
    end_down: "Fine ↓",
  };
  const contextLabelMap: Record<string, string> = {
    swept: "Sweep ✓",
    compression: "Compressione",
    intermediate: "Re-accumuli",
  };
  const scenarioLabelMap: Record<string, string> = {
    no_zone: "Solo liquidità",
    valid_zone: "Zona HTF valida",
    reaccum: "Re-accumuli",
  };

  const p1Summary =
    a.cycle || a.context
      ? [a.cycle ? cycleLabelMap[a.cycle] : null, a.context ? contextLabelMap[a.context] : null]
          .filter(Boolean)
          .join(" · ")
      : `Contesto ${tfs[0]}`;

  const p2Summary = a.scenario ? scenarioLabelMap[a.scenario] : "Cosa ha preso a sinistra?";
  const p3Summary = a.trigger
    ? `${a.trigger}${a.target ? ` → ${a.target}` : ""}`
    : "Conferma & Target";
  const p4Summary = isConfirmed ? `${a.market} · Gestione attiva` : "Gestione posizione";

  const triggersAllowed = cockpitTriggers(a);

  const handleInspectById = (schematicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const s = getCockpitSchematic(schematicId);
    if (s) onInspectSchematic(s);
  };

  const windowBadgeText =
    win.kind === "open"
      ? "FINESTRA ATTIVA"
      : win.kind === "asia"
      ? "FINESTRA SECONDARIA"
      : win.kind === "lunch"
      ? "PAUSA PRANZO"
      : win.kind === "analysis"
      ? "ANALISI"
      : "SESSIONE CHIUSA";

  return (
    <div className="ck-ref-mobile-shell" data-testid="cockpit-mobile-copilot-flow">
      {/* 1. SESSION & WINDOW STRIP (Struttura Trading Copilot Pro) */}
      <div className="ck-ref-top-bar">
        <div className="ck-ref-session-strip">
          <div className="ck-ref-mode-switch" role="group" aria-label="Modalità operativa">
            <button
              type="button"
              className={a.mode === "scalp" ? "active" : ""}
              onClick={() => onSelectMode("scalp")}
            >
              SCALPING
            </button>
            <button
              type="button"
              className={a.mode === "swing" ? "active" : ""}
              onClick={() => onSelectMode("swing")}
            >
              SWING
            </button>
          </div>
          <div className="ck-ref-session-clock">
            <span className="ck-ref-session-name">{win.name}</span>
            <time className="ck-ref-clock whitespace-nowrap">{romeClockStr}</time>
          </div>
        </div>

        <div className="ck-ref-window-strip">
          <div className="ck-ref-window-left">
            <span className="ck-ref-window-range whitespace-nowrap">{win.hours}</span>
            <span
              className={`ck-ref-window-badge whitespace-nowrap ${
                win.kind === "open"
                  ? "is-green"
                  : win.kind === "asia" || win.kind === "lunch"
                  ? "is-amber"
                  : "is-muted"
              }`}
            >
              {windowBadgeText}
            </span>
          </div>
          <div className="ck-ref-window-actions">
            <button
              type="button"
              className="ck-ref-pill-btn whitespace-nowrap"
              onClick={() => {
                synestheticClick();
                onOpenDialog("broker_hub");
              }}
            >
              MT5
            </button>
            <button
              type="button"
              className="ck-ref-pill-btn whitespace-nowrap"
              onClick={() => {
                synestheticClick();
                onOpenDialog("next_session_plan");
              }}
            >
              <span>Piano</span>
              {plansCount > 0 && <span className="ck-ref-pill-count">{plansCount}</span>}
            </button>
            <button
              type="button"
              className={`ck-ref-pill-btn whitespace-nowrap ${
                isNewsVerified ? "is-verified" : "is-warn"
              }`}
              onClick={() => {
                synestheticClick();
                onOpenDialog("news");
              }}
            >
              {isNewsVerified ? "NEWS VERIFICATE" : "NEWS DA VERIFICARE"}
            </button>
          </div>
        </div>

        {/* 2. DAILY NEWS CARD (#dailyNewsCard) */}
        <button
          type="button"
          onClick={() => {
            synestheticClick();
            onOpenDialog("news");
          }}
          className={`ck-ref-daily-news ${
            imminentRedNews && Math.abs(imminentRedNews.countdownMin) <= 15
              ? "is-danger"
              : imminentRedNews
              ? "is-warning"
              : isNewsVerified
              ? "is-clear"
              : ""
          }`}
        >
          <div className="ck-ref-daily-news-main">
            <span className="ck-ref-eyebrow">NEWS DI OGGI · CALENDARIO ECONOMICO</span>
            <strong>
              {imminentRedNews
                ? `${imminentRedNews.country} · ${imminentRedNews.title}`
                : isNewsVerified
                ? "Finestra macro verificata · Nessun blocco attivo"
                : "Controlla gli eventi ad alto impatto di oggi"}
            </strong>
            <span>Orari italiani · fonte verificabile · tocca per aprire</span>
          </div>
          <div className="ck-ref-news-timing">
            <small>
              {imminentRedNews
                ? imminentRedNews.countdownMin >= 0
                  ? "ALLA NEWS"
                  : "POST-NEWS"
                : "STATO"}
            </small>
            <strong className="whitespace-nowrap">
              {imminentRedNews
                ? imminentRedNews.countdownMin >= 0
                  ? `-${imminentRedNews.countdownMin}m`
                  : `+${Math.abs(imminentRedNews.countdownMin)}m`
                : isNewsVerified
                ? "OK ✓"
                : "VERIFICA"}
            </strong>
          </div>
        </button>

        {/* 3. GUARD STRIP (.guard-strip + #lossDots) */}
        <div
          className="ck-ref-guard-strip"
          role="button"
          tabIndex={0}
          onClick={() => {
            synestheticClick();
            onOpenDialog("protection");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenDialog("protection");
            }
          }}
        >
          <div className="ck-ref-guard-left">
            <span
              className={`ck-ref-status-dot ${
                limitReached
                  ? "is-red"
                  : isConfirmed
                  ? "is-amber"
                  : "is-green"
              }`}
            />
            <span>
              {limitReached
                ? "CIRCUIT BREAKER ATTIVO"
                : isConfirmed
                ? "GESTIONE POSIZIONE ATTIVA"
                : "SESSIONE ATTIVA · CUSTODE VIGILE"}
            </span>
          </div>
          <div className="ck-ref-guard-right">
            <div className="ck-ref-loss-dots" aria-label="Contatore Stop / Operazioni">
              {Array.from({ length: Math.max(2, maxTrades) }).map((_, idx) => (
                <span
                  key={idx}
                  className={`ck-ref-loss-dot ${idx < tradesToday ? "hit" : ""}`}
                />
              ))}
            </div>
            <span className="whitespace-nowrap">
              {tradesToday} / {maxTrades} SL
            </span>
          </div>
        </div>
      </div>

      {/* 4. FOUR QUESTIONS LED BAR (nav.leds — "Le quattro domande") */}
      <nav className="ck-ref-leds" aria-label="Le quattro domande">
        <button
          type="button"
          onClick={() => {
            synestheticClick();
            onSelectPhase(1);
            setManualOpenPhase(1);
          }}
          className={`ck-ref-led p1 ${led1Lit ? "lit" : ""} ${
            activeAccordionPhase === 1 ? "active" : ""
          }`}
        >
          <div className="ck-ref-led-top">
            <span className="ck-ref-led-num">01 / DOVE</span>
            <span className="ck-ref-led-bulb" />
          </div>
          <span className="ck-ref-led-name">Ciclo grande</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!led1Lit) return;
            synestheticClick();
            onSelectPhase(2);
            setManualOpenPhase(2);
          }}
          className={`ck-ref-led p2 ${led2Lit ? "lit" : ""} ${
            activeAccordionPhase === 2 ? "active" : ""
          }`}
        >
          <div className="ck-ref-led-top">
            <span className="ck-ref-led-num">02 / SINISTRA</span>
            <span className="ck-ref-led-bulb" />
          </div>
          <span className="ck-ref-led-name">Zona HTF</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!led2Lit) return;
            synestheticClick();
            onSelectPhase(3);
            setManualOpenPhase(3);
          }}
          className={`ck-ref-led p3 ${led3Lit ? "lit" : ""} ${
            activeAccordionPhase === 3 ? "active" : ""
          }`}
        >
          <div className="ck-ref-led-top">
            <span className="ck-ref-led-num">03 / COME</span>
            <span className="ck-ref-led-bulb" />
          </div>
          <span className="ck-ref-led-name">Ciclo piccolo</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!led2Lit && !isConfirmed) return;
            synestheticClick();
            onSelectPhase(isConfirmed ? 4 : 3);
            setManualOpenPhase(isConfirmed ? 4 : 3);
          }}
          className={`ck-ref-led p4 ${led4Lit ? "lit" : ""} ${
            activeAccordionPhase === 4 ? "active" : ""
          }`}
        >
          <div className="ck-ref-led-top">
            <span className="ck-ref-led-num">04 / TARGET</span>
            <span className="ck-ref-led-bulb" />
          </div>
          <span className="ck-ref-led-name">Liquidità</span>
        </button>
      </nav>

      {/* 5. DYNAMIC VERDICT BANNER (section.verdict) */}
      <section
        className={`ck-ref-verdict ${
          verdict.state !== "default" ? `is-${verdict.state}` : ""
        }`}
        aria-live="polite"
      >
        <div className="ck-ref-verdict-signal">{verdict.signal}</div>
        <div className="ck-ref-verdict-body">
          <div className="ck-ref-verdict-eyebrow">{verdict.eyebrow}</div>
          <h2 className="ck-ref-verdict-title">{verdict.title}</h2>
          <p className="ck-ref-verdict-detail">{verdict.detail}</p>
        </div>
      </section>

      {/* 6. WORKSPACE HEADER & 4-PHASE ACCORDION WIZARD (.workspace + #wizard) */}
      <div className="ck-ref-workspace">
        <div className="ck-ref-workspace-header">
          <span className="ck-ref-eyebrow">
            {isConfirmed ? "POSITION MANAGEMENT" : "PERCORSO OPERATIVO"}
          </span>
          <div className="ck-ref-workspace-actions">
            <button
              type="button"
              className="ck-ref-pill-btn"
              onClick={() => {
                synestheticClick();
                onOpenDialog("examples");
              }}
            >
              Esempi
            </button>
            <button
              type="button"
              className="ck-ref-pill-btn"
              onClick={() => {
                synestheticClick();
                onResetSetup();
              }}
            >
              Nuovo setup ↻
            </button>
          </div>
        </div>

        <div className="ck-ref-wizard">
          {/* ── FASE 01: DOVE SIAMO NEL CICLO GRANDE ── */}
          {(() => {
            const isOpen = activeAccordionPhase === 1;
            return (
              <section className={`ck-ref-phase p1 ${isOpen ? "current" : ""}`}>
                <header
                  className="ck-ref-phase-header"
                  onClick={() => {
                    synestheticClick();
                    onSelectPhase(1);
                    setManualOpenPhase(isOpen ? 0 : 1);
                  }}
                >
                  <div className="ck-ref-phase-title">
                    <span className="ck-ref-step-num">01</span>
                    <strong className="ck-ref-phase-summary">{p1Summary}</strong>
                    <span className="ck-ref-tf whitespace-nowrap">{tfs[0]}</span>
                  </div>
                  <span className="ck-ref-chev">{isOpen ? "−" : "+"}</span>
                </header>

                {isOpen && (
                  <div className="ck-ref-phase-body">
                    <div>
                      <span className="ck-ref-label">
                        Dove ci troviamo nel ciclo {tfs[0]}?
                      </span>
                      <div className="ck-ref-cycle-grid">
                        {CYCLE_OPTIONS.map((c) => {
                          const selected = a.cycle === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              disabled={isConfirmed}
                              onClick={() => {
                                synestheticClick();
                                set({ cycle: c.id });
                              }}
                              className={`ck-ref-chip-btn ${selected ? "selected" : ""}`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <ReferenceSchemaSvg
                                  kind={c.schematicId}
                                  className="w-7 h-5 text-[#E8C56A] shrink-0"
                                />
                                <span
                                  role="button"
                                  data-touch-size="custom"
                                  tabIndex={-1}
                                  title="Ingrandisci schema"
                                  onClick={(e) => handleInspectById(c.schematicId, e)}
                                  className="p-1 rounded bg-black/50 text-[#C5A059] hover:text-[#E8C56A]"
                                >
                                  <ZoomIn size={11} />
                                </span>
                              </div>
                              <span className="block mt-1 text-left leading-tight">
                                {c.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="ck-ref-label">Condizione della liquidità</span>
                      <div className="ck-ref-option-list">
                        {LIQUIDITY_OPTIONS.map((opt) => {
                          const selected = a.context === opt.id;
                          return (
                            <div
                              key={opt.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (isConfirmed) return;
                                synestheticClick();
                                set({ context: opt.id });
                                if (a.cycle && (opt.id === "swept" || opt.id === "intermediate")) {
                                  setManualOpenPhase(2);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (!isConfirmed) set({ context: opt.id });
                                }
                              }}
                              className={`ck-ref-option ${selected ? "selected" : ""}`}
                            >
                              <div
                                className="ck-ref-option-schema"
                                onClick={(e) => handleInspectById(opt.schematicId, e)}
                                title="Tocca per ingrandire lo schema"
                              >
                                <ReferenceSchemaSvg kind={opt.icon} />
                              </div>
                              <div className="ck-ref-option-text">
                                <strong>{opt.title}</strong>
                                <span>{opt.desc}</span>
                              </div>
                              <div className="ck-ref-option-check">
                                {selected && <Check size={12} strokeWidth={3} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onSwitchToChart(tfs[0])}
                        className="ck-ref-pill-btn flex-1 justify-center py-2"
                      >
                        Ispeziona Grafico {tfs[0]} →
                      </button>
                      {led1Lit && (
                        <button
                          type="button"
                          onClick={() => {
                            synestheticClick();
                            onSelectPhase(2);
                            setManualOpenPhase(2);
                          }}
                          className="ck-ref-pill-btn is-verified flex-1 justify-center py-2"
                        >
                          Fase 02 · Sinistra →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })()}

          {/* ── FASE 02: COSA HA PRESO A SINISTRA (ZONE ROUTER) ── */}
          {(() => {
            const isLocked = !led1Lit && !isConfirmed;
            const isOpen = !isLocked && activeAccordionPhase === 2;
            return (
              <section
                className={`ck-ref-phase p2 ${isOpen ? "current" : ""} ${
                  isLocked ? "locked" : ""
                }`}
              >
                <header
                  className="ck-ref-phase-header"
                  onClick={() => {
                    if (isLocked) return;
                    synestheticClick();
                    onSelectPhase(2);
                    setManualOpenPhase(isOpen ? 0 : 2);
                  }}
                >
                  <div className="ck-ref-phase-title">
                    <span className="ck-ref-step-num">02</span>
                    <strong className="ck-ref-phase-summary">{p2Summary}</strong>
                    <span className="ck-ref-tf whitespace-nowrap">{tfs[1]}</span>
                  </div>
                  <span className="ck-ref-chev">
                    {isLocked ? "⌑" : isOpen ? "−" : "+"}
                  </span>
                </header>

                {isOpen && (
                  <div className="ck-ref-phase-body">
                    {a.context === "intermediate" && (
                      <div className="ck-ref-callout">
                        Hai indicato che la zona estrema non è ancora stata raggiunta:
                        l'unico percorso coerente è <strong>Re-accumuli / ri-distribuzioni</strong>.
                      </div>
                    )}

                    <div className="ck-ref-option-list">
                      {SCENARIO_OPTIONS.map((opt) => {
                        const selected = a.scenario === opt.id;
                        const disabled =
                          isConfirmed ||
                          (a.context === "intermediate" && opt.id !== "reaccum");
                        return (
                          <div
                            key={opt.id}
                            role="button"
                            tabIndex={disabled ? -1 : 0}
                            onClick={() => {
                              if (disabled) return;
                              synestheticClick();
                              set({ scenario: opt.id });
                              setManualOpenPhase(3);
                            }}
                            onKeyDown={(e) => {
                              if (!disabled && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                set({ scenario: opt.id });
                                setManualOpenPhase(3);
                              }
                            }}
                            className={`ck-ref-option ${selected ? "selected" : ""} ${
                              disabled ? "is-disabled" : ""
                            }`}
                          >
                            <div
                              className="ck-ref-option-schema"
                              onClick={(e) => handleInspectById(opt.schematicId, e)}
                              title="Tocca per ingrandire lo schema"
                            >
                              <ReferenceSchemaSvg kind={opt.icon} />
                            </div>
                            <div className="ck-ref-option-text">
                              <strong>{opt.title}</strong>
                              <span>{opt.desc}</span>
                            </div>
                            <div className="ck-ref-option-check">
                              {selected && <Check size={12} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onSwitchToChart(tfs[1])}
                        className="ck-ref-pill-btn flex-1 justify-center py-2"
                      >
                        Ispeziona Grafico {tfs[1]} →
                      </button>
                      {led2Lit && (
                        <button
                          type="button"
                          onClick={() => {
                            synestheticClick();
                            onSelectPhase(3);
                            setManualOpenPhase(3);
                          }}
                          className="ck-ref-pill-btn is-verified flex-1 justify-center py-2"
                        >
                          Fase 03 · Come &amp; Target →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })()}

          {/* ── FASE 03: COME CI ARRIVA & DOVE SONO I SOLDI ── */}
          {(() => {
            const isLocked = (!led1Lit || !led2Lit) && !isConfirmed;
            const isOpen = !isLocked && activeAccordionPhase === 3;
            return (
              <section
                className={`ck-ref-phase p3 ${isOpen ? "current" : ""} ${
                  isLocked ? "locked" : ""
                }`}
              >
                <header
                  className="ck-ref-phase-header"
                  onClick={() => {
                    if (isLocked) return;
                    synestheticClick();
                    onSelectPhase(3);
                    setManualOpenPhase(isOpen ? 0 : 3);
                  }}
                >
                  <div className="ck-ref-phase-title">
                    <span className="ck-ref-step-num">03</span>
                    <strong className="ck-ref-phase-summary">{p3Summary}</strong>
                    <span className="ck-ref-tf whitespace-nowrap">{tfs[2]}</span>
                  </div>
                  <span className="ck-ref-chev">
                    {isLocked ? "⌑" : isOpen ? "−" : "+"}
                  </span>
                </header>

                {isOpen && (
                  <div className="ck-ref-phase-body">
                    {a.scenario && a.scenario !== "valid_zone" && (
                      <div className="ck-ref-callout">
                        {a.scenario === "no_zone"
                          ? "Solo liquidità a sinistra: non cercare l'inversione. Attendi che il prezzo mostri la direzione e usa solo BTI o JTC."
                          : "Struttura a box intermedi: segui il flusso fino alla zona opposta esclusivamente con JTC."}
                      </div>
                    )}

                    {/* Switch 1: Ciclo ITF chiuso & schematica confermata */}
                    <button
                      type="button"
                      disabled={isConfirmed}
                      onClick={() => {
                        synestheticClick();
                        set({ itfSchema: !a.itfSchema });
                      }}
                      className={`ck-ref-switch-row ${a.itfSchema ? "on" : ""}`}
                    >
                      <div className="ck-ref-switch-text">
                        <strong>Ciclo {tfs[1]} chiuso &amp; schematica confermata</strong>
                        <span>Rottura + retest + assorbimento nella direzione attesa.</span>
                      </div>
                      <span className="ck-ref-toggle" />
                    </button>

                    {/* Selettore Esecuzione M5 / M1 in Swing */}
                    {a.mode === "swing" && (
                      <div className="ck-ref-virgin-selector">
                        {(["M5", "M1"] as const).map((tf) => (
                          <button
                            key={tf}
                            type="button"
                            disabled={isConfirmed}
                            onClick={() => {
                              synestheticClick();
                              set({ execTF: tf });
                            }}
                            className={`ck-ref-chip-btn ${a.execTF === tf ? "selected" : ""}`}
                          >
                            Esecuzione {tf}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Switch 2: Schematica d'ingresso LTF valida */}
                    <button
                      type="button"
                      disabled={isConfirmed}
                      onClick={() => {
                        synestheticClick();
                        set({ ltfSchema: !a.ltfSchema });
                      }}
                      className={`ck-ref-switch-row ${a.ltfSchema ? "on" : ""}`}
                    >
                      <div className="ck-ref-switch-text">
                        <strong>Schematica d'ingresso {tfs[2]} valida</strong>
                        <span>Struttura {tfs[2]} pulita e coerente con il ciclo superiore.</span>
                      </div>
                      <span className="ck-ref-toggle" />
                    </button>

                    {/* Trigger Operativo (4 bottoni con schema) */}
                    <div>
                      <span className="ck-ref-label">Trigger operativo</span>
                      <div className="ck-ref-trigger-row">
                        {(["TEST", "POC", "JTC", "BTI"] as const).map((tr) => {
                          const allowed = triggersAllowed.includes(tr);
                          const selected = a.trigger === tr;
                          const schemKey = tr.toLowerCase();
                          return (
                            <button
                              key={tr}
                              type="button"
                              disabled={!allowed || isConfirmed}
                              onClick={() => {
                                if (!allowed || isConfirmed) return;
                                synestheticClick();
                                set({ trigger: tr });
                              }}
                              className={`ck-ref-trigger-btn ${selected ? "selected" : ""}`}
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <span>{tr}</span>
                                <span
                                  role="button"
                                  data-touch-size="custom"
                                  tabIndex={-1}
                                  title={`Schema ${tr}`}
                                  onClick={(e) => handleInspectById(schemKey, e)}
                                  className="p-0.5 rounded bg-black/50 text-[#C5A059] hover:text-[#E8C56A]"
                                >
                                  <ZoomIn size={10} />
                                </span>
                              </div>
                              <ReferenceSchemaSvg
                                kind={schemKey}
                                className="w-full h-5 text-[#E8C56A]/85"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Area Vergine / Storico a Sinistra */}
                    <div>
                      <span className="ck-ref-label">
                        {tfs[1]} ha chiuso senza storico a sinistra?
                      </span>
                      <div className="ck-ref-virgin-selector">
                        <button
                          type="button"
                          disabled={isConfirmed}
                          onClick={() => {
                            synestheticClick();
                            set({ area: "history" });
                          }}
                          className={`ck-ref-chip-btn ${a.area === "history" ? "selected" : ""}`}
                        >
                          Storico presente
                        </button>
                        <button
                          type="button"
                          disabled={isConfirmed}
                          onClick={() => {
                            synestheticClick();
                            set({ area: "virgin" });
                          }}
                          className={`ck-ref-chip-btn ${a.area === "virgin" ? "selected" : ""}`}
                        >
                          Area vergine
                        </button>
                      </div>
                    </div>

                    {/* Filtro 10% in Area Vergine */}
                    {a.area === "virgin" && (
                      <button
                        type="button"
                        disabled={isConfirmed}
                        onClick={() => {
                          synestheticClick();
                          set({ imbalance: !a.imbalance });
                        }}
                        className={`ck-ref-switch-row ${a.imbalance ? "on" : ""}`}
                      >
                        <div className="ck-ref-switch-text">
                          <strong>Sbilanciamento ≥ 10% confermato su {tfs[2]}</strong>
                          <span>Obbligatorio in area vergine prima di qualsiasi ingresso.</span>
                        </div>
                        <span className="ck-ref-toggle" />
                      </button>
                    )}

                    {/* Target Liquidity Input + Quick Pool Tags */}
                    <div className="ck-ref-field">
                      <label className="ck-ref-label" htmlFor="ck-mobile-target-input">
                        Pool di liquidità opposto / target
                      </label>
                      <input
                        id="ck-mobile-target-input"
                        type="text"
                        disabled={isConfirmed}
                        placeholder="Es. High di Londra / EQH / zona H1 opposta"
                        value={a.target}
                        onChange={(e) => set({ target: e.target.value })}
                      />
                      <div className="flex flex-wrap gap-1 mt-1">
                        {["Max Londra", "Min Londra", "Max Asia", "Min Asia", "EQH / BSL", "EQL / SSL"].map(
                          (tag) => (
                            <button
                              key={tag}
                              type="button"
                              disabled={isConfirmed}
                              onClick={() => {
                                synestheticClick();
                                set({ target: tag, targetConfirmed: true });
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors whitespace-nowrap ${
                                a.target === tag
                                  ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A]"
                                  : "border-white/10 bg-black/40 text-slate-400 hover:text-white"
                              }`}
                            >
                              {tag}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Switch 4: Pool opposto identificato e validato */}
                    <button
                      type="button"
                      disabled={isConfirmed}
                      onClick={() => {
                        synestheticClick();
                        set({ targetConfirmed: !a.targetConfirmed });
                      }}
                      className={`ck-ref-switch-row ${a.targetConfirmed ? "on" : ""}`}
                    >
                      <div className="ck-ref-switch-text">
                        <strong>Pool opposto identificato e validato</strong>
                        <span>
                          Conferma che il target è una presa di liquidità reale sul ciclo opposto.
                        </span>
                      </div>
                      <span className="ck-ref-toggle" />
                    </button>

                    {/* Condizioni extra di finestra (Asia / Lunch / News) */}
                    {win.kind === "asia" && (
                      <button
                        type="button"
                        disabled={isConfirmed}
                        onClick={() => {
                          synestheticClick();
                          set({ asiaConfirmed: !a.asiaConfirmed });
                        }}
                        className={`ck-ref-switch-row ${a.asiaConfirmed ? "on" : ""}`}
                      >
                        <div className="ck-ref-switch-text">
                          <strong>Asia: massime conferme aggiuntive presenti</strong>
                          <span>Sessione secondaria: entra solo con struttura impeccabile.</span>
                        </div>
                        <span className="ck-ref-toggle" />
                      </button>
                    )}

                    {win.kind === "lunch" && (
                      <button
                        type="button"
                        disabled={isConfirmed}
                        onClick={() => {
                          synestheticClick();
                          set({ impulseStarted: !a.impulseStarted });
                        }}
                        className={`ck-ref-switch-row ${a.impulseStarted ? "on" : ""}`}
                      >
                        <div className="ck-ref-switch-text">
                          <strong>Impulso già partito prima della pausa</strong>
                          <span>Tra le 11:30 e le 13:30 non si aprono nuovi cicli da zero.</span>
                        </div>
                        <span className="ck-ref-toggle" />
                      </button>
                    )}

                    {!isNewsVerified && (
                      <button
                        type="button"
                        disabled={isConfirmed}
                        onClick={() => {
                          synestheticClick();
                          set({ news: "clear", newsDay: cockpitDay(tickNow) });
                        }}
                        className="ck-ref-switch-row"
                      >
                        <div className="ck-ref-switch-text">
                          <strong>Calendario news verificato (nessuna news ±15m)</strong>
                          <span>Tocca per confermare la verifica macroeconomica.</span>
                        </div>
                        <span className="ck-ref-toggle" />
                      </button>
                    )}

                    {/* Parametri Rapidi (Entry / Stop / Rischio) */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <div className="ck-ref-field">
                        <label className="ck-ref-label" htmlFor="ck-mob-entry">
                          Entry
                        </label>
                        <input
                          id="ck-mob-entry"
                          type="text"
                          inputMode="decimal"
                          placeholder="Prezzo"
                          value={localEntry}
                          onChange={(e) => onEntryChange(e.target.value)}
                        />
                      </div>
                      <div className="ck-ref-field">
                        <label className="ck-ref-label" htmlFor="ck-mob-stop">
                          Stop Loss
                        </label>
                        <input
                          id="ck-mob-stop"
                          type="text"
                          inputMode="decimal"
                          placeholder="Livello SL"
                          value={localStop}
                          onChange={(e) => onStopChange(e.target.value)}
                        />
                      </div>
                      <div className="ck-ref-field">
                        <label className="ck-ref-label" htmlFor="ck-mob-risk">
                          Rischio (€/$)
                        </label>
                        <input
                          id="ck-mob-risk"
                          type="text"
                          inputMode="decimal"
                          placeholder="80"
                          value={localRisk}
                          onChange={(e) => onRiskChange(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Execution Box (Registrazione Manuale + Invio MT5) */}
                    <div className="ck-ref-exec-box">
                      <div className="ck-ref-exec-group">
                        <span className="ck-ref-exec-group-label">
                          REGISTRAZIONE OPERATIVA · IL VARCO
                        </span>
                        <div className="ck-ref-exec-manual-grid">
                          <button
                            type="button"
                            onClick={() => {
                              synestheticClick();
                              onConfirmOpenPosition();
                              setManualOpenPhase(4);
                            }}
                            className="ck-ref-cta-btn"
                          >
                            Registra posizione aperta →
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              synestheticClick();
                              onOpenTradeRegister();
                            }}
                            className="ck-ref-secondary-cta"
                          >
                            Registra un trade già concluso nel Libro della Verità →
                          </button>
                        </div>
                      </div>

                      <div className="ck-ref-exec-divider" />

                      <button
                        type="button"
                        onClick={() => {
                          synestheticClick();
                          onExportMt5Setup();
                        }}
                        className="ck-ref-mt5-btn"
                      >
                        Esporta / Prepara ordine su MT5 &amp; cTrader →
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })()}

          {/* ── FASE 04: GESTIONE POSIZIONE (LIVE 3-M1 REACTIVITY MONITOR) ── */}
          {(() => {
            const isLocked = !isConfirmed && phase !== 4;
            const isOpen = activeAccordionPhase === 4 || isConfirmed;
            return (
              <section
                className={`ck-ref-phase p4 ${isOpen ? "current" : ""} ${
                  isLocked ? "locked" : ""
                }`}
              >
                <header
                  className="ck-ref-phase-header"
                  onClick={() => {
                    synestheticClick();
                    onSelectPhase(4);
                    setManualOpenPhase(isOpen ? 0 : 4);
                  }}
                >
                  <div className="ck-ref-phase-title">
                    <span className="ck-ref-step-num">04</span>
                    <strong className="ck-ref-phase-summary">{p4Summary}</strong>
                    <span className="ck-ref-tf whitespace-nowrap">LIVE</span>
                  </div>
                  <span className="ck-ref-chev">{isOpen ? "−" : "+"}</span>
                </header>

                {isOpen && (
                  <div className="ck-ref-phase-body">
                    {/* Position Summary */}
                    <div className="ck-ref-pos-summary">
                      <div>
                        <span>Asset</span>
                        <strong>{a.market}</strong>
                      </div>
                      <div>
                        <span>Trigger</span>
                        <strong>{a.trigger || "—"}</strong>
                      </div>
                      <div>
                        <span>Scenario</span>
                        <strong>
                          {a.scenario ? scenarioLabelMap[a.scenario] : "—"}
                        </strong>
                      </div>
                    </div>

                    {/* Finestra di Reattività · 3 M1 */}
                    <div className="ck-ref-energy-box">
                      <div className="ck-ref-energy-head">
                        <span>FINESTRA DI REATTIVITÀ · 3 M1</span>
                        <strong className="whitespace-nowrap">{energyTimerLabel}</strong>
                      </div>
                      <div className="ck-ref-energy-track">
                        <div
                          className="ck-ref-energy-bar"
                          style={{ width: `${energyPct}%` }}
                        />
                      </div>
                      <small>
                        Il trade deve mostrare spinta immediata entro le prime 3 candele M1.
                      </small>
                    </div>

                    {/* Switch Reazione Immediata / Break-Even */}
                    <button
                      type="button"
                      onClick={() => {
                        synestheticClick();
                        onUpdateMgmtCheck("be", !mgmtChecks.be);
                      }}
                      className={`ck-ref-switch-row ${mgmtChecks.be ? "on" : ""}`}
                    >
                      <div className="ck-ref-switch-text">
                        <strong>Reazione immediata confermata (Stop a BE · 1:1.5R)</strong>
                        <span>Spinta pulita dal livello d'ingresso e capitale messo in sicurezza.</span>
                      </div>
                      <span className="ck-ref-toggle" />
                    </button>

                    {/* Switch Parziale 1:3R */}
                    <button
                      type="button"
                      onClick={() => {
                        synestheticClick();
                        onUpdateMgmtCheck("tp1", !mgmtChecks.tp1);
                      }}
                      className={`ck-ref-switch-row ${mgmtChecks.tp1 ? "on" : ""}`}
                    >
                      <div className="ck-ref-switch-text">
                        <strong>Parziale 1:3R incassato (50% scaricato)</strong>
                        <span>Rendita consolidata sul primo pool di liquidità.</span>
                      </div>
                      <span className="ck-ref-toggle" />
                    </button>

                    {/* Monitor Grid: Congestione / Violazione */}
                    <div className="ck-ref-monitor-grid">
                      <button
                        type="button"
                        onClick={() => {
                          synestheticClick();
                          onUpdateMgmtCheck("congestion", !mgmtChecks.congestion);
                        }}
                        className={`ck-ref-warn-btn ${mgmtChecks.congestion ? "active" : ""}`}
                      >
                        Congestione sul livello
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          synestheticClick();
                          onUpdateMgmtCheck("invalidation", !mgmtChecks.invalidation);
                        }}
                        className={`ck-ref-danger-btn ${mgmtChecks.invalidation ? "active" : ""}`}
                      >
                        Schematica violata / Flip
                      </button>
                    </div>

                    {(mgmtChecks.congestion || mgmtChecks.invalidation) && (
                      <div className="ck-ref-monitor-grid">
                        <button
                          type="button"
                          onClick={() => {
                            synestheticClick();
                            onUpdateMgmtCheck("be", true);
                            onUpdateMgmtCheck("congestion", false);
                          }}
                          className="ck-ref-pill-btn is-verified justify-center py-2"
                        >
                          Ho ridotto il rischio
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            synestheticClick();
                            onOpenTradeRegister();
                          }}
                          className="ck-ref-pill-btn justify-center py-2"
                        >
                          Ho chiuso la posizione
                        </button>
                      </div>
                    )}

                    <div className="ck-ref-field">
                      <label className="ck-ref-label" htmlFor="ck-mob-mgmt-note">
                        Note operative / reazione del prezzo
                      </label>
                      <input
                        id="ck-mob-mgmt-note"
                        type="text"
                        placeholder="Annota spinta, gestione parziale o reazione..."
                        value={mgmtNote}
                        onChange={(e) => onUpdateMgmtNote(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        synestheticClick();
                        onOpenTradeRegister();
                      }}
                      className="ck-ref-cta-btn"
                    >
                      Registra esito &amp; chiudi il ciclo →
                    </button>
                  </div>
                )}
              </section>
            );
          })()}
        </div>
      </div>

      {/* 7. BOTTOM EDGE TRACKER BAR (#drawerToggle) */}
      <button
        type="button"
        onClick={() => {
          synestheticClick();
          onOpenJournal();
        }}
        className="ck-ref-drawer-toggle"
      >
        <span>IL LIBRO DELLA VERITÀ · EDGE TRACKER ({evidenceCount} TRADE)</span>
        <span>↑</span>
      </button>
    </div>
  );
}

/**
 * Floating Checklist Bottom Sheet over the Mobile Chart (#chartChecklistBody + .chart-dock)
 * Allows compiling the active phase directly while inspecting candles on the mobile chart.
 */
export function CockpitMobileChartChecklistSheet({
  analysis: a,
  setAnalysis: set,
  phase,
  onSelectPhase,
  tfs,
  isConfirmed,
  tradesToday,
  maxTrades,
  onOpenDialog,
  onOpenTradeRegister,
  onInspectSchematic,
}: {
  analysis: CockpitAnalysis;
  setAnalysis: (patch: Partial<CockpitAnalysis>) => void;
  phase: 1 | 2 | 3 | 4;
  onSelectPhase: (p: 1 | 2 | 3 | 4) => void;
  tfs: string[];
  isConfirmed: boolean;
  tradesToday: number;
  maxTrades: number;
  onOpenDialog: (
    d: "protection" | "notes" | "examples" | "operative_plan" | null,
  ) => void;
  onOpenTradeRegister: () => void;
  onOpenJournal: () => void;
  onInspectSchematic: (s: CockpitSchematic) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const triggersAllowed = cockpitTriggers(a);

  return (
    <div className="ck-ref-chart-dock-wrap lg:hidden">
      {sheetOpen && (
        <div
          className="ck-ref-chart-checklist-body"
          data-prevent-swipe="true"
        >
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] font-mono text-[10px] font-bold">
                0{phase}
              </span>
              <strong className="text-xs font-mono uppercase tracking-wider text-white">
                {phase === 1
                  ? `Dove siamo (${tfs[0]})`
                  : phase === 2
                  ? `Cosa ha preso (${tfs[1]})`
                  : phase === 3
                  ? `Come & Target (${tfs[2]})`
                  : "Gestione Posizione"}
              </strong>
            </div>
            <div className="flex items-center gap-1">
              {([1, 2, 3] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    synestheticClick();
                    onSelectPhase(p);
                  }}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                    phase === p
                      ? "border-[#C5A059] bg-[#C5A059]/25 text-[#E8C56A]"
                      : "border-white/10 bg-black/50 text-slate-400"
                  }`}
                >
                  0{p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="ml-1 px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300 text-[10px] font-mono"
              >
                Chiudi ✕
              </button>
            </div>
          </div>

          {phase === 1 && (
            <div className="space-y-2">
              <div className="ck-ref-cycle-grid">
                {CYCLE_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isConfirmed}
                    onClick={() => {
                      synestheticClick();
                      set({ cycle: c.id });
                    }}
                    className={`ck-ref-chip-btn ${a.cycle === c.id ? "selected" : ""}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="ck-ref-option-list">
                {LIQUIDITY_OPTIONS.map((opt) => (
                  <div
                    key={opt.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (isConfirmed) return;
                      synestheticClick();
                      set({ context: opt.id });
                    }}
                    className={`ck-ref-option ${a.context === opt.id ? "selected" : ""}`}
                  >
                    <div
                      className="ck-ref-option-schema"
                      onClick={(e) => {
                        e.stopPropagation();
                        const s = getCockpitSchematic(opt.schematicId);
                        if (s) onInspectSchematic(s);
                      }}
                    >
                      <ReferenceSchemaSvg kind={opt.icon} />
                    </div>
                    <div className="ck-ref-option-text">
                      <strong>{opt.title}</strong>
                      <span>{opt.desc}</span>
                    </div>
                    <div className="ck-ref-option-check">
                      {a.context === opt.id && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === 2 && (
            <div className="ck-ref-option-list">
              {SCENARIO_OPTIONS.map((opt) => {
                const disabled =
                  isConfirmed || (a.context === "intermediate" && opt.id !== "reaccum");
                return (
                  <div
                    key={opt.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (disabled) return;
                      synestheticClick();
                      set({ scenario: opt.id });
                    }}
                    className={`ck-ref-option ${a.scenario === opt.id ? "selected" : ""} ${
                      disabled ? "is-disabled" : ""
                    }`}
                  >
                    <div
                      className="ck-ref-option-schema"
                      onClick={(e) => {
                        e.stopPropagation();
                        const s = getCockpitSchematic(opt.schematicId);
                        if (s) onInspectSchematic(s);
                      }}
                    >
                      <ReferenceSchemaSvg kind={opt.icon} />
                    </div>
                    <div className="ck-ref-option-text">
                      <strong>{opt.title}</strong>
                      <span>{opt.desc}</span>
                    </div>
                    <div className="ck-ref-option-check">
                      {a.scenario === opt.id && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {phase >= 3 && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => set({ itfSchema: !a.itfSchema })}
                  className={`ck-ref-chip-btn ${a.itfSchema ? "selected" : ""}`}
                >
                  Ciclo {tfs[1]} Chiuso {a.itfSchema ? "✓" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => set({ ltfSchema: !a.ltfSchema })}
                  className={`ck-ref-chip-btn ${a.ltfSchema ? "selected" : ""}`}
                >
                  Schema {tfs[2]} Valido {a.ltfSchema ? "✓" : ""}
                </button>
              </div>
              <div className="ck-ref-trigger-row">
                {(["TEST", "POC", "JTC", "BTI"] as const).map((tr) => {
                  const allowed = triggersAllowed.includes(tr);
                  return (
                    <button
                      key={tr}
                      type="button"
                      disabled={!allowed}
                      onClick={() => set({ trigger: tr })}
                      className={`ck-ref-trigger-btn ${a.trigger === tr ? "selected" : ""}`}
                    >
                      {tr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Dock Bar (.chart-dock) */}
      <div className="ck-ref-chart-dock" data-prevent-swipe="true">
        <button
          type="button"
          onClick={() => {
            synestheticClick();
            setSheetOpen((v) => !v);
          }}
          className={`ck-ref-dock-btn primary whitespace-nowrap ${sheetOpen ? "active" : ""}`}
        >
          <span>Compila Fase {phase}</span>
          <span>{sheetOpen ? "−" : "＋"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            synestheticClick();
            onOpenDialog("protection");
          }}
          className="ck-ref-dock-btn whitespace-nowrap"
        >
          <ShieldCheck size={12} className="text-[#C5A059]" />
          <span>
            {tradesToday}/{maxTrades}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            synestheticClick();
            onOpenDialog("operative_plan");
          }}
          className="ck-ref-dock-btn whitespace-nowrap"
        >
          <span>Appunti</span>
        </button>

        <button
          type="button"
          onClick={() => {
            synestheticClick();
            onOpenDialog("examples");
          }}
          className="ck-ref-dock-btn whitespace-nowrap"
        >
          <span>Esempi</span>
        </button>

        <button
          type="button"
          onClick={() => {
            synestheticClick();
            onOpenTradeRegister();
          }}
          className="ck-ref-dock-btn is-emerald whitespace-nowrap"
        >
          <BookOpen size={12} />
          <span>Trade</span>
        </button>
      </div>
    </div>
  );
}
