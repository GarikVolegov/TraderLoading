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
