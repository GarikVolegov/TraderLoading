// Correlazione tra stato d'animo al check-in e risultato dei trade dello stesso giorno.
// Incrocia i check-in di sessione con le entry del diario (per data locale).

export interface MoodCheckinInput {
  id: number;
  mood: string;
  date: string;
}

export interface MoodEntryInput {
  tradeDate: string;
  result: string;
}

export interface MoodPerformance {
  mood: string;
  /** Giorni con questo stato d'animo al check-in. */
  days: number;
  trades: number;
  wins: number;
  losses: number;
  /** Percentuale 0-100 su win+loss (breakeven esclusi). */
  winRate: number | null;
  /** True se il campione è troppo piccolo per essere indicativo. */
  lowSample: boolean;
}

export const MIN_TRADES_FOR_SIGNAL = 5;

/** Primo check-in di ogni giornata (l'umore con cui si è iniziato a operare). */
export function firstMoodByDate(checkins: MoodCheckinInput[] | undefined): Map<string, string> {
  const byDate = new Map<string, MoodCheckinInput>();
  for (const checkin of checkins ?? []) {
    const day = checkin.date.slice(0, 10);
    if (!day || !checkin.mood) continue;
    const existing = byDate.get(day);
    if (!existing || checkin.id < existing.id) byDate.set(day, checkin);
  }
  return new Map([...byDate.entries()].map(([day, c]) => [day, c.mood]));
}

export function computeMoodPerformance(
  checkins: MoodCheckinInput[] | undefined,
  entries: MoodEntryInput[] | undefined,
): MoodPerformance[] {
  const moodByDate = firstMoodByDate(checkins);
  if (moodByDate.size === 0) return [];

  const byMood = new Map<string, { days: Set<string>; trades: number; wins: number; losses: number }>();
  for (const [day, mood] of moodByDate) {
    const bucket = byMood.get(mood) ?? { days: new Set<string>(), trades: 0, wins: 0, losses: 0 };
    bucket.days.add(day);
    byMood.set(mood, bucket);
  }

  for (const entry of entries ?? []) {
    const day = entry.tradeDate.slice(0, 10);
    const mood = moodByDate.get(day);
    if (!mood) continue;
    const bucket = byMood.get(mood);
    if (!bucket) continue;
    bucket.trades++;
    if (entry.result === "win") bucket.wins++;
    else if (entry.result === "loss") bucket.losses++;
  }

  return [...byMood.entries()]
    .map(([mood, b]) => {
      const decided = b.wins + b.losses;
      return {
        mood,
        days: b.days.size,
        trades: b.trades,
        wins: b.wins,
        losses: b.losses,
        winRate: decided > 0 ? Math.round((b.wins / decided) * 100) : null,
        lowSample: decided < MIN_TRADES_FOR_SIGNAL,
      };
    })
    .sort((a, b) => b.trades - a.trades || b.days - a.days);
}
