// Pure credit-ledger math (sub-project B). No I/O — the wallet/spend services
// resolve the balance from the DB and delegate the arithmetic here so overspend
// and non-integer guards are unit-tested in one place. Credits are whole units.

// Wallet balance/delta are stored as Postgres int4, so a balance can never exceed
// its max — reject rather than let the DB throw a raw overflow mid-transaction.
export const MAX_WALLET_BALANCE = 2_147_483_647;

export function applyLedger(balance: number, delta: number): { ok: boolean; balance: number } {
  if (!Number.isInteger(balance) || !Number.isInteger(delta)) return { ok: false, balance };
  const next = balance + delta;
  if (next < 0) return { ok: false, balance }; // overspend — no change
  if (next > MAX_WALLET_BALANCE) return { ok: false, balance }; // would overflow int4
  return { ok: true, balance: next };
}
