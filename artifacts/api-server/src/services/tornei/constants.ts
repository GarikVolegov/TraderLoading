// Costanti di dominio dei Tornei: divisioni, guardrail della gara disciplinata,
// e i tier dei premi. Centralizzate qui così sono tunabili senza toccare la logica.

export type Division = "bronzo" | "argento" | "oro" | "diamante";
export type PrizeTier = "champ" | "podium" | "top10" | "disc" | "finish";
export type CertTier = "champion" | "podio" | "finisher";

// Fasce di punteggio per le leghe (soglie dal design `templates/tornei/data.js`).
export const DIVISIONS: { id: Division; name: string; min: number }[] = [
  { id: "bronzo", name: "Bronzo", min: 0 },
  { id: "argento", name: "Argento", min: 18 },
  { id: "oro", name: "Oro", min: 30 },
  { id: "diamante", name: "Diamante", min: 45 },
];

export function divisionForScore(score: number): Division {
  let result: Division = "bronzo";
  for (const d of DIVISIONS) if (score >= d.min) result = d.id;
  return result;
}

// Guardrail della gara disciplinata.
export const MAX_RISK_PCT = 2; // trade con rischio > 2% non conteggiati
export const DRAWDOWN_DQ_R = -10; // -10R cumulati => squalifica
export const DISC_QUALIFY = 80; // Indice Disciplina minimo per il tier "disc"
export const FINISH_DISC_MIN = 60; // Disciplina minima per il tier "finish"
// Attività minima per QUALSIASI premio: iscriversi a vuoto (0 trade) dava
// Disciplina 100 e quindi finish/disc/top10 gratis. Nessun premio sotto questa soglia.
export const MIN_PRIZE_TRADES = 5;

// Tier dei premi (XP / mesi Pro / certificato). `cap` limita i vincitori del tier.
export const PRIZE_TIERS: {
  tier: PrizeTier;
  xp: number;
  proMonths: number;
  certTier?: CertTier;
  cap?: number;
}[] = [
  { tier: "champ", xp: 0, proMonths: 12, certTier: "champion" },
  { tier: "podium", xp: 0, proMonths: 6, certTier: "podio" },
  { tier: "top10", xp: 2500, proMonths: 3 },
  { tier: "disc", xp: 1000, proMonths: 1, cap: 50 },
  { tier: "finish", xp: 500, proMonths: 0, certTier: "finisher" },
];
