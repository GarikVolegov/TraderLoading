import { useState } from "react";
import { ZEN_EMOJI_CATEGORIES } from "@/lib/zenEmojis";

interface EmojiPickerPanelProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPickerPanel({ onSelect, className = "" }: EmojiPickerPanelProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const cat = ZEN_EMOJI_CATEGORIES[activeCategory];

  return (
    <div className={`rounded-xl border border-border bg-card/90 shadow-lg ${className}`}>
      <div className="flex border-b border-border/50">
        {ZEN_EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.label}
            onClick={() => setActiveCategory(i)}
            title={c.label}
            className={`flex-1 py-1.5 text-base transition-colors ${
              i === activeCategory
                ? "bg-primary/10 text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="p-2">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1.5 px-0.5">
          {cat.label}
        </p>
        <div className="grid grid-cols-10 gap-0.5">
          {cat.emojis.map(e => (
            <button
              key={e}
              onClick={() => onSelect(e)}
              className="text-lg p-1 rounded hover:bg-secondary/80 hover:scale-125 transition-all"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
