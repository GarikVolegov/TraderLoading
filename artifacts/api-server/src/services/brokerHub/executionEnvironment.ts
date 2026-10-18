import type { BrokerAccountProfile, BrokerSnapshot, ExecutionEnvironment } from "./types.js";

/** Only explicit source data establishes an environment. Display defaults and
 * editable profile settings must never certify historic trades or live orders. */
export function executionEnvironmentFromSource(value: unknown): ExecutionEnvironment {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["demo", "simulation", "account_trade_mode_demo"].includes(normalized)) return "simulation";
  if (["live", "real", "account_trade_mode_real"].includes(normalized)) return "real";
  return "unknown";
}

export function snapshotExecutionEnvironment(
  profile: Pick<BrokerAccountProfile, "accountId">,
  snapshot: Pick<BrokerSnapshot, "accounts" | "status">,
): ExecutionEnvironment {
  if (snapshot.status !== "connected") return "unknown";
  const account = profile.accountId
    ? snapshot.accounts.find(item => item.id === profile.accountId)
    : snapshot.accounts.length === 1 ? snapshot.accounts[0] : undefined;
  return executionEnvironmentFromSource(account?.executionEnvironment);
}
