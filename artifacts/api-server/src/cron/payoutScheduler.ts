// Payout reconcile scheduler (sub-project D). Every 10 minutes, retry any payout left
// 'pending' (process died between the reserve commit and the Stripe Transfer). Self-
// gating: a no-op until payouts are configured AND a Stripe secret is present, so it
// stays inert by default. Modelled on lifecycleScheduler.
import cron, { type ScheduledTask } from "node-cron";
import { getStripeBillingConfig, createStripeClient } from "../lib/billing.js";
import { readPayoutConfig, isPayoutConfigured } from "../services/payout/payoutMath.js";
import { reconcilePendingPayouts } from "../services/payout/payoutReconcile.js";
import { reportJobError } from "../lib/observability.js";

export function startPayoutScheduler(): { close(): Promise<void> } {
  const task: ScheduledTask = cron.schedule("*/10 * * * *", () => {
    if (!isPayoutConfigured(readPayoutConfig())) return;
    const { secretKey } = getStripeBillingConfig();
    if (!secretKey) return;
    reconcilePendingPayouts(createStripeClient(secretKey)).catch((err) =>
      reportJobError(err, { job: "payout-reconcile" }),
    );
  });

  return {
    async close(): Promise<void> {
      task.stop();
    },
  };
}
