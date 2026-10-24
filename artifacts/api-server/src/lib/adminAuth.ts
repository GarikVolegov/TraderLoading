import { adminUsersTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import {
  hasAdminPermission,
  resolveAdminPrincipal,
  type AdminPermission,
  type AdminPrincipal,
} from "./adminPermissions.js";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPrincipal;
    }
  }
}

export async function getAdminPrincipalForUser(
  userId: string,
): Promise<AdminPrincipal | null> {
  const [adminUser] = await db
    .select({ role: adminUsersTable.role, status: adminUsersTable.status })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.userId, userId))
    .limit(1);

  return resolveAdminPrincipal(userId, adminUser ?? null);
}

export function requireAdmin(permission: AdminPermission) {
  return async function adminGuard(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (!req.user?.id) {
      res.status(401).json({ error: "Non autenticato" });
      return;
    }

    const principal = await getAdminPrincipalForUser(req.user.id);
    if (!principal || !hasAdminPermission(principal.role, permission)) {
      res.status(403).json({ error: "Permesso admin insufficiente" });
      return;
    }

    req.admin = principal;
    next();
  };
}

/** Content tools share DB roles; legacy platform IDs apply only without a DB role. */
export async function canPublishPlatformContent(userId: string): Promise<boolean> {
  const principal = await getAdminPrincipalForUser(userId);
  if (principal) return hasAdminPermission(principal.role, "content.publish");
  const [storedRole] = await db.select({ status: adminUsersTable.status }).from(adminUsersTable).where(eq(adminUsersTable.userId, userId)).limit(1);
  if (storedRole) return false;
  return (process.env.PLATFORM_ADMIN_IDS || "").split(",").map(id => id.trim()).filter(Boolean).includes(userId);
}

/** Owner-only for LIMEN training. Staff permissions never imply ownership. */
export async function isLimenOwner(userId: string): Promise<boolean> {
  const ownerId = process.env.LIMEN_OWNER_USER_ID?.trim();
  if (!ownerId || userId !== ownerId) return false;
  return Boolean(await getAdminPrincipalForUser(userId));
}
