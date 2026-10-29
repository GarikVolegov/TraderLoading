import { clerkClient } from "@clerk/express";
import { adminAuditLogsTable, adminUserStatusTable, db } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { singleFlight } from "../lib/singleFlight.js";

const SECURITY_CACHE_TTL_MS = 30_000;
const SECURITY_CACHE_MAX_ENTRIES = 5_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const revokedSessionCache = new Map<string, CacheEntry<boolean>>();
const revokedSessionInFlight = new Map<string, Promise<boolean>>();

const adminStatusCache = new Map<string, CacheEntry<{ status: string } | null>>();
const adminStatusInFlight = new Map<string, Promise<{ status: string } | null>>();

function setBoundedCache<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs = SECURITY_CACHE_TTL_MS): void {
  const now = Date.now();
  if (map.size >= SECURITY_CACHE_MAX_ENTRIES && !map.has(key)) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
  map.set(key, { value, expiresAt: now + ttlMs });
}

function getValidCache<T>(map: Map<string, CacheEntry<T>>, key: string): { hit: true; value: T } | { hit: false } {
  const entry = map.get(key);
  if (!entry) return { hit: false };
  if (entry.expiresAt <= Date.now()) {
    map.delete(key);
    return { hit: false };
  }
  return { hit: true, value: entry.value };
}

/**
 * Immediately evicts cached admin status and session revocation checks for `userId`.
 * Called whenever an admin suspends/reactivates a user or revokes their sessions.
 */
export function invalidateUserSecurityCache(userId: string): void {
  adminStatusCache.delete(userId);
  adminStatusInFlight.delete(userId);
  const prefix = `${userId}:`;
  for (const key of revokedSessionCache.keys()) {
    if (key.startsWith(prefix)) {
      revokedSessionCache.delete(key);
    }
  }
  for (const key of revokedSessionInFlight.keys()) {
    if (key.startsWith(prefix)) {
      revokedSessionInFlight.delete(key);
    }
  }
}

export function clearSecurityCacheForTesting(): void {
  revokedSessionCache.clear();
  revokedSessionInFlight.clear();
  adminStatusCache.clear();
  adminStatusInFlight.clear();
}

export async function isClerkSessionRevoked(
  userId: string,
  sessionId: string,
  queryRevoked?: (u: string, s: string) => Promise<boolean>,
): Promise<boolean> {
  const cacheKey = `${userId}:${sessionId}`;
  if (!queryRevoked) {
    const cached = getValidCache(revokedSessionCache, cacheKey);
    if (cached.hit) return cached.value;
  }

  const runQuery =
    queryRevoked ??
    (async (u: string, s: string) => {
      const [record] = await db
        .select({ id: adminAuditLogsTable.id })
        .from(adminAuditLogsTable)
        .where(
          and(
            eq(adminAuditLogsTable.targetType, "user"),
            eq(adminAuditLogsTable.targetId, u),
            eq(adminAuditLogsTable.action, "users.revoke_sessions"),
            sql`${adminAuditLogsTable.after}->'clerkSessionIds' @> ${JSON.stringify([s])}::jsonb`,
          ),
        )
        .limit(1);
      return Boolean(record);
    });

  if (queryRevoked) {
    return runQuery(userId, sessionId);
  }

  return singleFlight(revokedSessionInFlight, cacheKey, async () => {
    const revoked = await runQuery(userId, sessionId);
    setBoundedCache(revokedSessionCache, cacheKey, revoked);
    return revoked;
  });
}

export async function getCachedAdminUserStatus(
  userId: string,
  queryStatus?: (u: string) => Promise<{ status: string } | null>,
): Promise<{ status: string } | null> {
  if (!queryStatus) {
    const cached = getValidCache(adminStatusCache, userId);
    if (cached.hit) return cached.value;
  }

  const runQuery =
    queryStatus ??
    (async (u: string) => {
      const [adminStatus] = await db
        .select({ status: adminUserStatusTable.status })
        .from(adminUserStatusTable)
        .where(eq(adminUserStatusTable.userId, u))
        .limit(1);
      return adminStatus ?? null;
    });

  if (queryStatus) {
    return runQuery(userId);
  }

  return singleFlight(adminStatusInFlight, userId, async () => {
    const status = await runQuery(userId);
    setBoundedCache(adminStatusCache, userId, status);
    return status;
  });
}

export async function isSocketAccountActive(userId: string): Promise<boolean> {
  const status = await getCachedAdminUserStatus(userId);
  return !status || status.status === "active";
}

export async function listClerkSessions(userId: string): Promise<string[]> {
  // Stored-session identities have no Clerk account.
  if (!userId.startsWith("user_")) return [];
  if (!process.env.CLERK_SECRET_KEY?.trim()) throw new Error("Clerk revocation unavailable");
  const ids: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await clerkClient.sessions.getSessionList({ userId, status: "active", limit: 100, offset });
    ids.push(...page.data.map(session => session.id));
    if (page.data.length < 100 || offset + page.data.length >= page.totalCount) return ids;
  }
}

export async function revokeClerkSessions(ids: string[]): Promise<void> {
  for (const id of ids) await clerkClient.sessions.revokeSession(id);
}
