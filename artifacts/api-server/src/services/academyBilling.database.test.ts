import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type Stripe from "stripe";

// Explicit integration test: never use the caller's database or a project .env.
// ACADEMY_DATABASE_TEST=1 pnpm --filter @workspace/api-server exec tsx src/services/academyBilling.database.test.ts
// Set ACADEMY_TEST_PG_BIN when PostgreSQL binaries are not installed by Postgres.app.
if (process.env.ACADEMY_DATABASE_TEST !== "1") {
  console.log("Academy isolated PostgreSQL integration: skipped (set ACADEMY_DATABASE_TEST=1).");
} else {
  const execFile = promisify(execFileCallback);
  const fixture = await mkdtemp(join(tmpdir(), "academy-billing-test-"));
  const bin = process.env.ACADEMY_TEST_PG_BIN ?? "/Users/gazz/Applications/Postgres.app/Contents/Versions/16/bin";
  const cluster = join(fixture, "cluster");
  const database = `academy_billing_test_${randomUUID().replaceAll("-", "")}`;
  const listener = createServer();
  await new Promise<void>((resolve, reject) => listener.once("error", reject).listen(0, "127.0.0.1", resolve));
  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  const originalDatabase = process.env.DATABASE_URL;
  const originalPrice = process.env.STRIPE_ACADEMY_MONTHLY_PRICE_ID;
  const originalSsl = process.env.PGSSLMODE;
  const originalOptions = process.env.PGOPTIONS;
  let stopPool: (() => Promise<void>) | undefined;
  let started = false;
  try {
    await execFile(join(bin, "initdb"), ["-D", cluster, "-U", "trader", "-A", "trust", "--no-locale", "-E", "UTF8"]);
    await execFile(join(bin, "pg_ctl"), ["-D", cluster, "-l", join(fixture, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${fixture}`, "-w", "start"]);
    started = true;
    await execFile(join(bin, "createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "trader", database]);
    process.env.DATABASE_URL = `postgres://trader@127.0.0.1:${port}/${database}`;
    process.env.STRIPE_ACADEMY_MONTHLY_PRICE_ID = "price_academy_test";
    process.env.PGSSLMODE = "disable";
    delete process.env.PGOPTIONS;
    const { pool, closeDbPool } = await import("@workspace/db");
    stopPool = closeDbPool;
    const billing = await import("./academyBilling.js");
    for (const name of ["0044_academy_billing.sql", "0045_academy_content.sql"]) {
      await pool.query(await readFile(fileURLToPath(new URL(`../../../../lib/db/drizzle/${name}`, import.meta.url)), "utf8"));
    }
    await pool.query(`CREATE TABLE creator_payout_accounts (
      id serial PRIMARY KEY, user_id text NOT NULL UNIQUE, stripe_account_id text NOT NULL UNIQUE,
      payouts_enabled boolean NOT NULL DEFAULT false, details_submitted boolean NOT NULL DEFAULT false,
      status text NOT NULL DEFAULT 'pending', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    )`);
    const DAY = 86400;
    const now = Math.floor(Date.now() / 1000);
    const subscriptionMap = new Map<string, Stripe.Subscription>();
    const invoiceMap = new Map<string, Stripe.Invoice>();
    const chargeMap = new Map<string, Stripe.Charge>();
    const transferMap = new Map<string, Stripe.Transfer>();
    const invoiceForIntent = new Map<string, string>();
    const creates: string[] = [];
    const reversals: number[] = [];
    let failAfterTransfer = false;
    let failAfterReversal = false;
    const stripe = {
      subscriptions: { retrieve: async (id: string) => subscriptionMap.get(id)! },
      invoices: { retrieve: async (id: string) => invoiceMap.get(id)! },
      invoicePayments: { list: async (params: { invoice?: string; payment?: { payment_intent: string } }) => {
        const invoiceId = params.invoice ?? invoiceForIntent.get(params.payment!.payment_intent)!;
        const invoice = invoiceMap.get(invoiceId)!;
        return { has_more: false, data: [{ invoice: invoiceId, amount_paid: invoice.amount_paid,
          payment: { type: "payment_intent", payment_intent: `pi_${invoiceId}` } }] };
      } },
      paymentIntents: { retrieve: async (id: string) => ({ id, latest_charge: `ch_${id.slice(3)}`, status: "succeeded", currency: "eur" }) },
      charges: { retrieve: async (id: string) => chargeMap.get(id)! },
      accounts: { retrieve: async () => ({ payouts_enabled: true, capabilities: { transfers: "active" } }) },
      transfers: {
        list: async ({ transfer_group }: { transfer_group: string }) => ({ has_more: false,
          data: [...transferMap.values()].filter(t => t.transfer_group === transfer_group) }),
        create: async (params: Stripe.TransferCreateParams) => {
          creates.push(params.transfer_group!);
          const transfer = { id: `tr_${creates.length}`, amount_reversed: 0, ...params } as unknown as Stripe.Transfer;
          transferMap.set(transfer.id, transfer);
          if (failAfterTransfer) { failAfterTransfer = false; throw new Error("Synthetic lost transfer response"); }
          return transfer;
        },
        retrieve: async (id: string) => transferMap.get(id)!,
        createReversal: async (id: string, { amount }: { amount: number }) => {
          reversals.push(amount);
          transferMap.get(id)!.amount_reversed += amount;
          if (failAfterReversal) { failAfterReversal = false; throw new Error("Synthetic lost reversal response"); }
          return { id: `trr_${reversals.length}`, amount };
        },
      },
    } as unknown as Stripe;
    function makeSubscription(userId: string, id = `sub_${userId}`) {
      const value = { id, metadata: { type: "academy", userId }, customer: `cus_${userId}`,
        status: "active", cancel_at_period_end: false, items: { data: [{ current_period_end: now + 30 * DAY, quantity: 1,
          price: { id: "price_academy_test", active: true, currency: "eur", unit_amount: 15000, type: "recurring",
            recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, tax_behavior: "inclusive" } }] } } as unknown as Stripe.Subscription;
      subscriptionMap.set(id, value);
      return value;
    }
    function makeInvoice(id: string, subscription: Stripe.Subscription, paidAt = now, periodEnd = now + 30 * DAY) {
      const value = { id, status: "paid", currency: "eur", amount_paid: 15000, created: paidAt,
        status_transitions: { paid_at: paidAt }, parent: { subscription_details: { subscription: subscription.id } },
        lines: { has_more: false, data: [{ amount: 15000, pricing: { price_details: { price: "price_academy_test" } },
          period: { start: paidAt, end: periodEnd } }] } } as unknown as Stripe.Invoice;
      invoiceMap.set(id, value);
      invoiceForIntent.set(`pi_${id}`, id);
      chargeMap.set(`ch_${id}`, { id: `ch_${id}`, object: "charge", payment_intent: `pi_${id}`, amount: 15000,
        amount_refunded: 0, disputed: false, paid: true, currency: "eur" } as Stripe.Charge);
      return value;
    }
    async function seedBuyer(userId: string, affiliate = "affiliate_test") {
      await pool.query("INSERT INTO academy_attributions (buyer_user_id, affiliate_user_id, code, terms_version) VALUES ($1,$2,'CODE_TEST','test')", [userId, affiliate]);
      const subscription = makeSubscription(userId);
      await billing.syncAcademySubscription(subscription);
      return subscription;
    }
    async function commission(invoiceId: string) {
      const result = await pool.query("SELECT * FROM academy_commissions WHERE stripe_invoice_id=$1", [invoiceId]);
      assert.equal(result.rows.length, 1);
      return result.rows[0] as { id: string; amount_cents: number; reversed_cents: number; refunded_gross_cents: number; available_at: Date; disputed: boolean };
    }
    await billing.enrollAcademyAffiliate("affiliate_test");
    await pool.query("INSERT INTO creator_payout_accounts (user_id,stripe_account_id,payouts_enabled,details_submitted) VALUES ('affiliate_test','acct_test',true,true)");

    const firstSub = await seedBuyer("buyer_replay");
    const firstInvoice = makeInvoice("in_replay", firstSub);
    await Promise.all(Array.from({ length: 8 }, () => billing.recordAcademyInvoice(firstInvoice, firstSub, stripe)));
    await billing.handleAcademyStripeEvent({ type: "invoice.paid", data: { object: firstInvoice } } as Stripe.Event, stripe);
    const first = await commission(firstInvoice.id);
    assert.equal(first.amount_cents, 3000, "One 20% commission after concurrent and distinct paid-event replays");
    assert.equal(first.available_at.getTime(), (now + 30 * DAY) * 1000);
    assert.equal(await billing.hasAcademyAccess("buyer_replay"), true);
    const held = await billing.payAcademyCommissions([first.id], "admin_test", stripe);
    assert.equal(held.items[0].error, "academy_commission_not_available");
    assert.equal(creates.length, 0, "30-day hold prevents money movement");

    const secondInvoice = makeInvoice("in_renewal", firstSub, now + 30 * DAY, now + 60 * DAY);
    await billing.recordAcademyInvoice(secondInvoice, firstSub, stripe);
    await billing.recordAcademyInvoice(firstInvoice, firstSub, stripe);
    assert.equal((await billing.getAcademySubscription("buyer_replay"))!.paidThrough!.getTime(), (now + 60 * DAY) * 1000);
    const firstCharge = chargeMap.get("ch_in_replay")!;
    firstCharge.amount_refunded = 15000;
    await billing.reconcileAcademyCharge(firstCharge, stripe);
    assert.equal(await billing.hasAcademyAccess("buyer_replay"), true, "Refund of an old invoice preserves later paid access");
    const secondCharge = chargeMap.get("ch_in_renewal")!;
    for (const refunded of [5000, 2000, 10000, 10000]) {
      secondCharge.amount_refunded = refunded;
      await billing.reconcileAcademyCharge(secondCharge, stripe);
    }
    assert.equal((await commission("in_renewal")).reversed_cents, 2000, "Refund corrections are cumulative and never regress");
    assert.equal((await commission("in_renewal")).refunded_gross_cents, 10000);
    assert.equal(await billing.hasAcademyAccess("buyer_replay"), true, "Partial refund preserves paid access");
    secondCharge.amount_refunded = 15000;
    await billing.reconcileAcademyCharge(secondCharge, stripe);
    await billing.recordAcademyInvoice(secondInvoice, firstSub, stripe);
    assert.equal((await commission("in_renewal")).reversed_cents, 3000);
    assert.equal(await billing.hasAcademyAccess("buyer_replay"), false, "Latest full refund revokes access despite paid-event replay");

    const refundFirstSub = await seedBuyer("buyer_refund_first");
    makeInvoice("in_refund_first", refundFirstSub);
    const refundFirstCharge = chargeMap.get("ch_in_refund_first")!;
    refundFirstCharge.amount_refunded = 15000;
    await billing.reconcileAcademyCharge(refundFirstCharge, stripe);
    assert.equal((await commission("in_refund_first")).reversed_cents, 3000);
    assert.equal(await billing.hasAcademyAccess("buyer_refund_first"), false, "Refund preceding paid event cannot grant access");

    const payoutSub = await seedBuyer("buyer_payout");
    const payoutInvoice = makeInvoice("in_payout", payoutSub, now - 31 * DAY, now + DAY);
    await billing.recordAcademyInvoice(payoutInvoice, payoutSub, stripe);
    const payable = await commission("in_payout");
    const payouts = await Promise.all(Array.from({ length: 6 }, () => billing.payAcademyCommissions([payable.id], "admin_test", stripe)));
    assert.ok(payouts.every(result => result.items[0].status === "processed"));
    assert.equal(creates.length, 1, "Concurrent admin payout requests create one Stripe transfer");
    assert.equal((await pool.query("SELECT * FROM academy_payouts WHERE commission_id=$1", [payable.id])).rows.length, 1);
    const payoutCharge = chargeMap.get("ch_in_payout")!;
    payoutCharge.amount_refunded = 5000;
    await Promise.all(Array.from({ length: 4 }, () => billing.reconcileAcademyCharge(payoutCharge, stripe)));
    assert.deepEqual(reversals, [1000], "Concurrent refund deliveries recover transferred funds once");
    payoutCharge.disputed = true;
    await billing.handleAcademyStripeEvent({ type: "charge.dispute.created", data: { object: { object: "dispute", charge: payoutCharge.id } } } as Stripe.Event, stripe);
    await billing.reconcileAcademyCharge(payoutCharge, stripe);
    assert.deepEqual(reversals, [1000, 2000], "Dispute recovers only the remaining commission");
    assert.equal((await commission("in_payout")).disputed, true);
    assert.equal(await billing.hasAcademyAccess("buyer_payout"), false);
    assert.equal((await pool.query("SELECT transfer_reversed_cents FROM academy_payouts WHERE commission_id=$1", [payable.id])).rows[0].transfer_reversed_cents, 3000);

    const nonAffiliate = makeSubscription("buyer_organic");
    await billing.syncAcademySubscription(nonAffiliate);
    await billing.recordAcademyInvoice(makeInvoice("in_organic", nonAffiliate), nonAffiliate, stripe);
    assert.equal((await commission("in_organic")).amount_cents, 0);
    assert.equal(await billing.hasAcademyAccess("buyer_organic"), true, "Unreferred purchases still create paid access");

    const interruptedSub = await seedBuyer("buyer_interrupted");
    await billing.recordAcademyInvoice(makeInvoice("in_interrupted", interruptedSub, now - 31 * DAY, now + DAY), interruptedSub, stripe);
    const interrupted = await commission("in_interrupted");
    failAfterTransfer = true;
    assert.equal((await billing.payAcademyCommissions([interrupted.id], "admin_test", stripe)).items[0].status, "failed");
    const createsAfterFailure = creates.length;
    assert.equal((await billing.payAcademyCommissions([interrupted.id], "admin_test", stripe)).items[0].status, "processed");
    assert.equal(creates.length, createsAfterFailure, "Retry recovers a transfer committed by Stripe before the lost response");
    const interruptedCharge = chargeMap.get("ch_in_interrupted")!;
    interruptedCharge.amount_refunded = 5000;
    failAfterReversal = true;
    await assert.rejects(() => billing.reconcileAcademyCharge(interruptedCharge, stripe), /Synthetic lost reversal response/);
    const reversalsAfterFailure = reversals.length;
    await billing.reconcileAcademyCharge(interruptedCharge, stripe);
    assert.equal(reversals.length, reversalsAfterFailure, "Retry recovers a reversal committed by Stripe before the lost response");
    assert.equal((await pool.query("SELECT transfer_reversed_cents FROM academy_payouts WHERE commission_id=$1", [interrupted.id])).rows[0].transfer_reversed_cents, 1000);

    await billing.syncAcademySubscription({ ...nonAffiliate, status: "canceled" });
    const restarted = makeSubscription("buyer_organic", "sub_organic_restarted");
    await billing.syncAcademySubscription(restarted);
    assert.equal(await billing.hasAcademyAccess("buyer_organic"), false, "A restarted subscription cannot reuse the previous paid period");
    assert.equal((await billing.getAcademySubscription("buyer_organic"))!.paidThrough, null);
    await billing.recordAcademyInvoice(makeInvoice("in_organic_restarted", restarted), restarted, stripe);
    await billing.syncAcademySubscription({ ...nonAffiliate, status: "canceled" });
    assert.equal((await billing.getAcademySubscription("buyer_organic"))!.stripeSubscriptionId, restarted.id, "Old canceled event cannot overwrite the active replacement");
    assert.equal(await billing.hasAcademyAccess("buyer_organic"), true);
    console.log("Academy isolated PostgreSQL integration passed: replay, renewal, refund ordering/cumulative totals, dispute, 30-day hold, concurrent payout and recovery.");
  } finally {
    await stopPool?.();
    if (started) await execFile(join(bin, "pg_ctl"), ["-D", cluster, "-m", "immediate", "-w", "stop"]);
    await rm(fixture, { recursive: true, force: true });
    for (const [key, value] of Object.entries({ DATABASE_URL: originalDatabase, STRIPE_ACADEMY_MONTHLY_PRICE_ID: originalPrice, PGSSLMODE: originalSsl, PGOPTIONS: originalOptions })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
