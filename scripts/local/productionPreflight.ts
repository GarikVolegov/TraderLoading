/**
 * AUREUS PROTOCOL — Sovereign Production Preflight Validator
 *
 * Inspects environment contracts, secrets formatting, build artifacts,
 * and database migration parity before releasing to cloud (Railway / Docker / VPS).
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnvLocal, repoRoot } from "./lib/env.js";

export interface PreflightReport {
  passed: boolean;
  errors: string[];
  warnings: string[];
  checksRun: number;
}

export function runProductionPreflight(
  env: Record<string, string | undefined> = process.env,
  rootDir: string = repoRoot,
): PreflightReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let checksRun = 0;

  function check(name: string, fn: () => void) {
    checksRun++;
    try {
      fn();
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function warn(name: string, fn: () => boolean, message: string) {
    checksRun++;
    try {
      if (!fn()) {
        warnings.push(`${name}: ${message}`);
      }
    } catch (err) {
      warnings.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 1. Build Artifacts Integrity
  check("Frontend Build Artifacts", () => {
    const indexPath = path.join(rootDir, "artifacts/trader-dashboard/dist/public/index.html");
    const sitemapPath = path.join(rootDir, "artifacts/trader-dashboard/dist/public/sitemap.xml");
    assert.ok(existsSync(indexPath), `Missing compiled frontend entry point: ${indexPath}`);
    assert.ok(existsSync(sitemapPath), `Missing generated SEO sitemap: ${sitemapPath}`);
  });

  check("Backend Build Artifacts", () => {
    const serverDist = path.join(rootDir, "artifacts/api-server/dist/index.cjs");
    assert.ok(existsSync(serverDist), `Missing compiled API server: ${serverDist}`);
  });

  // 2. Database Migrations Journal Parity
  check("Drizzle Journal Parity", () => {
    const drizzleDir = path.join(rootDir, "lib/db/drizzle");
    const journalPath = path.join(drizzleDir, "meta/_journal.json");
    assert.ok(existsSync(journalPath), "Missing _journal.json");

    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    const journalTags = new Set(journal.entries.map((e: { tag: string }) => `${e.tag}.sql`));

    const sqlFiles = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
    for (const file of sqlFiles) {
      assert.ok(
        journalTags.has(file),
        `Migration file ${file} exists on disk but is not recorded in _journal.json`,
      );
    }
  });

  // 3. Broker Vault Key Encryption Length
  check("Broker Vault Key Cryptography", () => {
    const key = env["BROKER_VAULT_KEY"];
    if (key) {
      assert.equal(
        key.length,
        64,
        `BROKER_VAULT_KEY must be exactly 64 hex characters (32 bytes). Found length: ${key.length}`,
      );
      assert.ok(/^[0-9a-fA-F]{64}$/.test(key), "BROKER_VAULT_KEY must be hexadecimal");
    } else {
      errors.push("BROKER_VAULT_KEY is required for broker credential encryption");
    }
  });

  // 4. Clerk Auth Production Hardening
  check("Clerk Auth Production Keys", () => {
    const pk = env["CLERK_PUBLISHABLE_KEY"] ?? env["VITE_CLERK_PUBLISHABLE_KEY"];
    const sk = env["CLERK_SECRET_KEY"];

    if (pk) {
      if (pk.startsWith("pk_test_")) {
        warnings.push(
          "Clerk Publishable Key is currently in TEST mode (pk_test_). Must switch to pk_live_ before public launch.",
        );
      }
    } else {
      errors.push("CLERK_PUBLISHABLE_KEY or VITE_CLERK_PUBLISHABLE_KEY is missing");
    }

    if (sk) {
      if (sk.startsWith("sk_test_")) {
        warnings.push(
          "Clerk Secret Key is currently in TEST mode (sk_test_). Must switch to sk_live_ before public launch.",
        );
      }
    } else {
      errors.push("CLERK_SECRET_KEY is missing");
    }

    const proxy = env["VITE_CLERK_PROXY_URL"];
    if (proxy && proxy.trim().length > 0) {
      errors.push(
        "VITE_CLERK_PROXY_URL must be empty when using custom Clerk domains (causes MITM / blank screen)",
      );
    }
  });

  // 5. Database Connection String Security
  check("Database Connection String Security", () => {
    const dbUrl = env["DATABASE_URL"];
    if (!dbUrl) {
      errors.push("DATABASE_URL is not set");
      return;
    }

    if (env["NODE_ENV"] === "production") {
      if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) {
        warnings.push("DATABASE_URL points to localhost/127.0.0.1 while NODE_ENV=production");
      }
      if (!dbUrl.includes("sslmode=require") && !dbUrl.includes("ssl=true")) {
        warnings.push("Production DATABASE_URL should enforce SSL (sslmode=require)");
      }
    }
  });

  // 6. Web Push VAPID Configuration
  check("Web Push VAPID Configuration", () => {
    const pub = env["VAPID_PUBLIC_KEY"];
    const priv = env["VAPID_PRIVATE_KEY"];
    if (!pub || !priv) {
      warnings.push(
        "VAPID keys (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) are unset: background web push will stay dark.",
      );
    }
  });

  // 7. Stripe Billing Integration
  warn(
    "Stripe Billing Keys",
    () => {
      const sk = env["STRIPE_SECRET_KEY"];
      return !!(sk && sk.startsWith("sk_live_"));
    },
    "Stripe Live Secret Key is unset or in test mode. Paid tiers and marketplace channels will stay dark.",
  );

  // 8. Single-Instance vs Distributed Redis Scaling
  check("Scaling Replicas & Redis Topology", () => {
    const replicas = Number(env["EXPECTED_REPLICAS"] ?? "1");
    const hasRedis = !!env["REDIS_URL"];
    if (replicas > 1 && !hasRedis) {
      errors.push(
        `EXPECTED_REPLICAS is set to ${replicas} but REDIS_URL is missing. Scaling out requires Redis.`,
      );
    }
  });

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    checksRun,
  };
}

// CLI Execution Entry Point
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
) {
  console.log("👑 AUREUS PROTOCOL — Running Production Preflight Audit...\n");

  const envFileIdx = process.argv.indexOf("--config-env");
  let targetEnv: Record<string, string | undefined> = { ...process.env };

  if (envFileIdx !== -1 && process.argv[envFileIdx + 1]) {
    const customPath = path.resolve(repoRoot, process.argv[envFileIdx + 1]);
    if (existsSync(customPath)) {
      console.log(`Loading custom env file: ${customPath}`);
      const parsed = parseEnvLocal(readFileSync(customPath, "utf8"));
      for (const [k, v] of parsed.entries()) {
        if (v.trim() !== "") {
          targetEnv[k] = v;
        }
      }
    } else {
      console.error(`Env file not found: ${customPath}`);
      process.exit(1);
    }
  }

  const report = runProductionPreflight(targetEnv);

  console.log(`Executed ${report.checksRun} architectural preflight checks.\n`);

  if (report.warnings.length > 0) {
    console.log("⚠️  ADVISORY WARNINGS (Dark-by-Default Fallbacks):");
    for (const w of report.warnings) {
      console.log(`   • ${w}`);
    }
    console.log("");
  }

  if (report.errors.length > 0) {
    console.error("❌ CRITICAL PREFLIGHT FAILURES:");
    for (const err of report.errors) {
      console.error(`   ✗ ${err}`);
    }
    console.error("\nDeploy blocked by sovereign preflight gate.");
    process.exit(1);
  } else {
    console.log("✅ ALL CRITICAL PREFLIGHT GATES PASSED.");
    console.log("Application is hardened and ready for production deployment.\n");
    process.exit(0);
  }
}
