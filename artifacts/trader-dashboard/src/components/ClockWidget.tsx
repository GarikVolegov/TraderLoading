import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBackground, type TradingSessionConfig } from "@/contexts/BackgroundContext";
import {
  getLocalClockHours,
  isMarketClosedSession,
  isSessionEnabledForDate,
  isTradingSession,
  type MarketSessionConfig,
} from "@/lib/marketSessions";
import { getGetRandomQuoteQueryKey, useGetRandomQuote } from "@workspace/api-client-react";

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

  const { data: quote } = useGetRandomQuote({
    query: {
      queryKey: getGetRandomQuoteQueryKey(),
      staleTime: 0,
      refetchInterval: 8000,
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const localHours = useMemo(() => getLocalClockHours(time), [time]);

  const activeSession = useMemo(() => {
    const enabled = tradingSessions.filter(
      (s) => s.enabled && isTradingSession(s as MarketSessionConfig) && isSessionEnabledForDate(s as MarketSessionConfig, time),
    );
    return enabled.find((s) => isInSession(localHours, s)) ?? null;
  }, [localHours, time, tradingSessions]);

  const activeClosedSession = useMemo(() => {
    if (activeSession) return null;
    const enabled = tradingSessions.filter(
      (s) => s.enabled && isMarketClosedSession(s as MarketSessionConfig) && isSessionEnabledForDate(s as MarketSessionConfig, time),
    );
    return enabled.find((s) => isInSession(localHours, s)) ?? null;
  }, [activeSession, localHours, time, tradingSessions]);

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
    ? "Chiuso"
    : isWeekend
    ? "Chiuso"
    : "Mercato aperto";
  const compactBadgeLabel = badgeLabel === "Conferma Vol." ? "Conferma" : badgeLabel;

  const badgeDotClass = activeSession
    ? cn(activeColors?.bg, "animate-pulse shadow-[0_0_8px_currentColor]")
    : activeClosedSession
    ? cn(activeColors?.bg ?? "bg-destructive", "animate-pulse shadow-[0_0_8px_currentColor]")
    : isWeekend
    ? "bg-destructive"
    : "bg-success";

  const badgeTextClass = activeSession
    ? "text-foreground"
    : activeClosedSession || isWeekend
    ? "text-destructive"
    : "text-success";

  const badgeBorderClass = activeSession
    ? ""
    : activeClosedSession || isWeekend
    ? "border-destructive/30 bg-destructive/10"
    : "border-success/30 bg-success/10";

  return (
    <Card className="relative h-16 overflow-hidden rounded-[0.625rem]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-primary shadow-[0_0_16px_hsl(var(--primary)/0.8)]" />

      <CardContent className="relative z-10 h-full p-0">
        <div className="absolute inset-x-3 top-1/2 grid -translate-y-1/2 grid-cols-[minmax(9rem,1fr)_1px_minmax(3.4rem,4.2rem)_minmax(6.6rem,0.72fr)] items-center lg:grid-cols-[minmax(9rem,auto)_1fr_1px_minmax(3.4rem,4.2rem)_minmax(6.6rem,0.72fr)]">
          <div className="min-w-0 pl-2 pr-5 tabular-nums">
            <div className="truncate text-left font-sans text-[1.84rem] font-bold leading-none tracking-normal text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.12)] sm:text-[2rem]">
              {format(time, "HH:mm:ss")}
            </div>
          </div>

          {/* Daily quote — desktop only */}
          <div className="hidden min-w-0 lg:flex lg:items-center lg:gap-2 lg:px-4">
            <Quote className="h-3.5 w-3.5 shrink-0 text-primary/55" aria-hidden />
            {quote && (
              <>
                <p className="min-w-0 flex-1 truncate text-[0.72rem] italic leading-none text-foreground/80">
                  {quote.text}
                </p>
                <span className="shrink-0 font-mono text-[0.65rem] leading-none text-muted-foreground">
                  — {quote.author}
                </span>
              </>
            )}
          </div>

          <div className="h-[1.875rem] bg-[#132035]" />

          <div className="flex min-w-0 flex-col items-center justify-center gap-[0.18rem] px-2 text-center">
            <p className="font-sans text-[0.78rem] font-bold uppercase leading-none tracking-normal text-foreground/90 sm:text-[0.84rem]">
              {format(time, "d")}
            </p>
            <p className="max-w-full truncate text-[0.36rem] font-bold uppercase leading-none tracking-normal text-muted-foreground/70 sm:text-[0.4rem]">
              {format(time, "EEEE", { locale: it })}
            </p>
          </div>

          <div
            className={cn(
              "ml-3 mr-2 flex h-[1.875rem] w-[5.9rem] min-w-0 items-center justify-center gap-[0.35rem] justify-self-end rounded-md border border-[#1d2740] bg-[#151b31] px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
              activeColors?.glow ?? "",
              !activeSession && badgeBorderClass,
            )}
          >
            <div className={cn("h-[0.4rem] w-[0.4rem] shrink-0 rounded-full", badgeDotClass)} />
            <span className={cn("truncate text-[0.59rem] font-bold leading-none tracking-normal sm:text-[0.64rem]", badgeTextClass)}>
              {compactBadgeLabel}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
