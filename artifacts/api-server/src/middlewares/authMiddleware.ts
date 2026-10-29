import { getCachedAdminUserStatus, isClerkSessionRevoked } from "../services/sessionRevocation.js";
import { getAuth } from "@clerk/express";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { db, loginAccessTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import logger, { requestContext, type RequestContext } from "../lib/logger";
import { getSession, getSessionId, type SessionData } from "../lib/auth";
import { createLoginAccessRecorder } from "../services/loginAccessRecorder.js";

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

function getClientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function isAccountAllowedByAdminStatus(
  status: { status: string } | null | undefined,
): boolean {
  return !status || status.status === "active";
}

const recordAccess = createLoginAccessRecorder({
  async findRecent(userId, ip, since) {
    const [existing] = await db.select({ id: loginAccessTable.id }).from(loginAccessTable)
      .where(and(eq(loginAccessTable.userId, userId), eq(loginAccessTable.ipAddress, ip), gte(loginAccessTable.createdAt, since))).limit(1);
    return Boolean(existing);
  },
  async insert(access) { await db.insert(loginAccessTable).values(access); },
});

// ── Inietta userId nel contesto AsyncLocalStorage per il logging distribuito ──
type AuthMiddlewareDeps = {
  getClerkUserId?: (req: Request) => string | null | undefined;
  getClerkSessionId?: (req: Request) => string | null;
  isSessionRevoked?: (userId: string, sessionId: string) => Promise<boolean>;
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
    deps.getClerkUserId ??
    ((req: Request) => {
      if (
        process.env.NODE_ENV !== "production" &&
        !process.env.CLERK_SECRET_KEY?.trim()
      ) {
        return null;
      }

      return getAuth(req).userId;
    });
  const getClerkSessionId = deps.getClerkSessionId ?? (deps.getClerkUserId ? () => null : (req: Request) => getAuth(req).sessionId);
  const isSessionRevoked = deps.isSessionRevoked ?? isClerkSessionRevoked;
  const getStoredSession = deps.getStoredSession ?? getSession;
  const getAdminStatus =
    deps.getAdminStatus ??
    ((userId: string) => getCachedAdminUserStatus(userId));
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
      try {
        const sessionId = getClerkSessionId(req);
        if (sessionId && await isSessionRevoked(clerkUserId, sessionId)) { next(); return; }
      } catch (error) {
        warn(error, "Session revocation lookup failed");
        _res.status(503).json({ error: "Verifica accesso temporaneamente non disponibile" });
        return;
      }
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
        req.user = undefined;
        _res.status(503).json({ error: "Verifica accesso temporaneamente non disponibile" });
        return;
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
