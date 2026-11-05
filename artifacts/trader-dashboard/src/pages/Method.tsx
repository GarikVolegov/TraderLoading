import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Sparkles, Compass, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useGetChecklist, useGetUserSettings } from "@workspace/api-client-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { useTraderProcess, useProcessMutation } from "@/hooks/useTraderProcess";
import { useMethodDraft } from "@/hooks/useMethodDraft";
import { SessionDraftStatus } from "@/components/process/SessionDraftStatus";
import {
  activateProcessMethod,
  addProcessEvidence,
  advanceProcessMethod,
  createProcessMethod,
  fetchProcessHistory,
  type CreateProcessMethod,
  type ProcessMethod,
  type ProcessMethodDraft,
  type ProcessState,
  type AddProcessEvidence,
} from "@/lib/traderProcessApi";
import { processDay, calculateNetR } from "../../../../contracts/trader-process";
import { parseProcessDateTime, processDateTimeInput } from "@/lib/processDateTime";
import {
  ProcessError,
  ProcessField,
  ProcessLink,
  ProcessLoading,
  ProcessPanel,
  ProgressDetails,
  useProcessCopy,
} from "@/components/process/ProcessUI";
import type { ProcessCopyKey } from "@/lib/processCopy";
import { ProcessNextAction } from "@/components/process/ProcessNextAction";
import { useLanguage } from "@/contexts/LanguageContext";
import { journeyText } from "@/lib/processJourneyCopy";
import { PREPARATION_TOOLS } from "@/lib/workspaceTools";
import { useFinancialProfile } from "@/lib/financialProfileApi";
import { useFreeTrial } from "@/lib/useFreeTrial";
import { PageLayout } from "@/components/PageLayout";
import { DailyOrderPulseHeader } from "@/components/daily-order/DailyOrderPulseHeader";
import { DailyOrderQuickDock } from "@/components/daily-order/DailyOrderQuickDock";
import { DailyOrderStages } from "@/components/daily-order/DailyOrderStageCard";
import { DailyOrderMethodConsole } from "@/components/daily-order/DailyOrderMethodConsole";
import { useRoutineStorage } from "@/hooks/useRoutineStorage";
import { loadRoutineCompletions } from "@/pages/Routine.storage";
import { MobileChainWizard, QuickSelectChipBar, type ChainStepMeta } from "@/components/ui/MobileChainWizard";
import {
  SystemCompilationTutorialModal,
  hasSeenSystemTutorial,
  type SystemTutorialPreset,
} from "@/components/process/SystemCompilationTutorialModal";
import { SystemPassportCard } from "@/components/process/SystemPassportCard";
import type { SystemPassportPayload } from "@/lib/systemPassportHash";

const QUICK_MARKETS = ["EUR/USD", "GBP/USD", "XAU/USD", "NAS100", "USD/JPY", "BTC/USD"] as const;
const QUICK_WINDOWS = [
  "Londra 08:00-11:00 UTC",
  "New York 13:30-16:30 UTC",
  "Overlap 13:30-16:00 UTC",
  "Chiusure H4",
] as const;
const QUICK_SETUPS = [
  "Sweep Liquidità + BOS + FVG (M15/M5)",
  "Break & Retest Strutturale H1",
  "Zona Supply/Demand Daily + CHoCH M15",
] as const;
const QUICK_ENTRIES = [
  "Ritracciamento al 50% FVG / Order Block",
  "Chiusura candela M5 a corpo pieno",
  "Ordine Limit su livello strutturale testato",
] as const;
const QUICK_EXITS = [
  "Parziale 50% a 2R + Stop a Breakeven",
  "Target fisso 2.5R su pool di liquidità",
  "Trailing sotto ultimo swing M15",
] as const;
const QUICK_INVALIDATIONS = [
  "Chiusura M15 oltre l'estremo dello sweep",
  "Rientro completo nel range di partenza",
  "Mancata espansione entro 45 minuti",
] as const;
const QUICK_WAIT_CONDITIONS = [
  "15 min pre/post Red News (CPI, NFP, FOMC)",
  "Spread allargato / Bassa liquidità",
  "Prezzo a metà del range senza struttura",
] as const;
const QUICK_CHECKLIST_ITEMS = [
  "Struttura HTF (H4/H1) chiaramente allineata",
  "Zero Red News nei prossimi 15 minuti",
  "Stop Loss tecnico e R:R minimo >= 1:2",
  "Stato mentale centrato (Zero rivalsa)",
] as const;

type Draft = Record<string, string | boolean>;
function methodDraft(method?: ProcessMethod | null): Draft {
  return method
    ? {
        name: method.name,
        ...method.rules,
        markets: method.rules.markets.join(", "),
        checklist: method.rules.checklist.join("\n"),
        tools: (method.rules.tools ?? ["markets", "economic-calendar"]).join(","),
        ...Object.fromEntries(
          Object.entries(method.protocol ?? {}).map(([key, value]) => [key, String(value)]),
        ),
        riskPerTrade: String(method.rules.riskPerTrade),
        maxDailyLoss: String(method.rules.maxDailyLoss),
        maxDailyTrades: String(method.rules.maxDailyTrades),
        periodStart: processDay(),
        periodEnd: "",
        riskConfirmed: false,
      }
    : { periodStart: processDay(), riskConfirmed: false };
}
export function MethodEditor({
  previous,
  stored,
  onDone,
  onCancel,
}: {
  previous: ProcessMethod | null;
  stored: ProcessMethodDraft | null;
  onDone: (created?: ProcessMethod) => void;
  onCancel: () => void;
}) {
  const copy = useProcessCopy();
  const { language, t } = useLanguage();
  const journey = (key: Parameters<typeof journeyText>[1]) => journeyText(language, key);
  const { selectedPairs } = useBackground();
  const settings = useGetUserSettings();
  const { data: finProfile } = useFinancialProfile();
  const { isFreeTrial } = useFreeTrial();
  const checklist = useGetChecklist();
  const defaultChecklist = useRef(copy("defaultChecklist"));
  const checklistLoaded = useRef(Boolean(checklist.data));
  const defaults = useRef<Draft>({
    ...methodDraft(previous),
    ...(!previous
      ? {
          markets: selectedPairs.join(", "),
          tools: "markets,economic-calendar",
          currency: "EUR",
          maxDailyLoss:
            settings.data?.maxDailyLoss == null ? "" : String(settings.data.maxDailyLoss),
          checklist:
            (checklist.data ?? []).map((item) => item.text).join("\n") || defaultChecklist.current,
        }
      : {}),
  });
  const draft = useMethodDraft(stored, defaults.current, previous?.id ?? null, onDone);
  const { value: values, setValue: setValues, setStep } = draft;
  const step = Math.min(draft.step, 1);
  const [chainPage, setChainPage] = useState<number>(() => (step === 1 ? 3 : 0));
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(() => !previous && !hasSeenSystemTutorial());

  const selectChainPage = (nextPage: number) => {
    const clamped = Math.max(0, Math.min(4, nextPage));
    setChainPage(clamped);
    const targetDraftStep: 0 | 1 = clamped >= 3 ? 1 : 0;
    if (draft.step !== targetDraftStep) {
      setStep(targetDraftStep);
    }
  };

  const applyTutorialPreset = (preset: SystemTutorialPreset) => {
    setValues((v) => ({
      ...v,
      name: preset.name,
      markets: preset.rules.markets,
      windows: preset.rules.windows,
      setup: preset.rules.setup,
      entry: preset.rules.entry,
      exit: preset.rules.exit,
      invalidation: preset.rules.invalidation,
      waitConditions: preset.rules.waitConditions,
      currency: preset.rules.currency,
      riskPerTrade: String(preset.rules.riskPerTrade),
      maxDailyLoss: String(preset.rules.maxDailyLoss),
      maxDailyTrades: String(preset.rules.maxDailyTrades),
      checklist: preset.rules.checklist,
      riskConfirmed: false,
    }));
    selectChainPage(0);
  };

  const handleImportJsonConstitution = (
    imported: SystemPassportPayload,
    clauses: string[],
  ) => {
    setValues((prev) => ({
      ...prev,
      name: imported.name,
      markets: imported.markets,
      windows: imported.windows,
      setup: imported.setup,
      entry: imported.entry,
      exit: imported.exit,
      invalidation: imported.invalidation,
      waitConditions: imported.waitConditions,
      currency: imported.currency,
      riskPerTrade: String(imported.riskPerTrade),
      maxDailyLoss: String(imported.maxDailyLoss),
      maxDailyTrades: String(imported.maxDailyTrades),
      checklist: clauses.length > 0 ? clauses.join("\n") : prev.checklist,
      riskConfirmed: false,
    }));
    selectChainPage(0);
  };

  useEffect(() => {
    if (previous || stored) return;
    const inheritedChecklist =
      !checklistLoaded.current && checklist.data
        ? checklist.data.map((item) => item.text).join("\n") || defaultChecklist.current
        : null;
    if (checklist.data) checklistLoaded.current = true;
    setValues((v) => ({
      ...v,
      markets: v.markets || selectedPairs.join(", "),
      currency: v.currency || "EUR",
      checklist:
        (inheritedChecklist && v.checklist === defaultChecklist.current
          ? inheritedChecklist
          : v.checklist) ||
        (checklist.data ?? []).map((item) => item.text).join("\n") ||
        defaultChecklist.current,
      maxDailyLoss:
        v.maxDailyLoss ||
        (settings.data?.maxDailyLoss == null ? "" : String(settings.data.maxDailyLoss)),
    }));
  }, [previous, stored, selectedPairs, checklist.data, settings.data?.maxDailyLoss, setValues]);
  const create = useProcessMutation(() => save());
  const requestId = useRef(crypto.randomUUID());
  const previousId = draft.previousVersionId;
  const stepHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stepHeading.current?.focus();
  }, [chainPage]);
  const field = (key: string, label: ProcessCopyKey, type = "text", min?: string, max?: string) => (
    <ProcessField
      key={key}
      label={copy(label)}
      hint={key === "name" ? copy("optionalName") : undefined}
    >
      {type === "textarea" ? (
        <textarea
          required={key !== "name"}
          rows={2}
          maxLength={4000}
          value={String(values[key] ?? "")}
          onChange={(event) =>
            setValues((v) => ({ ...v, [key]: event.target.value, riskConfirmed: false }))
          }
        />
      ) : (
        <input
          required={key !== "name"}
          type={type}
          min={min}
          max={max}
          step={
            type === "number"
              ? ["minSamples", "maxDailyTrades", "observationDays"].includes(key)
                ? "1"
                : "any"
              : undefined
          }
          maxLength={type === "text" ? 4000 : undefined}
          value={String(values[key] ?? "")}
          onChange={(event) =>
            setValues((v) => ({
              ...v,
              [key]: key === "currency" ? event.target.value.toUpperCase() : event.target.value,
              riskConfirmed: false,
            }))
          }
        />
      )}
    </ProcessField>
  );
  const save = async () => {
    const created = await draft.confirm(async (values, metadata) => {
      if (values.riskConfirmed !== true) throw new Error(copy("checklistConfirm"));
      const n = (key: string) => Number(values[key]);
      const s = (key: string) => String(values[key] ?? "").trim();
      const data: CreateProcessMethod = {
        requestId: requestId.current,
        ...metadata,
        ...(previousId ? { previousVersionId: previousId } : {}),
        name: s("name") || copy("defaultMethodName"),
        riskConfirmed: true,
        rules: {
          markets: [
            ...new Set(
              s("markets")
                .split(",")
                .map((value) => value.trim().toUpperCase())
                .filter(Boolean),
            ),
          ],
          tools: (["markets", "news", "economic-calendar", "sessions", "calculator"] as const).filter(id => s("tools").split(",").includes(id)),
          windows: s("windows"),
          setup: s("setup"),
          entry: s("entry"),
          exit: s("exit"),
          invalidation: s("invalidation"),
          waitConditions: s("waitConditions"),
          currency: s("currency"),
          riskPerTrade: n("riskPerTrade"),
          maxDailyLoss: n("maxDailyLoss"),
          maxDailyTrades: n("maxDailyTrades"),
          checklist: s("checklist")
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
        },
      };
      return createProcessMethod(data);
    });
    onDone(created);
    return created;
  };

  const chainSteps: ChainStepMeta[] = [
    {
      id: "identity-markets",
      code: "01",
      title: "Identità & Mercati",
      subtitle: "Definisci il nome della Costituzione, gli asset autorizzati e gli strumenti di preparazione.",
      completed: Boolean(String(values.markets ?? "").trim()),
    },
    {
      id: "windows-setup",
      code: "02",
      title: "Finestre & Setup",
      subtitle: "Stabilisci le finestre temporali ad alta probabilità e il modello strutturale.",
      completed: Boolean(String(values.windows ?? "").trim() && String(values.setup ?? "").trim()),
    },
    {
      id: "entry-exit-invalidation",
      code: "03",
      title: "Trigger & Stop",
      subtitle: "Codifica la conferma d'ingresso, la gestione del Take Profit e il punto di invalidazione.",
      completed: Boolean(
        String(values.entry ?? "").trim() &&
          String(values.exit ?? "").trim() &&
          String(values.invalidation ?? "").trim(),
      ),
    },
    {
      id: "risk-wait",
      code: "04",
      title: "Rischio & Attesa",
      subtitle: "Imposta quando restare flat e i limiti monetari inviolabili per singola operazione e giornata.",
      completed: Boolean(
        String(values.waitConditions ?? "").trim() &&
          Number(values.riskPerTrade) > 0 &&
          Number(values.maxDailyLoss) > 0 &&
          Number(values.maxDailyTrades) > 0,
      ),
    },
    {
      id: "threshold-seal",
      code: "05",
      title: "Custode & Sigillo",
      subtitle: "Verifica la checklist de Il Custode della Soglia e sigilla la versione immutabile del Sistema.",
      completed: Boolean(String(values.checklist ?? "").trim() && values.riskConfirmed === true),
    },
  ];

  return (
    <ProcessPanel
      title={copy(previousId ? "newVersion" : "create")}
      description={copy(chainPage < 3 ? "essentialHint" : "riskHint")}
    >
      {/* Banner Introduttivo & Accesso al Tutorial Guidato */}
      <div className="mb-3 rounded-xl border border-[#C5A059]/30 bg-gradient-to-r from-[#0d0f14] via-[#11131c] to-[#0d0f14] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 p-1.5 text-[#E8C56A] shrink-0 mt-0.5">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-widest text-[#E8C56A]">
                COMPILAZIONE DEL SISTEMA A CATENA (5 ANELLI)
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] leading-snug mt-0.5">
              Compila passo dopo passo con le chip rapide oppure avvia il Tutorial per pre-caricare un Archetipo Istituzionale.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setTutorialOpen(true)}
          data-testid="open-system-tutorial-banner-btn"
          className="border-[#C5A059]/45 bg-[#C5A059]/12 hover:bg-[#C5A059]/25 text-[#E8C56A] font-mono text-[10px] font-bold uppercase tracking-wider shrink-0 whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#C5A059]" />
          Tutorial &amp; Archetipi
        </Button>
      </div>

      <h3
        ref={stepHeading}
        tabIndex={-1}
        className="sr-only"
      >
        {chainPage + 1} / 5 · {chainSteps[chainPage]?.title}
      </h3>

      <form
        className="process-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (chainPage < 4) selectChainPage(chainPage + 1);
          else create.mutate(undefined);
        }}
      >
        <fieldset disabled={create.isPending} className="process-form min-w-0">
          <MobileChainWizard
            steps={chainSteps}
            activeStepIndex={chainPage}
            onSelectStep={selectChainPage}
            onPrev={
              chainPage === 0
                ? () => {
                    void draft
                      .flush()
                      .then(onCancel)
                      .catch(() => undefined);
                  }
                : () => selectChainPage(chainPage - 1)
            }
            prevLabel={chainPage === 0 ? copy("resumeLater") : copy("back")}
            finalActionLabel={copy(create.isPending ? "saving" : "saveMethod")}
            onFinalAction={() => create.mutate(undefined)}
            isSubmitting={create.isPending || draft.status === "conflict"}
            onOpenTutorial={() => setTutorialOpen(true)}
            tutorialLabel="Guida"
          >
            {/* ── PAGINA 01: IDENTITÀ & MERCATI ELETTI ── */}
            {chainPage === 0 && (
              <div className="space-y-4" data-testid="method-chain-page-0">
                <div>
                  {field("name", "name")}
                  <QuickSelectChipBar
                    label="Nomi Costituzionali Suggeriti (1 Tap)"
                    options={[
                      "Protocollo Liquidità Londra",
                      "Momentum Sessione NY",
                      "Struttura Sovrana H4",
                    ]}
                    currentValue={String(values.name ?? "")}
                    mode="replace"
                    onSelect={(val) => setValues((v) => ({ ...v, name: val }))}
                  />
                </div>

                <div>
                  {field("markets", "markets")}
                  <QuickSelectChipBar
                    label="Aggiungi Mercati Eletti"
                    options={QUICK_MARKETS}
                    currentValue={String(values.markets ?? "")}
                    onSelect={(val) =>
                      setValues((v) => ({ ...v, markets: val, riskConfirmed: false }))
                    }
                  />
                </div>

                <div className="rounded-xl border border-[#C5A059]/20 bg-[#0d0f14] p-3 space-y-2">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[#E8C56A]">
                    {journey("tools")}
                  </span>
                  <p className="text-[11px] text-[#94a3b8] leading-snug">{journey("toolsHint")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {PREPARATION_TOOLS.map((tool) => {
                      const checked = String(values.tools ?? "")
                        .split(",")
                        .includes(tool.id);
                      return (
                        <label
                          key={tool.id}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-mono cursor-pointer transition-all ${
                            checked
                              ? "border-[#C5A059]/50 bg-[#C5A059]/15 text-[#F4F4F6] font-semibold"
                              : "border-[#26262E] bg-[#07080b] text-[#94a3b8]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setValues((value) => {
                                const selected = new Set(
                                  String(value.tools ?? "")
                                    .split(",")
                                    .filter(Boolean),
                                );
                                if (event.target.checked) selected.add(tool.id);
                                else selected.delete(tool.id);
                                return { ...value, tools: [...selected].join(",") };
                              })
                            }
                          />
                          <span>{t(tool.labelKey)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── PAGINA 02: FINESTRE OPERATIVE & SETUP ── */}
            {chainPage === 1 && (
              <div className="space-y-4" data-testid="method-chain-page-1">
                <div>
                  {field("windows", "windows")}
                  <QuickSelectChipBar
                    label="Finestre di Sessione Istituzionali"
                    options={QUICK_WINDOWS}
                    currentValue={String(values.windows ?? "")}
                    separator=" · "
                    onSelect={(val) =>
                      setValues((v) => ({ ...v, windows: val, riskConfirmed: false }))
                    }
                  />
                </div>

                <div>
                  {field("setup", "setup", "textarea")}
                  <QuickSelectChipBar
                    label="Archetipi di Setup (1 Tap)"
                    options={QUICK_SETUPS}
                    currentValue={String(values.setup ?? "")}
                    separator=" + "
                    onSelect={(val) =>
                      setValues((v) => ({ ...v, setup: val, riskConfirmed: false }))
                    }
                  />
                </div>
              </div>
            )}

            {/* ── PAGINA 03: TRIGGER D'INGRESSO, USCITA & INVALIDAZIONE ── */}
            {chainPage === 2 && (
              <div className="space-y-4" data-testid="method-chain-page-2">
                <div>
                  {field("entry", "entry", "textarea")}
                  <QuickSelectChipBar
                    label="Conferme Oggettive d'Ingresso"
                    options={QUICK_ENTRIES}
                    currentValue={String(values.entry ?? "")}
                    separator=" · "
                    onSelect={(val) =>
                      setValues((v) => ({ ...v, entry: val, riskConfirmed: false }))
                    }
                  />
                </div>

                <div>
                  {field("exit", "exit", "textarea")}
                  <QuickSelectChipBar
                    label="Protocolli di Take Profit & Gestione"
                    options={QUICK_EXITS}
                    currentValue={String(values.exit ?? "")}
                    separator=" · "
                    onSelect={(val) =>
                      setValues((v) => ({ ...v, exit: val, riskConfirmed: false }))
                    }
                  />
                </div>

                <div>
                  {field("invalidation", "invalidation", "textarea")}
                  <QuickSelectChipBar
                    label="Condizioni di Invalidazione & Stop"
                    options={QUICK_INVALIDATIONS}
                    currentValue={String(values.invalidation ?? "")}
                    separator=" · "
                    onSelect={(val) =>
                      setValues((v) => ({ ...v, invalidation: val, riskConfirmed: false }))
                    }
                  />
                </div>
              </div>
            )}

            {/* ── PAGINA 04: CONDIZIONI DI ATTESA & GOVERNO DEL RISCHIO ── */}
            {chainPage === 3 && (
              <div className="space-y-4" data-testid="method-chain-page-3">
                {!isFreeTrial && finProfile && finProfile.tradingAllocation > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#10B981] whitespace-nowrap">
                        Architettura Patrimoniale
                      </span>
                      <span className="text-muted-foreground">Capitale Allocato:</span>
                      <strong className="font-mono text-foreground whitespace-nowrap">
                        {finProfile.tradingAllocation.toLocaleString("it-IT")} €
                      </strong>
                    </div>
                    <Link
                      href="/patrimonio"
                      className="font-mono text-[10px] text-primary hover:underline whitespace-nowrap"
                    >
                      Modifica
                    </Link>
                  </div>
                )}

                <div>
                  {field("waitConditions", "waitConditions", "textarea")}
                  <QuickSelectChipBar
                    label="Filtri di Non-Intervento (Flat Obbligatorio)"
                    options={QUICK_WAIT_CONDITIONS}
                    currentValue={String(values.waitConditions ?? "")}
                    separator=" · "
                    onSelect={(val) =>
                      setValues((v) => ({ ...v, waitConditions: val, riskConfirmed: false }))
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    {field("currency", "currency")}
                    <QuickSelectChipBar
                      label="Valuta Conto"
                      options={["EUR", "USD", "GBP", "CHF"]}
                      currentValue={String(values.currency ?? "")}
                      mode="replace"
                      onSelect={(val) =>
                        setValues((v) => ({ ...v, currency: val, riskConfirmed: false }))
                      }
                    />
                  </div>
                  <div>
                    {field("maxDailyTrades", "maxTrades", "number", "1")}
                    <QuickSelectChipBar
                      label="Max Esecuzioni / Giorno"
                      options={["1", "2", "3", "4"]}
                      currentValue={String(values.maxDailyTrades ?? "")}
                      mode="replace"
                      onSelect={(val) =>
                        setValues((v) => ({ ...v, maxDailyTrades: val, riskConfirmed: false }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    {field("riskPerTrade", "riskPerTrade", "number", "0.000001")}
                    <QuickSelectChipBar
                      label="Rischio / Trade Rapido"
                      options={["25", "50", "100", "250"]}
                      currentValue={String(values.riskPerTrade ?? "")}
                      mode="replace"
                      onSelect={(val) =>
                        setValues((v) => ({ ...v, riskPerTrade: val, riskConfirmed: false }))
                      }
                    />
                  </div>
                  <div>
                    {field("maxDailyLoss", "maxLoss", "number", "0.000001")}
                    <QuickSelectChipBar
                      label="Max Loss Giornaliero"
                      options={["50", "100", "200", "500"]}
                      currentValue={String(values.maxDailyLoss ?? "")}
                      mode="replace"
                      onSelect={(val) =>
                        setValues((v) => ({ ...v, maxDailyLoss: val, riskConfirmed: false }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── PAGINA 05: CUSTODE DELLA SOGLIA & SIGILLO DELLA VERSIONE ── */}
            {chainPage === 4 && (
              <div className="space-y-4" data-testid="method-chain-page-4">
                <div>
                  {field("checklist", "checklistEditor", "textarea")}
                  <QuickSelectChipBar
                    label="Aggiungi Clausole a Il Custode della Soglia"
                    options={QUICK_CHECKLIST_ITEMS}
                    currentValue={String(values.checklist ?? "")}
                    separator="\n"
                    onSelect={(val) =>
                      setValues((v) => ({ ...v, checklist: val, riskConfirmed: false }))
                    }
                  />
                </div>

                {/* Scheda Sintetica di Revisione Pre-Sigillo */}
                <div className="rounded-xl border border-[#C5A059]/30 bg-[#0d0f14] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-[#C5A059]/15 pb-1.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#E8C56A]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
                      Dossier di Controllo Pre-Sigillo
                    </span>
                    <span className="font-mono text-[9.5px] text-[#94a3b8] whitespace-nowrap">
                      {String(values.name ?? "").trim() || copy("defaultMethodName")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px]">
                    <div className="rounded border border-[#26262E] bg-[#07080b] p-2">
                      <span className="block text-[8.5px] uppercase text-[#94a3b8]">Mercati</span>
                      <span className="font-bold text-[#F4F4F6] truncate block">
                        {String(values.markets ?? "—")}
                      </span>
                    </div>
                    <div className="rounded border border-[#26262E] bg-[#07080b] p-2">
                      <span className="block text-[8.5px] uppercase text-[#94a3b8]">Rischio/Trade</span>
                      <span className="font-bold text-[#10b981] whitespace-nowrap block">
                        {String(values.riskPerTrade || "0")} {String(values.currency || "EUR")}
                      </span>
                    </div>
                    <div className="rounded border border-[#26262E] bg-[#07080b] p-2">
                      <span className="block text-[8.5px] uppercase text-[#94a3b8]">Stop Giorno</span>
                      <span className="font-bold text-[#ef4444] whitespace-nowrap block">
                        -{String(values.maxDailyLoss || "0")} {String(values.currency || "EUR")}
                      </span>
                    </div>
                    <div className="rounded border border-[#26262E] bg-[#07080b] p-2">
                      <span className="block text-[8.5px] uppercase text-[#94a3b8]">Max Trade</span>
                      <span className="font-bold text-[#E8C56A] whitespace-nowrap block">
                        {String(values.maxDailyTrades || "0")} Esecuzioni
                      </span>
                    </div>
                  </div>
                </div>

                {/* Passaporto Crittografico del Sistema (QR Seal & Digest 64-Hex) */}
                <SystemPassportCard
                  payload={{
                    name: String(values.name ?? "").trim() || copy("defaultMethodName"),
                    versionNumber: previous ? previous.version + 1 : 1,
                    phase: previous?.phase || "define",
                    markets: String(values.markets ?? ""),
                    windows: String(values.windows ?? ""),
                    setup: String(values.setup ?? ""),
                    entry: String(values.entry ?? ""),
                    exit: String(values.exit ?? ""),
                    invalidation: String(values.invalidation ?? ""),
                    waitConditions: String(values.waitConditions ?? ""),
                    currency: String(values.currency || "EUR"),
                    riskPerTrade: Number(values.riskPerTrade || 0),
                    maxDailyLoss: Number(values.maxDailyLoss || 0),
                    maxDailyTrades: Number(values.maxDailyTrades || 0),
                    checklistCount: String(values.checklist ?? "")
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean).length,
                  }}
                  checklistItems={String(values.checklist ?? "")
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)}
                  initialShareToken={
                    typeof window !== "undefined"
                      ? new URLSearchParams(window.location.search).get("passport")
                      : null
                  }
                  onImportVerifiedSystem={(imported, clauses) => {
                    setValues((prev) => ({
                      ...prev,
                      name: imported.name,
                      markets: imported.markets,
                      windows: imported.windows,
                      setup: imported.setup,
                      entry: imported.entry,
                      exit: imported.exit,
                      invalidation: imported.invalidation,
                      waitConditions: imported.waitConditions,
                      currency: imported.currency,
                      riskPerTrade: String(imported.riskPerTrade),
                      maxDailyLoss: String(imported.maxDailyLoss),
                      maxDailyTrades: String(imported.maxDailyTrades),
                      checklist:
                        clauses.length > 0 ? clauses.join("\n") : prev.checklist,
                    }));
                  }}
                />

                <label className="process-option rounded-xl border border-[#C5A059]/35 bg-[#C5A059]/10 p-3 flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={values.riskConfirmed === true}
                    onChange={(event) =>
                      setValues((v) => ({ ...v, riskConfirmed: event.target.checked }))
                    }
                  />
                  <span className="text-xs font-medium text-[#F4F4F6]">
                    {copy("checklistConfirm")}
                  </span>
                </label>
              </div>
            )}
          </MobileChainWizard>

          <ProcessError error={create.error} />
        </fieldset>
      </form>
      <SessionDraftStatus {...draft} retry={draft.flush} scope="method" />

      <SystemCompilationTutorialModal
        open={tutorialOpen}
        onOpenChange={setTutorialOpen}
        onApplyPreset={applyTutorialPreset}
        onStartManualChain={() => selectChainPage(0)}
        onImportJsonConstitution={handleImportJsonConstitution}
      />
    </ProcessPanel>
  );
}
function EvidenceEditor({
  method,
  onDone,
  onCancel,
  userId,
}: {
  method: ProcessMethod;
  onDone: () => void;
  onCancel: () => void;
  userId: string | null | undefined;
}) {
  const copy = useProcessCopy();
  const { language } = useLanguage();
  const journey = (key: Parameters<typeof journeyText>[1]) => journeyText(language, key);
  const [environment, setEnvironment] = useState<NonNullable<AddProcessEvidence["executionEnvironment"]> | "">("");
  const [source, setSource] = useState<AddProcessEvidence["source"]>("manual");
  const [purpose, setPurpose] = useState<AddProcessEvidence["purpose"]>(
    method.phase === "verify" ? "validation" : "development",
  );
  const [tradeId, setTradeId] = useState("");
  const [risk, setRisk] = useState("");
  const [pnl, setPnl] = useState("");
  const [currency, setCurrency] = useState(method.rules.currency);
  const [account, setAccount] = useState("");
  const [costs, setCosts] = useState<AddProcessEvidence["costsStatus"]>("unknown");
  const defaultObservedAt = useRef(new Date());
  const [observedAt, setObservedAt] = useState(processDateTimeInput(defaultObservedAt.current, true));
  const [adherence, setAdherence] = useState<AddProcessEvidence["adherence"]>("unknown");
  const [note, setNote] = useState("");
  const [inputError, setInputError] = useState<unknown>(null);
  const requestId = useRef(crypto.randomUUID());
  const save = useProcessMutation(addProcessEvidence);
  const history = useQuery({
    queryKey: ["process-history", userId],
    queryFn: fetchProcessHistory,
    enabled: source === "account_trade" || source === "replay",
  });
  const annotations = useTraderProcess().data?.evidence ?? [];
  const candidates =
    source === "replay"
      ? (history.data?.replays ?? [])
      : (history.data?.trades ?? []).map((trade) => {
          const rows = annotations.filter(
            (e) => e.methodVersionId === method.id && e.accountTradeId === trade.id,
          );
          const risks = [...new Set(rows.map((e) => e.initialRisk).filter((v) => v != null))];
          const currencies = [...new Set(rows.map((e) => e.currency).filter((v) => v != null))];
          const costs = [...new Set(rows.map((e) => e.costsStatus))];
          return {
            ...trade,
            initialRisk: risks.length === 1 ? risks[0] : undefined,
            currency: currencies.length === 1 ? currencies[0] : undefined,
            costsStatus: costs.length === 1 ? costs[0] : undefined,
          };
        });
  const selected = candidates.find((item) => String(item.id) === tradeId);
  const canonical = Boolean(selected && (source === "account_trade" || source === "replay"));
  const needs = (key: "initialRisk" | "netPnl" | "currency" | "account") =>
    !canonical || (key !== "netPnl" && source !== "replay" && selected?.[key] == null);
  const selectTrade = (id: string) => {
    setTradeId(id);
    const trade = candidates.find((item) => String(item.id) === id);
    if (!trade) return;
    setPnl(trade.netPnl == null ? "" : String(trade.netPnl));
    setAccount(trade.account);
    setRisk(trade.initialRisk == null ? "" : String(trade.initialRisk));
    if (trade.currency) setCurrency(trade.currency);
    if (trade.closedAt) setObservedAt(processDateTimeInput(new Date(trade.closedAt), true));
    setCosts(trade.costsStatus === "included" ? "included" : "unknown");
    setPurpose(method.phase === "verify" && trade.executionEnvironment === "simulation" ? "validation" : ["apply", "consolidate"].includes(method.phase) && trade.executionEnvironment === "real" ? "live" : "development");
  };
  const submit = async () => {
    setInputError(null);
    try {
      await save.mutateAsync({
        requestId: requestId.current,
        methodVersionId: method.id,
        purpose,
        source,
        ...((source === "manual" || source === "external") && environment ? { executionEnvironment: environment } : {}),
        initialRisk: risk === "" ? null : Number(risk),
        netPnl: pnl === "" ? null : Number(pnl),
        costsStatus: costs,
        currency: currency || null,
        account: account || null,
        observedAt: observedAt === processDateTimeInput(defaultObservedAt.current, true) ? defaultObservedAt.current.toISOString() : parseProcessDateTime(observedAt),
        adherence,
        provenance: "declared",
        note,
        ...(source === "account_trade"
          ? { accountTradeId: Number(tradeId) }
          : source === "replay"
            ? { backtestTradeId: Number(tradeId) }
            : {}),
      });
      onDone();
    } catch (error) {
      setInputError(error);
    }
  };
  return (
    <ProcessPanel title={copy("evidenceTitle")} description={copy("evidenceHint")} focusHeading>
      <form
        className="process-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {(source === "manual" || source === "external") ? <ProcessField label={journey("environment")} hint={journey("environmentHint")}>
          <select required value={environment} onChange={event => setEnvironment(event.target.value as typeof environment)}>
            <option value="">—</option>
            {(["simulation", "real", "unknown"] as const).map(value => <option key={value} value={value}>{journey(value)}</option>)}
          </select>
        </ProcessField> : <p className="text-sm text-muted-foreground">{journey("environment")}: {journey(source === "replay" ? "simulation" : selected?.executionEnvironment ?? "unknown")}</p>}
        <div className="process-form-grid">
          <ProcessField label={copy("source")}>
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value as AddProcessEvidence["source"]);
                setTradeId("");
              }}
            >
              <option value="manual">{copy("manual")}</option>
              <option value="external">{copy("external")}</option>
              <option value="account_trade">{copy("history")}</option>
              <option value="replay">{copy("replay")}</option>
            </select>
          </ProcessField>
          <details className="self-start"><summary>{copy("purpose")}: {copy(purpose)}</summary>
          <ProcessField label={copy("purpose")}>
            <select
              value={purpose}
              onChange={(event) => setPurpose(event.target.value as AddProcessEvidence["purpose"])}
            >
              <option value="development">{copy("development")}</option>
              <option value="validation">{copy("validation")}</option>
              {["apply", "consolidate"].includes(method.phase) && <option value="live">{copy("live")}</option>}
            </select>
          </ProcessField></details>
        </div>
        {(source === "account_trade" || source === "replay") && (
          <>
            <p className="text-sm text-muted-foreground">{copy("historyHint")}</p>
            <ProcessField label={copy("history")}>
              <select
                required
                value={tradeId}
                onChange={(event) => selectTrade(event.target.value)}
              >
                <option value="">—</option>
                {candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.symbol} · {item.closedAt?.slice(0, 10)} · {item.netPnl ?? "—"} · #
                    {item.id}
                  </option>
                ))}
              </select>
            </ProcessField>
            <ProcessError error={history.error} />
            {history.isFetching && <p role="status">{copy("loading")}</p>}
          </>
        )}
        {canonical && (
          <dl className="process-summary">
            <div>
              <dt>{copy("initialRisk")}</dt>
              <dd>
                {risk || "—"} {currency}
              </dd>
            </div>
            <div>
              <dt>{copy("netPnl")}</dt>
              <dd>
                {pnl || "—"} {currency}
              </dd>
            </div>
            <div>
              <dt>{copy("account")}</dt>
              <dd>{account || "—"}</dd>
            </div>
          </dl>
        )}
        <div className="process-form-grid">
          {needs("initialRisk") && (
            <ProcessField label={copy("initialRisk")}>
              <input
                type="number"
                min="0.000001"
                step="any"
                value={risk}
                readOnly={source === "replay"}
                onChange={(event) => setRisk(event.target.value)}
              />
            </ProcessField>
          )}
          {needs("netPnl") && (
            <ProcessField label={copy("netPnl")}>
              <input
                type="number"
                step="any"
                value={pnl}
                readOnly={source === "account_trade" || source === "replay"}
                onChange={(event) => setPnl(event.target.value)}
              />
            </ProcessField>
          )}
          {needs("currency") && (
            <ProcessField label={copy("currency")}>
              <input
                value={currency}
                pattern="[A-Z]{3}"
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              />
            </ProcessField>
          )}
          {needs("account") && (
            <ProcessField label={copy("account")}>
              <input
                value={account}
                maxLength={200}
                onChange={(event) => setAccount(event.target.value)}
              />
            </ProcessField>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {copy("netR")}:{" "}
          {risk !== "" && pnl !== ""
            ? (calculateNetR(Number(pnl), Number(risk))?.toFixed(2) ?? "—")
            : "—"}{" "}
          · {copy(source === "replay" ? "replay" : "declared")}
        </p>
        {(!canonical || (source !== "replay" && selected?.costsStatus !== "included")) && (
          <ProcessField label={copy("costs")}>
            <select
              value={costs}
              onChange={(event) =>
                setCosts(event.target.value as AddProcessEvidence["costsStatus"])
              }
            >
              <option value="unknown">{copy("unknown")}</option>
              <option value="included">{copy("included")}</option>
              <option value="excluded">{copy("excluded")}</option>
            </select>
          </ProcessField>
        )}
        {!canonical && (
          <ProcessField label={copy("observedAt")}>
            <input
              required
              type="datetime-local"
              step="1"
              value={observedAt}
              onChange={(event) => setObservedAt(event.target.value)}
            />
          </ProcessField>
        )}
        <ProcessField label={copy("adherence")}>
          <select
            value={adherence}
            onChange={(event) =>
              setAdherence(event.target.value as AddProcessEvidence["adherence"])
            }
          >
            <option value="unknown">{copy("unknown")}</option>
            <option value="conforming">{copy("conforming")}</option>
            <option value="violation">{copy("violation")}</option>
          </select>
        </ProcessField>
        <ProcessField label={copy("evidenceNote")}>
          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={4000}
          />
        </ProcessField>
        <ProcessError error={inputError || save.error} />
        <div className="process-actions">
          <Button type="submit" disabled={save.isPending}>
            {copy(save.isPending ? "saving" : "saveEvidence")}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {copy("cancel")}
          </Button>
        </div>
      </form>
    </ProcessPanel>
  );
}
export function VerificationStart({ method, initiallyOpen = false }: { method: ProcessMethod; initiallyOpen?: boolean }) {
  const copy = useProcessCopy();
  const [open, setOpen] = useState(initiallyOpen);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(method.protocol ?? { periodStart: processDay() }).map(([k, v]) => [
        k,
        String(v),
      ]),
    ),
  );
  const save = useProcessMutation(advanceProcessMethod);
  const field = (
    key: string,
    label: ProcessCopyKey,
    type: "date" | "number",
    min?: string,
    max?: string,
  ) => (
    <ProcessField key={key} label={copy(label)}>
      <input
        required
        type={type}
        min={min}
        max={max}
        step={
          type === "number"
            ? ["minSamples", "observationDays"].includes(key)
              ? "1"
              : "any"
            : undefined
        }
        value={values[key] ?? ""}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
    </ProcessField>
  );
  if (!open)
    return (
      <Button className="self-start min-h-11" onClick={() => setOpen(true)}>
        {copy("startVerification")}
        <ArrowRight size={16} />
      </Button>
    );
  return (
    <form
      className="process-form"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          id: method.id,
          expectedPhase: "define",
          review: copy("confirmProtocol"),
          ...(!method.protocol
            ? {
                protocol: {
                  minSamples: Number(values.minSamples),
                  periodStart: values.periodStart,
                  periodEnd: values.periodEnd,
                  minExpectancyR: Number(values.minExpectancyR),
                  maxDrawdownR: Number(values.maxDrawdownR),
                  observationDays: Number(values.observationDays),
                  minAdherencePct: Number(values.minAdherencePct),
                },
              }
            : {}),
        });
      }}
    >
      <h3
        ref={heading}
        tabIndex={-1}
        className={`${initiallyOpen ? "sr-only" : "text-sm font-medium"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4`}
      >
        {copy("startVerification")}
      </h3>
      <p className="text-sm text-muted-foreground">{copy("protocolHint")}</p>
      <fieldset disabled={save.isPending || Boolean(method.protocol)} className="process-form-grid">
        {field("periodStart", "periodStart", "date", processDay())}
        {field("periodEnd", "periodEnd", "date", values.periodStart || processDay())}
        {field("minSamples", "minSamples", "number", "1")}
        {field("observationDays", "observationDays", "number", "1")}
        {field("minExpectancyR", "minExpectancy", "number")}
        {field("maxDrawdownR", "maxDrawdown", "number", "0.000001")}
        {field("minAdherencePct", "minAdherence", "number", "0", "100")}
      </fieldset>
      <details>
        <summary>{copy("methodExamples")}</summary>
        <p className="text-sm pt-3">{copy("methodProtocolHelp")}</p>
      </details>
      <ProcessError error={save.error} />
      <div className="process-actions">
        <Button type="submit" disabled={save.isPending}>
          {copy(save.isPending ? "saving" : "protocolFinalConfirm")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {copy("back")}
        </Button>
      </div>
    </form>
  );
}
export function MethodDetails({
  state,
  onEdit,
  readOnly = false,
}: {
  readOnly?: boolean;
  state: ProcessState;
  onEdit: (method: ProcessMethod | null) => void;
}) {
  const copy = useProcessCopy();
  const { language } = useLanguage();
  const journey = (key: Parameters<typeof journeyText>[1]) => journeyText(language, key);
  const method = state.activeMethod!;
  const [review, setReview] = useState("");
  const advance = useProcessMutation(advanceProcessMethod);
  const activate = useProcessMutation(activateProcessMethod);
  const rows = state.evidence.filter((e) => e.methodVersionId === method.id);
  const guidance = state.guidance;
  const canAdvance = guidance?.action === "review_verification" || guidance?.action === "review_application";
  return (
    <>
      <ProcessPanel
        title={`${method.name} · ${copy("version")} ${method.version}`}
        description={copy("progress")}
      >
        {!readOnly && <ProcessNextAction state={state} action={!["confirm_verification", "review_verification", "review_application"].includes(guidance?.action ?? "")} />}
        <details>
          <summary>{copy("progressDetails")}</summary>
          <ProgressDetails progress={state.progress} />
        </details>
        {!readOnly && method.phase === "define" && (
          <>
            {guidance?.action === "confirm_verification" && <VerificationStart method={method} />}
            <Button
              type="button"
              variant={guidance?.action === "revise_method" ? "default" : "ghost"}
              className="self-start"
              onClick={() => onEdit(method)}
            >
              {copy("newVersion")}
            </Button>
          </>
        )}
        {!readOnly && method.phase !== "consolidate" && method.phase !== "define" && (
          <form
            className="process-form"
            onSubmit={(event) => {
              event.preventDefault();
              advance.mutate(
                { id: method.id, expectedPhase: method.phase, review },
                { onSuccess: () => setReview("") },
              );
            }}
          >
            {canAdvance && (
              <ProcessField label={copy("reviewNote")} hint={copy("reviewHint")}>
                <textarea
                  required
                  value={review}
                  maxLength={4000}
                  rows={3}
                  onChange={(event) => setReview(event.target.value)}
                />
              </ProcessField>
            )}
            <ProcessError error={advance.error} />
            <div className="process-actions">
              {canAdvance ? (
                <Button type="submit" disabled={advance.isPending}>
                  {copy(advance.isPending ? "saving" : "advance")}
                  <ArrowRight size={16} />
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => onEdit(method)}>
                {copy("newVersion")}
              </Button>
            </div>
          </form>
        )}
        {!readOnly && method.phase === "consolidate" && (
          <div className="process-actions">
            <Link href="/" className={buttonVariants()}>
              {copy("today")}
              <ArrowRight size={16} />
            </Link>
            <Button type="button" variant="ghost" onClick={() => onEdit(method)}>
              {copy("newVersion")}
            </Button>
          </div>
        )}
        {readOnly && (
          <Link href="/method" className={buttonVariants() + " self-start"}>
            {copy("activeMethod")}
          </Link>
        )}
      </ProcessPanel>
      <details>
        <summary>{copy("rules")}</summary>
        <dl className="process-summary">
          {(["windows", "setup", "entry", "exit", "invalidation", "waitConditions"] as const).map(
            (key) => (
              <div key={key}>
                <dt>{copy(key)}</dt>
                <dd>{method.rules[key]}</dd>
              </div>
            ),
          )}
          <div>
            <dt>{copy("checklist")}</dt>
            <dd>{method.rules.checklist.join("\n")}</dd>
          </div>
          <div>
            <dt>{copy("riskPerTrade")}</dt>
            <dd>
              {method.rules.riskPerTrade} {method.rules.currency}
            </dd>
          </div>
          <div>
            <dt>{copy("maxLoss")}</dt>
            <dd>
              {method.rules.maxDailyLoss} {method.rules.currency}
            </dd>
          </div>
        </dl>
      </details>
      <details>
        <summary>
          {copy("evidenceList")} ({rows.length})
        </summary>
        <div className="process-table-wrap">
          <table className="process-table">
            <thead>
              <tr>
                <th>{copy("purpose")}</th>
                <th>{copy("source")}</th>
                <th>{copy("netR")}</th>
                <th>{copy("provenance")}</th>
                <th>{copy("costs")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{copy(e.purpose)}</td>
                  <td>
                    {e.source === "account_trade"
                      ? copy("history")
                      : e.source === "replay"
                        ? copy("replay")
                        : copy(e.source)}
                  </td>
                  <td>{e.netR?.toFixed(2) ?? "—"}{e.purpose === "validation" && method.verificationStartedAt &&
                    (e.observedAt < method.verificationStartedAt || Boolean(method.protocol &&
                      (processDay(new Date(e.observedAt)) < method.protocol.periodStart || processDay(new Date(e.observedAt)) > method.protocol.periodEnd))) &&
                    <span className="mt-1 block text-xs text-muted-foreground">{journey("outsideTest")}</span>}
                    {e.executionEnvironment === "unknown" && <span className="mt-1 block text-xs text-muted-foreground">{journey("environment")}: {journey("unknown")}</span>}
                  </td>
                  <td>{copy(e.provenance)}</td>
                  <td>{copy(e.costsStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <ProcessLink href="/method?section=evidence">{copy("addEvidence")}</ProcessLink>
        )}
        {!readOnly && (
          <ProcessLink href={`/backtest?methodVersionId=${encodeURIComponent(method.id)}`}>
            {copy("replay")}
          </ProcessLink>
        )}
      </details>
      <details>
        <summary>{copy("methods")}</summary>
        <ul className="space-y-3">
          {state.methods.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                {item.name} · {copy("version")} {item.version} · {copy(item.phase)}
              </span>
              <Link
                href={`/method?version=${encodeURIComponent(item.id)}`}
                className={buttonVariants({ variant: "ghost" })}
              >
                {copy("viewVersion")}
              </Link>
              {item.active ? (
                <span className="inline-flex items-center gap-2 text-primary">
                  <Check size={15} />
                  {copy("active")}
                </span>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => activate.mutate(item.id)}
                  disabled={activate.isPending}
                >
                  {copy("activate")}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <ProcessError error={activate.error} />
        <Button variant="ghost" onClick={() => onEdit(null)} className="mt-3">
          {copy("newMethod")}
        </Button>
      </details>
    </>
  );
}
export default function Method() {
  const copy = useProcessCopy();
  const query = useTraderProcess();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { data: finProfile } = useFinancialProfile();
  const { isFreeTrial } = useFreeTrial();
  const storage = useRoutineStorage();
  const completions = loadRoutineCompletions(storage);
  const morningDone = completions.some(
    (c) => c.template === "morning" && c.date === processDay(),
  );

  const searchParams = new URLSearchParams(search);
  const requestedVersion = searchParams.get("version");
  const defaultView = requestedVersion ? "method" : "flow";
  const [activeView, setActiveView] = useState<"flow" | "method">(defaultView);

  const [editor, setEditor] = useState<{
    previous: ProcessMethod | null;
    useStored: boolean;
  } | null>(null);

  if (!query.data && query.isLoading) {
    return <ProcessLoading error={query.error} retry={() => void query.refetch()} />;
  }
  const state: ProcessState = query.data ?? {
    methodDraft: null,
    methods: [],
    activeMethod: null,
    session: null,
    evidence: [],
    improvement: null,
    progress: {
      phase: "define",
      checks: [],
      canAdvance: false,
      nextAction: "define_method",
      report: {
        eligibleSamples: 0,
        incompleteSamples: 0,
        expectancyR: null,
        drawdownR: null,
        adherencePct: null,
        closedSessions: 0,
        amounts: [],
      },
    },
    progressByVersion: {},
  };
  const method =
    state.methods.find((m) => m.id === requestedVersion) ?? state.activeMethod;
  const readOnly = Boolean(method && !method.active);
  const displayState = method
    ? {
        ...state,
        activeMethod: method,
        progress: state.progressByVersion[method.id] ?? state.progress,
      }
    : state;
  const evidence = searchParams.get("section") === "evidence";

  const finish = (created?: ProcessMethod) => {
    setEditor(null);
    navigate(
      created && !created.active ? `/method?version=${encodeURIComponent(created.id)}` : "/method",
    );
  };

  const reviseId = searchParams.get("revise");
  const revisionMethod = state.methods.find((item) => item.id === reviseId);
  const showEditor =
    editor ||
    (revisionMethod
      ? { previous: revisionMethod, useStored: true }
      : !method
        ? { previous: null, useStored: true }
        : null);

  return (
    <PageLayout quiet>
      <main className="process-workspace limen-scroll-pane space-y-6 pb-16 max-w-7xl mx-auto px-3 sm:px-6">
        {/* Header con orario live, sessione di mercato e switch di vista */}
        <DailyOrderPulseHeader
          state={displayState}
          activeView={activeView}
          onViewChange={setActiveView}
          onNewVersion={() => setEditor({ previous: method, useStored: false })}
        />

        {/* Quick Dock di comodità per accedere a tutte le sezioni dell'app */}
        <DailyOrderQuickDock />

        {readOnly && (
          <p
            role="status"
            className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-xs font-mono text-amber-300"
          >
            {copy("inactiveVersionHint")}
          </p>
        )}

        {showEditor ? (
          <MethodEditor
            key={`${query.userId}:${showEditor.previous?.id ?? "new"}`}
            previous={showEditor.previous}
            stored={state.methodDraft}
            onDone={finish}
            onCancel={() => {
              setEditor(null);
              navigate("/");
            }}
          />
        ) : evidence && method && !readOnly ? (
          <EvidenceEditor
            method={method}
            userId={query.userId}
            onDone={finish}
            onCancel={finish}
          />
        ) : activeView === "flow" ? (
          <DailyOrderStages
            state={displayState}
            method={method}
            finProfile={isFreeTrial ? undefined : finProfile}
            morningDone={morningDone}
          />
        ) : (
          <DailyOrderMethodConsole
            state={displayState}
            readOnly={readOnly}
            onEdit={(previous) =>
              setEditor({
                previous: state.methodDraft
                  ? (state.methods.find((m) => m.id === state.methodDraft?.previousVersionId) ??
                    null)
                  : previous,
                useStored: Boolean(state.methodDraft),
              })
            }
            onAddEvidence={() => navigate("/method?section=evidence")}
          />
        )}
      </main>
    </PageLayout>
  );
}
