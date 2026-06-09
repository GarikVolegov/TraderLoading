import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { createPgPoolConfig } from "./poolConfig";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool(createPgPoolConfig());
export const db = drizzle(pool, { schema });

export async function closeDbPool(): Promise<void> {
  await pool.end();
}

export * from "./schema";
