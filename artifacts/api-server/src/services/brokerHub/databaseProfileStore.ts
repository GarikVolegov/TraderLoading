import { sql } from "drizzle-orm";
import {
  createBrokerProfileStoreFromBackend,
  type BrokerProfileList,
  type BrokerProfileStore,
  type BrokerProfileStoreBackend,
} from "./profileStore.js";

type DbClient = {
  execute(query: unknown): Promise<unknown>;
  transaction?<T>(run: (tx: DbClient) => Promise<T>): Promise<T>;
};

const EMPTY_PROFILE_LIST: BrokerProfileList = { activeProfileId: null, activeByUser: {}, profiles: [] };

function rowsFrom(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  if (typeof result === "object" && result !== null && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: Array<Record<string, unknown>> }).rows;
  }
  return [];
}

function createDatabaseBackend(db: DbClient): BrokerProfileStoreBackend {
  async function readData(client: DbClient, lock: boolean): Promise<unknown> {
    const result = await client.execute(sql`
      SELECT data
      FROM broker_profile_store
      WHERE store_key = 'default'
      LIMIT 1
      ${lock ? sql`FOR UPDATE` : sql``}
    `);
    return rowsFrom(result)[0]?.data;
  }

  async function writeData(client: DbClient, data: BrokerProfileList): Promise<void> {
    await client.execute(sql`
      INSERT INTO broker_profile_store (store_key, data, updated_at)
      VALUES ('default', ${JSON.stringify(data)}::jsonb, now())
      ON CONFLICT (store_key)
      DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `);
  }

  async function updateData<T>(
    client: DbClient,
    mutate: (current: unknown) => Promise<{ data: BrokerProfileList; result: T }> | { data: BrokerProfileList; result: T },
  ): Promise<T> {
    await client.execute(sql`
      INSERT INTO broker_profile_store (store_key, data, updated_at)
      VALUES ('default', ${JSON.stringify(EMPTY_PROFILE_LIST)}::jsonb, now())
      ON CONFLICT (store_key) DO NOTHING
    `);
    const next = await mutate((await readData(client, true)) ?? EMPTY_PROFILE_LIST);
    await writeData(client, next.data);
    return next.result;
  }

  return {
    async read(): Promise<unknown> {
      return readData(db, false);
    },

    async write(data: BrokerProfileList): Promise<void> {
      await writeData(db, data);
    },

    async update<T>(
      mutate: (current: unknown) => Promise<{ data: BrokerProfileList; result: T }> | { data: BrokerProfileList; result: T },
    ): Promise<T> {
      if (db.transaction) {
        return db.transaction((tx) => updateData(tx, mutate));
      }
      return updateData(db, mutate);
    },
  };
}

export async function createDatabaseBrokerProfileStore(dbClient?: DbClient): Promise<BrokerProfileStore> {
  const db = dbClient ?? (await import("@workspace/db")).db;
  return createBrokerProfileStoreFromBackend(createDatabaseBackend(db));
}
