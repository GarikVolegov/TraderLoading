import { useState, useMemo } from "react";
import {
  RotateCcw,
  Search,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useGetEconomicCalendar, type CalendarEvent, getGetEconomicCalendarQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface CockpitNewsDialogProps {
  market: string;
  fallbackEvents?: Array<{
    title: string;
    country: string;
    time?: string;
    impact: string;
    forecast?: string | null;
    previous?: string | null;
    actual?: string | null;
  }>;
}

const TITLE_TRANSLATIONS: Record<string, string> = {
  "Core CPI m/m": "Inflazione core (CPI) m/m",
  "Core CPI y/y": "Inflazione core (CPI) a/a",
  "CPI m/m": "Inflazione (CPI) m/m",
  "CPI y/y": "Inflazione (CPI) a/a",
  "Core PPI m/m": "Prezzi alla produzione core m/m",
  "PPI m/m": "Prezzi alla produzione m/m",
  "Retail Sales m/m": "Vendite al dettaglio m/m",
  "Core Retail Sales m/m": "Vendite al dettaglio core m/m",
  "Unemployment Claims": "Richieste sussidio disoccupazione",
  "Non-Farm Employment Change": "Occupazione non agricola (NFP)",
  "Unemployment Rate": "Tasso di disoccupazione",
  "FOMC Statement": "Comunicato FOMC Fed",
  "Federal Funds Rate": "Tasso di interesse Fed",
  "Beige Book": "Beige Book Fed",
  "ECB Monetary Policy Statement": "Politica monetaria BCE",
  "ECB Press Conference": "Conferenza stampa BCE",
  "BOE Official Bank Rate": "Tasso di interesse Bank of England",
  "BOJ Policy Rate": "Tasso di interesse Bank of Japan",
};

export function CockpitNewsDialog({ market, fallbackEvents = [] }: CockpitNewsDialogProps) {
  const queryClient = useQueryClient();
  const { data: apiEvents, isLoading, isRefetching } = useGetEconomicCalendar();
  const [currencyFilter, setCurrencyFilter] = useState<string>("ASSET");
  const [impactFilter, setImpactFilter] = useState<"all" | "high" | "major">("high");
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Determine currencies for asset
  const assetCurrencies = useMemo(() => {
    const s = market.toUpperCase();
    const codes = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "NZD", "CHF", "CNY"];
    const found = codes.filter((c) => s.includes(c));
    if (found.length) return found;
    if (/XAU|XAG|GOLD|ORO|SPX|NAS|DOW|BTC/.test(s)) return ["USD"];
    return ["USD", "EUR"];
  }, [market]);

  const rawEvents = (apiEvents && apiEvents.length > 0 ? apiEvents : fallbackEvents) as CalendarEvent[];

  const events = useMemo(() => {
    return rawEvents.filter((e) => {
      // Currency filter
      if (currencyFilter === "ASSET") {
        if (!assetCurrencies.includes(e.country?.toUpperCase())) return false;
      } else if (currencyFilter !== "ALL") {
        if (e.country?.toUpperCase() !== currencyFilter) return false;
      }

      // Impact filter
      const impact = (e.impact ?? "low").toLowerCase();
      if (impactFilter === "high" && impact !== "high") return false;
      if (impactFilter === "major" && impact !== "high" && impact !== "medium") return false;

      // Search filter
      if (searchTerm) {
        const text = `${e.title} ${e.country}`.toLowerCase();
        if (!text.includes(searchTerm.toLowerCase())) return false;
      }

      return true;
    });
  }, [rawEvents, currencyFilter, impactFilter, searchTerm, assetCurrencies]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: getGetEconomicCalendarQueryKey() });
    } catch {
      // Ignore refresh error
    } finally {
      setIsRefreshing(false);
    }
  };

  const highImpactCount = rawEvents.filter((e) => (e.impact ?? "").toLowerCase() === "high").length;

  return (
    <div className="space-y-4 text-foreground">
      {/* Top Controls & Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-white/10 bg-black/40">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
            Calendario Macroeconomico · Orario Italiano (Europe/Rome)
          </span>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">
            Eventi ad Alto Impatto per {market}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {highImpactCount > 0
              ? `${highImpactCount} eventi ad alto impatto monitorati oggi. Nuovi ordini sospesi 30m prima.`
              : "Nessun evento ad alto impatto registrato nelle prossime ore per questo asset."}
          </p>
        </div>

        <button
          type="button"
          disabled={isRefreshing || isLoading || isRefetching}
          onClick={handleRefresh}
          className="ck-mini-bridge shrink-0 self-start sm:self-center cursor-pointer flex items-center gap-1.5"
          title="Aggiorna calendario adesso"
        >
          <RotateCcw size={13} className={isRefreshing || isRefetching ? "animate-spin" : ""} />
          <span>Aggiorna ↻</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        {/* Currency Filter */}
        <div className="relative">
          <select
            aria-label="Filtra per valuta"
            className="w-full h-9 rounded-md border border-white/10 bg-[#12131A] px-3 font-mono text-xs text-foreground focus:border-primary/50"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
          >
            <option value="ASSET">Valute di {market} ({assetCurrencies.join(", ")})</option>
            <option value="ALL">Tutte le valute mondiali</option>
            <option value="USD">Solo USD (Dollaro USA)</option>
            <option value="EUR">Solo EUR (Eurozona)</option>
            <option value="GBP">Solo GBP (Sterlina UK)</option>
            <option value="JPY">Solo JPY (Yen Giappone)</option>
          </select>
        </div>

        {/* Impact Filter */}
        <div className="relative">
          <select
            aria-label="Filtra per impatto"
            className="w-full h-9 rounded-md border border-white/10 bg-[#12131A] px-3 font-mono text-xs text-foreground focus:border-primary/50"
            value={impactFilter}
            onChange={(e) => setImpactFilter(e.target.value as "all" | "high" | "major")}
          >
            <option value="high">🔴 Solo Alto Impatto (High Impact)</option>
            <option value="major">🔴🟠 Alto + Medio Impatto</option>
            <option value="all">Tutti gli eventi (Inclusi Basso)</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Cerca evento (es. CPI, NFP, Fed)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 rounded-md border border-white/10 bg-[#12131A] pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
      </div>

      {/* Events List */}
      <div className="rounded-xl border border-white/10 bg-[#0E0F14] overflow-hidden max-h-[50vh] overflow-y-auto">
        {events.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 size={32} className="mx-auto text-emerald-400/80" />
            <h4 className="text-sm font-semibold text-foreground">Nessun evento con questi filtri</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              La sessione corrente è libera da catalizzatori con i filtri selezionati. Puoi verificare tutte le valute o azzerare la ricerca.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-muted-foreground font-mono text-[10px] uppercase">
                <th className="py-2.5 px-3">Orario (IT)</th>
                <th className="py-2.5 px-3">Valuta</th>
                <th className="py-2.5 px-3">Impatto</th>
                <th className="py-2.5 px-3">Evento Macro</th>
                <th className="py-2.5 px-3 text-right">Precedente</th>
                <th className="py-2.5 px-3 text-right">Previsione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {events.map((e, idx) => {
                const impact = (e.impact ?? "low").toLowerCase();
                const translatedTitle = TITLE_TRANSLATIONS[e.title] ?? e.title;
                const timeStr = e.date
                  ? new Date(e.date).toLocaleTimeString("it-IT", {
                      timeZone: "Europe/Rome",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : (e as { time?: string }).time ?? "—";

                return (
                  <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-foreground shrink-0">{timeStr}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-semibold text-primary">
                        {e.country}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {impact === "high" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                          ALTO
                        </span>
                      ) : impact === "medium" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                          MEDIO
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">BASSO</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-xs text-foreground font-medium">
                      <span>{translatedTitle}</span>
                      {translatedTitle !== e.title && (
                        <span className="block text-[10px] text-muted-foreground font-mono">{e.title}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {e.previous ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                      {e.forecast ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Protocol Guard Rule Footer */}
      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-amber-300 flex items-start gap-2.5">
        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
        <p className="leading-snug">
          <strong>Protocollo Inviolabile di Rischio:</strong> Nessun ordine pendente o a mercato è consentito nei 30 minuti precedenti o nei 15 minuti successivi a una news ad alto impatto (🔴). Se hai posizioni aperte, riduci il rischio al pareggio o chiudi prima dell'evento.
        </p>
      </div>
    </div>
  );
}
