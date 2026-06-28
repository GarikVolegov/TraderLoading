import * as React from "react";
import { cn } from "@/lib/utils";

export interface GaugeProps {
  value: number;
  width?: number;
  className?: string;
}

export function Gauge({ value, width = 150, className }: GaugeProps) {
  const v = Math.max(0, Math.min(100, value));
  const R = width / 2 - 12;
  const cx = width / 2;
  const cy = R + 10;
  const h = cy + 22;
  const ang = (x: number) => Math.PI * (1 - x / 100);
  const pt = (x: number, r: number): [number, number] => [
    cx + r * Math.cos(ang(x)),
    cy - r * Math.sin(ang(x)),
  ];
  const arc = (v0: number, v1: number, r: number) => {
    const [x0, y0] = pt(v0, r);
    const [x1, y1] = pt(v1, r);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const [nx, ny] = pt(v, R - 5);
  const gid = React.useId();
  return (
    <svg
      viewBox={`0 0 ${width} ${h}`}
      width={width}
      height={h}
      className={cn("block overflow-visible", className)}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--destructive))" />
          <stop offset="50%" stopColor="hsl(var(--warning))" />
          <stop offset="100%" stopColor="hsl(var(--success))" />
        </linearGradient>
      </defs>
      <path d={arc(0, 100, R)} fill="none" stroke="hsl(var(--secondary))" strokeWidth="9" strokeLinecap="round" />
      <path d={arc(0, 100, R)} fill="none" stroke={`url(#${gid})`} strokeWidth="9" strokeLinecap="round" opacity="0.92" />
      <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="hsl(var(--foreground))" />
      <text x={cx} y={cy + 16} textAnchor="middle" fontWeight="700" fontSize="17" fill="hsl(var(--foreground))" style={{ fontFamily: "var(--font-mono, monospace)" }}>
        {Math.round(v)}%
      </text>
    </svg>
  );
}
