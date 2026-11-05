import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryCacheStore } from "./lib/cache.js";
import { CircuitBreaker, CircuitBreakerOpenError, getOrCreateCircuitBreaker } from "./lib/circuitBreaker.js";
import { singleFlight } from "./lib/singleFlight.js";
import {
  getServiceRole,
  shouldRunHttpApi,
  shouldRunWebSockets,
  shouldRunSchedulers,
} from "./services/serviceRole.js";
import {
  createCorsOptions,
  createHelmetOptions,
  getRateLimitKey,
  getRateLimitConfig,
  parseTrustProxy,
  publicUploadGuard,
} from "./lib/security.js";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { ACCOUNT_DELETION_CATEGORIES, getAccountDeletionDisclosure } = await import(
  "./services/accountDeletion.js"
);

function readSrc(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

// ─── 1. HTTP Server Timeouts & Graceful Shutdown (index.ts) ────────────────────
{
  const indexSource = readSrc("./index.ts");
  assert.match(
    indexSource,
    /server\.keepAliveTimeout\s*=\s*65_000/,
    "keepAliveTimeout must be 65_000ms to exceed reverse proxy 60s idle timeout",
  );
  assert.match(
    indexSource,
    /server\.headersTimeout\s*=\s*66_000/,
    "headersTimeout must be 66_000ms (> keepAliveTimeout) to prevent race conditions",
  );
  assert.match(
    indexSource,
    /server\.requestTimeout\s*=\s*30_000/,
    "requestTimeout must be 30_000ms to mitigate slowloris/hung requests",
  );
  assert.match(indexSource, /assertRedisConfigured\(\)/, "Production Redis assertion must be wired on boot");
  assert.match(indexSource, /closeHttpServer\(\)/, "Graceful shutdown must drain HTTP server");
  assert.match(indexSource, /closeDbPool\(\)/, "Graceful shutdown must close PostgreSQL pools");
  assert.match(indexSource, /closeSharedRedisClient\(\)/, "Graceful shutdown must close shared Redis client");
  assert.match(indexSource, /closeAppCache\(\)/, "Graceful shutdown must close app cache");
}

// ─── 2. Multi-Tenant Isolation & Advisory Locks (Critical Transactional Routes) ─
{
  const appSource = readSrc("./app.ts");
  assert.match(appSource, /app\.use\(helmet\(createHelmetOptions\(\)\)\)/, "Helmet security headers must be active");
  assert.match(appSource, /app\.use\(cors\(createCorsOptions\(\)\)\)/, "Hardened CORS must be active");
  assert.match(appSource, /app\.use\(authMiddleware\)/, "authMiddleware must be mounted before API router");
  assert.match(appSource, /createRedisRateLimitStore/, "Distributed Redis rate limit store must be wired");

  const routesIndexSource = readSrc("./routes/index.ts");
  assert.match(
    routesIndexSource,
    /router\.use\(ANONYMOUS_FALLBACK_PREFIXES,\s*createProductionAuthGate\(\)\)/,
    "Production auth gate must protect anonymous-fallback routes from shared-bucket leaks",
  );

  const authMiddlewareSource = readSrc("./middlewares/authMiddleware.ts");
  assert.match(authMiddlewareSource, /getAuth\(req\)\.userId/, "Clerk getAuth(req).userId must resolve identity");
  assert.match(authMiddlewareSource, /isSessionRevoked/, "Session revocation check must be enforced");
  assert.match(authMiddlewareSource, /isAccountAllowedByAdminStatus/, "Admin suspension check must be enforced");

  const traderProcessSource = readSrc("./routes/trader-process.ts");
  assert.match(
    traderProcessSource,
    /pg_advisory_xact_lock\(hashtext\(\$\{`process:\$\{userId\}`\}\)\)/,
    "trader-process must serialize mutations per user via pg_advisory_xact_lock",
  );
  assert.match(
    traderProcessSource,
    /res\.setHeader\("Cache-Control",\s*"private, no-store"\)/,
    "trader-process must prevent shared caching of private state",
  );

  const backtestSource = readSrc("./routes/backtest.ts");
  assert.match(
    backtestSource,
    /SELECT pg_advisory_xact_lock\(hashtextextended\(\$\{receiptKey\},\s*0\)\)/,
    "backtest trade creation must serialize idempotency receipts via pg_advisory_xact_lock",
  );
  assert.match(
    backtestSource,
    /async function userOwnsSession/,
    "backtest routes must enforce session ownership (IDOR prevention)",
  );

  const profileSource = readSrc("./routes/profile.ts");
  assert.match(
    profileSource,
    /pg_advisory_xact_lock\(hashtext\('traderloading\.profile\.create'\)/,
    "profile creation must serialize concurrent first-load requests via pg_advisory_xact_lock",
  );

  const chatSource = readSrc("./routes/chat.ts");
  assert.match(
    chatSource,
    /pg_advisory_xact_lock\(hashtextextended\(\$\{`chat-account-keys:\$\{userId\}`\},\s*0\)\)/,
    "chat E2EE key rotation must use pg_advisory_xact_lock",
  );

  const billingSource = readSrc("./routes/billing.ts");
  assert.match(
    billingSource,
    /stripe\.webhooks\.constructEvent/,
    "Stripe webhook must verify cryptographic signature",
  );
  assert.match(
    billingSource,
    /\.insert\(stripeWebhookEventsTable\)[\s\S]*?\.onConflictDoNothing\(\)/,
    "Stripe webhook must enforce atomic idempotency via ON CONFLICT DO NOTHING",
  );

  const brokersSource = readSrc("./routes/brokers.ts");
  assert.match(
    brokersSource,
    /async function requireOwnedBrokerProfile/,
    "brokers route must enforce strict ownerUserId isolation on profiles",
  );
}

// ─── 3. Security Helpers (CORS, CSP, Rate Limit Keying, Upload Guard) ──────────
{
  const prodCors = createCorsOptions({
    NODE_ENV: "production",
    API_CORS_ORIGINS: "https://aureus.traderloading.com",
  });
  assert.equal(prodCors.origin("https://aureus.traderloading.com"), true);
  assert.equal(prodCors.origin("http://localhost:5173"), false, "Production CORS must reject localhost");
  assert.equal(prodCors.origin("https://attacker.example"), false, "Production CORS must reject unknown origins");

  const helmetOpts = createHelmetOptions({
    CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsudHJhZGVybG9hZGluZy5jb20k",
    APP_BASE_URL: "https://aureus.traderloading.com",
  });
  const directives = helmetOpts.contentSecurityPolicy?.directives;
  assert.ok(directives?.defaultSrc?.includes("'self'"));
  assert.ok(directives?.scriptSrc?.includes("https://clerk.traderloading.com"));
  assert.ok(directives?.connectSrc?.includes("https://aureus.traderloading.com"));

  assert.equal(parseTrustProxy({ NODE_ENV: "production" }), 1);
  assert.equal(
    getRateLimitKey({ user: { id: "usr_sovereign" }, ip: "203.0.113.5" }),
    "user:usr_sovereign",
  );
  assert.equal(getRateLimitConfig({ NODE_ENV: "production" }).limit, 2000);

  let uploadStatus = 0;
  publicUploadGuard(
    { method: "GET", path: "/wiki/user_1/secret.pdf" },
    {
      setHeader: () => undefined,
      status: (code) => {
        uploadStatus = code;
        return { json: () => undefined };
      },
    },
    () => undefined,
  );
  assert.equal(uploadStatus, 404, "Private wiki uploads must be blocked on public static path");
}

// ─── 4. Circuit Breaker, singleFlight & Bounded LRU Cache (candles.ts / cache.ts)
{
  const candlesServiceSource = readSrc("./services/candles.ts");
  assert.match(
    candlesServiceSource,
    /MAX_MEMORY_CACHE_ENTRIES\s*=\s*250/,
    "candles service must bound in-memory cache to 250 entries",
  );
  assert.match(
    candlesServiceSource,
    /singleFlight\(candlesInFlight,\s*cacheKey/,
    "candles service must deduplicate concurrent upstream fetches via singleFlight",
  );
  assert.match(
    candlesServiceSource,
    /getOrCreateCircuitBreaker\(\{\s*name:\s*`candles-provider-\$\{name\.toLowerCase\(\)\}`/,
    "candles service must wrap upstream providers in per-provider circuit breakers",
  );

  // Runtime verification: singleFlight thundering-herd protection
  const inFlightMap = new Map<string, Promise<number>>();
  let upstreamCalls = 0;
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      singleFlight(inFlightMap, "XAUUSD:M1", async () => {
        upstreamCalls += 1;
        await new Promise((r) => setTimeout(r, 5));
        return 2650.5;
      }),
    ),
  );
  assert.equal(upstreamCalls, 1, "singleFlight must collapse 10 concurrent calls into 1 upstream execution");
  assert.ok(results.every((v) => v === 2650.5));
  assert.equal(inFlightMap.size, 0, "singleFlight map must clean up settled key");

  // Runtime verification: CircuitBreaker state machine
  let clock = 1_000;
  const breaker = new CircuitBreaker({
    name: "launch-gate-test-breaker",
    failureThreshold: 2,
    cooldownMs: 5_000,
    successThreshold: 1,
    now: () => clock,
  });
  assert.equal(breaker.getState(), "CLOSED");
  await assert.rejects(() => breaker.execute(async () => { throw new Error("fail 1"); }));
  await assert.rejects(() => breaker.execute(async () => { throw new Error("fail 2"); }));
  assert.equal(breaker.getState(), "OPEN");
  await assert.rejects(
    () => breaker.execute(async () => "should not run"),
    (err: unknown) => err instanceof CircuitBreakerOpenError,
  );
  const fallbackVal = await breaker.execute(
    async () => "unreachable",
    () => "fallback-ok",
  );
  assert.equal(fallbackVal, "fallback-ok");
  clock += 6_000;
  assert.equal(breaker.getState(), "HALF_OPEN");
  const recoveredVal = await breaker.execute(async () => "recovered");
  assert.equal(recoveredVal, "recovered");
  assert.equal(breaker.getState(), "CLOSED");

  // Registry check
  const registered = getOrCreateCircuitBreaker({ name: "launch-gate-shared" });
  assert.equal(getOrCreateCircuitBreaker({ name: "launch-gate-shared" }), registered);

  // Runtime verification: Bounded Memory Cache Store (lib/cache.ts)
  let cacheClock = 10_000;
  const boundedCache = createMemoryCacheStore(() => cacheClock, 3);
  await boundedCache.set("k1", "v1", 60);
  await boundedCache.set("k2", "v2", 60);
  await boundedCache.set("k3", "v3", 60);
  await boundedCache.set("k4", "v4", 60);
  assert.equal(await boundedCache.get("k1"), null, "Oldest entry k1 must be evicted when maxEntries=3 is exceeded");
  assert.equal(await boundedCache.get("k4"), "v4");
  cacheClock += 61_000;
  assert.equal(await boundedCache.get("k4"), null, "Expired entry must return null");
}

// ─── 5. GDPR Cascade Deletion Completeness (accountDeletion.ts) ────────────────
{
  const accountDeletionSource = readSrc("./services/accountDeletion.ts");
  const expectedCategories = [
    "auth-provider",
    "profile",
    "journal",
    "trader-process",
    "trading-data",
    "push-notifications",
    "social-community",
    "chat-security",
    "broker-connections",
    "supporting-preferences",
  ] as const;

  for (const cat of expectedCategories) {
    assert.ok(
      ACCOUNT_DELETION_CATEGORIES.includes(cat),
      `ACCOUNT_DELETION_CATEGORIES must include ${cat}`,
    );
  }

  const disclosure = getAccountDeletionDisclosure();
  assert.equal(disclosure.confirmationPhrase, "ELIMINA");
  assert.ok(disclosure.deletedData.length >= 5);
  assert.ok(disclosure.retainedData.length >= 2);

  const criticalTablesErased = [
    "backtest_chart_preferences",
    "post_comments",
    "post_likes",
    "posts",
    "follows",
    "chat_messages",
    "friendships",
    "user_public_keys",
    "user_e2ee_key_backups",
    "global_chat_messages",
    "chat_file_access",
    "signals",
    "voice_presence",
    "community_files",
    "community_messages",
    "community_members",
    "community_join_requests",
    "community_channel_entitlements",
    "community_channels",
    "community_review_reports",
    "community_reviews",
    "community_message_reports",
    "community_roles",
    "community_bans",
    "community_mutes",
    "community_moderation_log",
    "communities",
    "journal_images",
    "process_reviews",
    "process_advancements",
    "process_evidence",
    "process_sessions",
    "process_improvements",
    "process_drafts",
    "process_methods",
    "account_trades",
    "journal_recaps",
    "journal_tags",
    "journal_entries",
    "backtest_trades",
    "backtest_sessions",
    "backtest_tournament_entries",
    "backtest_tribe_presets",
    "broker_profile_store",
    "routine_completions",
    "market_decisions",
    "news_feedback",
    "news_preferences",
    "level_certificates",
    "missions",
    "mission_templates",
    "checkins",
    "checklist_items",
    "ideas",
    "quotes",
    "push_subscriptions",
    "user_settings",
    "honor_seals",
    "financial_profiles",
    "login_access",
    "wiki_ingest_jobs",
    "wiki_sources",
    "wiki_folders",
    "support_ticket_messages",
    "support_tickets",
    "tournament_enrollments",
    "tournament_prizes",
    "tournament_standings",
    "tournament_certificates",
    "testimonials",
    "review_prompt_state",
    "sem_attributions",
    "admin_user_subscriptions",
    "admin_user_status",
    "admin_users",
    "candidate_applications",
    "referral_codes",
    "referrals",
    "launch_emails",
    "school_requests",
    "email_lifecycle_state",
    "creator_payout_accounts",
    "academy_weekly_submissions",
    "academy_progress",
    "academy_affiliates",
    "academy_subscriptions",
    "academy_attributions",
    "arsenal_orders",
    "sessions",
    "profile",
    "users",
  ];

  for (const table of criticalTablesErased) {
    assert.match(
      accountDeletionSource,
      new RegExp(`DELETE FROM\\s+${table}\\b`),
      `GDPR cascade deletion must explicitly erase rows from ${table}`,
    );
  }

  // Verify PII anonymization on retained financial/audit tables
  assert.match(accountDeletionSource, /UPDATE admin_audit_logs SET ip_address = NULL, user_agent = NULL/);
  assert.match(accountDeletionSource, /UPDATE academy_commissions SET buyer_user_id = 'deleted_user'/);
  assert.match(accountDeletionSource, /UPDATE academy_payouts SET affiliate_user_id = 'deleted_user'/);
}

// ─── 6. Service Role (SERVICE_ROLE) Horizontal Scalability Separation ──────────
{
  assert.equal(getServiceRole({}), "all");
  assert.equal(getServiceRole({ SERVICE_ROLE: "invalid" }), "all");
  assert.equal(getServiceRole({ SERVICE_ROLE: "API" }), "api");
  assert.equal(getServiceRole({ SERVICE_ROLE: "GATEWAY" }), "gateway");
  assert.equal(getServiceRole({ SERVICE_ROLE: "WORKER" }), "worker");

  // 'all' role runs everything
  assert.equal(shouldRunHttpApi("all"), true);
  assert.equal(shouldRunWebSockets("all"), true);
  assert.equal(shouldRunSchedulers("all"), true);

  // 'api' role runs only stateless HTTP API
  assert.equal(shouldRunHttpApi("api"), true);
  assert.equal(shouldRunWebSockets("api"), false);
  assert.equal(shouldRunSchedulers("api"), false);

  // 'gateway' role runs WebSocket hubs
  assert.equal(shouldRunHttpApi("gateway"), false);
  assert.equal(shouldRunWebSockets("gateway"), true);
  assert.equal(shouldRunSchedulers("gateway"), false);

  // 'worker' role runs background schedulers & cron jobs
  assert.equal(shouldRunHttpApi("worker"), false);
  assert.equal(shouldRunWebSockets("worker"), false);
  assert.equal(shouldRunSchedulers("worker"), true);
}

console.log("public launch security, stability & compatibility gate checks passed (100%)");
