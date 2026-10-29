import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accountTradesTable } from "./account";
import { backtestTradesTable } from "./backtest";
import { journalRecapsTable } from "./journal";

export const processMethodsTable = pgTable(
  "process_methods",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    methodId: text("method_id").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    rules: jsonb("rules").notNull(),
    protocol: jsonb("protocol"),
    phase: text("phase").notNull().default("define"),
    active: boolean("active").notNull().default(false),
    requestId: text("request_id").notNull(),
    riskConfirmedAt: timestamp("risk_confirmed_at", { withTimezone: true }).notNull(),
    phaseStartedAt: timestamp("phase_started_at", { withTimezone: true }).notNull().defaultNow(),
    verificationStartedAt: timestamp("verification_started_at", { withTimezone: true }),
    applicationStartedAt: timestamp("application_started_at", { withTimezone: true }),
    reviewPolicyStartedAt: timestamp("review_policy_started_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("process_methods_user_active_idx")
      .on(t.userId)
      .where(sql`${t.active} = true`),
    uniqueIndex("process_methods_version_idx").on(t.userId, t.methodId, t.version),
    uniqueIndex("process_methods_retry_idx").on(t.userId, t.requestId),
    index("process_methods_user_idx").on(t.userId),
  ],
);

export const processDraftsTable = pgTable("process_drafts", {
  userId: text("user_id").primaryKey(),
  id: text("id")
    .notNull()
    .default(sql`gen_random_uuid()::text`),
  revision: integer("revision").notNull().default(0),
  step: integer("step").notNull().default(0),
  draft: jsonb("draft").notNull(),
  previousVersionId: text("previous_version_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const processSessionsTable = pgTable(
  "process_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    mode: text("mode").notNull().default("application"),
    methodVersionId: text("method_version_id")
      .notNull()
      .references(() => processMethodsTable.id),
    rulesSnapshot: jsonb("rules_snapshot").notNull(),
    state: text("state").notNull().default("preparation"),
    checklist: jsonb("checklist").notNull(),
    mood: text("mood").notNull().default(""),
    focus: text("focus").notNull().default(""),
    plan: jsonb("plan"),
    draft: jsonb("draft"),
    revision: integer("revision").notNull().default(0),
    closure: jsonb("closure"),
    improvementId: text("improvement_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    preparedAt: timestamp("prepared_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("process_sessions_user_day_idx").on(t.userId, t.day),
    index("process_sessions_method_idx").on(t.methodVersionId),
  ],
);
export const processEvidenceTable = pgTable(
  "process_evidence",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    methodVersionId: text("method_version_id")
      .notNull()
      .references(() => processMethodsTable.id),
    purpose: text("purpose").notNull(),
    source: text("source").notNull(),
    executionEnvironment: text("execution_environment").notNull().default("unknown"),
    netR: numeric("net_r"),
    initialRisk: numeric("initial_risk"),
    netPnl: numeric("net_pnl"),
    costsStatus: text("costs_status").notNull(),
    currency: text("currency"),
    account: text("account"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    adherence: text("adherence").notNull(),
    provenance: text("provenance").notNull(),
    note: text("note").notNull().default(""),
    accountTradeId: integer("account_trade_id").references(() => accountTradesTable.id, {
      onDelete: "set null",
    }),
    backtestTradeId: integer("backtest_trade_id").references(() => backtestTradesTable.id, {
      onDelete: "set null",
    }),
    sessionId: text("session_id").references(() => processSessionsTable.id),
    requestId: text("request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("process_evidence_retry_idx").on(t.userId, t.requestId),
    uniqueIndex("process_evidence_account_idx").on(
      t.userId,
      t.methodVersionId,
      t.purpose,
      t.accountTradeId,
    ),
    uniqueIndex("process_evidence_replay_idx").on(
      t.userId,
      t.methodVersionId,
      t.purpose,
      t.backtestTradeId,
    ),
    index("process_evidence_method_idx").on(t.userId, t.methodVersionId),
    index("process_evidence_user_observed_idx").on(t.userId, t.observedAt),
    index("process_evidence_session_idx").on(t.sessionId),
  ],
);
export const processImprovementsTable = pgTable(
  "process_improvements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    methodVersionId: text("method_version_id")
      .notNull()
      .references(() => processMethodsTable.id),
    recapId: integer("recap_id")
      .notNull()
      .references(() => journalRecapsTable.id),
    action: text("action").notNull(),
    criterion: text("criterion").notNull(),
    requestId: text("request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("process_improvements_retry_idx").on(t.userId, t.requestId),
    uniqueIndex("process_improvements_recap_idx").on(t.userId, t.methodVersionId, t.recapId),
    index("process_improvements_user_idx").on(t.userId, t.createdAt),
  ],
);
export const processAdvancementsTable = pgTable(
  "process_advancements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    methodVersionId: text("method_version_id")
      .notNull()
      .references(() => processMethodsTable.id),
    fromPhase: text("from_phase").notNull(),
    toPhase: text("to_phase").notNull(),
    review: text("review").notNull(),
    checksSnapshot: jsonb("checks_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("process_advancements_phase_idx").on(t.methodVersionId, t.fromPhase)],
);

/** Immutable confirmation of a review; historical session attestations never change. */
export const processReviewsTable = pgTable(
  "process_reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    methodVersionId: text("method_version_id").notNull().references(() => processMethodsTable.id),
    recapId: integer("recap_id").notNull().references(() => journalRecapsTable.id),
    improvementId: text("improvement_id").notNull().references(() => processImprovementsTable.id),
    kind: text("kind").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    coveredPeriods: jsonb("covered_periods").notNull(),
    judgment: text("judgment").notNull(),
    action: text("action").notNull(),
    criterion: text("criterion").notNull(),
    previousImprovementId: text("previous_improvement_id"),
    previousImprovementOutcome: text("previous_improvement_outcome"),
    previousImprovementNote: text("previous_improvement_note").notNull().default(""),
    decision: text("decision").notNull(),
    checks: jsonb("checks").notNull(),
    report: jsonb("report").notNull(),
    requestId: text("request_id").notNull(),
    requestSnapshot: jsonb("request_snapshot").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("process_reviews_retry_idx").on(t.userId, t.requestId),
    uniqueIndex("process_reviews_period_idx").on(t.methodVersionId, t.kind, t.periodStart, t.periodEnd),
    index("process_reviews_user_idx").on(t.userId, t.reviewedAt),
  ],
);
