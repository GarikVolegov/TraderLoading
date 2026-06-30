// Controllo puro d'idoneità all'iscrizione: serve un conto reale sincronizzato e
// il consenso esplicito; non ci si iscrive a una stagione conclusa.

export type EligibilityInput = {
  hasSyncedRealAccount: boolean;
  consent: boolean;
  seasonStatus: "upcoming" | "live" | "ended";
};

export type EligibilityResult =
  | { ok: true }
  | { ok: false; reason: "no_real_account" | "no_consent" | "season_closed" };

export function checkEligibility(input: EligibilityInput): EligibilityResult {
  if (input.seasonStatus === "ended") return { ok: false, reason: "season_closed" };
  if (!input.hasSyncedRealAccount) return { ok: false, reason: "no_real_account" };
  if (!input.consent) return { ok: false, reason: "no_consent" };
  return { ok: true };
}
