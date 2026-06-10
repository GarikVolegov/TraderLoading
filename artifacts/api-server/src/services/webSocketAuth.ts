import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { authenticateRequest, clerkClient } from "@clerk/express";
import { isAllowedWebSocketOrigin } from "../lib/security.js";
import logger from "../lib/logger";

const SESSION_COOKIE = "sid";

export type WebSocketAuthContext = {
  userId: string;
  source: "clerk" | "session";
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

async function getClerkUserId(request: IncomingMessage): Promise<string | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  try {
    const state = await authenticateRequest({
      clerkClient,
      request: request as never,
      options: { acceptsToken: "any" },
    });
    const auth = state.toAuth();
    if (!auth) return null;
    return auth.userId ?? null;
  } catch (err) {
    logger.warn({ err }, "Clerk websocket authentication failed");
    return null;
  }
}

export async function authenticateWebSocketUpgrade(
  request: IncomingMessage,
): Promise<WebSocketAuthContext | null> {
  const clerkUserId = await getClerkUserId(request);
  if (clerkUserId) return { userId: clerkUserId, source: "clerk" };

  const sid = sessionIdFromUpgrade(request);
  if (!sid) return null;
  const { getSession } = await import("../lib/auth.js");
  const session = await getSession(sid);
  return session?.user.id ? { userId: session.user.id, source: "session" } : null;
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
  return context;
}

export function rejectWebSocketUpgrade(
  socket: Duplex,
  statusCode: 401 | 402 | 403 | 503,
  reason: string,
): void {
  socket.write(
    `HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
}
