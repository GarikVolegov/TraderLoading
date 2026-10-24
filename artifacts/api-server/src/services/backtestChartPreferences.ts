import { db, backtestChartPreferencesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  parseBacktestChartPreferences,
  type BacktestChartSnapshot,
  type UpdateBacktestChartRequest,
} from "../../../../contracts/backtestChart.js";

export interface BacktestChartStore {
  read(userId: string): Promise<BacktestChartSnapshot>;
  write(
    userId: string,
    request: UpdateBacktestChartRequest,
  ): Promise<{ conflict: boolean; snapshot: BacktestChartSnapshot }>;
}
function snapshot(
  row: { revision: number; preferences: unknown } | undefined,
): BacktestChartSnapshot {
  if (!row) return { revision: 0, preferences: null };
  const preferences = parseBacktestChartPreferences(row.preferences);
  if (!preferences) throw new Error("Invalid persisted chart preferences");
  return { revision: row.revision, preferences };
}
export function createBacktestChartStore(database: typeof db = db): BacktestChartStore {
  return {
    async read(userId) {
      const [row] = await database
        .select()
        .from(backtestChartPreferencesTable)
        .where(eq(backtestChartPreferencesTable.userId, userId))
        .limit(1);
      return snapshot(row);
    },
    async write(userId, request) {
      return database.transaction(async (tx) => {
        // Also serializes creation, when SELECT FOR UPDATE alone cannot lock a missing row.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('backtest.chart.preferences'), hashtext(${userId}))`,
        );
        const [row] = await tx
          .select()
          .from(backtestChartPreferencesTable)
          .where(eq(backtestChartPreferencesTable.userId, userId))
          .limit(1)
          .for("update");
        const current = snapshot(row);
        if (current.revision !== request.revision) return { conflict: true, snapshot: current };
        const next = {
          userId,
          revision: current.revision + 1,
          preferences: request.preferences,
          updatedAt: new Date(),
        };
        await tx
          .insert(backtestChartPreferencesTable)
          .values(next)
          .onConflictDoUpdate({ target: backtestChartPreferencesTable.userId, set: next });
        return {
          conflict: false,
          snapshot: { revision: next.revision, preferences: request.preferences },
        };
      });
    },
  };
}
export const backtestChartStore = createBacktestChartStore();
