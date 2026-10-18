import { db, userSettingsTable } from "@workspace/db";
import { eq, isNull, sql } from "drizzle-orm";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Settings = typeof userSettingsTable.$inferSelect;

export function withLockedUserSettings<Result>(
  userId: string | null,
  operation: (tx: Transaction, settings: Settings) => Promise<Result>,
): Promise<Result> {
  return db.transaction(async (tx) => {
    // /settings and /push/preferences share a JSON column. Read its current
    // contents after taking the same lock so independent partial updates merge.
    // The advisory lock also covers creation when no settings row exists yet.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('traderloading.settings.update'), hashtext(${userId ?? "anonymous"}))`,
    );
    const where = userId ? eq(userSettingsTable.userId, userId) : isNull(userSettingsTable.userId);
    let [settings] = await tx.select().from(userSettingsTable).where(where).limit(1).for("update");
    if (!settings) {
      [settings] = await tx
        .insert(userSettingsTable)
        .values({
          userId,
          backgroundType: "default",
          fontChoice: "inter",
          backgroundDarkness: 60,
        })
        .returning();
    }
    return operation(tx, settings);
  });
}

export async function getOrCreateUserSettings(userId: string | null): Promise<Settings> {
  const where = userId ? eq(userSettingsTable.userId, userId) : isNull(userSettingsTable.userId);
  const [settings] = await db.select().from(userSettingsTable).where(where).limit(1);
  if (settings) return settings;
  return withLockedUserSettings(userId, async (_tx, created) => created);
}
