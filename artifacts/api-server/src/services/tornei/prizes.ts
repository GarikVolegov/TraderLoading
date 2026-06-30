// Qualificazione pura dei premi: dalle standings finali (congelate) produce
// l'elenco dei premi. Un trader può qualificarsi a più tier: i premi si cumulano.
// Gli squalificati non ricevono nulla. Il tier "disc" è limitato a `cap` trader.

import { PRIZE_TIERS, DISC_QUALIFY, FINISH_DISC_MIN, type PrizeTier, type CertTier } from "./constants.js";
import type { ComputedStanding } from "./standings.js";

export type Award = {
  userId: string;
  tier: PrizeTier;
  xp: number;
  proMonths: number;
  certTier?: CertTier;
};

function tierMeta(tier: PrizeTier) {
  const meta = PRIZE_TIERS.find((p) => p.tier === tier);
  if (!meta) throw new Error(`unknown prize tier ${tier}`);
  return meta;
}

function award(userId: string, tier: PrizeTier): Award {
  const m = tierMeta(tier);
  return { userId, tier, xp: m.xp, proMonths: m.proMonths, certTier: m.certTier };
}

export function qualifyPrizes(finalStandings: ComputedStanding[]): Award[] {
  const ranked = finalStandings.filter((r) => !r.dq && r.rank > 0);
  const awards: Award[] = [];

  for (const r of ranked) {
    if (r.rank === 1) awards.push(award(r.userId, "champ"));
    if (r.rank === 2 || r.rank === 3) awards.push(award(r.userId, "podium"));
    if (r.rank <= 10) awards.push(award(r.userId, "top10"));
    if (r.discIndex >= FINISH_DISC_MIN) awards.push(award(r.userId, "finish"));
  }

  // "disc": i primi `cap` per Indice Disciplina tra quelli >= soglia.
  const discCap = tierMeta("disc").cap ?? Number.POSITIVE_INFINITY;
  ranked
    .filter((r) => r.discIndex >= DISC_QUALIFY)
    .sort((a, b) => b.discIndex - a.discIndex)
    .slice(0, discCap)
    .forEach((r) => awards.push(award(r.userId, "disc")));

  return awards;
}
