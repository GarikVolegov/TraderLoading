import { useState, useMemo, useEffect, useCallback } from "react";
import { Calendar, RefreshCw, TrendingUp, ChevronDown, ChevronUp, SlidersHorizontal, Target, CheckCircle2, Circle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetEconomicCalendar, getGetEconomicCalendarQueryKey, useUpdateUserSettings, useGetMissions } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useBackground } from "@/contexts/BackgroundContext";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"] as const;

const IMPACT_CONFIG = {
  High: { color: "bg-red-500", border: "border-red-500/30", text: "text-red-400", label: "Alto" },
  Medium: { color: "bg-orange-500", border: "border-orange-500/30", text: "text-orange-400", label: "Medio" },
  Low: { color: "bg-yellow-500", border: "border-yellow-500/30", text: "text-yellow-400", label: "Basso" },
  Holiday: { color: "bg-blue-500", border: "border-blue-500/30", text: "text-blue-400", label: "Festivo" },
} as const;

type Impact = keyof typeof IMPACT_CONFIG;

export function CalendarWidget() {
  const queryClient = useQueryClient();
  const { calendarCurrencies, setCalendarCurrencies, calendarImpacts, setCalendarImpacts } = useBackground();
  const selectedCurrencies = useMemo(() => new Set(calendarCurrencies), [calendarCurrencies]);
  const selectedImpacts = useMemo(() => new Set(calendarImpacts), [calendarImpacts]);
  const { mutate: saveSettings } = useUpdateUserSettings();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const { data: missions } = useGetMissions();

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { data: events, isLoading } = useGetEconomicCalendar();

  const toggleCurrency = useCallback((currency: string) => {
    const current = new Set(calendarCurrencies);
    if (current.has(currency)) {
      if (current.size > 1) current.delete(currency);
    } else {
      current.add(currency);
    }
    const arr = Array.from(current);
    setCalendarCurrencies(arr);
    saveSettings({ data: { calendarCurrencies: arr } });
  }, [calendarCurrencies, setCalendarCurrencies, saveSettings]);

  const toggleImpact = useCallback((impact: string) => {
    const current = new Set(calendarImpacts);
    if (current.has(impact)) {
      if (current.size > 1) current.delete(impact);
    } else {
      current.add(impact);
    }
    const arr = Array.from(current);
    setCalendarImpacts(arr);
    saveSettings({ data: { calendarImpacts: arr } });
  }, [calendarImpacts, setCalendarImpacts, saveSettings]);

  const toggleExpanded = (key: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch("/api/calendar?nocache=1");
      await queryClient.invalidateQueries({ queryKey: getGetEconomicCalendarQueryKey() });
    } finally {
      setIsRefreshing(false);
    }
  };

  const visibleEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => {
      return selectedCurrencies.has(e.country) && selectedImpacts.has(e.impact);
    });
  }, [events, selectedCurrencies, selectedImpacts]);

  const upcomingCount = visibleEvents.filter((e) => new Date(e.date) >= now).length;
  const recentCount = visibleEvents.filter((e) => new Date(e.date) < now).length;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const day = d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });

    if (isToday) return { day: "Oggi", time };
    if (isTomorrow) return { day: "Domani", time };
    return { day, time };
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6 border-b border-border/50 bg-secondary/10">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
          Calendario Economico
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`h-8 w-8 transition-colors ${filtersOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-8 w-8 text-muted-foreground hover:text-primary"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-4 space-y-3">
        {filtersOpen && (
          <div className="space-y-3 pb-3 border-b border-border/30 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valuta</p>
              <div className="flex flex-wrap gap-1.5">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCurrency(c)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      selectedCurrencies.has(c)
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-secondary/40 text-muted-foreground border border-border/50 hover:border-primary/30"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Impatto</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(IMPACT_CONFIG) as Impact[]).filter(i => i !== "Holiday").map((impact) => {
                  const cfg = IMPACT_CONFIG[impact];
                  return (
                    <button
                      key={impact}
                      onClick={() => toggleImpact(impact)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                        selectedImpacts.has(impact)
                          ? `${cfg.border} ${cfg.text} bg-secondary/60 border`
                          : "bg-secondary/40 text-muted-foreground border border-border/50 hover:border-primary/30"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div>
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nessun evento trovato con i filtri selezionati.
            </div>
          ) : (
            <div className="space-y-1 pr-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                {upcomingCount > 0 && recentCount > 0
                  ? `In arrivo (${upcomingCount}) · Recenti (${recentCount})`
                  : upcomingCount > 0
                    ? `In arrivo (${upcomingCount})`
                    : `Recenti (${recentCount})`}
              </p>
              {visibleEvents.map((event, i) => {
                const eventKey = `${event.date}-${event.title}-${event.country}`;
                const { day, time } = formatDate(event.date);
                const cfg = IMPACT_CONFIG[event.impact as Impact] ?? IMPACT_CONFIG.Low;
                const isPast = new Date(event.date) < now;
                const isExpanded = expandedEvents.has(eventKey);
                const hasDetails = event.forecast || event.previous;

                return (
                  <div
                    key={`event-${i}`}
                    onClick={() => hasDetails && toggleExpanded(eventKey)}
                    className={`rounded-lg border transition-all ${
                      hasDetails ? "cursor-pointer" : ""
                    } ${
                      isPast
                        ? `bg-secondary/10 ${cfg.border} opacity-60`
                        : `bg-secondary/20 ${cfg.border} hover:bg-secondary/40`
                    }`}
                  >
                    <div className="flex items-center gap-3 p-2.5">
                      <div className="flex flex-col items-center min-w-[52px] text-center">
                        <span className="text-[10px] text-muted-foreground leading-tight">{day}</span>
                        <span className={`text-sm font-mono font-bold ${isPast ? "text-muted-foreground" : "text-foreground"}`}>{time}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`w-2 h-2 rounded-full ${cfg.color} shrink-0 ${isPast ? "opacity-50" : ""}`} />
                          <span className="text-xs font-bold text-muted-foreground">{event.country}</span>
                          {isPast && (
                            <span className="text-[10px] text-muted-foreground/60 ml-auto">uscito</span>
                          )}
                        </div>
                        <p className={`text-sm font-medium truncate ${isPast ? "text-muted-foreground" : "text-foreground"}`}>{event.title}</p>
                      </div>
                      {hasDetails && (
                        <div className="shrink-0 text-muted-foreground">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      )}
                    </div>

                    {isExpanded && hasDetails && (
                      <div className="px-3 pb-3 pt-0 border-t border-border/20 mx-2.5 mt-0">
                        <div className="grid grid-cols-2 gap-2 pt-2.5">
                          {event.forecast && (
                            <div className="bg-secondary/30 rounded-md p-2 text-center">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Previsione</p>
                              <p className="text-sm font-mono font-bold text-foreground">{event.forecast}</p>
                            </div>
                          )}
                          {event.previous && (
                            <div className="bg-secondary/30 rounded-md p-2 text-center">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Precedente</p>
                              <p className="text-sm font-mono font-bold text-foreground">{event.previous}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {missions && missions.length > 0 && (
          <div className="pt-3 border-t border-border/30">
            <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Missioni di Oggi
            </p>
            <div className="space-y-1">
              {missions.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg border p-2.5 flex items-center gap-3 transition-colors ${
                    m.completed
                      ? "bg-primary/5 border-primary/20 opacity-60"
                      : "bg-secondary/20 border-accent/20 hover:bg-secondary/40"
                  }`}
                >
                  <div className="shrink-0">
                    {m.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${m.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {m.title}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-accent bg-secondary/60 px-1.5 py-0.5 rounded shrink-0">
                    {m.xpReward} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
