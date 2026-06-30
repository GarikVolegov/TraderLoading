import { LayoutGrid } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { ARCHIVE_TYPES, TYPE_ACCENT, type ArchiveType } from "@/lib/archive";
import { typeIcon, typeLabel } from "./typeMeta";

interface Props {
  value: ArchiveType | "all";
  onChange: (value: ArchiveType | "all") => void;
}

export function TypeChips({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange("all")}
        data-active={value === "all" ? "1" : undefined}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/45 bg-card/55 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active]:border-primary/55 data-[active]:bg-primary/15 data-[active]:font-semibold data-[active]:text-primary"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        {uiText("archive.type.all")}
      </button>
      {ARCHIVE_TYPES.map((type) => {
        const Icon = typeIcon(type);
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            data-active={active ? "1" : undefined}
            style={active ? { color: TYPE_ACCENT[type], borderColor: TYPE_ACCENT[type] } : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/45 bg-card/55 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active]:bg-primary/10 data-[active]:font-semibold"
          >
            <Icon className="h-3.5 w-3.5" />
            {typeLabel(type)}
          </button>
        );
      })}
    </div>
  );
}
