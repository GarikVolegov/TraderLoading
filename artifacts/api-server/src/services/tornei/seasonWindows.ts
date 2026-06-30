// Calcolo puro delle finestre stagione "ciclo del 7": quattro trimestri
// ancorati al 7 del mese (mezzanotte UTC).
//   Q1 7 gen → 7 apr · Q2 7 apr → 7 lug · Q3 7 lug → 7 ott · Q4 7 ott → 7 gen.

export interface SeasonWindow {
  slug: string; // "2025-q3"
  label: string; // "Q3 2025"
  startsAt: Date;
  endsAt: Date;
}

// Mese d'inizio (0-based) di ciascun trimestre, sempre il giorno 7 UTC.
const ANCHORS = [0, 3, 6, 9];

function windowFromQuarter(year: number, q: number): SeasonWindow {
  const startMonth = ANCHORS[q];
  const startsAt = new Date(Date.UTC(year, startMonth, 7));
  const endYear = q === 3 ? year + 1 : year;
  const endMonth = q === 3 ? 0 : ANCHORS[q + 1];
  const endsAt = new Date(Date.UTC(endYear, endMonth, 7));
  return { slug: `${year}-q${q + 1}`, label: `Q${q + 1} ${year}`, startsAt, endsAt };
}

// La finestra che contiene `now`. Scansiona l'anno corrente e il precedente per
// gestire correttamente il confine d'anno del Q4 (ott → gen).
export function quarterWindowFor(now: Date): SeasonWindow {
  const year = now.getUTCFullYear();
  for (const candidateYear of [year, year - 1]) {
    for (let q = 3; q >= 0; q--) {
      const w = windowFromQuarter(candidateYear, q);
      if (now >= w.startsAt && now < w.endsAt) return w;
    }
  }
  return windowFromQuarter(year, 0);
}

export function nextWindowAfter(window: SeasonWindow): SeasonWindow {
  const match = /^(\d+)-q(\d)$/.exec(window.slug);
  if (!match) throw new Error(`bad season slug ${window.slug}`);
  const year = Number(match[1]);
  const q = Number(match[2]) - 1;
  return q === 3 ? windowFromQuarter(year + 1, 0) : windowFromQuarter(year, q + 1);
}
