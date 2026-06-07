import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBackground, type TradingSessionConfig } from "@/contexts/BackgroundContext";
import { getLocalClockHours, isMarketClosedSession, isTradingSession, type MarketSessionConfig } from "@/lib/marketSessions";

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

function isInSession(localHours: number, session: TradingSessionConfig): boolean {
  const open = parseTime(session.openUTC);
  const close = parseTime(session.closeUTC);
  if (open < close) return localHours >= open && localHours < close;
  return localHours >= open || localHours < close;
}

function getNextSession(
  localHours: number,
  sessions: TradingSessionConfig[],
): { session: TradingSessionConfig; minutesUntil: number } | null {
  const enabled = sessions.filter((s) => s.enabled && isTradingSession(s as MarketSessionConfig));
  if (enabled.length === 0) return null;
  let best: { session: TradingSessionConfig; minutesUntil: number } | null = null;
  for (const session of enabled) {
    let diff = parseTime(session.openUTC) - localHours;
    if (diff <= 0) diff += 24;
    const minutes = Math.round(diff * 60);
    if (!best || minutes < best.minutesUntil) best = { session, minutesUntil: minutes };
  }
  return best;
}

function formatCountdown(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function ClockWidget() {
  const [time, setTime] = useState(new Date());
  const { tradingSessions } = useBackground();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const localHours = useMemo(() => getLocalClockHours(time), [time]);

  const activeSession = useMemo(() => {
    const enabled = tradingSessions.filter((s) => s.enabled && isTradingSession(s as MarketSessionConfig));
    return enabled.find((s) => isInSession(localHours, s)) ?? null;
  }, [localHours, tradingSessions]);

  const activeClosedSession = useMemo(() => {
    if (activeSession) return null;
    const enabled = tradingSessions.filter((s) => s.enabled && isMarketClosedSession(s as MarketSessionConfig));
    return enabled.find((s) => isInSession(localHours, s)) ?? null;
  }, [activeSession, localHours, tradingSessions]);

  const nextSessionInfo = useMemo(() => {
    if (activeSession) return null;
    return getNextSession(localHours, tradingSessions);
  }, [localHours, tradingSessions, activeSession]);

  const colorMap: Record<string, { bg: string; glow: string }> = {
    "session-asian": { bg: "bg-[hsl(var(--session-asian))]", glow: "neon-glow-asian" },
    "session-london": { bg: "bg-[hsl(var(--session-london))]", glow: "neon-glow-london" },
    "session-ny": { bg: "bg-[hsl(var(--session-ny))]", glow: "neon-glow-ny" },
    "session-volume": { bg: "bg-[hsl(var(--session-volume))]", glow: "neon-glow-volume" },
    "session-closed": { bg: "bg-[hsl(var(--session-closed))]", glow: "neon-glow-volume" },
  };

  const dayOfWeek = time.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const activeColors = activeSession ? colorMap[activeSession.color] : activeClosedSession ? colorMap[activeClosedSession.color] : null;
  const countdownText = nextSessionInfo
    ? `${nextSessionInfo.session.name} tra ${formatCountdown(nextSessionInfo.minutesUntil)}`
    : "";

  const badgeLabel = activeSession
    ? activeSession.name
    : activeClosedSession
    ? activeClosedSession.name
    : isWeekend
    ? "Mercato chiuso"
    : "Mercato aperto";

  const badgeDotClass = activeSession
    ? cn(activeColors?.bg, "animate-pulse shadow-[0_0_8px_currentColor]")
    : activeClosedSession
    ? cn(activeColors?.bg ?? "bg-red-500", "animate-pulse shadow-[0_0_8px_currentColor]")
    : isWeekend
    ? "bg-red-500"
    : "bg-green-500";

  const badgeTextClass = activeSession
    ? "text-foreground"
    : activeClosedSession || isWeekend
    ? "text-red-400"
    : "text-green-400";

  const badgeBorderClass = activeSession
    ? ""
    : activeClosedSession || isWeekend
    ? "border-red-500/30 bg-red-500/10"
    : "border-green-500/30 bg-green-500/10";

  return (
    <Card className="relative overflow-hidden border-t-4 border-t-primary/50">
      <div className="pointer-events-none absolute right-0 top-0 select-none p-32 opacity-5">
        <div className="h-64 w-64 rounded-full bg-primary blur-[100px]" />
      </div>

      <CardContent className="z-10 px-4 py-3 sm:px-5 sm:py-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 sm:gap-6">
          <div className="tabular-nums slashed-zero">
            <div className="text-2xl font-bold tracking-tighter text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] sm:text-4xl md:text-5xl">
              {format(time, "HH:mm:ss")}
            </div>
          </div>

          <div className="flex flex-col items-center gap-[2px] text-center">
            <p className="text-xs font-medium uppercase leading-none tracking-widest text-muted-foreground sm:text-sm">
              {format(time, "d")}
            </p>
            <p className="text-[9px] font-medium uppercase leading-none tracking-widest text-muted-foreground sm:text-xs">
              {format(time, "EEEE", { locale: it })}
            </p>
            <p
              className={cn(
                "max-w-[120px] truncate pt-1 text-[9px] leading-none sm:text-[10px]",
                countdownText ? "text-muted-foreground" : "invisible select-none",
              )}
              aria-hidden={!countdownText}
            >
              {countdownText || "placeholder"}
            </p>
          </div>

          <div
            className={cn(
              "flex min-w-[8rem] items-center gap-2 rounded-md border bg-secondary/80 px-3 py-2 sm:min-w-[9.5rem]",
              activeColors?.glow ?? "",
              !activeSession && badgeBorderClass,
            )}
          >
            <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", badgeDotClass)} />
            <span className={cn("truncate text-sm font-bold tracking-wide sm:text-base", badgeTextClass)}>
              {badgeLabel}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
