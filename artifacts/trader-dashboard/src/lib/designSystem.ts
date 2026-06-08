export const commandCenterPalette = {
  background: "#020617",
  card: "#0E1223",
  panel: "#1A1E2F",
  border: "#334155",
  foreground: "#F8FAFC",
  mutedForeground: "#94A3B8",
  accent: "#22C55E",
  destructive: "#EF4444",
  warning: "#F59E0B",
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
