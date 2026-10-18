import { snapshotExecutionEnvironment } from "./executionEnvironment.js";
import type { BrokerAccountProfile, BrokerSnapshot, NormalizedBrokerOrderRequest } from "./types.js";

export type BrokerOpeningAuthorizer = (
  profile: BrokerAccountProfile,
  snapshot: BrokerSnapshot,
  order: NormalizedBrokerOrderRequest,
) => Promise<void>;

/** The snapshot comes from the connector, never from the order request. A sell
 * (including one opposite an open buy) is a new order, not proof of reduction. */
export const authorizeBrokerOpening: BrokerOpeningAuthorizer = async (profile, snapshot, order) => {
  const environment = snapshotExecutionEnvironment(profile, snapshot);
  if (environment === "simulation") return;
  if (environment === "unknown") {
    throw Object.assign(new Error("Ambiente del conto non verificato. Aggiorna il collegamento prima di aprire un ordine."), { status: 409 });
  }
  if (!profile.ownerUserId) {
    throw Object.assign(new Error("Il conto deve appartenere a un trader autenticato prima di aprire un ordine reale."), { status: 409 });
  }
  const { assertProcessOrderAuthorized } = await import("../processAuthorization.js");
  await assertProcessOrderAuthorized(profile.ownerUserId, {
    symbol: order.symbol,
    environment,
    side: order.side,
    stopLoss: order.stopLoss,
    entryPrice: order.type === "limit" ? order.limitPrice : order.type === "stop" ? order.stopPrice : undefined,
    currency: snapshot.metrics.currency,
  });
};

export function processOrderRejection(error: unknown): string {
  if (error instanceof Error && "status" in error && typeof error.status === "number" && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return "Verifica del processo non disponibile. Nessun nuovo ordine inviato.";
}

/** Keep the process authorization lock while a new real order is submitted. */
export async function submitAuthorizedBrokerOpening<T>(profile: BrokerAccountProfile, snapshot: BrokerSnapshot,
  order: NormalizedBrokerOrderRequest, submit: () => Promise<T>): Promise<T> {
  const environment = snapshotExecutionEnvironment(profile, snapshot);
  if (environment === "simulation") return submit();
  if (environment === "unknown" || !profile.ownerUserId) {
    await authorizeBrokerOpening(profile, snapshot, order);
    throw new Error("Opening authorization unavailable");
  }
  const { withProcessOrderAuthorization } = await import("../processAuthorization.js");
  return withProcessOrderAuthorization(profile.ownerUserId, {
    symbol: order.symbol, environment, side: order.side, stopLoss: order.stopLoss,
    entryPrice: order.type === "limit" ? order.limitPrice : order.type === "stop" ? order.stopPrice : undefined,
    currency: snapshot.metrics.currency,
  }, submit);
}
