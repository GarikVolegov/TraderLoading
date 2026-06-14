// Ensure a Clerk test user exists AND has a Pro subscription, so the backtest
// verifier can reach the (auth + Pro gated) replay. Idempotent.
//   - Clerk Backend API (CLERK_SECRET_KEY) creates/looks up the user.
//   - Postgres upsert grants Pro in admin_user_subscriptions.
import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnvLocal() {
  const env = {};
  try {
    const txt = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      env[line.slice(0, i).replace(/^export\s+/, "").trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local */
  }
  return env;
}

const env = loadEnvLocal();
const SECRET = process.env.CLERK_SECRET_KEY || env.CLERK_SECRET_KEY;
const EMAIL = process.env.VERIFY_EMAIL || "verify+clerk_test@example.com";
const PASSWORD = process.env.VERIFY_PASSWORD || "Clerk-Test-Verify-424242!";
const DB_URL =
  process.env.VERIFY_DATABASE_URL || "postgres://trader:trader@127.0.0.1:55432/traderloadings";

if (!SECRET) {
  console.error("CLERK_SECRET_KEY not found (env or .env.local)");
  process.exit(1);
}

const clerk = (path, init) =>
  fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json", ...(init?.headers) },
  });

// 1. Create the user (ignore "already exists").
const created = await clerk("/users", {
  method: "POST",
  body: JSON.stringify({ email_address: [EMAIL], password: PASSWORD, skip_password_checks: true }),
});
if (created.ok) {
  console.log(`created Clerk test user <${EMAIL}>`);
} else {
  const msg = JSON.stringify(await created.json().catch(() => ({})));
  if (created.status === 422 && /already|taken|exists|duplicate/i.test(msg)) {
    console.log(`Clerk test user already exists <${EMAIL}>`);
  } else {
    console.error(`Clerk create user failed: HTTP ${created.status} ${msg}`);
    process.exit(1);
  }
}

// 2. Look up the user id.
const lookup = await clerk(`/users?email_address=${encodeURIComponent(EMAIL)}`);
const users = await lookup.json();
const userId = Array.isArray(users) ? users[0]?.id : users?.data?.[0]?.id;
if (!userId) {
  console.error(`could not resolve user id for ${EMAIL}`);
  process.exit(1);
}

// 3. Grant Pro in the DB (the backend gates session creation on a real Pro plan).
const pool = new pg.Pool({ connectionString: DB_URL });
try {
  await pool.query(
    `INSERT INTO admin_user_subscriptions (user_id, plan, status, source, manual_override)
     VALUES ($1, 'pro', 'active', 'manual', true)
     ON CONFLICT (user_id) DO UPDATE SET plan = 'pro', status = 'active', manual_override = true, updated_at = now()`,
    [userId],
  );
  console.log(`granted Pro to ${userId}`);
} catch (err) {
  console.error(`Pro grant failed: ${err.message}`);
  process.exit(1);
} finally {
  await pool.end();
}

console.log(JSON.stringify({ email: EMAIL, password: PASSWORD, userId }));
