import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, ChevronRight, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateChecklistItem, useGetChecklist, getGetChecklistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface ConfirmationItem {
  id: string;
  text: string;
}
interface ConfirmationCategory {
  id: string;
  emoji: string;
  label: string;
  description: string;
  items: ConfirmationItem[];
}

const CONFIRMATION_CATEGORIES: ConfirmationCategory[] = [
  {
    id: "mtf",
    emoji: "📈",
    label: "Analisi Multi-Timeframe",
    description: "Confluenza tra timeframe diversi",
    items: [
      { id: "mtf1", text: "Trend principale confermato (D1/W)" },
      { id: "mtf2", text: "Struttura favorevole sul TF intermedio (H4)" },
      { id: "mtf3", text: "Setup operativo allineato al trend (H1)" },
      { id: "mtf4", text: "Nessuna resistenza critica entro 2× SL" },
    ],
  },
  {
    id: "entry",
    emoji: "🎯",
    label: "Segnale d'Entrata",
    description: "Conferme tecniche per il trigger",
    items: [
      { id: "e1", text: "Pattern di price action completato" },
      { id: "e2", text: "Rottura e retest del livello chiave" },
      { id: "e3", text: "Candlestick di conferma sulla zona" },
      { id: "e4", text: "Confluenza con indicatore secondario" },
    ],
  },
  {
    id: "risk",
    emoji: "⚖️",
    label: "Risk Management",
    description: "Gestione del rischio verificata",
    items: [
      { id: "r1", text: "Stop loss posizionato su struttura" },
      { id: "r2", text: "Risk/Reward ≥ 1:2" },
      { id: "r3", text: "Dimensione posizione calcolata (<2% conto)" },
      { id: "r4", text: "Nessun trade aperto in correlazione" },
    ],
  },
  {
    id: "market",
    emoji: "🌍",
    label: "Condizioni di Mercato",
    description: "Contesto macro e liquidità",
    items: [
      { id: "m1", text: "Nessun evento macro nelle prossime 2h" },
      { id: "m2", text: "Spread nella norma per questo strumento" },
      { id: "m3", text: "Sessione di trading attiva e liquida" },
      { id: "m4", text: "Volatilità compatibile con il setup" },
    ],
  },
  {
    id: "mindset",
    emoji: "🧠",
    label: "Disciplina & Mindset",
    description: "Stato mentale e rispetto del piano",
    items: [
      { id: "d1", text: "Non ho raggiunto il max daily loss" },
      { id: "d2", text: "Sto operando su setup, non per revenge" },
      { id: "d3", text: "Il trade era nel piano pre-sessione" },
      { id: "d4", text: "Sono in stato emotivo neutro" },
    ],
  },
];

export function ChecklistSetupModal() {
  const { data: items } = useGetChecklist();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<"intro" | "pick">("intro");
  const [expandedCat, setExpandedCat] = useState<string | null>("mtf");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customLines, setCustomLines] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const createMutation = useCreateChecklistItem();

  useEffect(() => {
    if (items && items.length === 0) setShow(true);
  }, [items]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (cat: ConfirmationCategory) => {
    const allSelected = cat.items.every((i) => selectedIds.has(i.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) cat.items.forEach((i) => next.delete(i.id));
      else cat.items.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const selectedTexts = CONFIRMATION_CATEGORIES.flatMap((cat) =>
    cat.items.filter((item) => selectedIds.has(item.id)).map((i) => i.text)
  );
  const customTexts = customLines
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const allToSave = [...selectedTexts, ...customTexts];

  const handleSave = async () => {
    if (allToSave.length === 0) return;
    setSaving(true);
    try {
      for (const text of allToSave) {
        await createMutation.mutateAsync({ data: { text, completed: true } });
      }
      qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
      setShow(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShow(false); }}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/15">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm leading-tight">Checklist di Conferma</p>
                  <p className="text-[10px] text-muted-foreground">Criteri per validare l'entrata in un trade</p>
                </div>
              </div>
              <button onClick={() => setShow(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {step === "intro" ? (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="p-5 space-y-4"
                >
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
                    <p className="text-sm font-semibold text-primary">Cos'è una checklist di conferma?</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Non è una routine generica — è il tuo <span className="text-foreground font-medium">gate di validazione</span> prima di premere "Buy/Sell". Ogni criterio che spunti rappresenta una confluenza che riduce il rischio e aumenta la probabilità del trade.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Prima di ogni entrata, scorri la lista: se non riesci a spuntare tutti i criteri, <span className="text-foreground font-medium">il trade non è pronto</span>.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {CONFIRMATION_CATEGORIES.map((cat) => (
                      <div key={cat.id} className="rounded-xl border border-border bg-secondary/30 p-3">
                        <p className="text-base mb-0.5">{cat.emoji}</p>
                        <p className="text-xs font-semibold text-foreground leading-tight">{cat.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{cat.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => setStep("pick")} className="flex-1">
                      Scegli i miei criteri →
                    </Button>
                    <Button onClick={() => setShow(false)} variant="outline" className="flex-1">
                      Dopo
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="pick"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex flex-col max-h-[75vh]"
                >
                  <div className="overflow-y-auto flex-1 divide-y divide-border/40">
                    {CONFIRMATION_CATEGORIES.map((cat) => {
                      const isOpen = expandedCat === cat.id;
                      const selectedCount = cat.items.filter((i) => selectedIds.has(i.id)).length;
                      const allSel = selectedCount === cat.items.length;
                      return (
                        <div key={cat.id}>
                          <button
                            onClick={() => setExpandedCat(isOpen ? null : cat.id)}
                            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/30 transition-colors text-left"
                          >
                            <span className="text-lg w-6 shrink-0">{cat.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold">{cat.label}</p>
                              <p className="text-[10px] text-muted-foreground">{cat.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {selectedCount > 0 && (
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                  {selectedCount}/{cat.items.length}
                                </span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleCategory(cat); }}
                                className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all ${
                                  allSel
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:border-primary/30"
                                }`}
                              >
                                {allSel ? "Tutti ✓" : "Tutti"}
                              </button>
                              {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </button>

                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-secondary/20"
                              >
                                {cat.items.map((item) => {
                                  const sel = selectedIds.has(item.id);
                                  return (
                                    <button
                                      key={item.id}
                                      onClick={() => toggleItem(item.id)}
                                      className={`w-full flex items-center gap-3 px-6 py-2.5 text-left transition-colors hover:bg-primary/5 ${
                                        sel ? "bg-primary/5" : ""
                                      }`}
                                    >
                                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                        sel ? "bg-primary border-primary" : "border-muted-foreground/30"
                                      }`}>
                                        {sel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                      </span>
                                      <span className={`text-xs ${sel ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                        {item.text}
                                      </span>
                                    </button>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}

                    <div className="px-5 py-4 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Criteri personalizzati (uno per riga)
                      </p>
                      <textarea
                        value={customLines}
                        onChange={(e) => setCustomLines(e.target.value)}
                        rows={3}
                        placeholder={"Il prezzo è sopra la EMA 200...\nBreakout confermato da volume..."}
                        className="w-full text-xs bg-secondary/40 border border-border rounded-xl px-3 py-2.5 resize-none outline-none focus:border-primary/50 placeholder:text-muted-foreground/40 text-foreground"
                      />
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t border-border space-y-3">
                    {allToSave.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {allToSave.slice(0, 6).map((t, i) => (
                          <span key={i} className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-medium truncate max-w-[140px]">
                            {t}
                          </span>
                        ))}
                        {allToSave.length > 6 && (
                          <span className="text-[9px] text-muted-foreground px-1.5 py-0.5">
                            +{allToSave.length - 6} altri
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStep("intro")}
                        className="text-xs text-muted-foreground hover:text-foreground px-3"
                      >
                        ← Indietro
                      </button>
                      <Button
                        onClick={handleSave}
                        disabled={saving || allToSave.length === 0}
                        className="flex-1"
                      >
                        {saving ? "Salvataggio…" : allToSave.length > 0 ? `Salva ${allToSave.length} criteri` : "Seleziona almeno un criterio"}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Puoi modificare i criteri in Impostazioni → Checklist
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
