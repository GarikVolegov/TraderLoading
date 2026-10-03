/**
 * Trading-session badge styling — the glowing "colour pill" from Claude Design's
 * Command-Center mock (design-ref/landing/landing-ui.jsx). The session colour tints
 * the text, a translucent background (12%), the border (30%) and a soft outer glow
 * (16px/25%), plus a glowing dot (8px). Shared by the ClockWidget banner badge and
 * the /clock page session cards.
 *
 * Colours use the registered `@theme` utilities (`text-/bg-/border-session-*`,
 * `success`, `destructive`) so opacity modifiers resolve through Tailwind. The glow
 * is a box-shadow, which has no utility, so it uses a literal arbitrary value — kept
 * literal (never interpolated) so the Tailwind JIT scanner emits it.
 */

export type SessionTone =
  | "session-asian"
  | "session-london"
  | "session-ny"
  | "session-volume"
  | "success"
  | "destructive"
  | "muted";

export const SESSION_TONES: readonly SessionTone[] = [
  "session-asian",
  "session-london",
  "session-ny",
  "session-volume",
  "success",
  "destructive",
  "muted",
];

export interface SessionBadgeClasses {
  /** Pill container: text colour + translucent bg + border + outer glow. */
  container: string;
  /** Status dot: solid colour + glow. */
  dot: string;
}

const CLASSES: Record<SessionTone, SessionBadgeClasses> = {
  "session-asian": {
    container:
      "border text-session-asian bg-session-asian/12 border-session-asian/30 shadow-[0_0_16px_hsl(var(--session-asian)/0.25)]",
    dot: "bg-session-asian shadow-[0_0_8px_hsl(var(--session-asian))]",
  },
  "session-london": {
    container:
      "border text-session-london bg-session-london/12 border-session-london/30 shadow-[0_0_16px_hsl(var(--session-london)/0.25)]",
    dot: "bg-session-london shadow-[0_0_8px_hsl(var(--session-london))]",
  },
  "session-ny": {
    container:
      "border text-session-ny bg-session-ny/12 border-session-ny/30 shadow-[0_0_16px_hsl(var(--session-ny)/0.25)]",
    dot: "bg-session-ny shadow-[0_0_8px_hsl(var(--session-ny))]",
  },
  "session-volume": {
    container:
      "border text-session-volume bg-session-volume/12 border-session-volume/30 shadow-[0_0_16px_hsl(var(--session-volume)/0.25)]",
    dot: "bg-session-volume shadow-[0_0_8px_hsl(var(--session-volume))]",
  },
  success: {
    container:
      "border text-success bg-success/12 border-success/30 shadow-[0_0_16px_hsl(var(--success)/0.25)]",
    dot: "bg-success shadow-[0_0_8px_hsl(var(--success))]",
  },
  destructive: {
    container:
      "border text-destructive bg-destructive/12 border-destructive/30 shadow-[0_0_16px_hsl(var(--destructive)/0.25)]",
    dot: "bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]",
  },
  // Spent pill for inactive sessions — no glow.
  muted: {
    container: "border border-border/40 text-muted-foreground bg-secondary/50",
    dot: "bg-muted-foreground/50",
  },
};

export function sessionBadgeClasses(tone: SessionTone): SessionBadgeClasses {
  return CLASSES[tone];
}

/**
 * Map a `TradingSessionConfig.color` value (e.g. "session-london", "session-closed")
 * to a badge tone. The "session-closed" colour becomes the destructive (red) tone;
 * the four trading colours pass through; anything unknown falls back to muted.
 */
export function toneForSessionColor(color: string): SessionTone {
  switch (color) {
    case "session-asian":
    case "session-london":
    case "session-ny":
    case "session-volume":
      return color;
    case "session-closed":
      return "destructive";
    default:
      return "muted";
  }
}
