// Append-only moderation audit trail. Records who did what to whom (ban, kick,
// mute, role change, message delete, role CRUD) so community moderation is
// accountable (finding 2.9). The row builder is pure and unit-tested; the writer
// is best-effort and must never throw — audit logging cannot break the action it
// records.

import { db as defaultDb, communityModerationLogTable } from "@workspace/db";
import logger from "../lib/logger.js";

export const MODERATION_ACTIONS = [
  "member.ban",
  "member.unban",
  "member.mute",
  "member.unmute",
  "member.kick",
  "member.role_change",
  "message.delete",
  "file.delete",
  "channel.delete",
  "review.hide",
  "review.unhide",
  "role.create",
  "role.update",
  "role.delete",
] as const;

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export interface ModerationLogInput {
  communityId: number;
  /** The moderator performing the action (never the target). */
  actorUserId: string;
  action: ModerationAction;
  targetUserId?: string | null;
  targetId?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface ModerationLogRow {
  communityId: number;
  actorUserId: string;
  action: ModerationAction;
  targetUserId: string | null;
  targetId: number | null;
  metadata: string | null;
}

const METADATA_MAX = 2000;

function serializeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  const json = JSON.stringify(metadata);
  // Stay valid JSON while bounding the row size (defense-in-depth; callers already
  // cap free-text like reason).
  return json.length <= METADATA_MAX ? json : JSON.stringify({ note: "metadata_truncated", size: json.length });
}

export function buildModerationLogEntry(input: ModerationLogInput): ModerationLogRow {
  return {
    communityId: input.communityId,
    actorUserId: input.actorUserId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    targetId: input.targetId ?? null,
    metadata: serializeMetadata(input.metadata),
  };
}

export async function recordModerationAction(
  input: ModerationLogInput,
  database: typeof defaultDb = defaultDb,
): Promise<void> {
  try {
    await database.insert(communityModerationLogTable).values(buildModerationLogEntry(input));
  } catch (err) {
    logger.warn({ err, action: input.action }, "Failed to record community moderation action");
  }
}
