import { clerkClient } from "@clerk/express";
import { adminAuditLogsTable, adminUserStatusTable, db } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

export async function isClerkSessionRevoked(userId: string, sessionId: string): Promise<boolean> {
  const [record] = await db.select({ id: adminAuditLogsTable.id }).from(adminAuditLogsTable).where(and(
    eq(adminAuditLogsTable.targetType, "user"), eq(adminAuditLogsTable.targetId, userId),
    eq(adminAuditLogsTable.action, "users.revoke_sessions"),
    sql`${adminAuditLogsTable.after}->'clerkSessionIds' @> ${JSON.stringify([sessionId])}::jsonb`,
  )).limit(1);
  return Boolean(record);
}
export async function isSocketAccountActive(userId: string): Promise<boolean> {
  const [status] = await db.select({ status: adminUserStatusTable.status }).from(adminUserStatusTable).where(eq(adminUserStatusTable.userId, userId)).limit(1);
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
