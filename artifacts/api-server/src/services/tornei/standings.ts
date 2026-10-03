// Calcolo puro della classifica: applica i guardrail della gara disciplinata,
// somma gli R validi, calcola il punteggio (R o R×Disciplina), ordina e assegna
// rango e divisione. Gli squalificati escono dalla classifica (rank 0) ma sono
// restituiti in coda con `dq:true`.

import { divisionForScore, type Division, MAX_RISK_PCT, DRAWDOWN_DQ_R } from "./constants.js";

export type TorneiTrade = {
  rMultiple: number | null;
  riskPct: number | null;
  journaled: boolean;
};

export type StandingInput = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  trades: TorneiTrade[];
  discIndex: number; // 0-100
};

export type ComputedStanding = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  rCum: number;
  discIndex: number;
  score: number;
  division: Division;
  rank: number;
  trades: number;
  dq: boolean;
  dqReason: string | null;
};

const DQ_REASON = "Drawdown −10R superato";

// Trade validi: con R noto e rischio entro il limite. NON si filtra su
// `journaled`: quel legame (journalEntryId) è cancellabile dall'utente, quindi
// gattare su di esso permetteva di far sparire i perdenti da rCum e dalla DQ.
function validRValues(input: StandingInput): number[] {
  return input.trades
    .filter((t) => t.rMultiple !== null && (t.riskPct ?? 0) <= MAX_RISK_PCT)
    .map((t) => t.rMultiple as number);
}

// L'R cumulato che tocca -10 in un qualsiasi punto della stagione squalifica.
function isDq(rValues: number[]): boolean {
  let cum = 0;
  for (const r of rValues) {
    cum += r;
    if (cum <= DRAWDOWN_DQ_R) return true;
  }
  return false;
}

export function computeStandings(inputs: StandingInput[], metric: "r" | "ts"): ComputedStanding[] {
  const rows: ComputedStanding[] = inputs.map((input) => {
    const rs = validRValues(input);
    const rCum = rs.reduce((a, b) => a + b, 0);
    const dq = isDq(rs);
    const score = metric === "ts" ? rCum * (input.discIndex / 100) : rCum;
    return {
      userId: input.userId,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      rCum,
      discIndex: input.discIndex,
      score,
      division: divisionForScore(score),
      rank: 0,
      trades: rs.length,
      dq,
      dqReason: dq ? DQ_REASON : null,
    };
  });

  const ranked = rows.filter((r) => !r.dq).sort((a, b) => b.score - a.score);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });

  // Classificati (in ordine) seguiti dagli squalificati.
  return [...ranked, ...rows.filter((r) => r.dq)];
}
