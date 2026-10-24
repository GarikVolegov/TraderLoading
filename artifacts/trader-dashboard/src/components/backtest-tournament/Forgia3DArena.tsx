import React, { useEffect, useRef, useState } from "react";
import {
  createForgia3DScene,
  type Forgia3DController,
  type Participant3DData,
} from "./forgia3dEngine";
import { ForgiaEmbersOverlay } from "./ForgiaEmbersOverlay";
import { ShieldAlert, Users, Award, Eye } from "lucide-react";

export interface Forgia3DArenaProps {
  participants?: Participant3DData[];
  onTriggerPulseRef?: React.MutableRefObject<(() => void) | null>;
  className?: string;
  style?: React.CSSProperties;
  height?: number | string;
  showEmbers?: boolean;
  asBackdrop?: boolean;
}

export function Forgia3DArena({
  participants = [],
  onTriggerPulseRef,
  className = "",
  style,
  height = 260,
  showEmbers = true,
  asBackdrop = false,
}: Forgia3DArenaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<Forgia3DController | null>(null);
  const draggingRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const controller = createForgia3DScene(host, participants);
    controllerRef.current = controller;

    if (onTriggerPulseRef) {
      onTriggerPulseRef.current = () => {
        controllerRef.current?.triggerTradePulse();
      };
    }

    return () => {
      controller?.dispose();
      controllerRef.current = null;
      if (onTriggerPulseRef) {
        onTriggerPulseRef.current = null;
      }
    };
  }, []);

  // Update participant nodes when props change
  useEffect(() => {
    controllerRef.current?.setParticipants(participants);
  }, [participants]);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = (e.clientX - draggingRef.current.x) * 0.008;
    const dy = (e.clientY - draggingRef.current.y) * 0.008;
    controllerRef.current?.rotate(dx, dy);
    draggingRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = () => {
    draggingRef.current = null;
  };

  if (asBackdrop) {
    return (
      <div
        className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
        style={style}
      >
        {showEmbers && <ForgiaEmbersOverlay />}
        <div
          ref={containerRef}
          className="absolute inset-0 select-none opacity-80"
          style={{ touchAction: "none" }}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#C5A059]/25 bg-gradient-to-b from-[#0E0F14] via-[#0A0B0E] to-[#070709] ${className}`}
      style={{ height, minHeight: 180, ...style }}
    >
      {/* Background embers if enabled */}
      {showEmbers && <ForgiaEmbersOverlay />}

      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
