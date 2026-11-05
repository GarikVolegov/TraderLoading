import React, { useState, useRef, useMemo } from "react";
import {
  ShieldCheck,
  Compass,
  Flame,
  BookOpen,
  Zap,
  CheckCircle2,
  Sparkles,
  Layers,
  Upload,
  FileCheck2,
  AlertCircle,
} from "lucide-react";
import { LimenResponsiveDrawer } from "@/components/ui/LimenResponsiveDrawer";
import { MobileChainWizard, type ChainStepMeta } from "@/components/ui/MobileChainWizard";
import { synestheticClick, synestheticConfirm, synestheticAlert } from "@/lib/soundFx";
import {
  verifySystemPassportDocument,
  type SystemPassportPayload,
} from "@/lib/systemPassportHash";

export interface SystemTutorialRulesDraft {
  markets: string;
  windows: string;
  setup: string;
  entry: string;
  exit: string;
  invalidation: string;
  waitConditions: string;
  currency: string;
  riskPerTrade: number;
  maxDailyLoss: number;
  maxDailyTrades: number;
  checklist: string;
}

export interface SystemTutorialPreset {
  id: string;
  code: string;
  name: string;
  tagline: string;
  premise: string;
  rules: SystemTutorialRulesDraft;
}

export const SYSTEM_TUTORIAL_PRESETS: readonly SystemTutorialPreset[] = [
  {
    id: "ict-liquidity-sweep",
    code: "ARCHETIPO I · LIQUIDITÀ",
    name: "Protocollo Sweep & Inversione Strutturale",
    tagline: "Caccia di liquidità su massimi/minimi di sessione + rottura di struttura (BOS).",
    premise:
      "Operare esclusivamente dopo la presa di liquidità di un livello chiave di Londra o New York con spostamento impulsivo e squilibrio (FVG) confermato.",
    rules: {
      markets: "EUR/USD, GBP/USD, XAU/USD",
      windows: "Londra 08:00-11:00 UTC · New York 13:30-16:30 UTC",
      setup: "Sweep di liquidità su High/Low di sessione precedente + Displacement + Fair Value Gap (M15/M5).",
      entry: "Ritracciamento al 50% del FVG o Order Block su M5 con candela di rifiuto a corpo pieno.",
      exit: "1° Target a 2R (parziale 50% + Stop a Breakeven), 2° Target su pool di liquidità opposta (3R+).",
      invalidation: "Chiusura candela M15 oltre l'estremo dello sweep o mancata reazione entro 45 minuti.",
      waitConditions: "Spread allargato, 15 min prima/dopo Red News (CPI, NFP, FOMC) o range compresso.",
      currency: "EUR",
      riskPerTrade: 50,
      maxDailyLoss: 150,
      maxDailyTrades: 2,
      checklist: [
        "Struttura H1/M15 allineata e liquidità di sessione spazzata",
        "Zero Red News (CPI/NFP/FOMC) nei prossimi 15 minuti",
        "Stop Loss tecnico calcolato e R:R minimo >= 1:2",
        "Stato mentale centrato (Zero rivalsa o fretta)",
      ].join("\n"),
    },
  },
  {
    id: "momentum-breakout",
    code: "ARCHETIPO II · MOMENTUM",
    name: "Protocollo Espansione & Pullback Istituzionale",
    tagline: "Continuazione direzionale a favore del flusso H4/H1 su apertura di sessione.",
    premise:
      "Seguire il flusso direzionale primario H4/H1 entrando solo sul primo pullback pulito dopo la rottura del range di apertura.",
    rules: {
      markets: "XAU/USD, NAS100, EUR/USD",
      windows: "Apertura Londra 08:00-10:30 UTC · Apertura NY 14:00-16:00 UTC",
      setup: "Struttura H1 allineata + rottura decisa del range asiatico o pre-NY con espansione di volume.",
      entry: "Pullback sul livello rotto (Break & Retest) con conferma su M5/M15.",
      exit: "Target fisso a 2.5R oppure trailing sotto l'ultimo swing strutturale M15.",
      invalidation: "Rientro completo e chiusura M15 all'interno del range precedente.",
      waitConditions: "Mercato laterale senza direzionalità H1 o assenza di catalizzatore volumetrico.",
      currency: "EUR",
      riskPerTrade: 100,
      maxDailyLoss: 200,
      maxDailyTrades: 2,
      checklist: [
        "Trend H4/H1 chiaramente direzionale",
        "Rottura con corpo pieno fuori dal range di sessione",
        "Rischio monetario conforme al piano patrimoniale",
        "Target primario posizionato prima di ostacoli macro",
      ].join("\n"),
    },
  },
  {
    id: "swing-strutturale",
    code: "ARCHETIPO III · SWING",
    name: "Protocollo Struttura Sovrana H4 / Daily",
    tagline: "Operatività selettiva a bassa frequenza su zone di domanda e offerta macro.",
    premise:
      "Catturare espansioni multi-giornaliere su zone Daily/H4 riducendo il rumore intraday a 1 sola decisione ad alta probabilità.",
    rules: {
      markets: "EUR/USD, USD/JPY, XAU/USD, BTC/USD",
      windows: "Controllo chiusure H4 (08:00, 12:00, 16:00, 20:00 UTC)",
      setup: "Zona Supply/Demand Daily testata + cambio di carattere (CHoCH) verificato su H1.",
      entry: "Ordine Limit o Market su test della zona H1 con Stop Loss oltre il minimo/massimo strutturale.",
      exit: "1° parziale a 1.5R + BE, chiusura finale su livello strutturale Daily (3R - 4R).",
      invalidation: "Violazione con chiusura H4 oltre la zona di origine della spinta.",
      waitConditions: "Prezzo a metà del range Daily (terra di nessuno) o vigilia di decisioni tassi.",
      currency: "EUR",
      riskPerTrade: 100,
      maxDailyLoss: 200,
      maxDailyTrades: 1,
      checklist: [
        "Prezzo in zona estrema Premium/Discount Daily",
        "Cambio di carattere H1 confermato a chiusura candela",
        "Rapporto Rischio/Rendimento >= 1:3",
        "Accettazione totale del rischio prima dell'esecuzione",
      ].join("\n"),
    },
  },
];

const TUTORIAL_STORAGE_KEY = "aureus_system_chain_tutorial_seen_v1";

export function hasSeenSystemTutorial(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markSystemTutorialSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
  } catch {
    // ignore storage errors
  }
}

export interface SystemCompilationTutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyPreset?: (preset: SystemTutorialPreset) => void;
  onStartManualChain?: () => void;
  onImportJsonConstitution?: (
    payload: SystemPassportPayload,
    checklistItems: string[],
  ) => void;
}

export function SystemCompilationTutorialModal({
  open,
  onOpenChange,
  onApplyPreset,
  onStartManualChain,
  onImportJsonConstitution,
}: SystemCompilationTutorialModalProps) {
  const [step, setStep] = useState(0);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SYSTEM_TUTORIAL_PRESETS[0].id);
  const [modelTab, setModelTab] = useState<"archetypes" | "json_import">("archetypes");
  const [jsonInput, setJsonInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedJsonResult = useMemo(() => {
    if (!jsonInput.trim()) return null;
    return verifySystemPassportDocument(jsonInput);
  }, [jsonInput]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setJsonInput(text);
        synestheticClick();
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleApplyJsonConstitution = () => {
    if (!parsedJsonResult?.valid || !parsedJsonResult.payload) {
      synestheticAlert();
      return;
    }
    synestheticConfirm();
    markSystemTutorialSeen();
    onImportJsonConstitution?.(
      parsedJsonResult.payload,
      parsedJsonResult.checklistItems ?? [],
    );
    onOpenChange(false);
  };

  const selectedPreset =
    SYSTEM_TUTORIAL_PRESETS.find((p) => p.id === selectedPresetId) ?? SYSTEM_TUTORIAL_PRESETS[0];

  const steps: ChainStepMeta[] = [
    {
      id: "chain-vision",
      code: "01",
      title: "Architettura a Catena",
      subtitle: "Come ogni decisione nel Protocollo AUREUS si collega senza attrito da un livello al successivo.",
      completed: step > 0,
    },
    {
      id: "system-archetypes",
      code: "02",
      title: "Modelli di Sistema",
      subtitle: "Scegli un archetipo operativo pre-calibrato oppure osserva come strutturare le tue regole.",
      completed: step > 1,
    },
    {
      id: "five-steps-compiler",
      code: "03",
      title: "I 5 Anelli di Compilazione",
      subtitle: "Il compilatore del Sistema divide le regole in 5 pagine concatenate per azzerare gli errori.",
      completed: step > 2,
    },
    {
      id: "launch-protocol",
      code: "04",
      title: "Attivazione Guidata",
      subtitle: "Avvia la compilazione passo-passo pre-caricando l'archetipo scelto o partendo da foglio bianco.",
      completed: step === 3,
    },
  ];

  const handleClose = () => {
    markSystemTutorialSeen();
    onOpenChange(false);
  };

  const handleApplyAndStart = () => {
    synestheticClick();
    markSystemTutorialSeen();
    onApplyPreset?.(selectedPreset);
    onOpenChange(false);
  };

  const handleManualStart = () => {
    synestheticClick();
    markSystemTutorialSeen();
    onStartManualChain?.();
    onOpenChange(false);
  };

  return (
    <LimenResponsiveDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) markSystemTutorialSeen();
        onOpenChange(next);
      }}
      title="Guida · Compilazione Sistema a Catena"
      description="AUREUS PROTOCOL // ARCHITETTURA MULTI-LIVELLO PASSO-PASSO"
      desktopClassName="max-w-2xl bg-[#07080b] border border-[#C5A059]/40"
      mobileClassName="max-h-[92dvh] bg-[#07080b] border-t border-[#C5A059]/40"
    >
      <div className="p-2 sm:p-3" data-testid="system-compilation-tutorial-modal">
        <MobileChainWizard
          steps={steps}
          activeStepIndex={step}
          onSelectStep={setStep}
          prevLabel={step === 0 ? "Chiudi" : "Passo Prec."}
          onPrev={step === 0 ? handleClose : () => setStep((s) => Math.max(0, s - 1))}
          finalActionLabel="Applica Archetipo & Compila"
          onFinalAction={handleApplyAndStart}
        >
          {step === 0 && (
            <div className="space-y-3" data-testid="tutorial-step-0">
              <div className="rounded-xl border border-[#C5A059]/30 bg-gradient-to-br from-[#11131c] to-[#07080b] p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-[9.5px] font-bold uppercase tracking-widest text-[#E8C56A]">
                    LA CATENA CAUSALE DELL'ORDINE
                  </span>
                  <span className="rounded border border-[#10b981]/35 bg-[#10b981]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-[#10b981] whitespace-nowrap">
                    5 Livelli Connessi
                  </span>
                </div>
                <p className="text-xs text-[#94a3b8] leading-snug">
                  In AUREUS nessun trade esiste nel vuoto: ogni pagina alimenta il livello successivo in una catena inviolabile.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    icon: <Compass className="w-3.5 h-3.5 text-[#C5A059]" />,
                    code: "ANELLO 01",
                    title: "La Costituzione del Sistema",
                    desc: "Definisci mercati, finestre, trigger, invalidazione e limiti di rischio.",
                  },
                  {
                    icon: <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />,
                    code: "ANELLO 02",
                    title: "Il Custode della Soglia",
                    desc: "Trasforma le regole del tuo sistema in un filtro pre-trade prima di aprire il Varco.",
                  },
                  {
                    icon: <Flame className="w-3.5 h-3.5 text-[#E8C56A]" />,
                    code: "ANELLO 03",
                    title: "La Forgia del Passato",
                    desc: "Collauda la versione del sistema su dati storici per misurare l'aspettativa matematica.",
                  },
                  {
                    icon: <BookOpen className="w-3.5 h-3.5 text-[#C5A059]" />,
                    code: "ANELLO 04 & 05",
                    title: "Libro della Verità & Patrimonio",
                    desc: "Sigilla le prove reali e trasferisci il surplus nei 5 Motori Patrimoniali.",
                  },
                ].map((item) => (
                  <div
                    key={item.code}
                    className="rounded-lg border border-[#C5A059]/20 bg-[#0d0f14] p-2.5 flex items-start gap-2.5"
                  >
                    <div className="mt-0.5 rounded border border-[#C5A059]/30 bg-[#11131c] p-1.5 shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#C5A059]">
                        {item.code}
                      </span>
                      <span className="block font-display text-xs font-bold text-[#F4F4F6]">
                        {item.title}
                      </span>
                      <p className="text-[11px] text-[#94a3b8] leading-snug mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3" data-testid="tutorial-step-1">
              {/* Selettore Modalità: Archetipi vs Importa JSON */}
              <div className="flex items-center gap-1.5 p-1 rounded-lg border border-[#26262E] bg-[#07080b]">
                <button
                  type="button"
                  onClick={() => {
                    synestheticClick();
                    setModelTab("archetypes");
                  }}
                  data-testid="tutorial-tab-archetypes"
                  className={`flex-1 py-1.5 px-2 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    modelTab === "archetypes"
                      ? "bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] shadow-sm"
                      : "text-[#94a3b8] hover:text-[#F4F4F6]"
                  }`}
                >
                  🏛️ Archetipi Istituzionali
                </button>
                <button
                  type="button"
                  onClick={() => {
                    synestheticClick();
                    setModelTab("json_import");
                  }}
                  data-testid="tutorial-tab-json-import"
                  className={`flex-1 py-1.5 px-2 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    modelTab === "json_import"
                      ? "bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] shadow-sm"
                      : "text-[#94a3b8] hover:text-[#F4F4F6]"
                  }`}
                >
                  📥 Importa Costituzione JSON
                </button>
              </div>

              {modelTab === "archetypes" ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#E8C56A]">
                      Seleziona un Archetipo di Partenza (Personalizzabile)
                    </span>
                    <span className="font-mono text-[9px] text-[#94a3b8] whitespace-nowrap">
                      1 Tap = Pre-Compila
                    </span>
                  </div>

                  <div className="space-y-2">
                    {SYSTEM_TUTORIAL_PRESETS.map((preset) => {
                      const active = preset.id === selectedPreset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            synestheticClick();
                            setSelectedPresetId(preset.id);
                          }}
                          data-testid={`tutorial-preset-${preset.id}`}
                          className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${
                            active
                              ? "border-[#C5A059] bg-[#C5A059]/12 shadow-[0_0_18px_rgba(197,160,89,0.18)]"
                              : "border-[#C5A059]/20 bg-[#0d0f14] hover:border-[#C5A059]/45"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#C5A059]">
                              {preset.code}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase whitespace-nowrap ${
                                active
                                  ? "bg-[#C5A059] text-[#07080b]"
                                  : "border border-[#C5A059]/25 text-[#94a3b8]"
                              }`}
                            >
                              {active ? "✓ Selezionato" : "Scegli"}
                            </span>
                          </div>
                          <div className="font-display text-xs sm:text-sm font-bold text-[#F4F4F6]">
                            {preset.name}
                          </div>
                          <p className="text-[11px] text-[#94a3b8] mt-0.5 leading-snug">
                            {preset.tagline}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[9.5px]">
                            <span className="rounded border border-[#C5A059]/30 bg-[#07080b] px-1.5 py-0.5 text-[#E8C56A] whitespace-nowrap">
                              Asset: {preset.rules.markets}
                            </span>
                            <span className="rounded border border-[#10b981]/30 bg-[#10b981]/10 px-1.5 py-0.5 text-[#10b981] whitespace-nowrap">
                              Rischio: {preset.rules.riskPerTrade} {preset.rules.currency}
                            </span>
                            <span className="rounded border border-[#ef4444]/30 bg-[#ef4444]/10 px-1.5 py-0.5 text-[#ef4444] whitespace-nowrap">
                              Stop Giornaliero: {preset.rules.maxDailyLoss} {preset.rules.currency}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-2.5" data-testid="tutorial-json-importer-panel">
                  <div className="rounded-lg border border-[#C5A059]/25 bg-[#0d0f14] p-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#E8C56A]">
                        Importatore Costituzione Sovrana (AUREUS PROTOCOL v1)
                      </span>
                      <p className="text-[11px] text-[#94a3b8] mt-0.5 leading-snug">
                        Carica un passaporto esportato precedentemente per reidratare tutti e 5 gli anelli.
                      </p>
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="tutorial-json-file-btn"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 px-2.5 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#E8C56A] transition-all whitespace-nowrap cursor-pointer active:scale-95"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Carica File .JSON</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='Incolla qui il JSON del passaporto {"protocol":"AUREUS_OS_SYSTEM_CONSTITUTION_V1", ...}'
                    data-testid="tutorial-json-textarea"
                    className="w-full rounded-lg border border-[#26262E] bg-[#07080b] p-2 font-mono text-[10px] text-[#F4F4F6] focus:border-[#C5A059]/60 focus:outline-none"
                  />

                  {parsedJsonResult && (
                    <div>
                      {parsedJsonResult.valid && parsedJsonResult.payload ? (
                        <div
                          className="rounded-lg border border-[#10b981]/40 bg-[#10b981]/10 p-2.5 space-y-2"
                          data-testid="tutorial-json-valid-banner"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#10b981]">
                                COSTITUZIONE VALIDA &amp; VERIFICATA
                              </span>
                            </div>
                            <span className="font-mono text-[9px] text-[#E8C56A]">
                              0x{parsedJsonResult.computedHash?.slice(0, 12)}…
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-left">
                            <div className="rounded border border-[#26262E] bg-[#07080b]/80 px-2 py-1">
                              <span className="block font-mono text-[8px] uppercase text-[#94a3b8]">Sistema</span>
                              <span className="font-mono text-[10px] font-bold text-[#F4F4F6] truncate block">
                                {parsedJsonResult.payload.name}
                              </span>
                            </div>
                            <div className="rounded border border-[#26262E] bg-[#07080b]/80 px-2 py-1">
                              <span className="block font-mono text-[8px] uppercase text-[#94a3b8]">Mercati</span>
                              <span className="font-mono text-[10px] font-bold text-[#E8C56A] truncate block">
                                {parsedJsonResult.payload.markets}
                              </span>
                            </div>
                            <div className="rounded border border-[#26262E] bg-[#07080b]/80 px-2 py-1">
                              <span className="block font-mono text-[8px] uppercase text-[#94a3b8]">Rischio/Trade</span>
                              <span className="font-mono text-[10px] font-bold text-[#10b981] whitespace-nowrap block">
                                {parsedJsonResult.payload.riskPerTrade} {parsedJsonResult.payload.currency}
                              </span>
                            </div>
                            <div className="rounded border border-[#26262E] bg-[#07080b]/80 px-2 py-1">
                              <span className="block font-mono text-[8px] uppercase text-[#94a3b8]">Clausole Custode</span>
                              <span className="font-mono text-[10px] font-bold text-[#F4F4F6] whitespace-nowrap block">
                                {parsedJsonResult.checklistItems?.length || 0} Regole
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleApplyJsonConstitution}
                            data-testid="tutorial-apply-imported-json-btn"
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#10b981]/50 bg-[#10b981]/20 hover:bg-[#10b981]/30 py-2 font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#10b981] transition-all cursor-pointer active:scale-95"
                          >
                            <FileCheck2 className="w-4 h-4 text-[#10b981]" />
                            <span>Reidrata i 5 Anelli con questa Costituzione (1-Tap)</span>
                          </button>
                        </div>
                      ) : (
                        <div
                          className="rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 p-2.5 flex items-center gap-2"
                          data-testid="tutorial-json-error-banner"
                        >
                          <AlertCircle className="w-4 h-4 text-[#ef4444] shrink-0" />
                          <div className="min-w-0">
                            <span className="block font-mono text-[9.5px] font-bold uppercase text-[#ef4444]">
                              Documento non conforme al Protocollo
                            </span>
                            <p className="font-mono text-[9px] text-[#ef4444]/80 truncate">
                              {parsedJsonResult.reason || "Formato JSON o protocollo non riconosciuto"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2.5" data-testid="tutorial-step-2">
              <div className="rounded-lg border border-[#C5A059]/25 bg-[#0d0f14] p-2.5">
                <span className="block font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#E8C56A]">
                  Mappa delle 5 Pagine Concatenate del Compilatore
                </span>
                <p className="text-[11px] text-[#94a3b8] mt-0.5 leading-snug">
                  Ogni pagina contiene solo i controlli essenziali per quel livello, con chip rapide per compilare su mobile senza fatica:
                </p>
              </div>

              <div className="space-y-1.5">
                {[
                  {
                    stepNum: "PAGINA 01",
                    title: "Identità & Mercati Eletti",
                    detail: `Nome versione, Strumenti e selezione rapida asset (${selectedPreset.rules.markets}).`,
                  },
                  {
                    stepNum: "PAGINA 02",
                    title: "Finestre Operative & Setup",
                    detail: `Orari ad alta probabilità (${selectedPreset.rules.windows}) e struttura del setup.`,
                  },
                  {
                    stepNum: "PAGINA 03",
                    title: "Ingresso, Uscita & Invalidazione",
                    detail: "Trigger oggettivo d'entrata, presa di profitto e punto esatto in cui la tesi decade.",
                  },
                  {
                    stepNum: "PAGINA 04",
                    title: "Governo del Rischio & Attesa",
                    detail: `Rischio per trade (${selectedPreset.rules.riskPerTrade} ${selectedPreset.rules.currency}), perdita max (${selectedPreset.rules.maxDailyLoss} ${selectedPreset.rules.currency}) e filtro Red News.`,
                  },
                  {
                    stepNum: "PAGINA 05",
                    title: "Custode della Soglia & Sigillo",
                    detail: "Checklist pre-trade, riepilogo delle clausole e generazione della versione immutabile.",
                  },
                ].map((ring) => (
                  <div
                    key={ring.stepNum}
                    className="rounded-lg border border-[#C5A059]/20 bg-[#11131c]/90 px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#C5A059] whitespace-nowrap">
                          {ring.stepNum}
                        </span>
                        <span className="font-display text-xs font-bold text-[#F4F4F6] truncate">
                          {ring.title}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[#94a3b8] truncate mt-0.5">
                        {ring.detail}
                      </p>
                    </div>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3" data-testid="tutorial-step-3">
              <div className="rounded-xl border border-[#C5A059]/40 bg-gradient-to-br from-[#11131c] via-[#0d0f14] to-[#07080b] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-bold uppercase tracking-widest text-[#E8C56A]">
                    <Sparkles className="w-3 h-3 text-[#C5A059]" />
                    PRONTO ALLA FORGIATURA DEL SISTEMA
                  </span>
                  <span className="rounded border border-[#C5A059]/40 bg-[#C5A059]/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#E8C56A] whitespace-nowrap">
                    {selectedPreset.code}
                  </span>
                </div>
                <div className="font-display text-sm font-bold text-[#F4F4F6]">
                  {selectedPreset.name}
                </div>
                <p className="text-xs text-[#94a3b8] leading-snug">
                  {selectedPreset.premise}
                </p>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div className="rounded border border-[#C5A059]/20 bg-[#07080b] p-2">
                    <span className="block font-mono text-[8.5px] uppercase text-[#94a3b8]">Rischio/Trade</span>
                    <span className="font-mono text-xs font-bold text-[#10b981] whitespace-nowrap">
                      {selectedPreset.rules.riskPerTrade} {selectedPreset.rules.currency}
                    </span>
                  </div>
                  <div className="rounded border border-[#C5A059]/20 bg-[#07080b] p-2">
                    <span className="block font-mono text-[8.5px] uppercase text-[#94a3b8]">Max Loss/Giorno</span>
                    <span className="font-mono text-xs font-bold text-[#ef4444] whitespace-nowrap">
                      {selectedPreset.rules.maxDailyLoss} {selectedPreset.rules.currency}
                    </span>
                  </div>
                  <div className="rounded border border-[#C5A059]/20 bg-[#07080b] p-2">
                    <span className="block font-mono text-[8.5px] uppercase text-[#94a3b8]">Max Operazioni</span>
                    <span className="font-mono text-xs font-bold text-[#E8C56A] whitespace-nowrap">
                      {selectedPreset.rules.maxDailyTrades} Trade
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {parsedJsonResult?.valid && (
                  <button
                    type="button"
                    onClick={handleApplyJsonConstitution}
                    data-testid="tutorial-apply-json-final-btn"
                    className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl border border-[#10b981]/60 bg-[#10b981]/20 hover:bg-[#10b981]/30 px-3.5 py-2.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#10b981] transition-all cursor-pointer active:scale-95"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">Avvia con Costituzione Importata ({parsedJsonResult.payload?.name})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleApplyAndStart}
                  data-testid="tutorial-apply-preset-btn"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#C5A059] bg-[#C5A059] hover:bg-[#E8C56A] px-3.5 py-2.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#07080b] transition-all cursor-pointer shadow-[0_0_18px_rgba(197,160,89,0.28)]"
                >
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Pre-Carica Archetipo & Avvia Catena</span>
                </button>
                <button
                  type="button"
                  onClick={handleManualStart}
                  data-testid="tutorial-start-manual-btn"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#C5A059]/35 bg-[#0d0f14] hover:border-[#C5A059] px-3.5 py-2.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#E8C56A] transition-all cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Compila da Zero in 5 Passi</span>
                </button>
              </div>
            </div>
          )}
        </MobileChainWizard>
      </div>
    </LimenResponsiveDrawer>
  );
}
