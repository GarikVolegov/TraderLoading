import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, TrendingUp, Plus, Trash2, ShieldAlert } from "lucide-react";
import { useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useBackground, DEFAULT_TRADING_SESSIONS, DEFAULT_LOT_DIVISOR, type TradingSessionConfig } from "@/contexts/BackgroundContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { uiText } from "@/contexts/LanguageContext";
import { detectTradingSessionOverlap, getLocalTimeZoneLabel, isMarketClosedSession, normalizeLocalSessionTime, type MarketSessionConfig, type TradingSessionKind } from "@/lib/marketSessions";

const WEEKDAY_OPTIONS = [
  { id: 1, label: "L", title: "Lunedì" },
  { id: 2, label: "M", title: "Martedì" },
  { id: 3, label: "M", title: "Mercoledì" },
  { id: 4, label: "G", title: "Giovedì" },
  { id: 5, label: "V", title: "Venerdì" },
  { id: 6, label: "S", title: "Sabato" },
  { id: 0, label: "D", title: "Domenica" },
] as const;

function getSessionDaysForUi(session: MarketSessionConfig): number[] {
  if (!Array.isArray(session.days) || session.days.length === 0) {
    return WEEKDAY_OPTIONS.map((day) => day.id);
  }
  return session.days;
}

function detectOverlap(sessions: TradingSessionConfig[]): string | null {
  return detectTradingSessionOverlap(sessions as MarketSessionConfig[]);
}

export function TradingSettings() {
  const { tradingSessions, setTradingSessions, lotDivisor, setLotDivisor } =
    useBackground();
  // All 3 handlers using this mutation (sessions save, divider save, restore
  // defaults) already show their own toast on catch — opt out of App.tsx's
  // global mutation-error toast to avoid a double toast.
  const updateMutation = useUpdateUserSettings({ mutation: { meta: { suppressGlobalError: true } } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [localSessions, setLocalSessions] =
    useState<MarketSessionConfig[]>(tradingSessions as MarketSessionConfig[]);
  const [localDivisor, setLocalDivisor] = useState(String(lotDivisor));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const localTimeZoneLabel = getLocalTimeZoneLabel();

  useEffect(() => {
    setLocalSessions(tradingSessions as MarketSessionConfig[]);
  }, [tradingSessions]);
  useEffect(() => {
    setLocalDivisor(String(lotDivisor));
  }, [lotDivisor]);
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const overlapError = detectOverlap(localSessions);

  const saveSessions = (sessions: MarketSessionConfig[]) => {
    setLocalSessions(sessions);
    setTradingSessions(sessions);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const err = detectOverlap(sessions);
      if (err) {
        toast({
          description: `Sovrapposizione rilevata: ${err}`,
          variant: "destructive",
        });
        return;
      }
      try {
        await updateMutation.mutateAsync({
          data: {
            tradingSessions: sessions,
            lotDivisor: Number(localDivisor) || DEFAULT_LOT_DIVISOR,
          },
        });
        qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
        toast({ description: "Sessioni salvate." });
      } catch {
        toast({
          description: "Errore nel salvataggio.",
          variant: "destructive",
        });
      }
    }, 800);
  };

  const handleSessionChange = (
    idx: number,
    field: keyof TradingSessionConfig,
    value: string | boolean,
  ) => {
    const updated = localSessions.map((s, i) => {
      if (i === idx) {
        if (field === "openUTC" || field === "closeUTC")
          return { ...s, [field]: normalizeLocalSessionTime(value as string) };
        return { ...s, [field]: value };
      }
      return s;
    });
    saveSessions(updated);
  };

  const handleSessionKindChange = (idx: number, kind: TradingSessionKind) => {
    const updated = localSessions.map((session, i) => {
      if (i !== idx) return session;
      return {
        ...session,
        kind,
        color:
          kind === "market_closed"
            ? "session-closed"
            : session.color === "session-closed"
              ? "session-ny"
              : session.color,
        days:
          kind === "market_closed"
            ? Array.isArray(session.days) && session.days.length > 0
              ? session.days
              : [6, 0]
            : undefined,
      };
    });
    saveSessions(updated);
  };

  const handleClosedSessionDayToggle = (idx: number, day: number) => {
    const updated = localSessions.map((session, i) => {
      if (i !== idx) return session;
      const selected = getSessionDaysForUi(session);
      const nextDays = selected.includes(day)
        ? selected.filter((value) => value !== day)
        : [...selected, day];
      return {
        ...session,
        days: nextDays.sort((a, b) => a - b),
      };
    });
    saveSessions(updated);
  };

  const handleAddSession = () => {
    const newSession: MarketSessionConfig = {
      id: `custom-${Date.now()}`,
      name: `Sessione ${localSessions.length + 1}`,
      openUTC: "07:00",
      closeUTC: "09:00",
      color: "session-ny",
      kind: "trading",
      enabled: false,
    };
    const updated = [...localSessions, newSession];
    setLocalSessions(updated);
    setTradingSessions(updated);
  };

  const handleAddClosedSession = () => {
    const newSession: MarketSessionConfig = {
      id: `closed-${Date.now()}`,
      name: "Mercato chiuso",
      openUTC: "22:00",
      closeUTC: "23:59",
      color: "session-closed",
      kind: "market_closed",
      days: [6, 0],
      enabled: true,
    };
    saveSessions([...localSessions, newSession]);
  };

  const handleDeleteSession = (idx: number) => {
    if (localSessions.length <= 1) return;
    saveSessions(localSessions.filter((_, i) => i !== idx));
  };

  const handleDivisorChange = (value: string) => {
    setLocalDivisor(value);
    const num = Number(value);
    if (num >= 1) {
      setLotDivisor(num);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await updateMutation.mutateAsync({
            data: { lotDivisor: num, tradingSessions: localSessions },
          });
          qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
          toast({ description: "Divisore salvato." });
        } catch {
          toast({
            description: "Errore nel salvataggio.",
            variant: "destructive",
          });
        }
      }, 800);
    }
  };

  const handleReset = async () => {
    setLocalSessions(DEFAULT_TRADING_SESSIONS);
    setTradingSessions(DEFAULT_TRADING_SESSIONS);
    setLocalDivisor(String(DEFAULT_LOT_DIVISOR));
    setLotDivisor(DEFAULT_LOT_DIVISOR);
    try {
      await updateMutation.mutateAsync({
        data: {
          tradingSessions: DEFAULT_TRADING_SESSIONS,
          lotDivisor: DEFAULT_LOT_DIVISOR,
        },
      });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Impostazioni trading ripristinate." });
    } catch {
      toast({ description: "Errore nel ripristino.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />{uiText("auto.ui.49352196f6")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Sessioni di Trading
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Orari solo locali ({localTimeZoneLabel}). Nessuna conversione di
                fuso viene applicata.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Le righe "Mercato chiuso" sono informative: possono sovrapporsi
                alle sessioni operative e non inviano promemoria di apertura.
              </p>
            </div>
          </div>

          {overlapError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
              <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{overlapError}</p>
            </div>
          )}

          {localSessions.map((session, idx) => (
            <motion.div
              key={session.id}
              className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 space-y-3 hover:border-border/80 transition-colors"
              whileHover={{ borderColor: "var(--border-hover)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <Input
                  value={session.name}
                  onChange={(e) =>
                    handleSessionChange(idx, "name", e.target.value)
                  }
                  className="text-sm font-semibold flex-1 bg-secondary/40 border-border/30 rounded-lg"
                  placeholder={uiText("auto.ui.26ce432557")}
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground font-medium">{uiText("auto.ui.97ec36f1ec")}</span>
                  <Switch
                    checked={session.enabled}
                    onCheckedChange={(checked) =>
                      handleSessionChange(idx, "enabled", checked)
                    }
                  />
                  {localSessions.length > 1 && (
                    <button
                      onClick={() => handleDeleteSession(idx)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title={uiText("auto.ui.c4446f0733")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Tipo sessione
                  </label>
                  <select
                    value={(session as MarketSessionConfig).kind ?? "trading"}
                    onChange={(event) =>
                      handleSessionKindChange(
                        idx,
                        event.target.value as TradingSessionKind,
                      )
                    }
                    className="h-10 w-full rounded-lg border border-border/30 bg-secondary/40 px-3 text-sm text-foreground"
                  >
                    <option value="trading">{uiText("auto.ui.7b780520ff")}</option>
                    <option value="market_closed">{uiText("auto.ui.aafe59a8f3")}</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                      isMarketClosedSession(session as MarketSessionConfig)
                        ? "bg-red-500/10 text-red-400 border border-red-500/30"
                        : "bg-primary/10 text-primary border border-primary/25"
                    }`}
                  >
                    {isMarketClosedSession(session as MarketSessionConfig)
                      ? "Chiuso"
                      : "Operativa"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Apertura
                  </label>
                  <Input
                    type="time"
                    value={normalizeLocalSessionTime(session.openUTC)}
                    onChange={(e) =>
                      handleSessionChange(idx, "openUTC", e.target.value)
                    }
                    className="text-sm font-mono bg-secondary/40 border border-border/30 rounded-lg h-10 text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Chiusura
                  </label>
                  <Input
                    type="time"
                    value={normalizeLocalSessionTime(session.closeUTC)}
                    onChange={(e) =>
                      handleSessionChange(idx, "closeUTC", e.target.value)
                    }
                    className="text-sm font-mono bg-secondary/40 border border-border/30 rounded-lg h-10 text-foreground"
                  />
                </div>
              </div>
              {isMarketClosedSession(session as MarketSessionConfig) && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Giorni chiusura
                  </label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const selected = getSessionDaysForUi(session as MarketSessionConfig).includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          title={day.title}
                          aria-pressed={selected}
                          onClick={() => handleClosedSessionDayToggle(idx, day.id)}
                          className={`h-8 rounded-md border text-xs font-bold transition-colors ${
                            selected
                              ? "border-red-400/70 bg-red-500/15 text-red-200"
                              : "border-border/40 bg-secondary/30 text-muted-foreground hover:border-red-400/40 hover:text-red-200"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          <Button
            variant="outline"
            className="w-full rounded-xl border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            onClick={handleAddSession}
          >
            <Plus className="w-4 h-4 mr-2 text-primary" />
            Aggiungi sessione personalizzata
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl border-dashed border-red-500/40 bg-red-500/5 text-red-300 hover:border-red-500/60 hover:bg-red-500/10 transition-colors"
            onClick={handleAddClosedSession}
          >
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi mercato chiuso
          </Button>
        </div>

        <Button
          variant="outline"
          className="w-full rounded-lg"
          onClick={handleReset}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Ripristina valori predefiniti
        </Button>
      </CardContent>
    </Card>
  );
}
