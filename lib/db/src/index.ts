import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { createPgPoolConfig } from "./poolConfig";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool(createPgPoolConfig());

// Idle pooled clients emit "error" when the backend closes the connection
// (DB restart, idle timeout, machine sleep). Without a listener Node escalates
// it to an uncaughtException and kills the whole process; the pool replaces
// the dead client on the next checkout, so logging is the correct response.
pool.on("error", (err) => {
  console.error("[db] idle client error (connection will be replaced):", err.message);
});

export const db = drizzle(pool, { schema });

const replicaUrl = process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_REPLICA_URL;
export const readPool = replicaUrl
  ? new Pool(createPgPoolConfig({ ...process.env, DATABASE_URL: replicaUrl }))
  : pool;

if (readPool !== pool) {
  readPool.on("error", (err) => {
    console.error("[db-replica] idle client error (connection will be replaced):", err.message);
  });
}

export const readDb = readPool === pool ? db : drizzle(readPool, { schema });

export async function closeDbPool(): Promise<void> {
  const promises: Promise<void>[] = [pool.end()];
  if (readPool !== pool) {
    promises.push(readPool.end());
  }
  await Promise.allSettled(promises);
}

export * from "./schema";
