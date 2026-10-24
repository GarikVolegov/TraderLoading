import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, financialProfilesTable } from "@workspace/db";
import { getUserId } from "./profile.js";
import {
  DEFAULT_FINANCIAL_PROFILE,
  validateFinancialProfile,
  TOP_50_EQUITIES_AND_ETFS,
  TOP_50_DIVIDENDS_BASKET,
  TOP_50_CRYPTO_BASKET,
  CURRENT_GOLD_BENCHMARK,
  LIMEN_TRADING_KELLY_MODEL,
  calculateEquityBasketTiming,
  calculateDividendBasketTiming,
  calculateCryptoBasketTiming,
  calculateGoldMarketTiming,
  calculateTradingKellyPositioning,
  calculateCrossAssetAllocationMatrix,
  type FinancialProfile,
  type GoldMarketBenchmark,
} from "../../../../contracts/financialArchitecture.js";

const router: IRouter = Router();

const financialProfileSchema = z.object({
  totalNetWorth: z.number().min(0),
  monthlyExpenses: z.number().min(0),
  liquidityMonthsCovered: z.number().int().min(3).max(12),
  externalStableIncome: z.number().min(0),
  hasDependents: z.boolean(),
  liquidityAllocation: z.number().min(0),
  reserveAllocation: z.number().min(0),
  tradingAllocation: z.number().min(0),
  investmentsAllocation: z.number().min(0),
  futureProjectsAllocation: z.number().min(0),
  accountObjective: z.enum(["GROWTH", "INCOME"]),
  timeHorizonYears: z.number().min(0.1).max(50),
  expectedMonthlyReturnPct: z.number().min(0).max(100),
  simulatedDrawdownPct: z.number().min(1).max(100),
  taxCountry: z.enum(["IT", "CH", "ES", "FR", "DE", "UK", "OTHER"]).optional(),
  taxRegime: z.enum(["DICHIARATIVO", "AMMINISTRATO"]).optional(),
  showNetOfTax: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
});

function serializeFinancialProfileRecord(
  record: typeof financialProfilesTable.$inferSelect,
): FinancialProfile {
  return {
    id: record.id,
    userId: record.userId,
    totalNetWorth: Number(record.totalNetWorth) || 0,
    monthlyExpenses: Number(record.monthlyExpenses) || 0,
    liquidityMonthsCovered: record.liquidityMonthsCovered ?? 6,
    externalStableIncome: Number(record.externalStableIncome) || 0,
    hasDependents: Boolean(record.hasDependents),
    liquidityAllocation: Number(record.liquidityAllocation) || 0,
    reserveAllocation: Number(record.reserveAllocation) || 0,
    tradingAllocation: Number(record.tradingAllocation) || 0,
    investmentsAllocation: Number(record.investmentsAllocation) || 0,
    futureProjectsAllocation: Number(record.futureProjectsAllocation) || 0,
    accountObjective: (record.accountObjective as "GROWTH" | "INCOME") || "GROWTH",
    timeHorizonYears: Number(record.timeHorizonYears) || 3,
    expectedMonthlyReturnPct: Number(record.expectedMonthlyReturnPct) || 3,
    simulatedDrawdownPct: Number(record.simulatedDrawdownPct) || 10,
    taxCountry: (record.taxCountry as any) || "IT",
    taxRegime: (record.taxRegime as any) || "DICHIARATIVO",
    showNetOfTax: record.showNetOfTax ?? true,
    isCompleted: Boolean(record.isCompleted),
    validatedAt: record.validatedAt ? record.validatedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// GET /api/financial-profile
router.get("/financial-profile", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req) ?? "guest";
    const [row] = await db
      .select()
      .from(financialProfilesTable)
      .where(eq(financialProfilesTable.userId, userId))
      .limit(1);

    if (!row) {
      return res.json({
        ...DEFAULT_FINANCIAL_PROFILE,
        userId,
      });
    }

    return res.json(serializeFinancialProfileRecord(row));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return res.status(500).json({ error: message });
  }
});

// PUT /api/financial-profile
router.put("/financial-profile", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req) ?? "guest";
    const parsed = financialProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Dati non validi";
      return res.status(400).json({
        error: `Dati non validi: ${firstIssue}`,
        details: parsed.error.issues,
      });
    }

    const data = parsed.data;

    // Se l'utente tenta di validare o completare, esegui la validazione del metodo
    if (data.isCompleted) {
      const validation = validateFinancialProfile(data);
      if (!validation.isValid) {
        return res.status(422).json({
          error: validation.errors[0] || "Validazione fallita",
          details: validation.errors,
        });
      }
    }

    const now = new Date();
    const [existing] = await db
      .select()
      .from(financialProfilesTable)
      .where(eq(financialProfilesTable.userId, userId))
      .limit(1);

    const validatedAt = data.isCompleted
      ? existing?.validatedAt ?? now
      : null;

    if (existing) {
      const [updated] = await db
        .update(financialProfilesTable)
        .set({
          totalNetWorth: String(data.totalNetWorth),
          monthlyExpenses: String(data.monthlyExpenses),
          liquidityMonthsCovered: data.liquidityMonthsCovered,
          externalStableIncome: String(data.externalStableIncome),
          hasDependents: data.hasDependents,
          liquidityAllocation: String(data.liquidityAllocation),
          reserveAllocation: String(data.reserveAllocation),
          tradingAllocation: String(data.tradingAllocation),
          investmentsAllocation: String(data.investmentsAllocation),
          futureProjectsAllocation: String(data.futureProjectsAllocation),
          accountObjective: data.accountObjective,
          timeHorizonYears: String(data.timeHorizonYears),
          expectedMonthlyReturnPct: String(data.expectedMonthlyReturnPct),
          simulatedDrawdownPct: String(data.simulatedDrawdownPct),
          taxCountry: data.taxCountry || existing.taxCountry || "IT",
          taxRegime: data.taxRegime || existing.taxRegime || "DICHIARATIVO",
          showNetOfTax: data.showNetOfTax !== undefined ? data.showNetOfTax : existing.showNetOfTax,
          isCompleted: data.isCompleted ?? false,
          validatedAt,
          updatedAt: now,
        })
        .where(eq(financialProfilesTable.id, existing.id))
        .returning();

      return res.json(serializeFinancialProfileRecord(updated));
    }

    const newId = randomUUID();
    const [created] = await db
      .insert(financialProfilesTable)
      .values({
        id: newId,
        userId,
        totalNetWorth: String(data.totalNetWorth),
        monthlyExpenses: String(data.monthlyExpenses),
        liquidityMonthsCovered: data.liquidityMonthsCovered,
        externalStableIncome: String(data.externalStableIncome),
        hasDependents: data.hasDependents,
        liquidityAllocation: String(data.liquidityAllocation),
        reserveAllocation: String(data.reserveAllocation),
        tradingAllocation: String(data.tradingAllocation),
        investmentsAllocation: String(data.investmentsAllocation),
        futureProjectsAllocation: String(data.futureProjectsAllocation),
        accountObjective: data.accountObjective,
        timeHorizonYears: String(data.timeHorizonYears),
        expectedMonthlyReturnPct: String(data.expectedMonthlyReturnPct),
        simulatedDrawdownPct: String(data.simulatedDrawdownPct),
        taxCountry: data.taxCountry || "IT",
        taxRegime: data.taxRegime || "DICHIARATIVO",
        showNetOfTax: data.showNetOfTax !== undefined ? data.showNetOfTax : true,
        isCompleted: data.isCompleted ?? false,
        validatedAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return res.json(serializeFinancialProfileRecord(created));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return res.status(500).json({ error: message });
  }
});

// GET /api/financial-profile/benchmarks
router.get("/financial-profile/benchmarks", async (_req: Request, res: Response) => {
  try {
    const equitySummary = calculateEquityBasketTiming();
    const dividendSummary = calculateDividendBasketTiming();
    const cryptoSummary = calculateCryptoBasketTiming();

    let goldBenchmark: GoldMarketBenchmark = { ...CURRENT_GOLD_BENCHMARK };
    try {
      const { getCandles } = await import("../services/candles.js");
      const candlesResult = await getCandles("XAUUSD", "D1", { limit: 200 });
      const candles = candlesResult.candles;
      if (candles && candles.length >= 20) {
        const latest = candles[candles.length - 1];
        const spotPriceUsd = latest.close;
        const spotPriceEur = Math.round(spotPriceUsd * 0.92 * 10) / 10;
        const closes = candles.map((c) => c.close);
        const smaCount = Math.min(closes.length, 200);
        const smaSum = closes.slice(-smaCount).reduce((a, b) => a + b, 0);
        const sma200Usd = Math.round((smaSum / smaCount) * 10) / 10;
        const sma50Count = Math.min(closes.length, 50);
        const sma50Sum = closes.slice(-sma50Count).reduce((a, b) => a + b, 0);
        const sma50Usd = Math.round((sma50Sum / sma50Count) * 10) / 10;
        const distanceFromSma200Pct = Number((((spotPriceUsd - sma200Usd) / sma200Usd) * 100).toFixed(2));
        const athUsd = Math.max(...closes);
        const distanceFromAthPct = Number((((spotPriceUsd - athUsd) / athUsd) * 100).toFixed(2));

        goldBenchmark = {
          symbol: "XAUUSD",
          spotPriceUsd,
          spotPriceEur,
          sma200Usd,
          sma50Usd,
          distanceFromSma200Pct,
          athUsd,
          distanceFromAthPct,
          realInterestRate10YPct: 1.82,
          historicalPreservationCagrPct: 3.8,
          lastUpdated: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback trasparente al benchmark storico validato
    }

    const goldSummary = calculateGoldMarketTiming(goldBenchmark);
    const tradingPositioning = calculateTradingKellyPositioning(8000, 50000);
    const crossAssetMatrix = calculateCrossAssetAllocationMatrix(
      equitySummary,
      dividendSummary,
      cryptoSummary,
      goldSummary,
      tradingPositioning
    );

    return res.json({
      equities: {
        summary: equitySummary,
        top50: TOP_50_EQUITIES_AND_ETFS,
      },
      dividends: {
        summary: dividendSummary,
        top50: TOP_50_DIVIDENDS_BASKET,
      },
      crypto: {
        summary: cryptoSummary,
        top50: TOP_50_CRYPTO_BASKET,
      },
      gold: {
        summary: goldSummary,
        benchmark: goldBenchmark,
      },
      tradingKelly: LIMEN_TRADING_KELLY_MODEL,
      tradingPositioning,
      crossAssetMatrix,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return res.status(500).json({ error: message });
  }
});

export default router;
