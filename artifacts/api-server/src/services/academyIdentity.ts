import { clerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LaunchError } from "../lib/launchError.js";

/** Email comes from the authenticated identity provider, never a form or client metadata. */
export async function ensureAcademyIdentity(userId: string): Promise<typeof usersTable.$inferSelect | null> {
  const [stored] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (stored?.email || !process.env.CLERK_SECRET_KEY) return stored ?? null;
  const user = await clerkClient.users.getUser(userId);
  const email = user.emailAddresses
    .find(
      (address) =>
        address.id === user.primaryEmailAddressId && address.verification?.status === "verified",
    )
    ?.emailAddress.toLowerCase();
  if (!email) throw new LaunchError("Verifica la tua email prima di aprire il percorso.", 403);
  const [record] = await db
    .insert(usersTable)
    .values({ id: userId, email, firstName: user.firstName, lastName: user.lastName })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { email, firstName: user.firstName, lastName: user.lastName },
    })
    .returning();
  return record;
}
