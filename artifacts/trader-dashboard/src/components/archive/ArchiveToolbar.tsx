import { Columns3, List, LayoutGrid, Search, SlidersHorizontal, X } from "lucide-react";
import { useRef } from "react";
import { uiText } from "@/contexts/LanguageContext";

export type ArchiveView = "grid" | "list" | "board";
export type ArchiveDensity = "comoda" | "compatta";

interface Props {
  search: string;
  onSearch: (value: string) => void;
  view: ArchiveView;
  onViewChange: (view: ArchiveView) => void;
  density: ArchiveDensity;
  onDensityChange: (density: ArchiveDensity) => void;
  count: number;
  filtered: boolean;
  onClear: () => void;
}

const VIEWS: { key: ArchiveView; Icon: typeof List; labelKey: string }[] = [
  { key: "grid", Icon: LayoutGrid, labelKey: "archive.view.grid" },
  { key: "list", Icon: List, labelKey: "archive.view.list" },
  { key: "board", Icon: Columns3, labelKey: "archive.view.board" },
];

export function ArchiveToolbar(props: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const clearFilters = () => {
    props.onClear();
    // The reset button disappears; retain a useful keyboard focus target.
    searchRef.current?.focus();
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[160px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchRef}
          type="text"
          value={props.search}
          onChange={(e) => props.onSearch(e.target.value)}
          placeholder={uiText("archive.search.placeholder")}
          aria-label={uiText("archive.search.placeholder")}
          className="h-11 w-full rounded-lg border border-border/50 bg-card/60 pl-9 pr-3 text-base text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        />
      </div>
      {props.filtered && (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <X className="h-3 w-3" />
          {uiText("archive.clear")}
        </button>
      )}
      <span className="shrink-0 whitespace-nowrap font-mono text-[11.5px] text-muted-foreground">
        {uiText("archive.stats.items", { count: props.count })}
      </span>
      <button
        type="button"
        onClick={() => props.onDensityChange(props.density === "comoda" ? "compatta" : "comoda")}
        title={uiText("archive.density.toggle")}
        aria-label={uiText("archive.density.toggle")}
        aria-pressed={props.density === "compatta"}
        data-active={props.density === "compatta" ? "1" : undefined}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground data-[active]:text-primary"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
      <div className="flex shrink-0 gap-0.5 rounded-[10px] border border-border/40 bg-secondary/50 p-0.5">
        {VIEWS.map(({ key, Icon, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => props.onViewChange(key)}
            data-active={props.view === key ? "1" : undefined}
            title={uiText(labelKey)}
            aria-label={uiText(labelKey)}
            aria-pressed={props.view === key}
            className="flex h-11 w-11 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:text-foreground data-[active]:bg-primary/15 data-[active]:text-primary"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
