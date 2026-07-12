import { useState, useEffect, useMemo } from "react";
import { Clock as ClockIcon, Radio, Hourglass } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ClockWidget } from "@/components/ClockWidget";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBackground, type TradingSessionConfig } from "@/contexts/BackgroundContext";
import { getLocalClockHours, getLocalTimeZoneLabel, isMarketClosedSession, isTradingSession, normalizeLocalSessionTime, type MarketSessionConfig } from "@/lib/marketSessions";
import { sessionBadgeClasses, toneForSessionColor, type SessionTone } from "@/lib/sessionBadge";
import { uiText } from "@/contexts/LanguageContext";

// ─── helpers (stessa logica di ClockWidget, qui estesa) ──────────────────────────
function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}
function isInSession(localHours: number, s: TradingSessionConfig): boolean {
  const open = parseTime(s.openUTC);
  const close = parseTime(s.closeUTC);
  return open < close ? localHours >= open && localHours < close : localHours >= open || localHours < close;
}
/** Ore di durata della sessione (gestisce il wrap a mezzanotte). */
function sessionDuration(s: TradingSessionConfig): number {
  const open = parseTime(s.openUTC);
  const close = parseTime(s.closeUTC);
  return close > open ? close - open : 24 - open + close;
}
/** Minuti mancanti a un orario locale salvato internamente a partire dall'ora corrente. */
function minutesUntil(targetHours: number, localHours: number): number {
  let diff = targetHours - localHours;
  if (diff <= 0) diff += 24;
  return Math.round(diff * 60);
}
function formatCountdown(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
const SESSION_DOT: Record<string, string> = {
  "session-asian":  "bg-[hsl(var(--session-asian))]",
  "session-london": "bg-[hsl(var(--session-london))]",
  "session-ny":     "bg-[hsl(var(--session-ny))]",
  "session-volume": "bg-[hsl(var(--session-volume))]",
  "session-closed": "bg-[hsl(var(--session-closed))]",
};

export default function Clock() {
  const [now, setNow] = useState(new Date());
  const { tradingSessions } = useBackground();
  const localTimeZoneLabel = getLocalTimeZoneLabel();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const localHours = getLocalClockHours(now);

  const sessions = useMemo(
    () => tradingSessions.filter((s) => s.enabled),
    [tradingSessions],
  );

  const rows = useMemo(() => {
    return sessions.map((s) => {
      const active = isInSession(localHours, s);
      const openH = parseTime(s.openUTC);
      const duration = sessionDuration(s);
      const untilClose = minutesUntil(parseTime(s.closeUTC), localHours);
      const untilOpen = minutesUntil(openH, localHours);
      // Avanzamento (0-100) all'interno della sessione attiva.
      let elapsed = localHours - openH;
      if (elapsed < 0) elapsed += 24;
      const progress = active ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : 0;
      return { s, active, untilClose, untilOpen, progress };
    });
  }, [sessions, localHours]);

  const activeCount = rows.filter((r) => r.active && isTradingSession(r.s as MarketSessionConfig)).length;
  const closedActive = rows.some((r) => r.active && isMarketClosedSession(r.s as MarketSessionConfig));

  return (
    <PageLayout>
      <PageHeader
        icon={
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <ClockIcon className="h-4.5 w-4.5" />
          </div>
        }
        title={uiText("auto.ui.87a7806fa2")}
        subtitle={uiText("auto.ui.60bd9cc0be", { tz: localTimeZoneLabel })}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
             <Radio className="h-3 w-3" /> {closedActive ? uiText("auto.ui.aafe59a8f3") : uiText("auto.ui.7c72ea46ea", { count: activeCount })}
          </span>
        }
      />

      {/* Orologio live (riuso del widget) */}
      <ClockWidget />

      {/* Sessioni di mercato */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Hourglass className="h-3.5 w-3.5" /> {uiText("auto.ui.45e809db60")}
        </h3>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {uiText("auto.ui.3d94117b41")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ s, active, untilClose, untilOpen, progress }) => {
              const closed = isMarketClosedSession(s as MarketSessionConfig);
              // Claude Design session pill: active → session colour (destructive when
              // closed), inactive → spent muted pill.
              const sessionColorTone = toneForSessionColor(s.color);
              const statusTone: SessionTone = active ? sessionColorTone : "muted";
              const statusBadge = sessionBadgeClasses(statusTone);
              return (
              <Card
                key={s.name}
                className={cn(
                  "overflow-hidden transition-colors",
                  active && closed ? "border-red-500/40 bg-red-500/5" : active ? "border-primary/40 bg-primary/5" : "border-border/40",
                )}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", active ? sessionBadgeClasses(sessionColorTone).dot : (SESSION_DOT[s.color] ?? "bg-primary"), active && "animate-pulse")} />
                      <span className="truncate font-bold">{s.name}</span>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", statusBadge.container)}>
                      {active && closed
                        ? uiText("clock.market_closed_badge")
                        : active
                        ? uiText("clock.active_badge")
                        : uiText("auto.ui.df95f7d698")}
                    </span>
                  </div>

                  <div className="rounded-lg bg-secondary/30 p-2 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">{uiText("auto.ui.90375ddfc3")}</div>
                    <div className="font-mono text-xs font-bold">{normalizeLocalSessionTime(s.openUTC)}–{normalizeLocalSessionTime(s.closeUTC)}</div>
                  </div>

                  {active ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{closed ? uiText("auto.ui.b3de9ecf4f") : uiText("auto.ui.8f2b8b4ced")}</span>
                        <span className={cn("font-mono font-bold", closed ? "text-red-400" : "text-primary")}>
                          {uiText("auto.ui.37ef226c4c", { time: formatCountdown(untilClose) })}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary/50">
                        <div className={cn("h-full rounded-full", closed ? "bg-red-500/70" : "bg-primary/70")} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-border/30 px-2.5 py-1.5 text-[11px]">
                      <span className="text-muted-foreground">{uiText("auto.ui.0e1a8d402a")}</span>
                      <span className="font-mono font-bold">{formatCountdown(untilOpen)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
