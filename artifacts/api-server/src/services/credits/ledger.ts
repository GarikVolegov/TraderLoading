// Pure credit-ledger math (sub-project B). No I/O — the wallet/spend services
// resolve the balance from the DB and delegate the arithmetic here so overspend
// and non-integer guards are unit-tested in one place. Credits are whole units.
export function applyLedger(balance: number, delta: number): { ok: boolean; balance: number } {
  if (!Number.isInteger(balance) || !Number.isInteger(delta)) return { ok: false, balance };
  const next = balance + delta;
  if (next < 0) return { ok: false, balance }; // overspend — no change
  return { ok: true, balance: next };
}
