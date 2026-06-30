// Decisione pura di rollover "ciclo del 7": dato lo stato attuale delle stagioni
// e l'istante `now`, dice cosa chiudere, cosa promuovere e quale finestra creare.
// Niente IO: l'applicazione (settle/insert/update) è in torneiScheduler.ts.

import { quarterWindowFor, nextWindowAfter, type SeasonWindow } from "./seasonWindows.js";

export type SeasonRow = {
  id: number;
  slug: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  settledAt: Date | null;
};

export type RolloverPlan = {
  toEnd: number[]; // stagioni live oltre endsAt
  toPromote: number[]; // stagioni upcoming la cui finestra è iniziata
  toCreate: SeasonWindow | null; // finestra mancante da creare (continuità)
};

export function planRollover(seasons: SeasonRow[], now: Date): RolloverPlan {
  const toEnd = seasons.filter((s) => s.status === "live" && s.endsAt <= now).map((s) => s.id);
  const toPromote = seasons
    .filter((s) => s.status === "upcoming" && s.startsAt <= now && s.endsAt > now)
    .map((s) => s.id);

  const current = quarterWindowFor(now);
  const has = (slug: string) => seasons.some((s) => s.slug === slug);

  // Garantisce continuità: prima la finestra corrente (cold start), poi la prossima.
  let toCreate: SeasonWindow | null = null;
  if (!has(current.slug)) toCreate = current;
  else {
    const next = nextWindowAfter(current);
    if (!has(next.slug)) toCreate = next;
  }

  return { toEnd, toPromote, toCreate };
}
