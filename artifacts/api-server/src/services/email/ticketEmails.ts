// ─── Support-ticket email dispatch (I/O) ──────────────────────────────────────
// Thin glue over the pure builders in ticketEmailContent.ts: resolve recipient
// email + language from the DB, then send via Resend. Best-effort — every path
// is wrapped so a ticket write can never fail because email is down.

import { eq } from "drizzle-orm";
import { db, usersTable, userSettingsTable } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { getNotificationLanguage } from "../notifications/notificationCopy.js";
import { getEmailCopy } from "./emailCopy.js";
import { sendEmail } from "./resendClient.js";
import {
  buildTicketCreatedEmail,
  buildTicketReplyEmail,
  buildTicketStatusEmail,
  type BuiltEmail,
} from "./ticketEmailContent.js";

function resolveBaseUrl(): string {
  return (process.env.APP_BASE_URL || "https://traderloading.com").replace(/\/+$/, "");
}

interface Recipient {
  email: string;
  lang: string;
}

async function resolveRecipient(userId: string): Promise<Recipient | null> {
  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user?.email) return null;

  let lang = "it";
  try {
    const [settings] = await db
      .select({ notificationPrefs: userSettingsTable.notificationPrefs })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1);
    const parsed = settings?.notificationPrefs
      ? JSON.parse(settings.notificationPrefs)
      : null;
    lang = getNotificationLanguage(parsed?.__language);
  } catch {
    lang = "it";
  }
  return { email: user.email, lang };
}

async function dispatch(
  userId: string,
  build: (recipient: Recipient) => BuiltEmail,
): Promise<{ sent: boolean }> {
  try {
    const recipient = await resolveRecipient(userId);
    if (!recipient) return { sent: false };
    const email = build(recipient);
    return await sendEmail({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (err) {
    logger.error({ err }, "[email] dispatch email ticket fallito");
    return { sent: false };
  }
}

export interface TicketEmailTarget {
  id: number;
  userId: string;
  subject: string;
}

export function sendTicketCreatedEmail(
  ticket: TicketEmailTarget,
): Promise<{ sent: boolean }> {
  const baseUrl = resolveBaseUrl();
  return dispatch(ticket.userId, (r) =>
    buildTicketCreatedEmail({
      copy: getEmailCopy(r.lang),
      lang: r.lang,
      baseUrl,
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
    }),
  );
}

export function sendTicketReplyEmail(
  ticket: TicketEmailTarget,
  replyBody: string,
): Promise<{ sent: boolean }> {
  const baseUrl = resolveBaseUrl();
  return dispatch(ticket.userId, (r) =>
    buildTicketReplyEmail({
      copy: getEmailCopy(r.lang),
      lang: r.lang,
      baseUrl,
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
      replyBody,
    }),
  );
}

export function sendTicketStatusEmail(
  ticket: TicketEmailTarget & { status: string },
): Promise<{ sent: boolean }> {
  const baseUrl = resolveBaseUrl();
  return dispatch(ticket.userId, (r) =>
    buildTicketStatusEmail({
      copy: getEmailCopy(r.lang),
      lang: r.lang,
      baseUrl,
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
      status: ticket.status,
    }),
  );
}
