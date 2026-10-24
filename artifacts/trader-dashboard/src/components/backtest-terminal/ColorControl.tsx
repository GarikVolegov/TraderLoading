import { useEffect, useState } from "react";
import { Star } from "lucide-react";

/** Converts existing renderer rgba colors to an editable eight digit hex value. */
export function colorToHex(value: string): string {
  if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) return value.toLowerCase();
  if (/^#[\da-f]{4}$/i.test(value)) return `#${value.slice(1).split("").map(c => c + c).join("")}`;
  if (/^#[\da-f]{3}$/i.test(value)) return `#${value.slice(1).split("").map(c => c + c).join("")}`;
  const parts = value.match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  if (!parts) return "#3b82f6";
  return `#${parts.slice(1, 4).map(v => Math.min(255, Math.max(0, Math.round(Number(v)))).toString(16).padStart(2, "0")).join("")}${parts[4] == null ? "" : Math.round(Math.min(1, Math.max(0, Number(parts[4]))) * 255).toString(16).padStart(2, "0")}`;
}

export function ColorControl({ label, value, onChange, favorites = [], onFavoritesChange }: {
  label: string; value: string; onChange: (color: string) => void;
  favorites?: string[]; onFavoritesChange?: (colors: string[]) => void;
}) {
  const hex = colorToHex(value);
  const [draft, setDraft] = useState(hex);
  useEffect(() => setDraft(hex), [hex]);
  const alpha = hex.length === 9 ? parseInt(hex.slice(7), 16) : 255;
  const starred = favorites.includes(hex);
  return <div className="btm-color-control">
    <label className="btm-field-label">{label}</label>
    <div className="btm-color-inputs">
      <input type="color" aria-label={label} value={hex.slice(0, 7)} onChange={e => onChange(`${e.target.value}${alpha === 255 ? "" : alpha.toString(16).padStart(2, "0")}`)} />
      <input className="btm-input btm-color-hex" aria-label={`${label} HEX`} value={draft} maxLength={9} spellCheck={false}
        onChange={e => { setDraft(e.target.value); if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(e.target.value)) onChange(e.target.value); }} onBlur={() => setDraft(hex)} />
      <input type="range" min="0" max="255" value={alpha} aria-label={`${label} · Opacità`} onChange={e => onChange(`${hex.slice(0, 7)}${Number(e.target.value).toString(16).padStart(2, "0")}`)} />
      <span className="btm-color-alpha">{Math.round(alpha / 255 * 100)}%</span>
      {onFavoritesChange && <button type="button" className="btm-iconbtn" aria-label={`${starred ? "Rimuovi" : "Salva"} colore preferito`} aria-pressed={starred}
        onClick={() => onFavoritesChange(starred ? favorites.filter(c => c !== hex) : [...favorites.slice(-23), hex])}><Star size={14} fill={starred ? "currentColor" : "none"} /></button>}
    </div>
    {favorites.length > 0 && <div className="btm-color-favorites" aria-label="Colori preferiti">{favorites.map(color => <button type="button" key={color} style={{ background: color }} title={color} aria-label={`${label} ${color}`} onClick={() => onChange(color)} />)}</div>}
  </div>;
}
