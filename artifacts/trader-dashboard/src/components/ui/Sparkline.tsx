import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_VAR: Record<"success" | "destructive" | "primary", string> = {
  success: "hsl(var(--success))",
  destructive: "hsl(var(--destructive))",
  primary: "hsl(var(--primary))",
};

export interface SparklineProps {
  data: number[];
  tone?: "success" | "destructive" | "primary";
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  tone = "primary",
  width = 96,
  height = 28,
  className,
}: SparklineProps) {
  // Hooks must run unconditionally — call useId before any early return.
  const gid = React.useId();
  if (!data || data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }
  const color = TONE_VAR[tone];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - 2 - ((v - min) / (max - min || 1)) * (height - 4),
  ]);
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={cn("block", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
