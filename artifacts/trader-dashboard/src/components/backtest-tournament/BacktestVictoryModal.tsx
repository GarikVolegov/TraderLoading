import React, { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { ForgiaEmbersOverlay } from "./ForgiaEmbersOverlay";
import { playVictoryFanfare } from "@/lib/tournamentSoundEffects";
import type { TournamentRunSummary } from "@/lib/backtestTournamentsApi";
import { Trophy, RotateCcw, ShieldCheck, Award, BookOpen } from "lucide-react";
import "./tournament.css";

export interface BacktestVictoryModalProps {
  summary: TournamentRunSummary;
  isOpen: boolean;
  onClose: () => void;
  onViewLeaderboard?: () => void;
  onRematch?: () => void;
}

export function BacktestVictoryModal({
  summary,
  isOpen,
  onClose,
  onViewLeaderboard,
  onRematch,
}: BacktestVictoryModalProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || firedRef.current) return;
    firedRef.current = true;

    // 1. Play victory synth fanfare
    playVictoryFanfare();

    // 2. Trigger festive particle/confetti explosion
    try {
      const end = Date.now() + 1800;
      const colors = ["#34d399", "#60a5fa", "#a78bfa", "#f59e0b"];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    } catch {
      // Confetti fallback
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isWin = !summary.isDisqualified && summary.totalProfit >= 0;
  const maxAllowed = summary.maxAllowedDrawdown ?? 10;
  const assetLabel = summary.asset ? summary.asset.replace("/", "") : "XAUUSD";

  return (
    <div className="bt-victory-overlay" role="dialog" aria-modal="true">
      <ForgiaEmbersOverlay />

      <div className="bt-victory-box">
        <h2 className="bt-victory-title">
          {isWin ? "PROVA SUPERATA!" : "PROVA DEL FUOCO CONCLUSA"}
        </h2>
        <p className="bt-victory-subtitle">
          {isWin
            ? "Esecuzione chirurgica e fedeltà al Codice. Nessun cedimento, solo rigore."
            : summary.isDisqualified
            ? "Soglia di rischio violata. Ne Il Libro della Verità la disciplina precede il profitto."
            : "Rendiconto registrato nel protocollo. Procedi all'analisi degli errori per affilare la strategia."}
        </p>

        {/* 3 Large Glowing KPI Cards */}
        <div className="bt-victory-kpi-grid">
          {/* Win Rate */}
          <div className="bt-victory-kpi-card">
            <span className="bt-kpi-label">Tasso di Vittoria</span>
            <span className="bt-kpi-val">{summary.winRate.toFixed(2)}%</span>
            <span className="bt-kpi-sub">
              {summary.winTrades} su {summary.totalTrades} operazioni
            </span>
          </div>

          {/* Total Profit (Centered with Green Neon Glow) */}
          <div className="bt-victory-kpi-card bt-kpi-highlight">
            <span className="bt-kpi-label">Rendiconto Netto</span>
            <span className="bt-kpi-val bt-kpi-val-green">
              {summary.totalProfit >= 0 ? "+" : ""}$
              {summary.totalProfit.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="bt-kpi-sub" style={{ color: "#34d399", fontWeight: 700 }}>
              {summary.profitPct >= 0 ? "+" : ""}{summary.profitPct.toFixed(2)}%
            </span>
          </div>

          {/* Max Drawdown */}
          <div className="bt-victory-kpi-card">
            <span className="bt-kpi-label">Drawdown Massimo</span>
            <span
              className="bt-kpi-val"
              style={{ color: summary.maxDrawdown > maxAllowed ? "#ef4444" : "#ffffff" }}
            >
              {summary.maxDrawdown.toFixed(2)}%
            </span>
            <span className="bt-kpi-sub">Limite Inviolabile: {maxAllowed}%</span>
          </div>
        </div>

        {/* 2 Detailed Breakdown Cards */}
        <div className="bt-victory-details-grid">
          {/* Financial Breakdown */}
          <div className="bt-victory-detail-card">
            <div className="bt-detail-row">
              <span className="bt-detail-label">Capitale Iniziale</span>
              <span className="bt-detail-val">${summary.initialBalance.toLocaleString()}</span>
            </div>
            <div className="bt-detail-row">
              <span className="bt-detail-label">Capitale Finale</span>
              <span className="bt-detail-val">${summary.finalBalance.toLocaleString()}</span>
            </div>
            <div className="bt-detail-row">
              <span className="bt-detail-label">Utile Netto</span>
              <span className={`bt-detail-val ${summary.totalProfit >= 0 ? "bt-detail-val-green" : ""}`}>
                {summary.totalProfit >= 0 ? "+" : ""}$
                {summary.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bt-detail-row">
              <span className="bt-detail-label">% Guadagno</span>
              <span className={`bt-detail-val ${summary.profitPct >= 0 ? "bt-detail-val-green" : ""}`}>
                {summary.profitPct >= 0 ? "+" : ""}{summary.profitPct.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Trade Metrics Breakdown */}
          <div className="bt-victory-detail-card">
            <div className="bt-detail-row">
              <span className="bt-detail-label">Asset</span>
              <span className="bt-detail-val">{assetLabel}</span>
            </div>
            <div className="bt-detail-row">
              <span className="bt-detail-label">Operazioni Vincenti</span>
              <span className="bt-detail-val bt-detail-val-green">{summary.winTrades}</span>
            </div>
            <div className="bt-detail-row">
              <span className="bt-detail-label">Operazioni Perdenti</span>
              <span className="bt-detail-val" style={{ color: summary.loseTrades > 0 ? "#f87171" : "#94a3b8" }}>
                {summary.loseTrades}
              </span>
            </div>
            <div className="bt-detail-row">
              <span className="bt-detail-label">Media per operazione</span>
              <span className={`bt-detail-val ${summary.avgTradeProfit >= 0 ? "bt-detail-val-green" : ""}`}>
                {summary.avgTradeProfit >= 0 ? "+" : ""}$
                {summary.avgTradeProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Rapporto di Forgiatura & Apprendimento Operativo (Didattica Limen) */}
        <div
          style={{
            background: "rgba(10, 11, 14, 0.85)",
            border: "1px solid rgba(197, 160, 89, 0.35)",
            borderRadius: 14,
            padding: "14px 18px",
            marginBottom: 24,
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                fontWeight: 800,
                color: "#D4AF37",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <BookOpen size={13} /> Forgia dell&apos;Apprendimento · Debriefing Didattico
            </span>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 9.5,
                color: summary.maxDrawdown <= 5 ? "#34d399" : "#C5A059",
                background: "rgba(197, 160, 89, 0.12)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(197, 160, 89, 0.25)",
              }}
            >
              Indice d&apos;Integrità: {summary.isDisqualified ? "0% (Squalificato)" : summary.maxDrawdown <= 5 ? "100% (Incorruttibile)" : "85% (Operativo)"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11.5, color: "#94a3b8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={14} color="#34d399" />
              <span>Disciplina di Rischio: <strong>{summary.isDisqualified ? "Violata (Max DD)" : "Rispettata"}</strong></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Award size={14} color="#D4AF37" />
              <span>XP Limen Guadagnati: <strong style={{ color: "#D4AF37" }}>+{Math.max(80, Math.floor(Math.abs(summary.totalProfit) / 25) + 120)} XP</strong></span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bt-victory-actions">
          <button type="button" className="bt-btn-victory-close" onClick={onClose}>
            Chiudi
          </button>

          {onViewLeaderboard && (
            <button type="button" className="bt-btn-victory-primary" onClick={onViewLeaderboard}>
              <Trophy size={16} style={{ display: "inline", marginRight: 8, verticalAlign: "-2px" }} />
              Consulta la Gerarchia
            </button>
          )}

          {onRematch && (
            <button
              type="button"
              className="bt-btn-action"
              onClick={onRematch}
              style={{ padding: "12px 24px" }}
            >
              <RotateCcw size={15} />
              Ripeti la Prova
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
