// ─── Resend email client (graceful degradation) ──────────────────────────────
// Same shape as services/llmClient.ts: lazily build the client, return null when
// the key is absent so callers no-op. sendEmail never throws — a down email
// provider must never fail a ticket write.

import { Resend } from "resend";
import { logger } from "../../lib/logger.js";

let _client: Resend | null = null;
let _warned = false;

export interface EmailClient {
  client: Resend;
  from: string;
}

function defaultFrom(): string {
  return (
    process.env.EMAIL_FROM ||
    "TraderLoading <assistenza@traderloading.com>"
  );
}

function ensureClient(): EmailClient | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (!_warned) {
      logger.warn("[email] RESEND_API_KEY non impostata — invio email disattivato");
      _warned = true;
    }
    return null;
  }
  if (!_client) {
    _client = new Resend(apiKey);
    logger.info("[email] client Resend pronto");
  }
  return { client: _client, from: defaultFrom() };
}

export function getEmailClient(): EmailClient | null {
  return ensureClient();
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean }> {
  const resolved = ensureClient();
  if (!resolved) return { sent: false };
  try {
    const { error } = await resolved.client.emails.send({
      from: resolved.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    if (error) {
      logger.error({ err: error }, "[email] invio fallito");
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    logger.error({ err }, "[email] invio in errore");
    return { sent: false };
  }
}
