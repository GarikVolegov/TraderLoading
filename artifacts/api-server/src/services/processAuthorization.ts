import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { processDay } from "../../../../contracts/trader-process.js";
import { loadProcessState } from "./processRepository.js";
import { processDailyLimits } from "./processPolicy.js";

export interface ProcessOpeningRequest {
  symbol: string;
  environment: "simulation" | "real" | "unknown";
  side: "buy" | "sell";
  stopLoss?: number;
  entryPrice?: number;
  currency?: string;
}

function reject(message: string): never { throw Object.assign(new Error(message), { status: 409 }); }
const market = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Use the same user lock as reviews and session confirmations until submission.
 * This verifies the documented plan, never an invented monetary value per lot. */
export async function withProcessOrderAuthorization<T>(
  userId: string,
  request: ProcessOpeningRequest,
  submit: () => Promise<T>,
): Promise<T> {
  if (request.environment === "simulation") return submit();
  if (request.environment !== "real") reject("Ambiente del conto non documentato.");
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`process:${userId}`}))`);
    const state = await loadProcessState(tx, userId);
    const method = state.activeMethod;
    if (!method || !["apply", "consolidate"].includes(method.phase))
      reject("Completa la verifica del metodo prima di aprire ordini reali.");
    if (state.guidance?.applicationHold) reject("Il metodo richiede una nuova verifica prima di altre aperture reali.");
    if (state.pendingReviews?.length) reject("Completa la revisione dovuta prima di aprire nuovi ordini reali.");
    const session = state.session;
    if (!session || session.methodVersionId !== method.id || session.mode !== "application" ||
      session.day !== processDay() || session.state !== "operation" || !session.preparedAt || session.plan?.decision !== "trade")
      reject("Conferma preparazione e piano operativo nella sessione di oggi.");
    const plan = session.plan;
    const rules = session.rulesSnapshot;
    if (!plan.market || market(plan.market) !== market(request.symbol) ||
      !rules.markets.some(value => market(value) === market(request.symbol)))
      reject("Il mercato dell’ordine non corrisponde al piano confermato.");
    if (!plan.initialRisk || plan.initialRisk > rules.riskPerTrade ||
      request.currency !== rules.currency) reject("Il rischio e la valuta del piano devono rispettare le protezioni confermate.");
    const stop = Number(plan.stop);
    if (!Number.isFinite(stop) || stop <= 0 || !request.stopLoss ||
      !Number.isFinite(request.stopLoss) || Math.abs(stop - request.stopLoss) > Math.max(1e-8, Math.abs(stop) * 1e-8))
      reject("Inserisci uno stop numerico coerente con il piano prima dell’apertura reale.");
    if (request.entryPrice != null && (request.side === "buy" ? stop >= request.entryPrice : stop <= request.entryPrice))
      reject("Lo stop deve proteggere il lato dell’ordine.");
    const limits = processDailyLimits(session, state.evidence);
    if (limits.lossLimit || limits.tradeLimit) reject("Il limite personale della giornata è raggiunto: gestisci e chiudi la sessione.");
    return submit();
  });
}

/** Compatibility for queued commands: revalidate before releasing to a terminal. */
export const assertProcessOrderAuthorized = (userId: string, request: ProcessOpeningRequest) =>
  withProcessOrderAuthorization(userId, request, async () => undefined);
