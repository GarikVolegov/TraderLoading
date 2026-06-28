// ─── Support-ticket email content (pure) ──────────────────────────────────────
// Pure builders that turn ticket data + localized copy into { subject, html,
// text }. No I/O — fully unit-testable. The I/O wrappers live in ticketEmails.ts.

import type { EmailCopy } from "./emailCopy.js";
import { escapeHtml, renderEmailLayout, renderText, BRAND } from "./emailLayout.js";

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

/** Email "Subject:" headers must never contain CR/LF (header injection). */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Escape a user paragraph and keep its line breaks as <br>. */
function bodyToHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;">${escapeHtml(text)}</p>`;
}

function quotedBlock(text: string): string {
  return `<div style="margin:18px 0;padding:14px 16px;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;color:${BRAND.text};white-space:normal;">${bodyToHtml(text)}</div>`;
}

function ticketUrl(baseUrl: string, ticketId: number): string {
  return `${baseUrl.replace(/\/+$/, "")}/support/${ticketId}`;
}

export interface TicketCreatedInput {
  copy: EmailCopy;
  lang: string;
  baseUrl: string;
  ticketId: number;
  ticketSubject: string;
}

export function buildTicketCreatedEmail(input: TicketCreatedInput): BuiltEmail {
  const { copy, lang, baseUrl, ticketId, ticketSubject } = input;
  const url = ticketUrl(baseUrl, ticketId);
  const intro = copy.ticketCreated.intro(ticketSubject);
  const bodyHtml = paragraph(copy.greeting) + paragraph(intro);
  return {
    subject: sanitizeHeader(copy.ticketCreated.subject(ticketId)),
    html: renderEmailLayout({
      title: copy.ticketCreated.title,
      bodyHtml,
      ctaLabel: copy.cta,
      ctaUrl: url,
      lang,
      baseUrl,
      previewText: intro,
      footerText: copy.footer,
    }),
    text: renderText({
      title: copy.ticketCreated.title,
      bodyText: `${copy.greeting}\n\n${intro}`,
      ctaLabel: copy.cta,
      ctaUrl: url,
      footerText: copy.footer,
    }),
  };
}

export interface TicketReplyInput {
  copy: EmailCopy;
  lang: string;
  baseUrl: string;
  ticketId: number;
  ticketSubject: string;
  replyBody: string;
}

export function buildTicketReplyEmail(input: TicketReplyInput): BuiltEmail {
  const { copy, lang, baseUrl, ticketId, ticketSubject, replyBody } = input;
  const url = ticketUrl(baseUrl, ticketId);
  const intro = copy.ticketReply.intro(ticketSubject);
  const bodyHtml = paragraph(copy.greeting) + paragraph(intro) + quotedBlock(replyBody);
  return {
    subject: sanitizeHeader(copy.ticketReply.subject(ticketSubject)),
    html: renderEmailLayout({
      title: copy.ticketReply.title,
      bodyHtml,
      ctaLabel: copy.cta,
      ctaUrl: url,
      lang,
      baseUrl,
      previewText: intro,
      footerText: copy.footer,
    }),
    text: renderText({
      title: copy.ticketReply.title,
      bodyText: `${copy.greeting}\n\n${intro}\n\n${replyBody}`,
      ctaLabel: copy.cta,
      ctaUrl: url,
      footerText: copy.footer,
    }),
  };
}

export interface TicketStatusInput {
  copy: EmailCopy;
  lang: string;
  baseUrl: string;
  ticketId: number;
  ticketSubject: string;
  status: string;
}

export function buildTicketStatusEmail(input: TicketStatusInput): BuiltEmail {
  const { copy, lang, baseUrl, ticketId, ticketSubject, status } = input;
  const url = ticketUrl(baseUrl, ticketId);
  const label = copy.statusLabel(status);
  const intro = copy.ticketStatus.intro(ticketSubject, label);
  const bodyHtml = paragraph(copy.greeting) + paragraph(intro);
  return {
    subject: sanitizeHeader(copy.ticketStatus.subject(label)),
    html: renderEmailLayout({
      title: copy.ticketStatus.title(label),
      bodyHtml,
      ctaLabel: copy.cta,
      ctaUrl: url,
      lang,
      baseUrl,
      previewText: intro,
      footerText: copy.footer,
    }),
    text: renderText({
      title: copy.ticketStatus.title(label),
      bodyText: `${copy.greeting}\n\n${intro}`,
      ctaLabel: copy.cta,
      ctaUrl: url,
      footerText: copy.footer,
    }),
  };
}
