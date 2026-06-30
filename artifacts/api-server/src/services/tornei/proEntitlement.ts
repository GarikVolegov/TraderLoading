// Estensione pura dell'entitlement Pro: il nuovo termine è `max(now, attuale) + N
// mesi`. Se l'entitlement è scaduto si riparte da adesso. Nessun addebito Stripe:
// è un'estensione dell'entitlement interno (adminUserSubscriptionsTable).

export function extendProEntitlement(
  current: { currentPeriodEnd: Date | null },
  months: number,
  now: Date,
): Date {
  const base =
    current.currentPeriodEnd && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
  const end = new Date(base);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end;
}
