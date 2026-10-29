import React, { memo, useRef, useState, useEffect } from "react";
import { Bell, Plus, X, Pause, Play } from "lucide-react";
import type { ReplayPriceAlert } from "@/lib/replay/alertModel";
import { formatPrice } from "./format";
import type { ChartProjector } from "./PositionOverlay";
import type { ReplayEngine } from "./useReplayEngine";

export interface ChartAlertsOverlayProps {
  engine?: { symbol?: string } | ReplayEngine;
  symbol?: string;
  projector: ChartProjector;
  revision: number;
  alerts: ReplayPriceAlert[];
  onCreateAlert: (price: number) => void;
  onRemoveAlert: (id: string) => void;
  onUpdateAlertPrice: (id: string, newPrice: number) => void;
  onToggleAlert: (id: string) => void;
  crosshairY?: number | null;
}

export const ChartAlertsOverlay = memo(function ChartAlertsOverlay({
  engine,
  symbol,
  projector,
  revision: _revision,
  alerts,
  onCreateAlert,
  onRemoveAlert,
  onUpdateAlertPrice,
  onToggleAlert,
  crosshairY,
}: ChartAlertsOverlayProps) {
  const effectiveSymbol = symbol ?? engine?.symbol ?? "EURUSD";
  const containerRef = useRef<HTMLDivElement>(null);
  const [heldY, setHeldY] = useState<number | null>(null);
  const [overButton, setOverButton] = useState(false);
  const [hoveredAlertId, setHoveredAlertId] = useState<string | null>(null);
  const [draggingAlertId, setDraggingAlertId] = useState<string | null>(null);
  const [dragPrice, setDragPrice] = useState<number | null>(null);

  // Il '+' segue il crosshair dentro il grafico; resta visibile ~0.7s dopo l'uscita
  // del mouse dal canvas (o finché il cursore è sul pulsante) per poterlo cliccare.
  useEffect(() => {
    if (crosshairY != null) {
      setHeldY(crosshairY);
      return;
    }
    if (overButton) return;
    const timer = setTimeout(() => setHeldY(null), 700);
    return () => clearTimeout(timer);
  }, [crosshairY, overButton]);

  const { width, height, paneWidth: projPaneWidth } = projector;
  const paneWidth = projPaneWidth ?? Math.max(0, width - 58);
  const scaleWidth = Math.max(0, width - paneWidth);
  if (width <= 0 || height <= 0) return null;

  const effectiveHoverY = draggingAlertId != null
    ? null
    : heldY != null && heldY >= 0 && heldY <= height
    ? heldY
    : null;

  const effectiveHoverPrice = effectiveHoverY != null ? projector.priceForY(effectiveHoverY) : null;

  // Dragging alert line with window listeners to avoid loss of pointer capture
  const startDrag = (alertId: string, initialPrice: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingAlertId(alertId);
    setDragPrice(initialPrice);
  };

  useEffect(() => {
    if (!draggingAlertId) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const newPrice = projector.priceForY(y);
      if (newPrice != null && Number.isFinite(newPrice)) {
        setDragPrice(newPrice);
      }
    };

    const handlePointerUp = () => {
      if (draggingAlertId && dragPrice != null) {
        onUpdateAlertPrice(draggingAlertId, dragPrice);
      }
      setDraggingAlertId(null);
      setDragPrice(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingAlertId, dragPrice, projector, onUpdateAlertPrice]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none z-10"
    >
      {/* ── '+' Allerta dentro il grafico (bordo destro dell'area prezzi, all'altezza del crosshair) ── */}
      {effectiveHoverY != null && effectiveHoverPrice != null && !draggingAlertId && (
        <div
          className="absolute flex items-center pointer-events-none transform -translate-y-1/2"
          style={{ top: effectiveHoverY, left: 0, width: Math.max(0, paneWidth) }}
        >
          {/* Linea guida orizzontale tratteggiata fino al pulsante */}
          <div
            className="flex-1 border-t border-dashed border-[#C5A059]/50 pointer-events-none"
          />

          <button
            type="button"
            onPointerEnter={() => setOverButton(true)}
            onPointerLeave={() => setOverButton(false)}
            onClick={(e) => {
              e.stopPropagation();
              onCreateAlert(effectiveHoverPrice);
            }}
            className="pointer-events-auto mr-1 w-5 h-5 rounded-full bg-[#C5A059] hover:bg-[#E8C56A] text-black flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95"
            title={`Aggiungi allerta a ${formatPrice(effectiveHoverPrice, effectiveSymbol)}`}
            aria-label={`Aggiungi allerta a ${formatPrice(effectiveHoverPrice, effectiveSymbol)}`}
          >
            <Plus size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* ── Linee di Alert Esistenti sul Canvas ── */}
      <svg
        className="w-full h-full pointer-events-none overflow-visible"
        width={width}
        height={height}
      >
        {alerts.map((alert) => {
          const isDragging = draggingAlertId === alert.id;
          const displayPrice = isDragging && dragPrice != null ? dragPrice : alert.price;
          const y = projector.yForPrice(displayPrice);
          if (y == null || y < -10 || y > height + 10) return null;

          const isActive = alert.status === "active";
          const isTriggered = alert.status === "triggered";
          const isHovered = hoveredAlertId === alert.id || isDragging;

          const lineColor = isTriggered
            ? "#10b981"
            : isActive
            ? "#f59e0b"
            : "#6b7280";

          return (
            <g
              key={alert.id}
              className="pointer-events-auto group cursor-ns-resize"
              onPointerEnter={() => setHoveredAlertId(alert.id)}
              onPointerLeave={() => {
                if (!draggingAlertId) setHoveredAlertId(null);
              }}
              onPointerDown={(e) => startDrag(alert.id, displayPrice, e)}
            >
              {/* Hitbox trasparente per interazione e trascinamento confortevole lungo TUTTO il grafico */}
              <line
                x1={0}
                y1={y}
                x2={paneWidth}
                y2={y}
                stroke="transparent"
                strokeWidth={18}
              />

              {/* Linea Visiva Tratteggiata di Alert (rigorosamente confinata nel pane) */}
              <line
                x1={0}
                y1={y}
                x2={paneWidth}
                y2={y}
                stroke={lineColor}
                strokeWidth={isHovered ? 1.8 : 1.2}
                strokeDasharray={isTriggered ? undefined : "5 4"}
                className={isTriggered ? "animate-pulse" : undefined}
                opacity={isActive ? 0.9 : 0.45}
              />

              {/* Badge Asse Prezzo Destro (Campanella + Prezzo) innestato nella scala */}
              <g transform={`translate(${paneWidth + 2}, ${y - 10})`}>
                <rect
                  width={Math.max(54, scaleWidth - 4)}
                  height={20}
                  rx={4}
                  fill={isTriggered ? "#064e3b" : isActive ? "rgba(245, 158, 11, 0.22)" : "#1f2937"}
                  stroke={lineColor}
                  strokeWidth={1}
                />
                <text
                  x={5}
                  y={13.5}
                  fontSize={9.5}
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={lineColor}
                >
                  🔔 {formatPrice(displayPrice, effectiveSymbol)}
                </text>
              </g>

              {/* Maniglia di Trascinamento al passaggio del mouse */}
              {isHovered && (
                <g transform={`translate(${Math.max(40, paneWidth / 2 - 60)}, ${y - 12})`}>
                  <rect
                    width={120}
                    height={24}
                    rx={6}
                    fill="#0d0f14"
                    stroke="rgba(197, 160, 89, 0.4)"
                    strokeWidth={1}
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                  />
                  <text
                    x={8}
                    y={15}
                    fontSize={10}
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#E8C56A"
                  >
                    {isDragging ? "Rilascia per fissare" : "Trascina livello"}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Controlli Rapidi HTML (Elimina / Toggle) sull'Alert al passaggio del mouse ── */}
      {hoveredAlertId && !draggingAlertId && (() => {
        const alert = alerts.find((a) => a.id === hoveredAlertId);
        if (!alert) return null;
        const y = projector.yForPrice(alert.price);
        if (y == null) return null;

        return (
          <div
            className="absolute flex items-center gap-1 pointer-events-auto transform -translate-y-1/2 bg-black/85 border border-[#C5A059]/40 rounded px-1.5 py-0.5 shadow-xl"
            style={{ top: y, right: scaleWidth + 6 }}
            onPointerEnter={() => setHoveredAlertId(alert.id)}
            onPointerLeave={() => setHoveredAlertId(null)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleAlert(alert.id);
              }}
              className="text-amber-400 hover:text-amber-200 p-0.5 cursor-pointer"
              title={alert.status === "active" ? "Disattiva allerta" : "Attiva allerta"}
            >
              {alert.status === "active" ? <Pause size={11} /> : <Play size={11} />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveAlert(alert.id);
                setHoveredAlertId(null);
              }}
              className="text-rose-400 hover:text-rose-200 p-0.5 cursor-pointer"
              title="Elimina allerta di prezzo"
            >
              <X size={11} />
            </button>
          </div>
        );
      })()}
    </div>
  );
});
