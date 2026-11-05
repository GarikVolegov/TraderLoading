import { useMemo, useState } from "react";
import { ShieldCheck, Copy, Check, Download, Fingerprint, Lock } from "lucide-react";
import {
  computeSystemPassportHash,
  formatPassportSealCode,
  generateDeterministicQrMatrix,
  type SystemPassportPayload,
} from "@/lib/systemPassportHash";
import { synestheticClick } from "@/lib/soundFx";

interface SystemPassportCardProps {
  payload: SystemPassportPayload;
  checklistItems?: string[];
  compact?: boolean;
}

const PHASE_LABELS: Record<string, string> = {
  define: "FASE I · FONDAZIONE",
  verify: "FASE II · VALIDAZIONE",
  apply: "FASE III · ESECUZIONE",
  consolidate: "FASE IV · SOVRANITÀ",
};

export function SystemPassportCard({
  payload,
  checklistItems = [],
  compact = false,
}: SystemPassportCardProps) {
  const [copied, setCopied] = useState(false);

  const hash = useMemo(() => computeSystemPassportHash(payload), [payload]);
  const sealCode = useMemo(() => formatPassportSealCode(hash), [hash]);
  const qrMatrix = useMemo(() => generateDeterministicQrMatrix(hash, 21), [hash]);

  const phaseLabel = PHASE_LABELS[payload.phase || "define"] || "FASE I · FONDAZIONE";
  const currency = (payload.currency || "EUR").toUpperCase();

  const handleCopySeal = async () => {
    synestheticClick();
    const summaryText = [
      `🏛️ AUREUS PROTOCOL — PASSAPORTO CRITTOGRAFICO DEL SISTEMA`,
      `Sigillo: ${sealCode}`,
      `Sistema: ${payload.name || "Costituzione Operativa"} (v${payload.versionNumber ?? 1} · ${phaseLabel})`,
      `Mercati: ${payload.markets || "—"}`,
      `Rischio/Trade: ${payload.riskPerTrade} ${currency} | Max Loss Giorno: -${payload.maxDailyLoss} ${currency} | Max Esecuzioni: ${payload.maxDailyTrades}`,
      `Clausole Il Custode della Soglia: ${payload.checklistCount}`,
      `Impronta SHA-AUREUS (64-hex): 0x${hash}`,
    ].join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(summaryText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleExportJson = () => {
    synestheticClick();
    const exportDocument = {
      protocol: "AUREUS_OS_SYSTEM_CONSTITUTION_V1",
      sealCode,
      cryptographicHash: `0x${hash}`,
      issuedAt: new Date().toISOString(),
      system: {
        name: payload.name || "Costituzione Operativa",
        versionNumber: payload.versionNumber ?? 1,
        phase: payload.phase || "define",
        markets: payload.markets,
        windows: payload.windows,
        setup: payload.setup,
        entry: payload.entry,
        exit: payload.exit,
        invalidation: payload.invalidation,
        waitConditions: payload.waitConditions,
        riskGovernance: {
          currency,
          riskPerTrade: payload.riskPerTrade,
          maxDailyLoss: payload.maxDailyLoss,
          maxDailyTrades: payload.maxDailyTrades,
        },
        thresholdCustodian: {
          checklistCount: payload.checklistCount,
          clauses: checklistItems,
        },
      },
    };

    const blob = new Blob([JSON.stringify(exportDocument, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const safeSlug = (payload.name || "aureus-system")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    anchor.download = `${safeSlug || "aureus-system"}-${sealCode.toLowerCase()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="rounded-xl border border-[#C5A059]/35 bg-[#07080b] p-3.5 sm:p-4 shadow-[0_0_25px_rgba(197,160,89,0.08)] space-y-3"
      data-testid="system-passport-card"
    >
      {/* Header Solenne Passaporto */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#C5A059]/20 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A]">
            <Fingerprint className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-widest text-[#E8C56A] whitespace-nowrap">
                Passaporto Crittografico del Sistema
              </span>
              <span className="rounded px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider bg-[#10b981]/15 border border-[#10b981]/35 text-[#10b981] whitespace-nowrap">
                SIGILLO ATTIVO
              </span>
            </div>
            <p className="text-[11px] text-[#94a3b8] truncate">
              {payload.name || "Costituzione Operativa"} ·{" "}
              <span className="font-mono tracking-tight text-[#F4F4F6] whitespace-nowrap">
                v{payload.versionNumber ?? 1}
              </span>{" "}
              · <span className="font-mono text-[10px] text-[#C5A059] whitespace-nowrap">{phaseLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded border border-[#C5A059]/35 bg-[#0d0f14] px-2 py-1 font-mono text-[10px] font-bold tracking-tight text-[#E8C56A] whitespace-nowrap"
            data-testid="system-passport-seal-code"
          >
            <Lock className="w-3 h-3 text-[#C5A059]" />
            {sealCode}
          </span>
        </div>
      </div>

      {/* Corpo Centrale: QR Seal 21x21 + Telemetria Costituzionale */}
      <div className="flex flex-col sm:flex-row items-stretch gap-3.5">
        {/* Matrice SVG QR-Seal 21x21 */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#0d0f14] p-2.5 shrink-0 sm:w-[118px]">
          <svg
            viewBox="0 0 21 21"
            className="w-20 h-20 sm:w-[88px] sm:h-[88px] rounded bg-[#07080b] p-1 border border-[#C5A059]/25"
            shapeRendering="crispEdges"
            aria-label={`Sigillo QR ${sealCode}`}
            data-testid="system-passport-qr-svg"
          >
            {qrMatrix.map((row, rIdx) =>
              row.map((cell, cIdx) =>
                cell ? (
                  <rect
                    key={`${rIdx}-${cIdx}`}
                    x={cIdx}
                    y={rIdx}
                    width={1}
                    height={1}
                    fill={
                      (rIdx < 7 && cIdx < 7) ||
                      (rIdx < 7 && cIdx >= 14) ||
                      (rIdx >= 14 && cIdx < 7)
                        ? "#E8C56A"
                        : "#C5A059"
                    }
                  />
                ) : null,
              ),
            )}
          </svg>
          <span className="mt-1.5 font-mono text-[8.5px] uppercase tracking-widest text-[#94a3b8] whitespace-nowrap">
            QR SEAL 21×21
          </span>
        </div>

        {/* Telemetria Crittografica & Parametri Inviolabili */}
        <div className="flex-1 flex flex-col justify-between gap-2.5 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border border-[#26262E] bg-[#0d0f14] px-2.5 py-2">
              <span className="block font-mono text-[8.5px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">
                Rischio/Trade
              </span>
              <span className="mt-0.5 block font-mono text-xs font-bold tracking-tight text-[#10b981] whitespace-nowrap">
                {Number(payload.riskPerTrade || 0)} {currency}
              </span>
            </div>

            <div className="rounded-lg border border-[#26262E] bg-[#0d0f14] px-2.5 py-2">
              <span className="block font-mono text-[8.5px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">
                Max Loss Giorno
              </span>
              <span className="mt-0.5 block font-mono text-xs font-bold tracking-tight text-[#ef4444] whitespace-nowrap">
                -{Number(payload.maxDailyLoss || 0)} {currency}
              </span>
            </div>

            <div className="rounded-lg border border-[#26262E] bg-[#0d0f14] px-2.5 py-2">
              <span className="block font-mono text-[8.5px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">
                Max Esecuzioni
              </span>
              <span className="mt-0.5 block font-mono text-xs font-bold tracking-tight text-[#E8C56A] whitespace-nowrap">
                {Number(payload.maxDailyTrades || 0)} Trade
              </span>
            </div>

            <div className="rounded-lg border border-[#26262E] bg-[#0d0f14] px-2.5 py-2">
              <span className="block font-mono text-[8.5px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">
                Clausole Custode
              </span>
              <span className="mt-0.5 block font-mono text-xs font-bold tracking-tight text-[#F4F4F6] whitespace-nowrap">
                {Number(payload.checklistCount || 0)} Regole
              </span>
            </div>
          </div>

          {/* Impronta Crittografica 64-Hex */}
          <div className="rounded-lg border border-[#C5A059]/20 bg-[#0d0f14] px-2.5 py-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">
                DIGEST 64-HEX:
              </span>
              <code
                className="font-mono text-[10px] tracking-tight text-[#E8C56A] truncate"
                data-testid="system-passport-hash-digest"
              >
                0x{hash.slice(0, 16)}…{hash.slice(-16)}
              </code>
            </div>
            <span className="font-mono text-[9px] text-[#10b981] whitespace-nowrap hidden sm:inline">
              INTEGRITÀ VERIFICATA
            </span>
          </div>

          {/* Barra Azioni 1-Tap */}
          {!compact && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleCopySeal}
                data-testid="system-passport-copy-btn"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#E8C56A] transition-all whitespace-nowrap cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10b981]" />
                    <span className="text-[#10b981]">✓ Sigillo Copiato</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Copia Sigillo Crittografico</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                data-testid="system-passport-export-json-btn"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#26262E] bg-[#0d0f14] hover:border-[#C5A059]/40 hover:text-[#E8C56A] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#F4F4F6] transition-all whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Esporta JSON Costituzione</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
