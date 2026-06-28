import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<"default" | "primary" | "success" | "destructive", string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  destructive: "text-destructive",
};

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: "default" | "primary" | "success" | "destructive";
  size?: "md" | "lg";
  className?: string;
}

export function StatTile({
  label,
  value,
  unit,
  tone = "default",
  size = "md",
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/35 bg-secondary/30 px-3 py-2.5",
        className,
      )}
    >
      <p className="text-[0.62rem] font-bold uppercase leading-none text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-mono font-black leading-none tabular-nums",
          size === "lg" ? "text-xl" : "text-lg",
          TONE_CLASS[tone],
        )}
      >
        {value}
        {unit ? <span className="ml-1 text-xs font-bold text-muted-foreground">{unit}</span> : null}
      </p>
    </div>
  );
}
