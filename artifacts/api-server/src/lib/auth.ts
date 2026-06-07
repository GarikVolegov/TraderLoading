import * as client from "openid-client";
import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";

type Env = Record<string, string | undefined>;

export const DEFAULT_ISSUER_URL = "https://replit.com/oidc";
export const ISSUER_URL = process.env.ISSUER_URL ?? DEFAULT_ISSUER_URL;
export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

export interface SessionData {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

let oidcConfig: client.Configuration | null = null;

export function getValidatedOidcSettings(env: Env = process.env) {
  const issuerUrl = env.ISSUER_URL?.trim() || DEFAULT_ISSUER_URL;
  let parsedIssuer: URL;

  try {
    parsedIssuer = new URL(issuerUrl);
  } catch {
    throw new Error("ISSUER_URL must be a valid URL.");
  }

  if (
    parsedIssuer.protocol !== "https:" &&
    parsedIssuer.hostname !== "localhost"
  ) {
    throw new Error("ISSUER_URL must use https unless it targets localhost.");
  }

  const clientId = (env.OIDC_CLIENT_ID ?? env.REPL_ID)?.trim();
  if (!clientId) {
    throw new Error(
      "OIDC_CLIENT_ID or REPL_ID is required for Replit OIDC. Set OIDC_CLIENT_ID for generic OIDC providers or REPL_ID on Replit.",
    );
  }

  return {
    clientId,
    issuerUrl: parsedIssuer.href.replace(/\/$/, ""),
  };
}

export async function getOidcConfig(): Promise<client.Configuration> {
  if (!oidcConfig) {
    const settings = getValidatedOidcSettings();
    oidcConfig = await client.discovery(
      new URL(settings.issuerUrl),
      settings.clientId,
    );
  }
  return oidcConfig;
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  await db
    .update(sessionsTable)
    .set({
      sess: data as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}
