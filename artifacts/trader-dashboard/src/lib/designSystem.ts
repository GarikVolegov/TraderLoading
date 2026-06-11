// Palette "C2-Verde sobria" (Gate A 11/06/2026) — hex equivalenti dei token HSL in index.css
export const commandCenterPalette = {
  background: "#07090E",
  card: "#11141D",
  panel: "#1B1E28",
  border: "#383F4D",
  foreground: "#F2F5F7",
  mutedForeground: "#98A1AE",
  accent: "#4CA973",
  destructive: "#D45454",
  warning: "#D78742",
} as const;

// Brand vs semantica: il brand è verde smorzato, il P&L usa --profit/--loss (vedi index.css)
export const commandCenterBrand = {
  primary: "#4CA973",
  soft: "#70C296",
  deep: "#396F56",
} as const;

export const commandCenterTouch = {
  minTargetPx: 44,
  minGapPx: 8,
} as const;

export const commandCenterRadii = {
  controlPx: 8,
  panelPx: 10,
  modalPx: 16,
} as const;

export const commandCenterViewports = [375, 768, 1024, 1440] as const;
