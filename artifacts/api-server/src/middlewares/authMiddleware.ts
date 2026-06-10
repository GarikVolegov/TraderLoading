import { getAuth } from "@clerk/express";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { adminUserStatusTable, db, loginAccessTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import logger, { requestContext, type RequestContext } from "../lib/logger";
import { getSession, getSessionId, type SessionData } from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

// In-memory dedup cache: "userId:ip" → last-logged timestamp (ms)
const recentAccess = new Map<string, number>();
const DEDUP_TTL = 60 * 60 * 1000; // 1 hour

function getClientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function isAccountAllowedByAdminStatus(
  status: { status: string } | null | undefined,
): boolean {
  return !status || status.status === "active";
}

async function recordAccess(
  userId: string,
  ip: string,
  userAgent: string | undefined,
) {
  const key = `${userId}:${ip}`;
  const now = Date.now();
  const last = recentAccess.get(key);
  if (last && now - last < DEDUP_TTL) return; // already logged recently

  recentAccess.set(key, now);

  // Also check DB — avoid duplicates surviving a server restart (within 1 h)
  const since = new Date(now - DEDUP_TTL);
  const [existing] = await db
    .select({ id: loginAccessTable.id })
    .from(loginAccessTable)
    .where(
      and(
        eq(loginAccessTable.userId, userId),
        eq(loginAccessTable.ipAddress, ip),
        gte(loginAccessTable.createdAt, since),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(loginAccessTable).values({
      userId,
      ipAddress: ip,
      userAgent: userAgent ?? null,
    });
  }
}

// ── Inietta userId nel contesto AsyncLocalStorage per il logging distribuito ──
type AuthMiddlewareDeps = {
  getClerkUserId?: (req: Request) => string | null | undefined;
  getStoredSession?: (sid: string) => Promise<SessionData | null>;
  getAdminStatus?: (userId: string) => Promise<{ status: string } | null>;
  recordAccess?: (
    userId: string,
    ip: string,
    userAgent: string | undefined,
  ) => Promise<void>;
  warn?: (error: unknown, message: string) => void;
};

function setAuthenticatedUser(req: Request, user: AuthUser) {
  req.user = user;

  const store = requestContext.getStore() as RequestContext | undefined;
  if (store) {
    store.userId = user.id;
  }
}

export function createAuthMiddleware(deps: AuthMiddlewareDeps = {}) {
  const getClerkUserId =
    deps.getClerkUserId ?? ((req: Request) => getAuth(req).userId);
  const getStoredSession = deps.getStoredSession ?? getSession;
  const getAdminStatus =
    deps.getAdminStatus ??
    (async (userId: string) => {
      const [adminStatus] = await db
        .select({ status: adminUserStatusTable.status })
        .from(adminUserStatusTable)
        .where(eq(adminUserStatusTable.userId, userId))
        .limit(1);

      return adminStatus ?? null;
    });
  const recordLoginAccess = deps.recordAccess ?? recordAccess;
  const warn =
    deps.warn ??
    ((error: unknown, message: string) => {
      logger.warn({ err: error }, message);
    });

  return async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ) {
    req.isAuthenticated = function (this: Request) {
      return this.user != null;
    } as Request["isAuthenticated"];

    let clerkUserId: string | null | undefined;
    try {
      clerkUserId = getClerkUserId(req);
    } catch (error) {
      warn(error, "Clerk auth lookup failed");
    }

    if (clerkUserId) {
      setAuthenticatedUser(req, {
        id: clerkUserId,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      });
    } else {
      const sid = getSessionId(req);
      let storedSession: SessionData | null = null;
      try {
        storedSession = sid ? await getStoredSession(sid) : null;
      } catch (error) {
        warn(error, "Stored session lookup failed");
      }

      if (storedSession) {
        setAuthenticatedUser(req, storedSession.user);
      }
    }

    if (req.user) {
      let adminStatus: { status: string } | null = null;
      try {
        adminStatus = await getAdminStatus(req.user.id);
      } catch (error) {
        warn(error, "Admin status lookup failed");
      }

      if (!isAccountAllowedByAdminStatus(adminStatus ?? null)) {
        req.user = undefined;
        next();
        return;
      }

      const ip = getClientIp(req);
      const ua = req.headers["user-agent"];
      recordLoginAccess(req.user.id, ip, ua).catch((error) => {
        warn(error, "Login access logging failed");
      });
    }

    next();
  };
}

export const authMiddleware = createAuthMiddleware();
