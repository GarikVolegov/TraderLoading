import { cn } from "@/lib/utils";
import "./BrandMark.css";

/** Official AUREUS Wordmark and Symbol across public pages and workspaces. */
export function BrandMark({
  className,
  subtitle = "CICLO OPERATIVO",
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <span className={cn("tl-brand", className)}>
      <span className="tl-brand-symbol" aria-hidden="true">
        <img src="/app-icon-192.png?v=20261021g" alt="AUREUS" className="tl-brand-symbol-img" width={32} height={32} />
      </span>
      <span className="tl-brand-wordmark">
        AUREUS{subtitle ? <small>{subtitle}</small> : null}
      </span>
    </span>
  );
}
