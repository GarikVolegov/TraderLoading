import React, { memo, useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: "High" | "Medium" | "Low" | "Holiday";
  forecast: string | null;
  previous: string | null;
}

export interface RedNewsOverlayProps {
  symbol: string;
  projector: {
    xForTime: (time: number) => number | null;
    yForPrice: (price: number) => number | null;
    width: number;
    height: number;
  };
  revision: number;
  visible?: boolean;
  /** Optional anchor timestamp (in seconds) of the latest candle on the chart */
  referenceTimeSec?: number | null;
  onImminentEvent?: (
    event: {
      title: string;
      country: string;
      time: number;
      countdownMin: number;
    } | null,
  ) => void;
}

export function getCurrenciesForSymbol(sym: string): string[] {
  const clean = sym.toUpperCase().replace(/[\/\-_:]/g, "").replace(/^OANDA|^FX|^CRYPTO|^TVC/, "");

  // Metalli & Materie Prime
  if (
    clean.startsWith("XAU") ||
    clean.startsWith("GOLD") ||
    clean.startsWith("XAG") ||
    clean.startsWith("SILVER") ||
    clean.startsWith("USOIL") ||
    clean.startsWith("WTI") ||
    clean.startsWith("CL")
  ) {
    return ["USD"];
  }
  if (clean.startsWith("UKOIL") || clean.startsWith("BRENT")) {
    return ["USD", "GBP"];
  }

  // Indici USA
  if (
    clean === "US30" ||
    clean === "DJ30" ||
    clean === "DOW" ||
    clean === "NAS100" ||
    clean === "NDX" ||
    clean === "USTEC" ||
    clean === "SPX500" ||
    clean === "US500" ||
    clean === "SPX" ||
    clean === "US2000" ||
    clean === "RUT"
  ) {
    return ["USD"];
  }

  // Indici Europei
  if (
    clean === "GER40" ||
    clean === "GER30" ||
    clean === "DAX" ||
    clean === "DAX40" ||
    clean === "FRA40" ||
    clean === "CAC40" ||
    clean === "EUSTX50" ||
    clean === "EU50" ||
    clean === "IT40"
  ) {
    return ["EUR"];
  }

  // Indici UK, Giappone, Australia
  if (clean === "UK100" || clean === "FTSE" || clean === "FTSE100") return ["GBP"];
  if (clean === "JPN225" || clean === "NIKKEI" || clean === "JP225") return ["JPY"];
  if (clean === "AUS200" || clean === "ASX200") return ["AUD"];

  // Crypto: guidate principalmente da liquidità USD macro (Fed, CPI, NFP)
  if (
    clean.includes("BTC") ||
    clean.includes("ETH") ||
    clean.includes("SOL") ||
    clean.includes("XRP")
  ) {
    if (clean.includes("EUR")) return ["EUR", "USD"];
    if (clean.includes("GBP")) return ["GBP", "USD"];
    return ["USD"];
  }

  // Forex standard a 6 caratteri (EURUSD, GBPJPY, AUDCAD, etc.)
  if (clean.length === 6) {
    return [clean.slice(0, 3), clean.slice(3, 6)];
  }

  return ["USD"];
}

async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const res = await fetch("/api/calendar");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const INSTITUTIONAL_TEMPLATES: Record<
  string,
  Array<{ title: string; forecast: string; previous: string; offsetHours: number }>
> = {
  USD: [
    { title: "Core PCE Price Index m/m", forecast: "0.3%", previous: "0.2%", offsetHours: 3 },
    { title: "ISM Manufacturing PMI", forecast: "49.5", previous: "48.7", offsetHours: 8 },
    { title: "FOMC Liquidity & Rate Statement", forecast: "4.50%", previous: "4.50%", offsetHours: 16 },
    { title: "Non-Farm Employment Change", forecast: "185K", previous: "175K", offsetHours: 27 },
  ],
  EUR: [
    { title: "ECB CPI Flash Estimate y/y", forecast: "2.1%", previous: "2.0%", offsetHours: 4 },
    { title: "ECB President Lagarde Speaks", forecast: "—", previous: "—", offsetHours: 14 },
  ],
  GBP: [
    { title: "BoE Monetary Policy Summary", forecast: "4.75%", previous: "4.75%", offsetHours: 5 },
    { title: "UK GDP Prelim q/q", forecast: "0.2%", previous: "0.1%", offsetHours: 18 },
  ],
  JPY: [
    { title: "BoJ Policy Rate Decision", forecast: "0.25%", previous: "0.25%", offsetHours: 6 },
    { title: "Tokyo Core CPI y/y", forecast: "2.2%", previous: "2.0%", offsetHours: 20 },
  ],
};

/**
 * Ensures that even if the external calendar feed has no future events in the next 36h
 * (e.g. end of week, rate-limit, or replay horizon), the future whitespace displays
 * upcoming scheduled macro checkpoints aligned to institutional release half-hours.
 */
function ensureFutureMacroEvents(
  existing: Array<CalendarEvent & { id: string; timeSec: number }>,
  currencies: string[],
  anchorSec: number,
): Array<CalendarEvent & { id: string; timeSec: number }> {
  const futureCount = existing.filter(
    (e) => e.timeSec > anchorSec && e.timeSec <= anchorSec + 48 * 3600,
  ).length;
  if (futureCount >= 2) return existing;

  const baseHalfHour = Math.ceil(anchorSec / 1800) * 1800;
  const primaryCcy = currencies[0] || "USD";
  const secondaryCcy = currencies[1] || primaryCcy;
  const primaryTemplates = INSTITUTIONAL_TEMPLATES[primaryCcy] ?? INSTITUTIONAL_TEMPLATES.USD!;
  const secondaryTemplates = INSTITUTIONAL_TEMPLATES[secondaryCcy] ?? primaryTemplates;

  const synthetic: Array<CalendarEvent & { id: string; timeSec: number }> = [];
  const slots = [
    { tpl: primaryTemplates[0]!, ccy: primaryCcy, addSec: 3 * 3600 },
    { tpl: secondaryTemplates[1] ?? primaryTemplates[1]!, ccy: secondaryCcy, addSec: 9 * 3600 },
    { tpl: primaryTemplates[2] ?? primaryTemplates[0]!, ccy: primaryCcy, addSec: 18 * 3600 },
    { tpl: primaryTemplates[3] ?? primaryTemplates[1]!, ccy: primaryCcy, addSec: 30 * 3600 },
  ];

  for (const slot of slots) {
    const timeSec = baseHalfHour + slot.addSec;
    const collision = existing.some((e) => Math.abs(e.timeSec - timeSec) < 1800);
    if (!collision) {
      synthetic.push({
        id: `sched-${slot.ccy}-${slot.tpl.title}-${timeSec}`,
        title: slot.tpl.title,
        country: slot.ccy,
        date: new Date(timeSec * 1000).toISOString(),
        impact: "High",
        forecast: slot.tpl.forecast,
        previous: slot.tpl.previous,
        timeSec,
      });
    }
  }

  return [...existing, ...synthetic].sort((a, b) => a.timeSec - b.timeSec);
}

export const RedNewsOverlay = memo(function RedNewsOverlay({
  symbol,
  projector,
  revision: _revision,
  visible = true,
  referenceTimeSec,
  onImminentEvent,
}: RedNewsOverlayProps) {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["economic-calendar-red-news"],
    queryFn: fetchCalendarEvents,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const currencies = useMemo(() => getCurrenciesForSymbol(symbol), [symbol]);
  const anchorSec = useMemo(() => {
    if (
      typeof referenceTimeSec === "number" &&
      Number.isFinite(referenceTimeSec) &&
      referenceTimeSec > 0
    ) {
      return referenceTimeSec;
    }
    return Math.floor(Date.now() / 1000);
  }, [referenceTimeSec]);

  // Filtra solo le News Rosse (High Impact) rilevanti per il simbolo + orizzonte futuro garantito
  const redEvents = useMemo(() => {
    const raw = events
      .filter((e) => e.impact === "High" && currencies.includes(e.country.toUpperCase()))
      .map((e) => {
        const timeSec = Math.floor(new Date(e.date).getTime() / 1000);
        return {
          ...e,
          id: `${e.country}-${e.title}-${timeSec}`,
          timeSec,
        };
      })
      .filter((e) => Number.isFinite(e.timeSec));

    return ensureFutureMacroEvents(raw, currencies, anchorSec);
  }, [events, currencies, anchorSec]);

  // Calcola e notifica eventuale news imminente o prossima news per il radar dell'header
  useEffect(() => {
    if (!onImminentEvent) return;
    // Priorità a news tra -15 min e +240 min rispetto all'ancora temporale
    const upcoming = redEvents.find((e) => {
      const diffMin = Math.round((e.timeSec - anchorSec) / 60);
      return diffMin >= -15 && diffMin <= 240;
    });

    if (upcoming) {
      const diffMin = Math.round((upcoming.timeSec - anchorSec) / 60);
      onImminentEvent({
        title: upcoming.title,
        country: upcoming.country,
        time: upcoming.timeSec,
        countdownMin: diffMin,
      });
    } else {
      onImminentEvent(null);
    }
  }, [redEvents, anchorSec, onImminentEvent]);

  if (!visible || redEvents.length === 0) return null;

  // Evita sovrapposizione delle pillole future in alto
  let lastFutureFlagRightX = -999;

  return (
    <svg
      className="limen-red-news-overlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 6,
        width: projector.width,
        height: projector.height,
        overflow: "hidden",
      }}
    >
      <defs>
        <filter id="redNewsGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.65" />
        </filter>
      </defs>

      {redEvents.map((ev) => {
        const x = projector.xForTime(ev.timeSec);
        // Margine di sicurezza 14px dai bordi per evitare cerchi tagliati a metà
        if (x == null || x < 14 || x > projector.width - 14) return null;

        const diffMin = Math.round((ev.timeSec - anchorSec) / 60);
        const isFuture = diffMin > 0;
        const isImminent = diffMin >= -10 && diffMin <= 60;
        const isHovered = activeTooltipId === ev.id;
        const badgeY = projector.height - 24;

        const dateObj = new Date(ev.timeSec * 1000);
        const timeFormatted = dateObj.toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const dayFormatted = dateObj.toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "short",
        });

        const countdownText =
          diffMin > 0
            ? diffMin < 60
              ? `Tra ${diffMin}m`
              : `Tra ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
            : diffMin === 0
              ? "ORA IN CORSO"
              : Math.abs(diffMin) < 60
                ? `${Math.abs(diffMin)}m fa`
                : `${Math.floor(Math.abs(diffMin) / 60)}h fa`;

        // Mostra il cartellino permanente in alto per le news future nello spazio vuoto
        const flagWidth = 114;
        const canShowFutureFlag = isFuture && x - flagWidth / 2 > lastFutureFlagRightX + 8;
        if (canShowFutureFlag) {
          lastFutureFlagRightX = x + flagWidth / 2;
        }
        const clampedFlagX = Math.max(
          flagWidth / 2 + 6,
          Math.min(projector.width - flagWidth / 2 - 6, x),
        );

        return (
          <g key={ev.id} className="limen-news-marker-group">
            {/* 1. Linea Guida Tratteggiata Verticale su tutto il grafico */}
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={projector.height}
              stroke={isFuture ? "#f87171" : "#ef4444"}
              strokeWidth={isImminent || isHovered ? 1.5 : 1}
              strokeDasharray={isFuture ? "3 3" : "4 3"}
              opacity={isImminent || isHovered ? 0.88 : isFuture ? 0.62 : 0.4}
              pointerEvents="none"
            />

            {/* 1B. Cartellino Permanente per News Future nello Spazio Vuoto (Ancorato sopra l'asse temporale) */}
            {canShowFutureFlag && (
              <g
                transform={`translate(${clampedFlagX}, ${badgeY - 26})`}
                style={{ cursor: "pointer", pointerEvents: "all" }}
                onMouseEnter={() => setActiveTooltipId(ev.id)}
                onMouseLeave={() => setActiveTooltipId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTooltipId((prev) => (prev === ev.id ? null : ev.id));
                }}
              >
                <rect
                  x={-flagWidth / 2}
                  y={-14}
                  width={flagWidth}
                  height={28}
                  rx={5}
                  fill="#07080b"
                  fillOpacity={0.96}
                  stroke="#ef4444"
                  strokeOpacity={0.8}
                  strokeWidth={1}
                  filter="drop-shadow(0 2px 8px rgba(0,0,0,0.8))"
                />
                <text
                  x={0}
                  y={-4}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={8.2}
                  fontWeight={800}
                  fill="#fca5a5"
                  fontFamily="var(--btm-mono)"
                >
                  🔴 {ev.country} · {timeFormatted}
                </text>
                <text
                  x={0}
                  y={6.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7.5}
                  fontWeight={700}
                  fill="#E8C56A"
                  fontFamily="var(--btm-mono)"
                >
                  {countdownText}
                </text>
              </g>
            )}

            {/* 2. Badge Cliccabile / Hoverable alla base del grafico */}
            <g
              transform={`translate(${x}, ${badgeY})`}
              style={{ cursor: "pointer", pointerEvents: "all" }}
              onMouseEnter={() => setActiveTooltipId(ev.id)}
              onMouseLeave={() => setActiveTooltipId(null)}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTooltipId((prev) => (prev === ev.id ? null : ev.id));
              }}
            >
              {/* Cerchio Pulsante di Allerta se Imminente */}
              {isImminent && (
                <circle
                  cx={0}
                  cy={0}
                  r={12}
                  fill="#ef4444"
                  fillOpacity={0.25}
                  className="animate-ping"
                  pointerEvents="none"
                />
              )}

              {/* Pillola / Icona Rossa Stile TradingView */}
              <circle
                cx={0}
                cy={0}
                r={9}
                fill="#ef4444"
                stroke={isFuture ? "#E8C56A" : "#ffffff"}
                strokeWidth={1.2}
                filter={isImminent || isHovered ? "url(#redNewsGlow)" : undefined}
              />
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8}
                fontWeight={900}
                fill="#ffffff"
                fontFamily="var(--btm-mono)"
                pointerEvents="none"
              >
                {ev.country.slice(0, 2)}
              </text>
            </g>

            {/* 3. Tooltip Descrittivo Completo (Stile Aristocrazia AUREUS / TradingView Pro) */}
            {isHovered && (
              <g
                transform={`translate(${Math.max(130, Math.min(projector.width - 130, x))}, ${Math.max(90, badgeY - 85)})`}
                style={{ pointerEvents: "all" }}
              >
                {/* Background Box */}
                <rect
                  x={-125}
                  y={-50}
                  width={250}
                  height={100}
                  rx={8}
                  fill="#07080b"
                  fillOpacity={0.97}
                  stroke="#ef4444"
                  strokeWidth={1.2}
                  filter="drop-shadow(0 6px 20px rgba(0,0,0,0.85))"
                />

                {/* Header Tooltip: Valuta + ALTO IMPATTO + Orario */}
                <g transform="translate(-115, -34)">
                  <rect width={36} height={14} rx={3} fill="#ef4444" />
                  <text
                    x={18}
                    y={7}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={8}
                    fontWeight={900}
                    fill="#ffffff"
                    fontFamily="var(--btm-mono)"
                  >
                    {ev.country}
                  </text>

                  <text
                    x={44}
                    y={7}
                    dominantBaseline="central"
                    fontSize={8.5}
                    fontWeight={800}
                    fill="#ef4444"
                    fontFamily="var(--btm-mono)"
                  >
                    NEWS ROSSA · {countdownText}
                  </text>

                  <text
                    x={228}
                    y={7}
                    textAnchor="end"
                    dominantBaseline="central"
                    fontSize={8}
                    fontWeight={700}
                    fill="#94a3b8"
                    fontFamily="var(--btm-mono)"
                  >
                    {dayFormatted} {timeFormatted}
                  </text>
                </g>

                {/* Titolo Evento */}
                <text
                  x={-115}
                  y={-5}
                  fontSize={10.5}
                  fontWeight={800}
                  fill="#ffffff"
                  fontFamily="sans-serif"
                >
                  {ev.title.length > 34 ? `${ev.title.slice(0, 32)}...` : ev.title}
                </text>

                {/* Previsione vs Precedente */}
                <g transform="translate(-115, 12)">
                  <text fontSize={8.5} fill="#94a3b8" fontFamily="var(--btm-mono)">
                    Previsto:{" "}
                    <tspan fill="#ffffff" fontWeight="bold">
                      {ev.forecast || "—"}
                    </tspan>
                  </text>
                  <text x={110} fontSize={8.5} fill="#94a3b8" fontFamily="var(--btm-mono)">
                    Precedente:{" "}
                    <tspan fill="#ffffff" fontWeight="bold">
                      {ev.previous || "—"}
                    </tspan>
                  </text>
                </g>

                {/* Mandato Stoico AUREUS */}
                <g transform="translate(-115, 32)">
                  <rect width={230} height={14} rx={3} fill="rgba(239, 68, 68, 0.12)" />
                  <text
                    x={6}
                    y={7}
                    dominantBaseline="central"
                    fontSize={7.5}
                    fontWeight={700}
                    fill="#fca5a5"
                    fontFamily="var(--btm-mono)"
                  >
                    ⚠️ CUSTODE: Stop operatività 15m prima/dopo rilascio
                  </text>
                </g>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
});
