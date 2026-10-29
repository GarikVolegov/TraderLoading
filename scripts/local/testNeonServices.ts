/**
 * End-to-End Verification of Neon Services (Postgres & Auth)
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
// @ts-expect-error pg types are provided by workspace lib/db
import pg from "pg";
import { parseEnvLocal, repoRoot } from "./lib/env.js";

const { Pool } = pg;

async function main() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("👑 AUREUS OS — TESTING NEON SERVICES END-TO-END");
  console.log("════════════════════════════════════════════════════════════════\n");

  // Load .env.local
  const envPath = path.join(repoRoot, ".env.local");
  assert.ok(existsSync(envPath), ".env.local must exist");
  const parsed = parseEnvLocal(readFileSync(envPath, "utf8"));
  for (const [k, v] of parsed.entries()) {
    if (!process.env[k]) {
      process.env[k] = v;
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  const databaseUrlUnpooled = process.env.DATABASE_URL_UNPOOLED;
  const neonAuthBaseUrl = process.env.NEON_AUTH_BASE_URL;
  const neonAuthJwksUrl = process.env.NEON_AUTH_JWKS_URL;
  const neonBranch = process.env.NEON_BRANCH;

  console.log(`Neon Project Branch : ${neonBranch}`);
  console.log(`Database (Pooled)   : ${databaseUrl ? databaseUrl.replace(/:[^:]*@/, ":***@") : "MISSING"}`);
  console.log(`Database (Unpooled) : ${databaseUrlUnpooled ? databaseUrlUnpooled.replace(/:[^:]*@/, ":***@") : "MISSING"}`);
  console.log(`Neon Auth Base URL  : ${neonAuthBaseUrl}`);
  console.log(`Neon Auth JWKS URL  : ${neonAuthJwksUrl}\n`);

  assert.ok(databaseUrl, "DATABASE_URL is missing");
  assert.ok(databaseUrlUnpooled, "DATABASE_URL_UNPOOLED is missing");
  assert.ok(neonAuthBaseUrl, "NEON_AUTH_BASE_URL is missing");
  assert.ok(neonAuthJwksUrl, "NEON_AUTH_JWKS_URL is missing");

  // 1. TEST NEON POSTGRES POOLED (Application Runtime Connection)
  console.log("▶ [1/4] Testing Neon Postgres (Pooled Connection)...");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const startTime = Date.now();
  const infoRes = await pool.query("SELECT current_database() as db, current_user as usr, version() as ver, NOW() as ts");
  const queryDuration = Date.now() - startTime;
  console.log(`  ✓ Connected in ${queryDuration}ms`);
  console.log(`  ✓ Database: ${infoRes.rows[0].db} | User: ${infoRes.rows[0].usr}`);
  console.log(`  ✓ PostgreSQL Engine: ${infoRes.rows[0].ver.split(" ")[0]} ${infoRes.rows[0].ver.split(" ")[1]}`);

  // Check tables count
  const tablesRes = await pool.query(
    "SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = 'public'"
  );
  console.log(`  ✓ Public Tables Count in Neon: ${tablesRes.rows[0].count}`);
  assert.ok(tablesRes.rows[0].count >= 40, `Expected at least 40 tables, found ${tablesRes.rows[0].count}`);

  // Check Drizzle migrations table
  const migrationsRes = await pool.query("SELECT count(*)::int as count FROM drizzle.__drizzle_migrations");
  console.log(`  ✓ Applied Drizzle Migrations: ${migrationsRes.rows[0].count}/58 (0000 to 0057)`);
  assert.equal(migrationsRes.rows[0].count, 58, `Expected 58 migrations, found ${migrationsRes.rows[0].count}`);

  // Test Transaction & Advisory Lock
  console.log("  ✓ Testing atomic transaction with pg_advisory_xact_lock...");
  await pool.query("BEGIN");
  await pool.query("SELECT pg_advisory_xact_lock(hashtext('aureus_test_lock'))");
  await pool.query("COMMIT");
  console.log("  ✓ Advisory transaction lock test passed!");
  await pool.end();

  // 2. TEST NEON POSTGRES UNPOOLED (Direct Connection for Migrations & DDL)
  console.log("\n▶ [2/4] Testing Neon Postgres (Direct Unpooled Connection)...");
  const unpooledPool = new Pool({
    connectionString: databaseUrlUnpooled,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  const unpooledRes = await unpooledPool.query("SELECT 1 as direct_ok");
  assert.equal(unpooledRes.rows[0].direct_ok, 1);
  console.log("  ✓ Direct unpooled connection verified successfully!");
  await unpooledPool.end();

  // 3. TEST NEON AUTH SERVICE (Base URL Health)
  console.log("\n▶ [3/4] Testing Neon Auth Service (HTTP Health Probe)...");
  const healthRes = await fetch(`${neonAuthBaseUrl}/ok`, { signal: AbortSignal.timeout(5000) });
  console.log(`  ✓ HTTP Status: ${healthRes.status} ${healthRes.statusText}`);
  const healthBody = await healthRes.json() as { ok?: boolean };
  console.log(`  ✓ Response Payload: ${JSON.stringify(healthBody)}`);
  assert.equal(healthRes.status, 200);
  assert.equal(healthBody.ok, true, "Expected Neon Auth /ok to return { ok: true }");

  // 4. TEST NEON AUTH JWKS (Cryptographic Signature Discovery)
  console.log("\n▶ [4/4] Testing Neon Auth Cryptographic JWKS Endpoint...");
  const jwksRes = await fetch(neonAuthJwksUrl, { signal: AbortSignal.timeout(5000) });
  console.log(`  ✓ HTTP Status: ${jwksRes.status} ${jwksRes.statusText}`);
  const jwksBody = await jwksRes.json() as { keys?: Array<{ alg: string; crv: string; kty: string; kid: string }> };
  console.log(`  ✓ Discovered ${jwksBody.keys?.length ?? 0} public keys:`);
  for (const k of jwksBody.keys ?? []) {
    console.log(`    • Key ID: ${k.kid} | Alg: ${k.alg} | Curve: ${k.crv} | Type: ${k.kty}`);
  }
  assert.equal(jwksRes.status, 200);
  assert.ok((jwksBody.keys?.length ?? 0) > 0, "Expected at least 1 public key in JWKS");

  console.log("\n════════════════════════════════════════════════════════════════");
  console.log("✅ ALL NEON SERVICES (POSTGRES & AUTH) PROVEN OPERATIONAL END-TO-END!");
  console.log("════════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("❌ Neon end-to-end verification failed:", err);
  process.exit(1);
});
