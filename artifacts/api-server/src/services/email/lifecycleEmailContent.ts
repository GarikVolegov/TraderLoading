// ─── Lifecycle email content (pure) ───────────────────────────────────────────
// Pure builders that turn lifecycle data + localized copy into { subject, html,
// text }. No I/O — fully unit-testable (mirrors ticketEmailContent.ts). The I/O
// send wrappers live in lifecycleEmails.ts.

import type { LifecycleCopy } from "./lifecycleCopy.js";
import { escapeHtml, renderEmailLayout, renderText, BRAND } from "./emailLayout.js";
import type { BuiltEmail } from "./ticketEmailContent.js";

/** Email "Subject:" headers must never contain CR/LF (header injection). */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;">${escapeHtml(text)}</p>`;
}

function stripBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/** Rounded win-rate percent, e.g. 0.5833 → "58%". */
function formatPercent(winRate: number): string {
  return `${Math.round(winRate * 100)}%`;
}

/** Signed R, e.g. 3.4 → "+3.4R", -1.2 → "-1.2R". */
function formatR(netR: number): string {
  const sign = netR >= 0 ? "+" : "";
  return `${sign}${netR.toFixed(1)}R`;
}

export interface WelcomeInput {
  copy: LifecycleCopy;
  lang: string;
  baseUrl: string;
}

export function buildWelcomeEmail(input: WelcomeInput): BuiltEmail {
  const { copy, lang, baseUrl } = input;
  const url = stripBase(baseUrl);
  const bodyHtml = paragraph(copy.greeting) + paragraph(copy.welcome.intro) + paragraph(copy.welcome.body);
  return {
    subject: sanitizeHeader(copy.welcome.subject),
    html: renderEmailLayout({
      title: copy.welcome.title,
      bodyHtml,
      ctaLabel: copy.welcome.cta,
      ctaUrl: url,
      lang,
      baseUrl,
      previewText: copy.welcome.intro,
      footerText: copy.footer,
    }),
    text: renderText({
      title: copy.welcome.title,
      bodyText: `${copy.greeting}\n\n${copy.welcome.intro}\n\n${copy.welcome.body}`,
      ctaLabel: copy.welcome.cta,
      ctaUrl: url,
      footerText: copy.footer,
    }),
  };
}

export interface DigestStats {
  tradesLogged: number;
  /** 0..1, or null when there is nothing to average. */
  winRate: number | null;
  netR: number;
  streakDays: number;
  topSymbol: string | null;
}

export interface DigestInput {
  copy: LifecycleCopy;
  lang: string;
  baseUrl: string;
  stats: DigestStats;
}

function statRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-family:${BRAND.font};font-size:14px;color:${BRAND.muted};">${escapeHtml(label)}</td>
    <td align="right" style="padding:8px 0;font-family:${BRAND.font};font-size:14px;font-weight:600;color:${BRAND.text};">${escapeHtml(value)}</td>
  </tr>`;
}

function digestStatsHtml(copy: LifecycleCopy, stats: DigestStats): string {
  const rows = [
    statRow(copy.digest.labels.trades, String(stats.tradesLogged)),
    statRow(copy.digest.labels.winRate, stats.winRate === null ? "—" : formatPercent(stats.winRate)),
    statRow(copy.digest.labels.netR, formatR(stats.netR)),
    statRow(copy.digest.labels.streak, String(stats.streakDays)),
  ];
  if (stats.topSymbol) rows.push(statRow(copy.digest.labels.topSymbol, stats.topSymbol));
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 4px;border-collapse:collapse;">${rows.join("")}</table>`;
}

function digestStatsText(copy: LifecycleCopy, stats: DigestStats): string {
  const lines = [
    `${copy.digest.labels.trades}: ${stats.tradesLogged}`,
    `${copy.digest.labels.winRate}: ${stats.winRate === null ? "-" : formatPercent(stats.winRate)}`,
    `${copy.digest.labels.netR}: ${formatR(stats.netR)}`,
    `${copy.digest.labels.streak}: ${stats.streakDays}`,
  ];
  if (stats.topSymbol) lines.push(`${copy.digest.labels.topSymbol}: ${stats.topSymbol}`);
  return lines.join("\n");
}

export function buildDigestEmail(input: DigestInput): BuiltEmail {
  const { copy, lang, baseUrl, stats } = input;
  const url = `${stripBase(baseUrl)}/journal`;
  const hasActivity = stats.tradesLogged > 0;
  const bodyHtml = hasActivity
    ? paragraph(copy.greeting) + paragraph(copy.digest.intro) + digestStatsHtml(copy, stats)
    : paragraph(copy.greeting) + paragraph(copy.digest.empty);
  const bodyText = hasActivity
    ? `${copy.greeting}\n\n${copy.digest.intro}\n\n${digestStatsText(copy, stats)}`
    : `${copy.greeting}\n\n${copy.digest.empty}`;
  return {
    subject: sanitizeHeader(copy.digest.subject(stats.tradesLogged)),
    html: renderEmailLayout({
      title: copy.digest.title,
      bodyHtml,
      ctaLabel: copy.digest.cta,
      ctaUrl: url,
      lang,
      baseUrl,
      previewText: copy.digest.intro,
      footerText: copy.footer,
    }),
    text: renderText({
      title: copy.digest.title,
      bodyText,
      ctaLabel: copy.digest.cta,
      ctaUrl: url,
      footerText: copy.footer,
    }),
  };
}

export interface WinbackInput {
  copy: LifecycleCopy;
  lang: string;
  baseUrl: string;
  idleDays: number;
}

export function buildWinbackEmail(input: WinbackInput): BuiltEmail {
  const { copy, lang, baseUrl, idleDays } = input;
  const url = stripBase(baseUrl);
  const intro = copy.winback.intro(idleDays);
  const bodyHtml = paragraph(copy.greeting) + paragraph(intro);
  return {
    subject: sanitizeHeader(copy.winback.subject),
    html: renderEmailLayout({
      title: copy.winback.title,
      bodyHtml,
      ctaLabel: copy.winback.cta,
      ctaUrl: url,
      lang,
      baseUrl,
      previewText: intro,
      footerText: copy.footer,
    }),
    text: renderText({
      title: copy.winback.title,
      bodyText: `${copy.greeting}\n\n${intro}`,
      ctaLabel: copy.winback.cta,
      ctaUrl: url,
      footerText: copy.footer,
    }),
  };
}
