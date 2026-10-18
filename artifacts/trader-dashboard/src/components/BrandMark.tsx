import { Focus } from "lucide-react";
import { cn } from "@/lib/utils";
import "./BrandMark.css";

/** One wordmark and symbol across the public site and trading workspaces. */
export function BrandMark({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn("tl-brand", className)}>
      <span className="tl-brand-symbol" aria-hidden="true">
        <Focus size={20} strokeWidth={1.7} />
      </span>
      <span className="tl-brand-wordmark">
        TraderLoading{subtitle && <small>{subtitle}</small>}
      </span>
    </span>
  );
}
