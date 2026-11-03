import React from "react";
import { ShieldCheck, Award, Zap, CheckCircle2, ArrowRight, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BrokerPropItem {
  id: string;
  name: string;
  category: "broker" | "prop";
  tagline: string;
  badge: string;
  badgeTone: "gold" | "emerald" | "slate";
  platforms: string[];
  spreadOrDrawdown: string;
  serverExamples: string[];
  keyStrengths: string[];
  whyAureus: string;
}

export const RECOMMENDED_BROKERS: BrokerPropItem[] = [
  {
    id: "ic-markets",
    name: "IC Markets",
    category: "broker",
    tagline: "Leader ECN Globale con Connettività Equinix LD4",
    badge: "SPREAD DA 0.0 PIP",
    badgeTone: "emerald",
    platforms: ["cTrader", "MT5", "MT4"],
    spreadOrDrawdown: "Raw Spread da 0.0 pip · Comm. $3.50/lot",
    serverExamples: ["ICMarketsSC-MT5", "ICMarketsSC-Live01"],
    keyStrengths: [
      "Server a fibra ottica a Londra (LD4) con latenza ultra-bassa (<30ms)",
      "Nessun dealing desk, nessun conflitto d'interesse o requote",
      "Liquidità bancaria di livello 1 ideale per scalping e swing",
    ],
    whyAureus:
      "Compatibilità ideale con l'infrastruttura di analisi AUREUS: la precisione dei prezzi riflette al 100% i livelli istituzionali BSL/SSL.",
  },
  {
    id: "pepperstone",
    name: "Pepperstone",
    category: "broker",
    tagline: "Esecuzione Istituzionale & Integrazione Diretta TradingView",
    badge: "LATENZA ULTRA-BASSA",
    badgeTone: "gold",
    platforms: ["TradingView", "cTrader", "MT5", "MT4"],
    spreadOrDrawdown: "Razor Account da 0.0 pip",
    serverExamples: ["Pepperstone-Edge01", "Pepperstone-Live01"],
    keyStrengths: [
      "Integrazione nativa diretta con grafici TradingView e cTrader",
      "Esecuzione media inferiore a 30 millisecondi con fill garantito",
      "Zero commissioni su depositi/prelievi e regolamentazione di massimo livello",
    ],
    whyAureus:
      "Scelta prediletta per chi opera sui timeframe rapidi del Varco (M5/M15) necessitando di fill istantaneo senza slippage anomali.",
  },
  {
    id: "fp-markets",
    name: "FP Markets",
    category: "broker",
    tagline: "Pricing ECN Trasparente & Liquidità Aggregata NY4",
    badge: "ZERO RESTRIZIONI",
    badgeTone: "slate",
    platforms: ["MT5", "cTrader", "MT4"],
    spreadOrDrawdown: "ECN Raw da 0.0 pip",
    serverExamples: ["FPMarkets-Live", "FPMarketsLLC-Live"],
    keyStrengths: [
      "Aggregazione prezzi multi-banca a New York (NY4)",
      "Zero restrizioni su news trading e apertura simultanea di ordini",
      "Infrastruttura affidabile per importazione automatica storici",
    ],
    whyAureus:
      "Garanzia di trasparenza totale sui volumi e perfetta corrispondenza con le letture Wyckoff del protocollo.",
  },
];

export const RECOMMENDED_PROPS: BrokerPropItem[] = [
  {
    id: "ftmo",
    name: "FTMO",
    category: "prop",
    tagline: "Il Gold Standard della Disciplina e dei Payout",
    badge: "DRAWDOWN STATICO 10%",
    badgeTone: "emerald",
    platforms: ["cTrader", "MT5", "MT4", "DXtrade"],
    spreadOrDrawdown: "Max Loss 10% (Statico) · Daily 5%",
    serverExamples: ["FTMO-Server", "FTMO-Server2", "FTMO-Server3"],
    keyStrengths: [
      "Drawdown statico calcolato sul capitale iniziale (nessuna trappola trailing intraday)",
      "Oltre 10 anni di storico ininterrotto con oltre $200M di payout certificati",
      "Scaling Plan che porta il capitale fino a $2,000,000 con 90% profit split",
    ],
    whyAureus:
      "I guardrail de *Il Custode della Soglia* sono modellati esattamente sui parametri FTMO: operare con AUREUS azzera il rischio di violazione involontaria.",
  },
  {
    id: "the-5ers",
    name: "The 5%ers",
    category: "prop",
    tagline: "Scaling Matematico per Trader Disciplinati",
    badge: "SCALING FINO A $4M",
    badgeTone: "gold",
    platforms: ["MT5"],
    spreadOrDrawdown: "Programma Bootcamp & Hyper-Growth",
    serverExamples: ["The5ers-Live", "The5ers-Demo"],
    keyStrengths: [
      "Stop Loss obbligatorio di sistema: coerente al 100% col Codice AUREUS",
      "Raddoppio capitale a ogni target 10% raggiunto senza dover ripetere challenge",
      "Fondata da trader istituzionali per premiare la consistenza a lungo termine",
    ],
    whyAureus:
      "La struttura con Stop Loss vincolante protegge l'Operatore dalla Deriva emotiva, sposando appieno la filosofia di protezione del capitale.",
  },
  {
    id: "fundednext",
    name: "FundedNext",
    category: "prop",
    tagline: "Modello Stellar & Drawdown su Balance",
    badge: "NO TIME LIMITS",
    badgeTone: "emerald",
    platforms: ["cTrader", "MT5", "MT4"],
    spreadOrDrawdown: "Drawdown basato su Balance · 15% Profit Challenge",
    serverExamples: ["FundedNext-Server", "FundedNext-Server2"],
    keyStrengths: [
      "Nessun limite temporale per superare la fase di valutazione",
      "15% profit split accreditato anche durante la fase di prova",
      "Calcolo del drawdown non influenzato dal floating positivo intraday",
    ],
    whyAureus:
      "Permette all'Iniziato di attendere il Varco con pazienza monastica, senza l'ansia di scadenze temporali arbitrarie.",
  },
  {
    id: "alpha-capital",
    name: "Alpha Capital Group",
    category: "prop",
    tagline: "Zero Commissioni & Spread Raw Istituzionali",
    badge: "ZERO COMMISSIONI",
    badgeTone: "slate",
    platforms: ["cTrader", "MT5"],
    spreadOrDrawdown: "Zero Commissioni · Spread 0 pip su Indici e FX",
    serverExamples: ["AlphaCapital-Live", "AlphaCapital-Demo"],
    keyStrengths: [
      "Broker proprietario con spread raw e zero commissioni operative",
      "Dashboard analitica avanzata compatibile con export dati del Libro della Verità",
      "Regole di esecuzione snelle e chiare pensate per trader tecnici",
    ],
    whyAureus:
      "Condizioni di costo ideali per strategie ad alto turnover o swing strutturale senza erosione del capitale da commissioni.",
  },
];

export function RecommendedBrokersAndProps({
  onSelectBroker,
}: {
  onSelectBroker?: (brokerName: string, serverExample?: string) => void;
}) {
  return (
    <div className="space-y-6 font-sans">
      {/* Testata di Rigore ed Ethos AUREUS */}
      <div className="rounded-xl border border-[#C5A059]/30 bg-gradient-to-r from-[#0d0f14] via-[#11131c] to-[#0d0f14] p-4 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-4 w-4 text-[#E8C56A]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A]">
            I Presidi dell&apos;Esecuzione · Criteri di Selezione AUREUS
          </span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          AUREUS non sponsorizza casinò retail né broker market-maker manipolativi. I partner e le prop firm raccomandate
          in questa corte rispettano criteri rigorosi: <strong>regolamentazione solida</strong>, <strong>spread reali da 0.0 pip</strong>,
          <strong>assenza di stop-hunting fraudolento</strong> e <strong>drawdown statici trasparenti</strong>.
        </p>
        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <Lock className="h-3 w-3 text-[#10b981]" />
          <span>Collegamento solo in <strong>Sola Lettura (Investor Password)</strong>: i tuoi fondi non possono essere toccati dall&apos;applicazione.</span>
        </div>
      </div>

      {/* Sezione 1: Broker ECN / Raw Spread Raccomandati */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#E8C56A]" />
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
              Broker ECN / Raw Spread Selezionati
            </h3>
          </div>
          <span className="font-mono text-[10px] text-slate-400 uppercase">Per Conti Personali &amp; Esecuzione Istituzionale</span>
        </div>

        <div className="grid gap-3.5 md:grid-cols-3">
          {RECOMMENDED_BROKERS.map((broker) => (
            <div
              key={broker.id}
              className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#0d0f14]/90 p-3.5 transition-all hover:border-[#C5A059]/50 hover:shadow-[0_0_20px_rgba(197,160,89,0.12)]"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 className="font-mono text-base font-bold text-white tracking-tight">{broker.name}</h4>
                  <span
                    className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
                      broker.badgeTone === "emerald"
                        ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                        : broker.badgeTone === "gold"
                          ? "bg-[#C5A059]/15 border-[#C5A059]/35 text-[#E8C56A]"
                          : "bg-white/5 border-white/15 text-slate-300"
                    }`}
                  >
                    {broker.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mb-2.5">{broker.tagline}</p>

                <div className="rounded-md bg-black/40 border border-white/5 p-2 mb-3 space-y-1 font-mono text-[10.5px]">
                  <div className="text-[#E8C56A] font-bold whitespace-nowrap">{broker.spreadOrDrawdown}</div>
                  <div className="text-slate-400 text-[10px]">Piattaforme: {broker.platforms.join(", ")}</div>
                </div>

                <div className="space-y-1.5 mb-3">
                  {broker.keyStrengths.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded border-l-2 border-[#C5A059] bg-[#C5A059]/10 px-2 py-1.5 text-[10.5px] text-slate-300 italic mb-3">
                  {broker.whyAureus}
                </div>
              </div>

              {onSelectBroker && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectBroker(broker.name, broker.serverExamples[0])}
                  className="w-full mt-2 border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] hover:bg-[#C5A059]/25 hover:border-[#C5A059]/60 font-mono text-xs font-bold uppercase tracking-wider"
                >
                  <span>Collega {broker.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sezione 2: Prop Firm Sovrane Raccomandate */}
      <div className="space-y-3 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-[#10b981]" />
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
              Prop Firm Sovrane Selezionate
            </h3>
          </div>
          <span className="font-mono text-[10px] text-slate-400 uppercase">Allineamento 1:1 con Il Custode della Soglia</span>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-4">
          {RECOMMENDED_PROPS.map((prop) => (
            <div
              key={prop.id}
              className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#0d0f14]/90 p-3.5 transition-all hover:border-[#10b981]/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.12)]"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 className="font-mono text-base font-bold text-white tracking-tight">{prop.name}</h4>
                  <span
                    className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
                      prop.badgeTone === "emerald"
                        ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                        : "bg-[#C5A059]/15 border-[#C5A059]/35 text-[#E8C56A]"
                    }`}
                  >
                    {prop.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mb-2.5">{prop.tagline}</p>

                <div className="rounded-md bg-black/40 border border-white/5 p-2 mb-3 space-y-1 font-mono text-[10.5px]">
                  <div className="text-emerald-400 font-bold whitespace-nowrap">{prop.spreadOrDrawdown}</div>
                  <div className="text-slate-400 text-[10px]">Piattaforme: {prop.platforms.join(", ")}</div>
                </div>

                <div className="space-y-1.5 mb-3">
                  {prop.keyStrengths.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded border-l-2 border-emerald-500 bg-emerald-500/10 px-2 py-1.5 text-[10.5px] text-slate-300 italic mb-3">
                  {prop.whyAureus}
                </div>
              </div>

              {onSelectBroker && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectBroker(prop.name, prop.serverExamples[0])}
                  className="w-full mt-2 border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-500/60 font-mono text-xs font-bold uppercase tracking-wider"
                >
                  <span>Collega {prop.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
