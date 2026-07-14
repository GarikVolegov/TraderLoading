// Granular permission model for communities.
//
// The community creator is the implicit owner and always passes every check
// (see getMemberContext / hasPermission). Every other member derives their
// capabilities from the `permissions` array of their assigned role.

import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  communitiesTable,
  communityMembersTable,
  communityRolesTable,
  communityBansTable,
  communityMutesTable,
} from "@workspace/db";

export const COMMUNITY_PERMISSIONS = [
  "community.manage", // edit settings / customization
  "channels.manage", // create / delete / reorder channels
  "messages.moderate", // delete other members' messages
  "files.manage", // toggle downloadable / delete others' files
  "roles.manage", // create / edit / delete / assign roles
  "members.kick", // remove members
  "members.ban", // ban / unban members
  "members.mute", // mute / unmute members
  "reviews.respond", // reply to reviews (phase 3)
  "reviews.moderate", // hide reported reviews (phase 3)
] as const;

export type CommunityPermission = (typeof COMMUNITY_PERMISSIONS)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set(COMMUNITY_PERMISSIONS);

/** Permission set of the auto-seeded default "Membro" role (no privileges). */
export const DEFAULT_MEMBER_PERMISSIONS: CommunityPermission[] = [];

/** Permission set of the auto-seeded "Admin" role (every privilege). */
export const ADMIN_ROLE_PERMISSIONS: CommunityPermission[] = [...COMMUNITY_PERMISSIONS];

/** True when the actor may perform `perm`: owners always, others by role set. */
export function hasPermission(
  actor: { isOwner: boolean; permissions: string[] },
  perm: CommunityPermission,
): boolean {
  if (actor.isOwner) return true;
  return actor.permissions.includes(perm);
}

/**
 * Whether a mute is in effect at `now`. `null` = no mute row; a row with
 * `until === null` is an indefinite mute; otherwise it lapses at `until`.
 */
export function isMuteActive(mute: { until: Date | null } | null, now: Date): boolean {
  if (!mute) return false;
  if (mute.until === null) return true;
  return mute.until.getTime() > now.getTime();
}

// ─── Role hierarchy ───────────────────────────────────────────────────────────
// A member's "rank" is their role's `position` (higher = more senior); the
// community owner sits above every role. Privileged actions require the actor
// to STRICTLY outrank the role/member they act on, so a `roles.manage` holder
// can't edit the Admin role, promote themselves to it, or moderate a peer.

/** The owner is above any role position. */
export const OWNER_RANK = Number.POSITIVE_INFINITY;
/** A member with no assigned role is below any positioned role. */
export const NO_ROLE_RANK = Number.NEGATIVE_INFINITY;

export function memberRank(actor: { isOwner: boolean; rolePosition: number | null }): number {
  if (actor.isOwner) return OWNER_RANK;
  return actor.rolePosition ?? NO_ROLE_RANK;
}

/** True when `actorRank` may act on something at `targetRank` (strictly above). */
export function outranks(actorRank: number, targetRank: number): boolean {
  return actorRank > targetRank;
}

/** Owners may grant any permission; others only permissions they already hold. */
export function canGrantPermissions(
  actor: { isOwner: boolean; permissions: string[] },
  desired: string[],
): boolean {
  if (actor.isOwner) return true;
  const held = new Set(actor.permissions);
  return desired.every((perm) => held.has(perm));
}

/** Keep only valid, de-duplicated permission keys from untrusted input. */
export function sanitizePermissions(input: unknown): CommunityPermission[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const value of input) {
    if (typeof value === "string" && PERMISSION_SET.has(value)) seen.add(value);
  }
  return [...seen] as CommunityPermission[];
}

// ─── DB-backed resolution (not pure; thin glue over the helpers above) ─────────

export interface MemberContext {
  communityId: number;
  userId: string;
  communityExists: boolean;
  isMember: boolean;
  isOwner: boolean;
  roleId: number | null;
  rolePosition: number | null;
  permissions: CommunityPermission[];
  isBanned: boolean;
  mute: { until: Date | null } | null;
}

/** Resolve everything a route needs to authorize an action in one read. */
export async function getMemberContext(communityId: number, userId: string): Promise<MemberContext> {
  const base: MemberContext = {
    communityId,
    userId,
    communityExists: false,
    isMember: false,
    isOwner: false,
    roleId: null,
    rolePosition: null,
    permissions: [],
    isBanned: false,
    mute: null,
  };

  const [community] = await db
    .select({ creatorId: communitiesTable.creatorId })
    .from(communitiesTable)
    .where(eq(communitiesTable.id, communityId))
    .limit(1);
  if (!community) return base;
  base.communityExists = true;
  base.isOwner = community.creatorId === userId;

  const [membership] = await db
    .select({ roleId: communityMembersTable.roleId })
    .from(communityMembersTable)
    .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, userId)))
    .limit(1);
  base.isMember = !!membership;
  base.roleId = membership?.roleId ?? null;

  if (membership?.roleId != null) {
    const [role] = await db
      .select({
        permissions: communityRolesTable.permissions,
        position: communityRolesTable.position,
      })
      .from(communityRolesTable)
      .where(eq(communityRolesTable.id, membership.roleId))
      .limit(1);
    base.permissions = sanitizePermissions(role?.permissions);
    base.rolePosition = role?.position ?? null;
  }

  const [ban] = await db
    .select({ id: communityBansTable.id })
    .from(communityBansTable)
    .where(and(eq(communityBansTable.communityId, communityId), eq(communityBansTable.userId, userId)))
    .limit(1);
  base.isBanned = !!ban;

  const [mute] = await db
    .select({ until: communityMutesTable.until })
    .from(communityMutesTable)
    .where(and(eq(communityMutesTable.communityId, communityId), eq(communityMutesTable.userId, userId)))
    .limit(1);
  base.mute = mute ? { until: mute.until ?? null } : null;

  return base;
}

/**
 * Hierarchy rank of a target member (owner > role position > no role), for the
 * outranks() checks that gate moderation and role assignment.
 */
export async function getMemberRank(communityId: number, userId: string): Promise<number> {
  const [community] = await db
    .select({ creatorId: communitiesTable.creatorId })
    .from(communitiesTable)
    .where(eq(communitiesTable.id, communityId))
    .limit(1);
  if (community?.creatorId === userId) return OWNER_RANK;

  const [membership] = await db
    .select({ roleId: communityMembersTable.roleId })
    .from(communityMembersTable)
    .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, userId)))
    .limit(1);
  if (!membership || membership.roleId == null) return NO_ROLE_RANK;

  const [role] = await db
    .select({ position: communityRolesTable.position })
    .from(communityRolesTable)
    .where(eq(communityRolesTable.id, membership.roleId))
    .limit(1);
  return role?.position ?? NO_ROLE_RANK;
}

/**
 * Express guard: 401 if unauthenticated, 404 if the community is gone, 403 if
 * the caller is not a member or lacks `perm`. Returns the resolved context on
 * success (so callers can reuse it), or null when a response was already sent.
 */
export async function requirePermission(
  req: Request,
  res: Response,
  communityId: number,
  perm: CommunityPermission,
): Promise<MemberContext | null> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return null;
  }
  const ctx = await getMemberContext(communityId, userId);
  if (!ctx.communityExists) {
    res.status(404).json({ error: "Community non trovata" });
    return null;
  }
  if (!ctx.isMember && !ctx.isOwner) {
    res.status(403).json({ error: "Non sei membro di questa community" });
    return null;
  }
  if (!hasPermission(ctx, perm)) {
    res.status(403).json({ error: "Permesso negato" });
    return null;
  }
  return ctx;
}
