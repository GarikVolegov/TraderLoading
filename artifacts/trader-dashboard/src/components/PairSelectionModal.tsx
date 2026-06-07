import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Check, ChevronDown, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAIR_CATALOG, CATEGORY_LABELS, type PairEntry } from "@workspace/pair-catalog";

interface PairSelectionModalProps {
  open: boolean;
  onConfirm: (pairs: string[]) => void;
  initialPairs?: string[];
  dismissible?: boolean;
  onClose?: () => void;
}

const CATEGORY_ORDER = ["forex-major", "forex-minor", "metal", "index", "crypto", "forex-exotic"];

const CATEGORY_ICONS: Record<string, string> = {
  "forex-major": "💱",
  "forex-minor": "🔀",
  "forex-exotic": "🌏",
  "metal": "🥇",
  "index": "📊",
  "crypto": "₿",
};

export function PairSelectionModal({
  open,
  onConfirm,
  initialPairs = [],
  dismissible = false,
  onClose,
}: PairSelectionModalProps) {
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
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSelected(initialPairs);
      setSearch("");
    }
  }, [open]);

  // Auto-scroll chips to end when a new pair is added
  useEffect(() => {
    if (chipsRef.current) {
      chipsRef.current.scrollLeft = chipsRef.current.scrollWidth;
    }
  }, [selected.length]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return PAIR_CATALOG;
    return PAIR_CATALOG.filter(
      (p) =>
        p.symbol.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.currencies.some((c) => c.toLowerCase().includes(q))
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PairEntry[]>();
    for (const cat of CATEGORY_ORDER) {
      const pairs = filtered.filter((p) => p.category === cat);
      if (pairs.length > 0) map.set(cat, pairs);
    }
    for (const p of filtered) {
      if (!CATEGORY_ORDER.includes(p.category) && !map.has(p.category)) {
        map.set(p.category, []);
      }
    }
    return map;
  }, [filtered]);

  const toggle = (symbol: string) => {
    setSelected((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  const removeChip = (symbol: string) =>
    setSelected((prev) => prev.filter((s) => s !== symbol));

  const toggleCategory = (cat: string) =>
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const selectAllInCategory = (cat: string, pairs: PairEntry[]) => {
    const symbols = pairs.map((p) => p.symbol);
    const allIn = symbols.every((s) => selected.includes(s));
    if (allIn) {
      setSelected((prev) => prev.filter((s) => !symbols.includes(s)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...symbols])]);
    }
  };

  const handleConfirm = () => {
    if (selected.length > 0) onConfirm(selected);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={() => { if (dismissible) onClose?.(); }}
      />

      {/* Panel */}
      <motion.div
        key="panel"
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        className={[
          "fixed z-50 bg-card border border-border/60 shadow-2xl flex flex-col",
          /* Mobile: full-width bottom sheet */
          "bottom-0 left-0 right-0 rounded-t-3xl",
          "max-h-[92dvh]",
          /* Tablet+: centered modal */
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:rounded-2xl sm:w-[560px] sm:max-h-[88vh]",
          /* Desktop: slightly wider */
          "lg:w-[680px]",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0" aria-hidden>
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* ── Header ── */}
        <div className="px-4 sm:px-5 pt-2 sm:pt-5 pb-3 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/15">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
              </div>
              <h2 className="text-base sm:text-lg font-bold">I tuoi strumenti</h2>
            </div>
            {dismissible && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Seleziona i pair su cui fai trading. La dashboard si adatterà automaticamente.
          </p>
        </div>

        {/* ── Search ── */}
        <div className="px-4 sm:px-5 py-2.5 shrink-0 border-b border-border/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per nome, simbolo o valuta…"
              autoCorrect="off"
              autoCapitalize="none"
              className="w-full pl-9 pr-8 h-10 rounded-xl bg-secondary/40 border border-border/50 text-sm outline-none focus:border-primary/50 focus:bg-secondary/60 transition-all placeholder:text-muted-foreground/40"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground bg-secondary/60 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* ── Selected chips (horizontal scroll, single line) ── */}
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="shrink-0 border-b border-border/30 overflow-hidden"
            >
              <div
                ref={chipsRef}
                className="flex items-center gap-1.5 px-4 sm:px-5 py-2 overflow-x-auto scrollbar-none"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide shrink-0">
                  {selected.length} sel.
                </span>
                {selected.map((sym) => {
                  const entry = PAIR_CATALOG.find((p) => p.symbol === sym);
                  return (
                    <motion.span
                      key={sym}
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg text-[11px] font-mono font-bold bg-primary/15 text-primary border border-primary/30"
                    >
                      {entry?.label ?? sym}
                      <button
                        onClick={() => removeChip(sym)}
                        className="w-4 h-4 rounded flex items-center justify-center hover:text-destructive transition-colors ml-0.5"
                        aria-label={`Rimuovi ${sym}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </motion.span>
                  );
                })}
                <button
                  onClick={() => setSelected([])}
                  className="shrink-0 text-[10px] text-muted-foreground/60 hover:text-destructive transition-colors ml-1 whitespace-nowrap"
                >
                  Svuota
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Scrollable pair list ── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-4 py-2 space-y-1">
          {Array.from(grouped.entries()).map(([category, pairs]) => {
            const isExpanded = search.trim() !== "" || expandedCategories[category];
            const selectedInCat = pairs.filter((p) => selected.includes(p.symbol)).length;
            const allInCat = selectedInCat === pairs.length && pairs.length > 0;
            const icon = CATEGORY_ICONS[category] ?? "📌";

            return (
              <div key={category} className="rounded-xl overflow-hidden border border-border/30 bg-secondary/10">
                {/* Category header */}
                <div className="flex items-center">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-secondary/30 transition-colors"
                  >
                    <span className="text-sm">{icon}</span>
                    <span className="text-xs font-semibold text-muted-foreground flex-1">
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                    {selectedInCat > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                        {selectedInCat}/{pairs.length}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {/* Select-all toggle */}
                  <button
                    onClick={() => selectAllInCategory(category, pairs)}
                    className={`px-3 py-2.5 text-[10px] font-semibold border-l border-border/30 transition-colors ${
                      allInCat
                        ? "text-primary bg-primary/10 hover:bg-primary/15"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/30"
                    }`}
                  >
                    {allInCat ? "✓ Tutti" : "Tutti"}
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16 }}
                      className="overflow-hidden border-t border-border/20"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 p-2">
                        {pairs.map((pair) => {
                          const isSel = selected.includes(pair.symbol);
                          return (
                            <button
                              key={pair.symbol}
                              onClick={() => toggle(pair.symbol)}
                              className={[
                                "flex items-center gap-2 px-2.5 py-2.5 rounded-lg text-left text-xs transition-all",
                                "min-h-[48px] active:scale-95 select-none",
                                isSel
                                  ? "bg-primary/15 border border-primary/40 text-primary"
                                  : "bg-card/60 border border-border/40 hover:border-primary/20 hover:bg-secondary/40 text-foreground",
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                                  isSel ? "bg-primary border-primary" : "border-muted-foreground/25",
                                ].join(" ")}
                              >
                                {isSel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                              </span>
                              <span className="font-mono font-bold truncate">{pair.label}</span>
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
            <div className="py-12 text-center text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nessun pair trovato per &ldquo;{search}&rdquo;</p>
              <button onClick={() => setSearch("")} className="mt-2 text-xs text-primary underline">
                Cancella ricerca
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="shrink-0 px-4 sm:px-5 pt-3 pb-4 border-t border-border/40 flex items-center justify-between gap-3 bg-card"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {selected.length}
            </span>
            <span className="text-sm text-muted-foreground truncate">
              {selected.length === 1 ? "pair selezionato" : "pair selezionati"}
            </span>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={selected.length === 0}
            className="shrink-0 h-11 px-6 text-sm font-semibold"
          >
            {selected.length === 0 ? "Seleziona un pair" : "Conferma →"}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
