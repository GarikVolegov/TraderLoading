import { boolean, integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const financialProfilesTable = pgTable(
  "financial_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    totalNetWorth: numeric("total_net_worth", { precision: 14, scale: 2 }).notNull().default("0"),
    monthlyExpenses: numeric("monthly_expenses", { precision: 14, scale: 2 }).notNull().default("0"),
    liquidityMonthsCovered: integer("liquidity_months_covered").notNull().default(6),
    externalStableIncome: numeric("external_stable_income", { precision: 14, scale: 2 }).notNull().default("0"),
    hasDependents: boolean("has_dependents").notNull().default(false),
    liquidityAllocation: numeric("liquidity_allocation", { precision: 14, scale: 2 }).notNull().default("0"),
    reserveAllocation: numeric("reserve_allocation", { precision: 14, scale: 2 }).notNull().default("0"),
    tradingAllocation: numeric("trading_allocation", { precision: 14, scale: 2 }).notNull().default("0"),
    investmentsAllocation: numeric("investments_allocation", { precision: 14, scale: 2 }).notNull().default("0"),
    futureProjectsAllocation: numeric("future_projects_allocation", { precision: 14, scale: 2 }).notNull().default("0"),
    accountObjective: text("account_objective").notNull().default("GROWTH"),
    timeHorizonYears: numeric("time_horizon_years", { precision: 6, scale: 2 }).notNull().default("3"),
    expectedMonthlyReturnPct: numeric("expected_monthly_return_pct", { precision: 6, scale: 2 }).notNull().default("3"),
    simulatedDrawdownPct: numeric("simulated_drawdown_pct", { precision: 6, scale: 2 }).notNull().default("10"),
    taxCountry: text("tax_country").notNull().default("IT"),
    taxRegime: text("tax_regime").notNull().default("DICHIARATIVO"),
    showNetOfTax: boolean("show_net_of_tax").notNull().default(true),
    isCompleted: boolean("is_completed").notNull().default(false),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("financial_profiles_user_idx").on(t.userId)],
);

export type FinancialProfileRecord = typeof financialProfilesTable.$inferSelect;
export type InsertFinancialProfileRecord = typeof financialProfilesTable.$inferInsert;
