import React, { memo, useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, TrendingUp, ShieldAlert, X } from "lucide-react";

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
  onImminentEvent?: (event: { title: string; country: string; time: number; countdownMin: number } | null) => void;
}

export function getCurrenciesForSymbol(sym: string): string[] {
  const clean = sym.toUpperCase().replace(/[\/\-_]/g, "");

  // Metalli & Materie Prime
  if (clean.startsWith("XAU") || clean.startsWith("GOLD") || clean.startsWith("XAG") || clean.startsWith("SILVER") || clean.startsWith("USOIL") || clean.startsWith("WTI") || clean.startsWith("CL")) {
    return ["USD"];
  }
  if (clean.startsWith("UKOIL") || clean.startsWith("BRENT")) {
    return ["USD", "GBP"];
  }

  // Indici USA
  if (
    clean === "US30" || clean === "DJ30" || clean === "DOW" ||
    clean === "NAS100" || clean === "NDX" || clean === "USTEC" ||
    clean === "SPX500" || clean === "US500" || clean === "SPX" ||
    clean === "US2000" || clean === "RUT"
  ) {
    return ["USD"];
  }

  // Indici Europei
  if (
    clean === "GER40" || clean === "GER30" || clean === "DAX" || clean === "DAX40" ||
    clean === "FRA40" || clean === "CAC40" || clean === "EUSTX50" || clean === "EU50" || clean === "IT40"
  ) {
    return ["EUR"];
  }

  // Indici UK, Giappone, Australia
  if (clean === "UK100" || clean === "FTSE" || clean === "FTSE100") return ["GBP"];
  if (clean === "JPN225" || clean === "NIKKEI" || clean === "JP225") return ["JPY"];
  if (clean === "AUS200" || clean === "ASX200") return ["AUD"];

  // Crypto: guidate principalmente da liquidità USD macro (Fed, CPI, NFP)
  if (clean.includes("BTC") || clean.includes("ETH") || clean.includes("SOL") || clean.includes("XRP")) {
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

export const RedNewsOverlay = memo(function RedNewsOverlay({
  symbol,
  projector,
  revision: _revision,
  visible = true,
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

  // Filtra solo le News Rosse (High Impact) rilevanti per il simbolo
  const redEvents = useMemo(() => {
    return events
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
  }, [events, currencies]);

  // Calcola e notifica eventuale news imminente per il radar dell'header
  useEffect(() => {
    if (!onImminentEvent) return;
    const nowSec = Math.floor(Date.now() / 1000);
    // News tra -15 min e +60 min
    const upcoming = redEvents.find((e) => {
      const diffMin = Math.round((e.timeSec - nowSec) / 60);
      return diffMin >= -15 && diffMin <= 60;
    });

    if (upcoming) {
      const diffMin = Math.round((upcoming.timeSec - nowSec) / 60);
      onImminentEvent({
        title: upcoming.title,
        country: upcoming.country,
        time: upcoming.timeSec,
        countdownMin: diffMin,
      });
    } else {
      onImminentEvent(null);
    }
  }, [redEvents, onImminentEvent]);

  if (!visible || redEvents.length === 0) return null;

  const nowSec = Math.floor(Date.now() / 1000);

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
        overflow: "visible",
      }}
    >
      <defs>
        <filter id="redNewsGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.65" />
        </filter>
      </defs>

      {redEvents.map((ev) => {
        const x = projector.xForTime(ev.timeSec);
        if (x == null || x < -20 || x > projector.width + 20) return null;

        const diffMin = Math.round((ev.timeSec - nowSec) / 60);
        const isImminent = diffMin >= -10 && diffMin <= 45;
        const isHovered = activeTooltipId === ev.id;
        const badgeY = projector.height - 24;

        const dateObj = new Date(ev.timeSec * 1000);
        const timeFormatted = dateObj.toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        const countdownText =
          diffMin > 0
            ? diffMin < 60
              ? `Tra ${diffMin} min`
              : `Tra ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
            : diffMin === 0
              ? "ORA IN CORSO"
              : Math.abs(diffMin) < 60
                ? `${Math.abs(diffMin)}m fa`
                : `${Math.floor(Math.abs(diffMin) / 60)}h fa`;

        return (
          <g key={ev.id} className="limen-news-marker-group">
            {/* 1. Linea Guida Tratteggiata Verticale su tutto il grafico */}
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={projector.height}
              stroke="#ef4444"
              strokeWidth={isImminent || isHovered ? 1.5 : 1}
              strokeDasharray="4 3"
              opacity={isImminent || isHovered ? 0.85 : 0.45}
              pointerEvents="none"
            />

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
                stroke="#ffffff"
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
                    x={222}
                    y={7}
                    textAnchor="end"
                    dominantBaseline="central"
                    fontSize={8.5}
                    fontWeight={700}
                    fill="#94a3b8"
                    fontFamily="var(--btm-mono)"
                  >
                    {timeFormatted}
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
