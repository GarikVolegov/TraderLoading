import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Check, ChevronDown, BarChart2, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import { PAIR_CATALOG, CATEGORY_LABELS, type PairEntry } from "@workspace/pair-catalog";

interface PairOnboardingScreenProps {
  initialPairs?: string[];
  onConfirm: (pairs: string[]) => void;
}

const CATEGORY_ORDER = ["forex-major", "forex-minor", "metal", "index", "crypto", "forex-exotic"];

const CATEGORY_ICONS: Record<string, string> = {
  "forex-major": "💱",
  "forex-minor": "🌐",
  "metal": "🥇",
  "index": "📊",
  "crypto": "₿",
  "forex-exotic": "🌍",
};

const POPULAR_PAIRS = ["EURUSD", "GBPUSD", "XAUUSD", "US30", "NAS100", "USDJPY", "BTCUSD", "GBPJPY"];

export function PairOnboardingScreen({ initialPairs = [], onConfirm }: PairOnboardingScreenProps) {
  const [selected, setSelected] = useState<string[]>(initialPairs);
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "forex-major": true,
    "forex-minor": false,
    "forex-exotic": false,
    "metal": true,
    "index": true,
    "crypto": true,
  });
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return PAIR_CATALOG;
    return PAIR_CATALOG.filter(
      (p) =>
        p.symbol.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.currencies?.some((c) => c.toLowerCase().includes(q))
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PairEntry[]>();
    for (const cat of CATEGORY_ORDER) {
      const pairs = filtered.filter((p) => p.category === cat);
      if (pairs.length > 0) map.set(cat, pairs);
    }
    return map;
  }, [filtered]);

  const toggle = (symbol: string) =>
    setSelected((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );

  const toggleCategory = (cat: string) =>
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const addPopular = (symbol: string) => {
    if (!selected.includes(symbol)) setSelected((prev) => [...prev, symbol]);
  };

  const quickPopulars = POPULAR_PAIRS.filter((s) => !selected.includes(s));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex flex-col bg-[hsl(224,71%,4%)] overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[200px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      {/* ── LAYOUT: stacked on mobile, side-by-side on lg ── */}
      <div className="relative flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* ── LEFT PANEL: branding + progress (desktop only as sidebar, mobile as compact header) ── */}
        <div className="shrink-0 flex flex-col lg:w-72 xl:w-80">
          {/* Mobile compact header */}
          <div className="lg:hidden px-5 pt-6 pb-4 shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-xl bg-primary/15 border border-primary/25">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <span className="font-bold text-lg tracking-tight">
                <span className="text-foreground">TRADER</span>
                <span className="text-primary">LOADING</span>
              </span>
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">
              Quali strumenti segui?
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Seleziona i tuoi pair — la dashboard si adatta.
            </p>
          </div>

          {/* Desktop full sidebar */}
          <div className="hidden lg:flex flex-col h-full px-8 py-10 border-r border-border/30 bg-card/20">
            <div className="flex items-center gap-2.5 mb-10">
              <div className="p-2 rounded-xl bg-primary/15 border border-primary/25">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <span className="font-bold text-xl tracking-tight">
                <span className="text-foreground">TRADER</span>
                <span className="text-primary">LOADING</span>
              </span>
            </div>

            <div className="space-y-2 mb-8">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">Onboarding</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground leading-snug">
                Quali strumenti di trading segui?
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seleziona i pair, indici e asset che tradi ogni giorno. La dashboard, le notizie e le sessioni si adatteranno automaticamente alla tua selezione.
              </p>
            </div>

            {/* Selected pairs list (desktop sidebar) */}
            {selected.length > 0 && (
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-primary" />
                  Selezionati ({selected.length})
                </p>
                <div className="space-y-1.5 overflow-y-auto max-h-64 pr-1">
                  <AnimatePresence>
                    {selected.map((sym) => {
                      const entry = PAIR_CATALOG.find((p) => p.symbol === sym);
                      return (
                        <motion.div
                          key={sym}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 group"
                        >
                          <span className="text-sm font-mono font-bold text-primary">
                            {entry?.label ?? sym}
                          </span>
                          <button
                            onClick={() => toggle(sym)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {selected.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                <BarChart2 className="w-12 h-12 mb-3" />
                <p className="text-sm">Nessun strumento selezionato</p>
              </div>
            )}

            {/* Desktop CTA */}
            <button
              onClick={() => selected.length > 0 && onConfirm(selected)}
              disabled={selected.length === 0}
              className={[
                "mt-6 w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all",
                selected.length > 0
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
                  : "bg-secondary/40 text-muted-foreground cursor-not-allowed",
              ].join(" ")}
            >
              {selected.length > 0 ? (
                <>Inizia con {selected.length} pair <ArrowRight className="w-4 h-4" /></>
              ) : (
                "Seleziona almeno un pair"
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL: search + pair grid ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Search + quick picks */}
          <div className="shrink-0 px-4 sm:px-6 pt-2 lg:pt-6 pb-3 space-y-3 border-b border-border/20">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca pair... (EUR, gold, BTC, US30…)"
                className={[
                  "w-full pl-10 pr-9 py-3 rounded-2xl border text-sm",
                  "bg-card/60 border-border/60 text-foreground placeholder:text-muted-foreground/40",
                  "focus:outline-none focus:border-primary/50 focus:bg-card/80 transition-all",
                ].join(" ")}
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Mobile selected chips */}
            {selected.length > 0 && (
              <div className="lg:hidden flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                <AnimatePresence>
                  {selected.map((sym) => {
                    const entry = PAIR_CATALOG.find((p) => p.symbol === sym);
                    return (
                      <motion.span
                        key={sym}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-primary/15 text-primary border border-primary/30"
                      >
                        {entry?.label ?? sym}
                        <button onClick={() => toggle(sym)} className="hover:text-destructive ml-0.5 transition-colors">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </motion.span>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* Quick popular picks (show only when search empty and not many selected) */}
            {!search && quickPopulars.length > 0 && selected.length < 4 && (
              <div>
                <p className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> I più usati
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickPopulars.slice(0, 8).map((sym) => {
                    const entry = PAIR_CATALOG.find((p) => p.symbol === sym);
                    return (
                      <button
                        key={sym}
                        onClick={() => addPopular(sym)}
                        className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-secondary/40 border border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all active:scale-95"
                      >
                        + {entry?.label ?? sym}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Scrollable pair grid */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 space-y-1">
            {Array.from(grouped.entries()).map(([category, pairs]) => {
              const isExpanded = search.trim() !== "" || expandedCategories[category];
              const selectedInCat = pairs.filter((p) => selected.includes(p.symbol)).length;

              return (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-2 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded-xl hover:bg-card/40"
                  >
                    <span className="flex items-center gap-2">
                      <span>{CATEGORY_ICONS[category] ?? "📌"}</span>
                      <span>{CATEGORY_LABELS[category] ?? category}</span>
                      <span className="font-mono opacity-50">({pairs.length})</span>
                      {selectedInCat > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold border border-primary/20">
                          {selectedInCat} ✓
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 pb-3 pt-0.5">
                          {pairs.map((pair) => {
                            const isSelected = selected.includes(pair.symbol);
                            return (
                              <button
                                key={pair.symbol}
                                onClick={() => toggle(pair.symbol)}
                                className={[
                                  "flex items-center gap-2 px-3 py-3 rounded-2xl text-left text-sm transition-all border min-h-[52px] active:scale-95",
                                  isSelected
                                    ? "bg-primary/15 border-primary/50 text-primary shadow-sm shadow-primary/10"
                                    : "bg-card/40 border-border/40 hover:border-primary/30 hover:bg-card/70 text-foreground",
                                ].join(" ")}
                              >
                                <div
                                  className={[
                                    "w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                                    isSelected
                                      ? "bg-primary border-primary"
                                      : "border-muted-foreground/25 bg-transparent",
                                  ].join(" ")}
                                >
                                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                                </div>
                                <span className="font-mono font-bold text-xs leading-tight truncate">
                                  {pair.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {grouped.size === 0 && (
              <div className="py-16 text-center text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-15" />
                <p className="text-sm font-medium">Nessun risultato per "{search}"</p>
                <p className="text-xs mt-1 opacity-60">Prova con EUR, gold, BTC o US30</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE sticky footer CTA ── */}
      <div className="lg:hidden shrink-0 px-4 pb-[env(safe-area-inset-bottom,16px)] pt-3 border-t border-border/30 bg-card/50 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">
            {selected.length === 0
              ? "Nessun strumento selezionato"
              : `${selected.length} selezionat${selected.length === 1 ? "o" : "i"}`}
          </span>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Deseleziona tutti
            </button>
          )}
        </div>
        <button
          onClick={() => selected.length > 0 && onConfirm(selected)}
          disabled={selected.length === 0}
          className={[
            "w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all",
            selected.length > 0
              ? "bg-primary text-primary-foreground shadow-xl shadow-primary/30 active:scale-[0.98]"
              : "bg-secondary/50 text-muted-foreground cursor-not-allowed",
          ].join(" ")}
        >
          {selected.length > 0 ? (
            <>Inizia con {selected.length} pair <ArrowRight className="w-5 h-5" /></>
          ) : (
            "Seleziona almeno un pair"
          )}
        </button>
      </div>
    </motion.div>
  );
}
