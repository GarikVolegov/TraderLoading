import { adminAuditLogsTable, db } from "@workspace/db";
import type { Request } from "express";
import type { AdminPrincipal } from "../lib/adminPermissions.js";

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|private|credential|auth|p256dh|brokerSecret|jwk)/i;

export function normalizeAuditReason(
  reason: string | null | undefined,
): string | null {
  const trimmed = reason?.trim();
  return trimmed ? trimmed : null;
}

export function redactAdminSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAdminSnapshot(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key)
          ? "[redacted]"
          : redactAdminSnapshot(nested),
      ]),
    );
  }

  return value;
}

export interface WriteAdminAuditInput {
  req: Request;
  admin: AdminPrincipal;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function writeAdminAudit(
  input: WriteAdminAuditInput,
): Promise<void> {
  await db.insert(adminAuditLogsTable).values({
    actorUserId: input.admin.userId,
    actorRole: input.admin.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: normalizeAuditReason(input.reason),
    before: input.before == null ? null : redactAdminSnapshot(input.before),
    after: input.after == null ? null : redactAdminSnapshot(input.after),
    ipAddress: input.req.ip ?? input.req.socket?.remoteAddress ?? null,
    userAgent: input.req.headers["user-agent"] ?? null,
    requestId: input.req.headers["x-request-id"]?.toString() ?? null,
  });
}
