import { watchWebSocketAuthorization } from "./webSocketLease.js";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { authenticateRequest, clerkClient } from "@clerk/express";
import { isAllowedWebSocketOrigin } from "../lib/security.js";
import logger from "../lib/logger";

const SESSION_COOKIE = "sid";

export type WebSocketAuthContext = {
  userId: string;
  source: "clerk" | "session";
  sessionId?: string | null;
};

export type WebSocketAuthenticator = (
  request: IncomingMessage,
) => Promise<WebSocketAuthContext | null>;

export interface WebSocketSecurityOptions {
  authenticate?: WebSocketAuthenticator;
  requireProAccess?: (context: WebSocketAuthContext, request: IncomingMessage) => Promise<boolean>;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function sessionIdFromUpgrade(request: IncomingMessage): string | null {
  const authHeader = firstHeader(request.headers.authorization);
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  const cookies = parseCookies(firstHeader(request.headers.cookie));
  return cookies[SESSION_COOKIE] ?? null;
}

async function getClerkAuth(
  request: IncomingMessage,
): Promise<{ userId: string; sessionId: string } | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  try {
    const state = await authenticateRequest({
      clerkClient,
      request: request as never,
      options: { acceptsToken: "any" },
    });
    const auth = state.toAuth();
    if (!auth) return null;
    const { isClerkSessionRevoked } = await import("./sessionRevocation.js");
    if (!auth.userId || !auth.sessionId || await isClerkSessionRevoked(auth.userId, auth.sessionId)) return null;
    return { userId: auth.userId, sessionId: auth.sessionId };
  } catch (err) {
    logger.warn({ err }, "Clerk websocket authentication failed");
    return null;
  }
}

export async function authenticateWebSocketUpgrade(
  request: IncomingMessage,
): Promise<WebSocketAuthContext | null> {
  const { isSocketAccountActive } = await import("./sessionRevocation.js");
  const clerkAuth = await getClerkAuth(request);
  if (clerkAuth) {
    return (await isSocketAccountActive(clerkAuth.userId))
      ? { userId: clerkAuth.userId, source: "clerk", sessionId: clerkAuth.sessionId }
      : null;
  }

  const sid = sessionIdFromUpgrade(request);
  if (!sid) return null;
  const { getSession } = await import("../lib/auth.js");
  const session = await getSession(sid);
  return session?.user.id && (await isSocketAccountActive(session.user.id))
    ? { userId: session.user.id, source: "session", sessionId: sid }
    : null;
}

async function revalidateEstablishedSocketContext(
  context: WebSocketAuthContext,
  request: IncomingMessage,
): Promise<WebSocketAuthContext | null> {
  const { isClerkSessionRevoked, isSocketAccountActive } = await import("./sessionRevocation.js");
  if (context.source === "clerk") {
    if (context.sessionId && (await isClerkSessionRevoked(context.userId, context.sessionId))) {
      return null;
    }
    return (await isSocketAccountActive(context.userId)) ? context : null;
  }

  const sid = context.sessionId ?? sessionIdFromUpgrade(request);
  if (!sid) return null;
  const { getSession } = await import("../lib/auth.js");
  const session = await getSession(sid);
  if (!session?.user.id || session.user.id !== context.userId) return null;
  return (await isSocketAccountActive(context.userId)) ? context : null;
}

export async function authorizeWebSocketUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  security: WebSocketSecurityOptions = {},
): Promise<WebSocketAuthContext | null> {
  const origin = firstHeader(request.headers.origin);
  const host = firstHeader(request.headers.host);
  if (!isAllowedWebSocketOrigin(origin, host)) {
    rejectWebSocketUpgrade(socket, 403, "Forbidden");
    return null;
  }

  const authenticate = security.authenticate ?? authenticateWebSocketUpgrade;
  const context = await authenticate(request);
  if (!context) {
    rejectWebSocketUpgrade(socket, 401, "Unauthorized");
    return null;
  }
  if (security.requireProAccess && !(await security.requireProAccess(context, request))) {
    rejectWebSocketUpgrade(socket, 402, "Payment Required");
    return null;
  }
  watchWebSocketAuthorization(socket, async () => {
    const current = security.authenticate
      ? await security.authenticate(request)
      : await revalidateEstablishedSocketContext(context, request);
    return Boolean(
      current &&
        current.userId === context.userId &&
        (!security.requireProAccess || (await security.requireProAccess(current, request))),
    );
  });
  return context;
}

export function rejectWebSocketUpgrade(
  socket: Duplex,
  statusCode: 401 | 402 | 403 | 503,
  reason: string,
): void {
  try {
    if (!socket.destroyed && socket.writable) {
      socket.write(
        `HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
      );
    }
  } catch {
    // Ignore write errors on already-closing sockets
  } finally {
    if (!socket.destroyed) {
      socket.destroy();
    }
  }
}
