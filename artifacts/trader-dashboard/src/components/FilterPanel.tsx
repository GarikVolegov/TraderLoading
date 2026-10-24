import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useLanguage } from "@/contexts/LanguageContext";

const labels = { it: "Filtri e ricerca", en: "Search and filters", es: "Búsqueda y filtros", fr: "Recherche et filtres", de: "Suche und Filter" };

/** A single mounted form keeps draft filters when the viewport changes. */
export function FilterPanel({ children, active = false }: { children: ReactNode; active?: boolean }) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [expanded, setExpanded] = useState(false);
  const { language } = useLanguage();
  return <details className="filter-panel rounded-xl border border-border bg-card/70" open={desktop || expanded} onToggle={event => { if (!desktop) setExpanded(event.currentTarget.open); }}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium lg:hidden">
      <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
      {labels[language]}
      {active && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
      <ChevronDown className="ml-auto h-4 w-4" />
    </summary>
    <div className="p-3">{children}</div>
  </details>;
}
