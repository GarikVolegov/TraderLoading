import { useState } from "react";
import {
  Crown,
  Medal,
  Award,
  Sparkles,
  Shield,
  Download,
  Loader2,
  TrendingUp,
  X,
  CheckCircle,
  ExternalLink,
  Target,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@clerk/react";
import { NftCertificate, type CertTier } from "./NftCertificate";
import { downloadTorneoCertificate } from "./torneoCertificateExport";
import { fmtR, initials } from "./format";
import { divisionLabel } from "./Leaderboard";
import type { TorneiCurrent, TorneiStandingsResponse, TorneiMetric, TorneiStanding } from "@/lib/torneiApi";

interface ArenaViewProps {
  current: TorneiCurrent;
  standings: TorneiStandingsResponse | undefined;
  metric: TorneiMetric;
  onMetric: (m: TorneiMetric) => void;
  enrolling: boolean;
  onEnroll: () => void;
}

const CERT_PREVIEWS: { tier: CertTier; title: string; edition: string; rarity: string }[] = [
  { tier: "champion", title: "Champion", edition: "Ed. 1 / 1", rarity: "Leggendario" },
  { tier: "podio", title: "Podio", edition: "Ed. 1 / 2", rarity: "Epico" },
  { tier: "finisher", title: "Finisher", edition: "Open Edition", rarity: "Raro" },
];

export function ArenaView({
  current,
  standings,
  metric,
  onMetric,
  enrolling: _enrolling,
  onEnroll: _onEnroll,
}: ArenaViewProps) {
  const { t } = useLanguage();
  const { user } = useUser();
  const defaultTraderName = user?.fullName || user?.username || user?.firstName || "GARIKFX";

  const [previewCert, setPreviewCert] = useState<(typeof CERT_PREVIEWS)[number] | null>(null);
  const [customName, setCustomName] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  const activeName = (customName.trim() || defaultTraderName).toUpperCase();

  const season = current.season;
  if (!season) {
    return <p className="p-8 text-center text-sm text-slate-400">{t("tornei.hall.empty")}</p>;
  }

  const board = standings?.board ?? [];
  const dq = standings?.dq ?? [];
  const allRows: TorneiStanding[] = [...board, ...dq];
  const myStanding = standings?.me ?? allRows.find((r) => r.me) ?? null;

  const handleDownload = async () => {
    if (!previewCert) return;
    try {
      setDownloading(true);
      await downloadTorneoCertificate({
        tier: previewCert.tier,
        userName: activeName,
        seasonLabel: season.label,
      });
    } catch (err) {
      console.error("Errore download attestato:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full h-full min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3.5 overflow-hidden text-white">
      {/* ========================================================
          PILASTRO 1: PREMI & CERTIFICATI DI VINCITA NFT (Col 1-5)
          ======================================================== */}
      <section className="lg:col-span-6 xl:col-span-5 flex flex-col rounded-xl border border-[#C5A059]/25 bg-[#0B0D13] p-3.5 overflow-hidden shadow-lg">
        {/* Header Sezione Premi */}
        <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A]">
              <Sparkles size={14} />
            </span>
            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#E8C56A]">
                Premi & Certificati di Vincita
              </h3>
              <p className="font-mono text-[9.5px] text-slate-400">
                Certificati digitali on-chain edizioni Limen {season.label}
              </p>
            </div>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider rounded border border-[#C5A059]/30 bg-[#C5A059]/10 px-2 py-0.5 text-[#E8C56A]">
            ERC-721
          </span>
        </div>

        {/* I 3 Certificati NFT Ufficiali a Vista (Interattivi con Olografia) */}
        <div className="grid grid-cols-3 gap-2.5 mb-3 flex-none">
          {CERT_PREVIEWS.map((c) => (
            <div key={c.tier} className="relative group">
              <NftCertificate
                tier={c.tier}
                title={c.title}
                edition={c.edition}
                rarity={c.rarity}
                seasonLabel={season.label}
                userName={activeName}
                onClick={() => setPreviewCert(c)}
              />
              <span className="absolute bottom-1 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 rounded px-1.5 py-0.5 font-mono text-[8px] text-[#E8C56A] border border-[#C5A059]/40 pointer-events-none">
                Clicca per HD
              </span>
            </div>
          ))}
        </div>

        {/* ========================================================
            NUOVA SEZIONE: LE TUE STATISTICHE NEL TORNEO (Personalized)
            ======================================================== */}
        <div className="rounded-lg border border-[#C5A059]/30 bg-[#07080B] p-2.5 space-y-2 mb-2.5">
          <div className="flex items-center justify-between border-b border-[#26262E] pb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Target size={12} className="text-[#C5A059] shrink-0" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-bold truncate">
                Le Tue Statistiche nel Torneo
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#C5A059]/15 text-[#E8C56A] border border-[#C5A059]/35 font-bold">
                {myStanding ? divisionLabel(myStanding.division, t) : current.enrolled ? "BRONZO" : "NON ISCRITTO"}
              </span>
              {myStanding?.me && (
                <span className="font-mono text-[8.5px] px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                  TU
                </span>
              )}
            </div>
          </div>

          {/* Griglia 4 Metriche Chiave */}
          <div className="grid grid-cols-4 gap-1.5 font-mono text-center">
            <div className="p-1.5 rounded bg-[#0D0E14] border border-[#26262E]">
              <div className="text-[8.5px] text-slate-400 uppercase tracking-wider">Rango</div>
              <div className="text-xs font-bold text-[#E8C56A] mt-0.5">
                {myStanding ? `#${myStanding.rank}` : current.enrolled ? "#1" : "—"}
              </div>
            </div>
            <div className="p-1.5 rounded bg-[#0D0E14] border border-[#26262E]">
              <div className="text-[8.5px] text-slate-400 uppercase tracking-wider">R Cum.</div>
              <div className="text-xs font-bold text-emerald-400 mt-0.5">
                {myStanding ? fmtR(myStanding.rCum) : "0.0R"}
              </div>
            </div>
            <div className="p-1.5 rounded bg-[#0D0E14] border border-[#26262E]">
              <div className="text-[8.5px] text-slate-400 uppercase tracking-wider">Disciplina</div>
              <div className="text-xs font-bold text-white mt-0.5">
                {myStanding ? `${myStanding.discIndex}%` : current.enrolled ? "100%" : "—"}
              </div>
            </div>
            <div className="p-1.5 rounded bg-[#0D0E14] border border-[#26262E]">
              <div className="text-[8.5px] text-slate-400 uppercase tracking-wider">Punteggio</div>
              <div className="text-xs font-bold text-[#E8C56A] mt-0.5">
                {myStanding ? myStanding.score.toFixed(1) : "0.0"}
              </div>
            </div>
          </div>

          {/* Barra Avanzamento Requisito Finisher (Disciplina > 90%) */}
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-slate-400">
                Obiettivo Finisher: Disciplina &gt; 90%
              </span>
              <span className={(myStanding?.discIndex ?? (current.enrolled ? 100 : 0)) >= 90 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {(myStanding?.discIndex ?? (current.enrolled ? 100 : 0)) >= 90 ? "Conforme (Idoneo NFT)" : "In corso"}
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#14151E] rounded-full overflow-hidden border border-[#26262E]">
              <div
                className="h-full bg-gradient-to-r from-amber-600 via-[#C5A059] to-emerald-400"
                style={{ width: `${Math.min(100, Math.max(5, myStanding?.discIndex ?? (current.enrolled ? 100 : 0)))}%` }}
              />
            </div>
          </div>

          {/* Telemetria secondaria */}
          <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400 border-t border-[#1C1D26] pt-1">
            <span>Esecuzioni valide: <strong className="text-white">{myStanding?.trades ?? 0}</strong></span>
            <span>Guardrail: <strong className={myStanding?.dq ? "text-red-400" : "text-emerald-400"}>{myStanding?.dq ? "Squalificato" : "In regola (Max 1%)"}</strong></span>
          </div>
        </div>

        {/* ========================================================
            TABELLA BENEFIT E PREMI DI RANGO (Compatta -50%)
            ======================================================== */}
        <div className="rounded-lg border border-[#26262E] bg-[#07080B] p-2 space-y-1.5 font-mono text-xs flex-1 min-h-0 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <Award size={11} className="text-[#C5A059]" />
              Benefit Ufficiali di Rango
            </span>
            <span className="text-[8.5px] text-slate-500">Conio Polygon/Base</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {/* 1° Posto */}
            <div className="p-1.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 text-[9.5px] font-bold text-[#E8C56A]">
                <Crown size={10} />
                <span>1° Posto</span>
              </div>
              <div className="text-[9px] text-slate-300 font-semibold mt-0.5">Cert. 1/1 + 3 Mesi Pro</div>
            </div>

            {/* 2°-3° Posto */}
            <div className="p-1.5 rounded border border-slate-700/60 bg-slate-800/20 text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 text-[9.5px] font-bold text-slate-200">
                <Medal size={10} className="text-slate-300" />
                <span>2° - 3° Posto</span>
              </div>
              <div className="text-[9px] text-slate-400 font-semibold mt-0.5">Cert. 1/2 + 1 Mese Pro</div>
            </div>

            {/* Finisher */}
            <div className="p-1.5 rounded border border-amber-900/40 bg-amber-950/15 text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 text-[9.5px] font-bold text-amber-500">
                <CheckCircle size={10} />
                <span>Finisher</span>
              </div>
              <div className="text-[9px] text-amber-400 font-semibold mt-0.5">Certificato + 100 XP</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-500 border-t border-[#1C1D26] pt-1">
            <span>Verificabile on-chain</span>
            <span className="text-[#E8C56A]">Disponibile a fine stagione</span>
          </div>
        </div>
      </section>

      {/* ========================================================
          PILASTRO 2: CLASSIFICA LIVE & GUARDRAIL (Col 6-12)
          ======================================================== */}
      <section className="lg:col-span-6 xl:col-span-7 flex flex-col rounded-xl border border-[#26262E] bg-[#0A0B10] p-3.5 overflow-hidden shadow-lg">
        {/* Toolbar Superiore Classifica */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#26262E] pb-2.5 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A]">
              <Crown size={14} />
            </span>
            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                Classifica Live · {season.label}
              </h3>
              <p className="font-mono text-[9.5px] text-slate-400">
                {board.length} {t("tornei.inGara", { n: "" }).trim()} · Aggiornamento continuo
              </p>
            </div>
          </div>

          {/* Switch Metrica (R Cumulato / Indice Disciplina) */}
          <div className="inline-flex rounded-lg border border-[#26262E] bg-[#07080B] p-0.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => onMetric("r")}
              className={`px-3 py-1 rounded text-xs transition-all flex items-center gap-1.5 ${
                metric === "r"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TrendingUp size={11} />
              {t("tornei.metric.r")}
            </button>
            <button
              type="button"
              onClick={() => onMetric("ts")}
              className={`px-3 py-1 rounded text-xs transition-all flex items-center gap-1.5 ${
                metric === "ts"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Shield size={11} />
              {t("tornei.metric.ts")}
            </button>
          </div>
        </div>

        {/* Header Colonne Tabella */}
        <div className="grid grid-cols-[48px_1fr_95px_95px_75px] items-center px-3 py-2 rounded-lg bg-[#07080B] font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
          <span>{t("tornei.col.rank")}</span>
          <span>{t("tornei.col.trader")}</span>
          <span className="text-right">{t("tornei.col.rcum")}</span>
          <span className="text-right">{t("tornei.col.discipline")}</span>
          <span className="text-right">{t("tornei.col.score")}</span>
        </div>

        {/* Tabella con Scorrimento Interno Fluido */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
          {allRows.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 font-mono">
              {t("tornei.board.empty")}
            </div>
          ) : (
            allRows.map((r) => {
              const isDq = Boolean(r.dq);
              return (
                <div
                  key={r.id}
                  className={`grid grid-cols-[48px_1fr_95px_95px_75px] items-center px-3 py-2.5 rounded-lg border transition-all text-xs ${
                    isDq
                      ? "border-red-950/40 bg-red-950/10 opacity-70"
                      : r.me
                      ? "border-[#C5A059]/70 bg-[#C5A059]/15 shadow-[0_0_15px_rgba(197,160,89,0.2)]"
                      : r.rank === 1
                      ? "border-[#C5A059]/40 bg-[#0F1017] hover:border-[#C5A059]/70"
                      : r.rank === 2
                      ? "border-slate-500/30 bg-[#0C0D12] hover:border-slate-400/50"
                      : r.rank === 3
                      ? "border-amber-700/30 bg-[#0C0D12] hover:border-amber-600/50"
                      : "border-[#26262E]/70 bg-[#0C0D12] hover:border-slate-600/60"
                  }`}
                >
                  {/* Posizione (Badge Oro / Argento / Bronzo) */}
                  <div className="flex items-center gap-1 font-mono">
                    <span
                      className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
                        isDq
                          ? "bg-red-950/40 text-red-400 line-through"
                          : r.rank === 1
                          ? "bg-[#C5A059]/25 text-[#E8C56A] border border-[#C5A059]/50 shadow-sm"
                          : r.rank === 2
                          ? "bg-slate-300/20 text-slate-200 border border-slate-300/40"
                          : r.rank === 3
                          ? "bg-amber-700/20 text-amber-500 border border-amber-700/40"
                          : "text-slate-400"
                      }`}
                    >
                      {r.rank === 1 ? (
                        <Crown size={12} className="text-[#E8C56A]" />
                      ) : r.rank === 2 ? (
                        <Medal size={12} className="text-slate-300" />
                      ) : r.rank === 3 ? (
                        <Award size={12} className="text-amber-500" />
                      ) : (
                        r.rank
                      )}
                    </span>
                  </div>

                  {/* Informazioni Trader */}
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold bg-[#14151E] border border-[#26262E] text-slate-300 flex-none">
                      {initials(r.displayName)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-semibold truncate max-w-[140px] sm:max-w-[180px] ${
                            isDq ? "line-through text-slate-400" : "text-white"
                          }`}
                        >
                          {r.displayName}
                        </span>
                        {r.me && (
                          <span className="rounded bg-[#C5A059]/25 text-[#E8C56A] font-mono text-[9px] px-1.5 py-0.2 border border-[#C5A059]/40 font-bold flex-none">
                            TU
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 block mt-0.5">
                        {divisionLabel(r.division, t)}
                        {isDq && " · Squalificato"}
                      </span>
                    </div>
                  </div>

                  {/* R Cumulato */}
                  <div className="text-right font-mono font-bold">
                    <span className={isDq ? "text-slate-500 line-through" : "text-emerald-400"}>
                      {fmtR(r.rCum)}
                    </span>
                  </div>

                  {/* Indice Disciplina */}
                  <div className="text-right font-mono">
                    <span className={isDq ? "text-red-400" : "text-slate-200"}>
                      {r.discIndex}%
                    </span>
                  </div>

                  {/* Score Totale */}
                  <div className="text-right font-mono font-bold text-white">
                    {isDq ? "—" : r.score.toFixed(1)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Guardrail della Fratellanza */}
        <div className="border-t border-[#26262E] pt-2 mt-2 flex items-center justify-between font-mono text-[9.5px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Shield size={11} className="text-[#C5A059]" />
            Guardrail: Rischio max 1% · Stop-loss a mercato · Disciplina &gt; 90%
          </span>
          <span className="text-[#E8C56A]">Punteggio = R × (Disciplina / 100)</span>
        </div>
      </section>

      {/* ========================================================
          MODALE DI ANTEPRIMA & DOWNLOAD CERTIFICATO HD (Al click)
          ======================================================== */}
      {previewCert && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewCert(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#C5A059]/40 bg-[#0B0D13] p-5 shadow-2xl flex flex-col gap-4 text-white"
          >
            <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-3">
              <div>
                <h4 className="font-display text-sm font-bold uppercase tracking-wider text-[#E8C56A]">
                  Certificato {previewCert.title}
                </h4>
                <p className="font-mono text-[10px] text-slate-400">
                  {previewCert.edition} · {previewCert.rarity} · Download PNG HD
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCert(null)}
                className="text-slate-400 hover:text-white p-1"
                aria-label={t("tornei.close")}
              >
                <X size={18} />
              </button>
            </div>

            {/* Visualizzazione Certificato con nome dinamico */}
            <div className="w-[280px] mx-auto">
              <NftCertificate
                tier={previewCert.tier}
                title={previewCert.title}
                edition={previewCert.edition}
                rarity={previewCert.rarity}
                seasonLabel={season.label}
                userName={activeName}
              />
            </div>

            {/* Input Nome Operatore */}
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase text-slate-400 block">
                Nome Operatore Inciso sull&apos;Attestato:
              </label>
              <input
                type="text"
                maxLength={24}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={defaultTraderName}
                className="w-full h-8 rounded-lg border border-[#26262E] bg-[#07080B] px-3 font-mono text-xs text-white focus:border-[#C5A059] outline-none"
              />
            </div>

            {/* Bottone Download */}
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="w-full h-9 rounded-lg font-mono text-xs font-bold bg-gradient-to-r from-[#9C772C] to-[#C5A059] text-black hover:brightness-110 flex items-center justify-center gap-2 shadow-md"
            >
              {downloading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generazione HD in corso…
                </>
              ) : (
                <>
                  <Download size={14} />
                  Scarica Attestato PNG (1024x1024)
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
