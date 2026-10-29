import { ensureAcademyIdentity } from "../academyIdentity.js";
import { createHash } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import {
  db,
  launchEmailsTable as emails,
  emailLifecycleStateTable,
  usersTable,
} from "@workspace/db";
import { escapeHtml, renderEmailLayout } from "./emailLayout.js";
import { isEmailConfigured, sendEmail } from "./resendClient.js";

export type LaunchEmail = {
  key: string;
  userId?: string | null;
  kind: string;
  recipient: string;
  subject: string;
  body: string;
  path: string;
};
export async function queueLaunchEmail(
  input: LaunchEmail,
  executor: Pick<typeof db, "insert"> = db,
) {
  await executor.insert(emails).values(input).onConflictDoNothing({ target: emails.key });
}
export async function queueLaunchWelcome(userId: string) {
  await ensureAcademyIdentity(userId);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`launch-welcome:${userId}`}))`);
    const [state] = await tx
      .select()
      .from(emailLifecycleStateTable)
      .where(eq(emailLifecycleStateTable.userId, userId));
    if (state?.welcomeSentAt) return;
    const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user?.email) return;
    await queueLaunchEmail(
      {
        key: `welcome:${userId}`,
        userId,
        kind: "welcome",
        recipient: user.email,
        subject: "Benvenuto in AUREUS · Inizia dal tuo percorso gratuito",
        body: "Il tuo spazio gratuito è pronto. Trovi il libro introduttivo nella Biblioteca AUREUS, il Capitolo 0 e due lezioni guidate nel Laboratorio AUREUS, quando pubblicati dal docente. Inizia dall’introduzione, poi prepara e documenta una sessione in simulazione. Non servono carta o candidatura. Il Protocollo completo è una scelta successiva, senza attivazioni automatiche.",
        path: "/academy?tab=introduction",
      },
      tx,
    );
  });
}

/** Same key on every retry; retry window stays inside Resend's 24h idempotency retention. */
export function launchEmailRetry(attempts: number, createdAt: Date, now: Date) {
  const next = new Date(now.getTime() + Math.min(60, 2 ** attempts) * 60_000);
  return attempts >= 12 || next.getTime() - createdAt.getTime() >= 23 * 3600_000 ? null : next;
}
export async function dispatchLaunchEmails() {
  if (!isEmailConfigured()) return;
  for (let i = 0; i < 20; i++) {
    const found = await db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .select()
        .from(emails)
        .where(and(eq(emails.status, "pending"), lte(emails.availableAt, now)))
        .orderBy(emails.availableAt)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return false;
      if (now.getTime() - row.createdAt.getTime() >= 23 * 3600_000) {
        await tx.update(emails).set({ status: "needs_review" }).where(eq(emails.key, row.key));
        return true;
      }
      const baseUrl = (process.env.APP_BASE_URL || "https://traderloading.com").replace(/\/+$/, "");
      const result = await sendEmail({
        to: row.recipient,
        subject: row.subject,
        html: renderEmailLayout({
          brandName: "AUREUS",
          accentColor: "#d5b878",
          title: row.subject,
          bodyHtml: `<p>${escapeHtml(row.body)}</p>`,
          ctaLabel: "Apri AUREUS",
          ctaUrl: `${baseUrl}${row.path}`,
          baseUrl,
          lang: "it",
          footerText: "AUREUS · Formazione e pratica consapevole",
        }),
        text: `${row.subject}\n\n${row.body}\n\n${baseUrl}${row.path}`,
        idempotencyKey: `launch-${createHash("sha256").update(row.key).digest("hex")}`,
      });
      const retry = launchEmailRetry(row.attempts + 1, row.createdAt, now);
      await tx
        .update(emails)
        .set(
          result.sent
            ? { status: "sent", sentAt: now, attempts: row.attempts + 1 }
            : {
                status: retry ? "pending" : "needs_review",
                attempts: row.attempts + 1,
                availableAt: retry ?? now,
              },
        )
        .where(eq(emails.key, row.key));
      if (result.sent && row.kind === "welcome" && row.userId) {
        await tx
          .insert(emailLifecycleStateTable)
          .values({ userId: row.userId, welcomeSentAt: now })
          .onConflictDoUpdate({
            target: emailLifecycleStateTable.userId,
            set: { welcomeSentAt: now, updatedAt: now },
          });
      }
      return true;
    });
    if (!found) break;
  }
}
