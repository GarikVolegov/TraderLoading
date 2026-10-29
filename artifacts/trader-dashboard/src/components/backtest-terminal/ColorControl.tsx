import { useEffect, useRef, useState } from "react";
import { Star, X } from "lucide-react";

/** Converts existing renderer rgba colors to an editable eight digit hex value. */
export function colorToHex(value: string): string {
  if (!value) return "#c5a059";
  if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) return value.toLowerCase();
  if (/^#[\da-f]{4}$/i.test(value)) return `#${value.slice(1).split("").map(c => c + c).join("")}`.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(value)) return `#${value.slice(1).split("").map(c => c + c).join("")}`.toLowerCase();
  const parts = value.match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  if (!parts) return "#c5a059";
  return `#${parts.slice(1, 4).map(v => Math.min(255, Math.max(0, Math.round(Number(v)))).toString(16).padStart(2, "0")).join("")}${parts[4] == null ? "" : Math.round(Math.min(1, Math.max(0, Number(parts[4]))) * 255).toString(16).padStart(2, "0")}`.toLowerCase();
}

export const AUREUS_SWATCH_PALETTE = [
  "#c5a059", // Aureus Gold
  "#e8c56a", // Aureus Light Gold
  "#997a3a", // Aureus Deep Bronze
  "#10b981", // Emerald Bull
  "#059669", // Dark Emerald
  "#ef4444", // Crimson Bear
  "#dc2626", // Deep Crimson
  "#3b82f6", // Sapphire Blue
  "#60a5fa", // Sky Blue
  "#06b6d4", // Cyan
  "#f8fafc", // Pure White
  "#94a3b8", // Slate
  "#475569", // Dark Slate
  "#1e293b", // Deep Charcoal
  "#0e1017", // Obsidian Panel
  "#000000", // Black
];

interface ColorPopoverProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
  favorites?: string[];
  onFavoritesChange?: (colors: string[]) => void;
  align?: "left" | "right";
}

export function AureusColorPopover({
  label,
  value,
  onChange,
  onClose,
  favorites = [],
  onFavoritesChange,
  align = "right",
}: ColorPopoverProps) {
  const hex = colorToHex(value);
  const [draft, setDraft] = useState(hex);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(hex);
  }, [hex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const baseHex = hex.slice(0, 7);
  const alpha = hex.length === 9 ? parseInt(hex.slice(7), 16) : 255;
  const starred = favorites.includes(hex);

  const handleAlphaChange = (nextAlpha: number) => {
    const alphaHex = nextAlpha === 255 ? "" : Math.min(255, Math.max(0, nextAlpha)).toString(16).padStart(2, "0");
    onChange(`${baseHex}${alphaHex}`);
  };

  const handleHexChange = (nextBaseHex: string) => {
    const alphaHex = alpha === 255 ? "" : alpha.toString(16).padStart(2, "0");
    onChange(`${nextBaseHex}${alphaHex}`);
  };

  return (
    <div
      ref={popoverRef}
      className={`btm-color-popover ${align === "left" ? "btm-popover-left" : "btm-popover-right"}`}
      role="dialog"
      aria-label={`Selettore colore ${label}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="btm-popover-header">
        <span className="btm-popover-title">{label}</span>
        <button type="button" className="btm-popover-close" onClick={onClose} aria-label="Chiudi">
          <X size={13} />
        </button>
      </div>

      {/* Palette standard AUREUS */}
      <div className="btm-popover-palette" aria-label="Tavolozza colori predefiniti">
        {AUREUS_SWATCH_PALETTE.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={`btm-popover-swatch ${baseHex.toLowerCase() === swatch.toLowerCase() ? "is-selected" : ""}`}
            style={{ backgroundColor: swatch }}
            title={swatch}
            onClick={() => handleHexChange(swatch)}
          />
        ))}
      </div>

      {/* Riquadro Colore Nativo & Input HEX */}
      <div className="btm-popover-controls">
        <div className="btm-popover-picker-wrap">
          <input
            type="color"
            value={baseHex}
            aria-label={`${label} colore`}
            onChange={(e) => handleHexChange(e.target.value)}
          />
          <span className="btm-popover-preview" style={{ backgroundColor: hex }} />
        </div>

        <input
          className="btm-input btm-popover-hex"
          aria-label={`${label} HEX`}
          value={draft}
          maxLength={9}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(e.target.value)) {
              onChange(e.target.value);
            }
          }}
          onBlur={() => setDraft(hex)}
        />

        {onFavoritesChange && (
          <button
            type="button"
            className="btm-popover-star"
            aria-label={starred ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            title={starred ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            onClick={() => {
              if (starred) {
                onFavoritesChange(favorites.filter((c) => c !== hex));
              } else {
                onFavoritesChange([...favorites.slice(-15), hex]);
              }
            }}
          >
            <Star size={13} fill={starred ? "#C5A059" : "transparent"} color={starred ? "#C5A059" : "#71717a"} />
          </button>
        )}
      </div>

      {/* Regolazione Opacità */}
      <div className="btm-popover-slider-row">
        <span className="btm-popover-sublabel">Opacità</span>
        <input
          type="range"
          min="0"
          max="255"
          value={alpha}
          aria-label={`${label} opacità`}
          onChange={(e) => handleAlphaChange(Number(e.target.value))}
        />
        <span className="btm-popover-percent whitespace-nowrap">{Math.round((alpha / 255) * 100)}%</span>
      </div>

      {/* Colori Preferiti salvati */}
      {favorites.length > 0 && (
        <div className="btm-popover-favs">
          <span className="btm-popover-sublabel">Preferiti</span>
          <div className="btm-popover-fav-grid">
            {favorites.map((favColor) => (
              <button
                key={favColor}
                type="button"
                className="btm-popover-swatch"
                style={{ backgroundColor: favColor }}
                title={favColor}
                onClick={() => onChange(favColor)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Pulsante compatto per colore singolo (es. linea, sfondo, testo) */
export function AureusColorSwatch({
  label,
  value,
  onChange,
  favorites = [],
  onFavoritesChange,
  align = "right",
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  favorites?: string[];
  onFavoritesChange?: (colors: string[]) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const hex = colorToHex(value);

  return (
    <div className="btm-swatch-anchor">
      <button
        type="button"
        className="btm-single-swatch-btn"
        aria-label={`Personalizza ${label}`}
        title={`${label}: ${hex}`}
        onClick={() => setOpen(!open)}
      >
        <span className="btm-swatch-checker">
          <span className="btm-swatch-fill" style={{ backgroundColor: hex }} />
        </span>
      </button>

      {open && (
        <AureusColorPopover
          label={label}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
          favorites={favorites}
          onFavoritesChange={onFavoritesChange}
          align={align}
        />
      )}
    </div>
  );
}

/** Pulsante compatto Dual-Swatch per Toro / Orso (es. Candele rialzista/ribassista) */
export function AureusDualColorSwatch({
  upLabel,
  upValue,
  onUpChange,
  downLabel,
  downValue,
  onDownChange,
  favorites = [],
  onFavoritesChange,
}: {
  upLabel: string;
  upValue: string;
  onUpChange: (c: string) => void;
  downLabel: string;
  downValue: string;
  onDownChange: (c: string) => void;
  favorites?: string[];
  onFavoritesChange?: (f: string[]) => void;
}) {
  const [activeSide, setActiveSide] = useState<"up" | "down" | null>(null);
  const upHex = colorToHex(upValue);
  const downHex = colorToHex(downValue);

  return (
    <div className="btm-swatch-anchor">
      <div className="btm-dual-swatch-pill">
        <button
          type="button"
          className="btm-dual-swatch-half btm-dual-swatch-left"
          title={`${upLabel}: ${upHex}`}
          aria-label={upLabel}
          onClick={() => setActiveSide(activeSide === "up" ? null : "up")}
        >
          <span className="btm-swatch-checker">
            <span className="btm-swatch-fill" style={{ backgroundColor: upHex }} />
          </span>
        </button>

        <span className="btm-dual-swatch-divider" />

        <button
          type="button"
          className="btm-dual-swatch-half btm-dual-swatch-right"
          title={`${downLabel}: ${downHex}`}
          aria-label={downLabel}
          onClick={() => setActiveSide(activeSide === "down" ? null : "down")}
        >
          <span className="btm-swatch-checker">
            <span className="btm-swatch-fill" style={{ backgroundColor: downHex }} />
          </span>
        </button>
      </div>

      {activeSide === "up" && (
        <AureusColorPopover
          label={upLabel}
          value={upValue}
          onChange={onUpChange}
          onClose={() => setActiveSide(null)}
          favorites={favorites}
          onFavoritesChange={onFavoritesChange}
          align="right"
        />
      )}

      {activeSide === "down" && (
        <AureusColorPopover
          label={downLabel}
          value={downValue}
          onChange={onDownChange}
          onClose={() => setActiveSide(null)}
          favorites={favorites}
          onFavoritesChange={onFavoritesChange}
          align="right"
        />
      )}
    </div>
  );
}

/** Componente retrocompatibile con layout compatto */
export function ColorControl({
  label,
  value,
  onChange,
  favorites = [],
  onFavoritesChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  favorites?: string[];
  onFavoritesChange?: (colors: string[]) => void;
}) {
  return (
    <div className="btm-setting-row">
      <span className="btm-setting-label">{label}</span>
      <AureusColorSwatch
        label={label}
        value={value}
        onChange={onChange}
        favorites={favorites}
        onFavoritesChange={onFavoritesChange}
      />
    </div>
  );
}
