import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import logger from "../lib/logger";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  getValidatedOidcSettings,
  type SessionData,
} from "../lib/auth";

export { getValidatedOidcSettings } from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value?.split(",")[0]?.trim();
}

function isHttpsRequest(req: Request): boolean {
  const protocol = typeof req.protocol === "string" ? req.protocol : undefined;
  const forwardedProto = firstHeader(req.headers["x-forwarded-proto"]);
  return (
    protocol === "https" ||
    forwardedProto === "https" ||
    req.secure ||
    process.env.NODE_ENV === "production"
  );
}

export function getOrigin(req: Request): string {
  const rawProtocol =
    typeof req.protocol === "string" ? req.protocol : undefined;
  const fallbackProtocol = isHttpsRequest(req) ? "https" : "http";
  const proto =
    rawProtocol === "http" || rawProtocol === "https"
      ? rawProtocol
      : fallbackProtocol;
  const forwardedHost = firstHeader(req.headers["x-forwarded-host"]);
  const rawHost =
    typeof req.host === "string" ? req.host : firstHeader(req.headers["host"]);
  const host = forwardedHost || rawHost || "localhost";
  if (!/^[A-Za-z0-9.-]+(?::\d+)?$/.test(host)) return `${proto}://localhost`;
  return `${proto}://${host}`;
}

export function createSessionCookieOptions(req: Request) {
  return {
    httpOnly: true,
    secure: isHttpsRequest(req),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL,
  };
}

export function createOidcCookieOptions(req: Request) {
  return {
    httpOnly: true,
    secure: isHttpsRequest(req),
    sameSite: "lax" as const,
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  };
}

function setSessionCookie(req: Request, res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    ...createSessionCookieOptions(req),
  });
}

function setOidcCookie(
  req: Request,
  res: Response,
  name: string,
  value: string,
) {
  res.cookie(name, value, {
    ...createOidcCookieOptions(req),
  });
}

export function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

export function getOidcUnavailableRedirect(returnTo: unknown): string {
  const safeReturnTo = getSafeReturnTo(returnTo);
  if (safeReturnTo === "/") return "/sign-in";
  return `/sign-in?redirect_url=${encodeURIComponent(safeReturnTo)}`;
}

function isMissingOidcConfigurationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("OIDC_CLIENT_ID or REPL_ID")
  );
}

function handleMissingOidcConfiguration(
  res: Response,
  error: unknown,
  returnTo?: unknown,
): boolean {
  if (!isMissingOidcConfigurationError(error)) return false;

  logger.warn(
    { err: error },
    "OIDC login unavailable because provider configuration is missing",
  );

  if (process.env.NODE_ENV === "production") {
    res.status(503).json({ error: "oidc_not_configured" });
    return true;
  }

  res.redirect(getOidcUnavailableRedirect(returnTo));
  return true;
}

export function isAllowedMobileRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (
    url.protocol === "traderloadings:" &&
    url.hostname === "auth" &&
    url.pathname === "/callback"
  ) {
    return true;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
    (url.protocol === "http:" || url.protocol === "https:")
  ) {
    return true;
  }

  const allowed = (process.env.MOBILE_REDIRECT_URIS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(value);
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/login", async (req: Request, res: Response) => {
  let config: oidc.Configuration;
  try {
    config = await getOidcConfig();
  } catch (error) {
    if (handleMissingOidcConfiguration(res, error, req.query.returnTo)) return;
    throw error;
  }

  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(req, res, "code_verifier", codeVerifier);
  setOidcCookie(req, res, "nonce", nonce);
  setOidcCookie(req, res, "state", state);
  setOidcCookie(req, res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get("/callback", async (req: Request, res: Response) => {
  let config: oidc.Configuration;
  try {
    config = await getOidcConfig();
  } catch (error) {
    if (handleMissingOidcConfiguration(res, error, req.cookies?.return_to)) {
      return;
    }
    throw error;
  }

  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch (err) {
    logger.warn({ err }, "OIDC callback exchange failed");
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(req, res, sid);
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const origin = getOrigin(req);
  const sid = getSessionId(req);
  await clearSession(res, sid);

  let config: oidc.Configuration;
  let oidcSettings: ReturnType<typeof getValidatedOidcSettings>;
  try {
    config = await getOidcConfig();
    oidcSettings = getValidatedOidcSettings();
  } catch (error) {
    if (handleMissingOidcConfiguration(res, error)) return;
    throw error;
  }

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: oidcSettings.clientId,
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;
    if (!isAllowedMobileRedirectUri(redirect_uri)) {
      res.status(400).json({ error: "Unsupported redirect URI" });
      return;
    }

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const sid = await createSession(sessionData);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      logger.warn({ err }, "Mobile token exchange failed");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
