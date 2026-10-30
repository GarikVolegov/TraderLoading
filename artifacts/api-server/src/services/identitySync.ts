import { clerkClient } from "@clerk/express";
import { db, usersTable, candidateApplicationsTable, adminUsersTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";
import logger from "../lib/logger.js";
import { getBootstrapAdminEmails, getBootstrapAdminIds } from "../lib/adminPermissions.js";

interface CachedIdentity {
  user: AuthUser;
  expiresAt: number;
}

const identityCache = new Map<string, CachedIdentity>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuti

export function clearIdentityCache(userId?: string) {
  if (userId) identityCache.delete(userId);
  else identityCache.clear();
}

/**
 * Sincronizza l'identità dell'utente Clerk nel database sovranamente:
 * 1. Recupera o popola la riga `usersTable` con email verificata, nome e cognome.
 * 2. Collega automaticamente eventuali candidature orfane (`candidate_applications`).
 * 3. Garantisce l'accesso amministrativo se l'email fa parte degli indirizzi autorizzati.
 */
export async function syncUserIdentity(userId: string): Promise<AuthUser> {
  const cached = identityCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1:5432/test")) {
    return {
      id: userId,
      email: null,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
    };
  }

  // 1. Controlla in usersTable
  try {
    const [stored] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (stored?.email) {
      const authUser: AuthUser = {
        id: stored.id,
        email: stored.email,
        firstName: stored.firstName,
        lastName: stored.lastName,
        profileImageUrl: stored.profileImageUrl,
      };
      identityCache.set(userId, { user: authUser, expiresAt: Date.now() + CACHE_TTL_MS });
      return authUser;
    }
  } catch (err) {
    logger.warn({ err, userId }, "Database lookup failed in syncUserIdentity");
  }

  // 2. Se non presente o email assente, sincronizza con Clerk (se configurato)
  const clerkSecretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (clerkSecretKey) {
    try {
      const user = await clerkClient.users.getUser(userId);
      const email =
        user.emailAddresses.find((a) => a.id === user.primaryEmailAddressId)
          ?.emailAddress?.toLowerCase() ??
        user.emailAddresses[0]?.emailAddress?.toLowerCase() ??
        null;
      const firstName = user.firstName ?? null;
      const lastName = user.lastName ?? null;
      const profileImageUrl = user.imageUrl ?? null;

      const [record] = await db
        .insert(usersTable)
        .values({
          id: userId,
          email,
          firstName,
          lastName,
          profileImageUrl,
        })
        .onConflictDoUpdate({
          target: usersTable.id,
          set: {
            email,
            firstName,
            lastName,
            profileImageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();

      // Collega candidature pendenti se presenti con questa email
      if (email) {
        await db
          .update(candidateApplicationsTable)
          .set({ userId, updatedAt: new Date() })
          .where(
            and(
              eq(candidateApplicationsTable.email, email),
              isNull(candidateApplicationsTable.userId),
            ),
          )
          .catch(() => {});

        // Auto-bootstrap admin se l'email fa parte degli indirizzi sovrani/bootstrap
        if (getBootstrapAdminEmails().has(email)) {
          await db
            .insert(adminUsersTable)
            .values({
              userId,
              role: "super_admin",
              status: "active",
              createdBy: "email_bootstrap",
            })
            .onConflictDoUpdate({
              target: adminUsersTable.userId,
              set: { role: "super_admin", status: "active", updatedAt: new Date() },
            })
            .catch(() => {});
        }
      }

      const authUser: AuthUser = {
        id: userId,
        email: record?.email ?? email,
        firstName: record?.firstName ?? firstName,
        lastName: record?.lastName ?? lastName,
        profileImageUrl: record?.profileImageUrl ?? profileImageUrl,
      };

      identityCache.set(userId, { user: authUser, expiresAt: Date.now() + CACHE_TTL_MS });
      return authUser;
    } catch (err) {
      logger.warn({ err, userId }, "Failed to fetch user from Clerk in syncUserIdentity");
    }
  }

  // 3. Fallback minimale
  const fallbackUser: AuthUser = {
    id: userId,
    email: null,
    firstName: null,
    lastName: null,
    profileImageUrl: null,
  };
  return fallbackUser;
}

/**
 * Bootstrap iniziale all'avvio del server:
 * Assicura che gli ID bootstrap e gli account sovrani siano registrati
 * in adminUsersTable e che le candidature orfane siano riconciliate.
 */
export async function bootstrapSovereignAdmins(): Promise<void> {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1:5432/test")) {
    return;
  }

  try {
    const adminIds = getBootstrapAdminIds();
    for (const userId of adminIds) {
      await db
        .insert(adminUsersTable)
        .values({
          userId,
          role: "super_admin",
          status: "active",
          createdBy: "bootstrap",
        })
        .onConflictDoUpdate({
          target: adminUsersTable.userId,
          set: { role: "super_admin", status: "active", updatedAt: new Date() },
        })
        .catch(() => {});
    }

    // Collega candidature orfane con gli utenti registrati
    const unlinked = await db
      .select({ id: candidateApplicationsTable.id, email: candidateApplicationsTable.email })
      .from(candidateApplicationsTable)
      .where(isNull(candidateApplicationsTable.userId));

    for (const app of unlinked) {
      const [u] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, app.email.toLowerCase()))
        .limit(1);
      if (u?.id) {
        await db
          .update(candidateApplicationsTable)
          .set({ userId: u.id, updatedAt: new Date() })
          .where(eq(candidateApplicationsTable.id, app.id))
          .catch(() => {});
      }
    }
  } catch (err) {
    logger.warn({ err }, "Sovereign admin bootstrap encountered non-fatal error");
  }
}
