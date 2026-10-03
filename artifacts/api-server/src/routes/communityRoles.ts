import { Router, type IRouter } from "express";
import { db, communitiesTable, communityMembersTable, communityRolesTable, profileTable } from "@workspace/db";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import {
  getMemberContext,
  getMemberRank,
  requirePermission,
  sanitizePermissions,
  memberRank,
  outranks,
  canGrantPermissions,
  COMMUNITY_PERMISSIONS,
} from "../services/communityPermissions.js";
import { recordModerationAction } from "../services/communityModerationLog.js";

const router: IRouter = Router();

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
function sanitizeColor(value: unknown): string | null {
  return typeof value === "string" && HEX_COLOR.test(value.trim()) ? value.trim() : null;
}

/** Require the caller to be a member (or owner) of `communityId`; sends 401/404/403. */
async function requireMembership(req: Parameters<typeof requirePermission>[0], res: Parameters<typeof requirePermission>[1], communityId: number) {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return null; }
  const ctx = await getMemberContext(communityId, userId);
  if (!ctx.communityExists) { res.status(404).json({ error: "Community non trovata" }); return null; }
  if (!ctx.isMember && !ctx.isOwner) { res.status(403).json({ error: "Non sei membro di questa community" }); return null; }
  return ctx;
}

// ─── Permission catalog (for the role editor) ─────────────────────────────────
router.get("/community/:id/permissions-catalog", async (req, res) => {
  const communityId = parseInt(req.params.id);
  if (!(await requireMembership(req, res, communityId))) return;
  res.json({ permissions: [...COMMUNITY_PERMISSIONS] });
});

// ─── List roles ───────────────────────────────────────────────────────────────
router.get("/community/:id/roles", async (req, res) => {
  const communityId = parseInt(req.params.id);
  if (!(await requireMembership(req, res, communityId))) return;
  try {
    const roles = await db
      .select()
      .from(communityRolesTable)
      .where(eq(communityRolesTable.communityId, communityId))
      .orderBy(asc(communityRolesTable.position));
    res.json(roles);
  } catch (err) {
    console.error("GET /community/:id/roles error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Create role ────────────────────────────────────────────────────────────────
router.post("/community/:id/roles", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "roles.manage");
  if (!ctx) return;
  try {
    const { name, color, permissions } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Nome ruolo richiesto" });
      return;
    }
    const desiredPermissions = sanitizePermissions(permissions);
    // Can't create a role granting permissions you don't hold yourself.
    if (!canGrantPermissions(ctx, desiredPermissions)) {
      res.status(403).json({ error: "Non puoi concedere permessi che non possiedi" });
      return;
    }
    const [last] = await db
      .select({ position: communityRolesTable.position })
      .from(communityRolesTable)
      .where(eq(communityRolesTable.communityId, communityId))
      .orderBy(desc(communityRolesTable.position))
      .limit(1);
    const [role] = await db
      .insert(communityRolesTable)
      .values({
        communityId,
        name: name.trim().slice(0, 40),
        color: sanitizeColor(color),
        permissions: desiredPermissions,
        position: last ? last.position + 1 : 0,
        isDefault: false,
      })
      .returning();
    await recordModerationAction({ communityId, actorUserId: ctx.userId, action: "role.create", targetId: role.id, metadata: { name: role.name, permissions: desiredPermissions } });
    res.status(201).json(role);
  } catch (err) {
    console.error("POST /community/:id/roles error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Update role ────────────────────────────────────────────────────────────────
router.patch("/community/roles/:roleId", async (req, res) => {
  const roleId = parseInt(req.params.roleId);
  try {
    const [role] = await db.select().from(communityRolesTable).where(eq(communityRolesTable.id, roleId)).limit(1);
    if (!role) { res.status(404).json({ error: "Ruolo non trovato" }); return; }
    const ctx = await requirePermission(req, res, role.communityId, "roles.manage");
    if (!ctx) return;
    // Can only edit roles strictly below your own rank (blocks editing the Admin
    // role or your own role to escalate).
    if (!outranks(memberRank(ctx), role.position)) {
      res.status(403).json({ error: "Non puoi modificare un ruolo di livello pari o superiore al tuo" });
      return;
    }

    const update: Partial<{ name: string; color: string | null; permissions: string[] }> = {};
    if (typeof req.body.name === "string" && req.body.name.trim().length > 0) {
      update.name = req.body.name.trim().slice(0, 40);
    }
    if ("color" in req.body) update.color = sanitizeColor(req.body.color);
    if ("permissions" in req.body) {
      const desired = sanitizePermissions(req.body.permissions);
      // Can't add permissions to a role that you don't hold yourself.
      if (!canGrantPermissions(ctx, desired)) {
        res.status(403).json({ error: "Non puoi concedere permessi che non possiedi" });
        return;
      }
      update.permissions = desired;
    }
    if (Object.keys(update).length === 0) { res.status(400).json({ error: "Nessuna modifica" }); return; }

    const [updated] = await db
      .update(communityRolesTable)
      .set(update)
      .where(eq(communityRolesTable.id, roleId))
      .returning();
    await recordModerationAction({ communityId: role.communityId, actorUserId: ctx.userId, action: "role.update", targetId: roleId, metadata: update });
    res.json(updated);
  } catch (err) {
    console.error("PATCH /community/roles/:roleId error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Delete role (reassigns its members to the default role) ─────────────────────
router.delete("/community/roles/:roleId", async (req, res) => {
  const roleId = parseInt(req.params.roleId);
  try {
    const [role] = await db.select().from(communityRolesTable).where(eq(communityRolesTable.id, roleId)).limit(1);
    if (!role) { res.status(404).json({ error: "Ruolo non trovato" }); return; }
    const ctx = await requirePermission(req, res, role.communityId, "roles.manage");
    if (!ctx) return;
    if (!outranks(memberRank(ctx), role.position)) {
      res.status(403).json({ error: "Non puoi eliminare un ruolo di livello pari o superiore al tuo" });
      return;
    }
    if (role.isDefault) { res.status(400).json({ error: "Il ruolo predefinito non può essere eliminato" }); return; }

    const [defaultRole] = await db
      .select({ id: communityRolesTable.id })
      .from(communityRolesTable)
      .where(and(eq(communityRolesTable.communityId, role.communityId), eq(communityRolesTable.isDefault, true)))
      .limit(1);

    await db
      .update(communityMembersTable)
      .set({ roleId: defaultRole?.id ?? null })
      .where(eq(communityMembersTable.roleId, roleId));
    await db.delete(communityRolesTable).where(eq(communityRolesTable.id, roleId));
    await recordModerationAction({ communityId: role.communityId, actorUserId: ctx.userId, action: "role.delete", targetId: roleId, metadata: { name: role.name } });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /community/roles/:roleId error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── List members (with role + profile) ──────────────────────────────────────────
router.get("/community/:id/members", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requireMembership(req, res, communityId);
  if (!ctx) return;
  try {
    const [community] = await db
      .select({ creatorId: communitiesTable.creatorId })
      .from(communitiesTable)
      .where(eq(communitiesTable.id, communityId))
      .limit(1);

    const rows = await db
      .select({
        userId: communityMembersTable.userId,
        roleId: communityMembersTable.roleId,
        joinedAt: communityMembersTable.joinedAt,
        name: profileTable.name,
        avatarUrl: profileTable.avatarUrl,
        roleName: communityRolesTable.name,
        roleColor: communityRolesTable.color,
      })
      .from(communityMembersTable)
      .leftJoin(profileTable, eq(profileTable.userId, communityMembersTable.userId))
      .leftJoin(communityRolesTable, eq(communityRolesTable.id, communityMembersTable.roleId))
      .where(eq(communityMembersTable.communityId, communityId))
      .orderBy(asc(communityMembersTable.joinedAt));

    res.json(
      rows.map((m) => ({
        userId: m.userId,
        name: m.name ?? "Trader",
        avatarUrl: m.avatarUrl ?? null,
        roleId: m.roleId,
        roleName: m.roleName ?? null,
        roleColor: m.roleColor ?? null,
        joinedAt: m.joinedAt,
        isOwner: community?.creatorId === m.userId,
      })),
    );
  } catch (err) {
    console.error("GET /community/:id/members error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Assign a role to a member ───────────────────────────────────────────────────
router.patch("/community/:id/members/:userId/role", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "roles.manage");
  if (!ctx) return;
  try {
    const targetUserId = req.params.userId;
    const actorRank = memberRank(ctx);

    // Can't change the role of someone who ranks at or above you (e.g. another
    // admin or the owner).
    const currentTargetRank = await getMemberRank(communityId, targetUserId);
    if (!outranks(actorRank, currentTargetRank)) {
      res.status(403).json({ error: "Non puoi modificare il ruolo di un membro di livello pari o superiore al tuo" });
      return;
    }

    const roleIdRaw = req.body.roleId;
    let roleId: number | null = null;
    if (roleIdRaw !== null && roleIdRaw !== undefined) {
      roleId = parseInt(String(roleIdRaw));
      const [role] = await db
        .select({ id: communityRolesTable.id, position: communityRolesTable.position })
        .from(communityRolesTable)
        .where(and(eq(communityRolesTable.id, roleId), eq(communityRolesTable.communityId, communityId)))
        .limit(1);
      if (!role) { res.status(400).json({ error: "Ruolo non valido per questa community" }); return; }
      // Can't assign a role at or above your own rank (blocks self-promotion to
      // Admin and handing out roles more senior than yours).
      if (!outranks(actorRank, role.position)) {
        res.status(403).json({ error: "Non puoi assegnare un ruolo di livello pari o superiore al tuo" });
        return;
      }
    }

    const [updated] = await db
      .update(communityMembersTable)
      .set({ roleId })
      .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, targetUserId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Membro non trovato" }); return; }
    await recordModerationAction({ communityId, actorUserId: ctx.userId, action: "member.role_change", targetUserId, targetId: roleId, metadata: { roleId } });
    res.json({ ok: true, userId: targetUserId, roleId });
  } catch (err) {
    console.error("PATCH /community/:id/members/:userId/role error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Kick a member ───────────────────────────────────────────────────────────────
router.delete("/community/:id/members/:userId", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "members.kick");
  if (!ctx) return;
  try {
    const targetUserId = req.params.userId;
    // Can't kick a member who ranks at or above you (owner included).
    if (!outranks(memberRank(ctx), await getMemberRank(communityId, targetUserId))) {
      res.status(403).json({ error: "Non puoi espellere un membro di livello pari o superiore al tuo" });
      return;
    }

    const deleted = await db
      .delete(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, targetUserId)))
      .returning({ id: communityMembersTable.id });
    if (deleted.length === 0) { res.status(404).json({ error: "Membro non trovato" }); return; }

    await db
      .update(communitiesTable)
      .set({ memberCount: sql`GREATEST(${communitiesTable.memberCount} - 1, 0)` })
      .where(eq(communitiesTable.id, communityId));
    await recordModerationAction({ communityId, actorUserId: ctx.userId, action: "member.kick", targetUserId });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /community/:id/members/:userId error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
