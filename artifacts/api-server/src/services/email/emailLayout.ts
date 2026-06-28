// ─── Branded (dark) email layout ────────────────────────────────────────────
// Pure render helpers (no I/O) so they are trivially unit-testable. The same
// dark/jade identity as the app (see trader-dashboard/src/index.css). Email is
// table-based with all-inline CSS and an MSO-safe button: Outlook ignores
// <body> backgrounds and CSS buttons, so the dark colour is set on the wrapper
// table too and the CTA uses a bulletproof table + VML fallback. SVG is not
// rendered by Gmail/Outlook → the logo is a PNG served over an absolute URL.

export const BRAND = {
  jade: "#51a488",
  jadeSoft: "#7cb6a3",
  bg: "#0a0c10",
  surface: "#13161b",
  text: "#f3f5f7",
  muted: "#9ca6b4",
  border: "#2d3139",
  success: "#2ac075",
  danger: "#e64c4c",
  font: "'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  productName: "TraderLoading",
} as const;

export interface EmailLayoutOptions {
  title: string;
  /** Already-safe HTML fragment for the body (escape user input before passing). */
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Absolute origin used for the logo and any links. */
  baseUrl: string;
  lang?: string;
  /** Hidden inbox-preview line. */
  previewText?: string;
  /** Localized footer sentence below the divider. */
  footerText?: string;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

function stripBaseTrailingSlash(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function renderButton(label: string, url: string): string {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);
  return `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
                <tr>
                  <td align="center" bgcolor="${BRAND.jade}" style="border-radius:10px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:44px;v-text-anchor:middle;width:260px;" arcsize="22%" stroke="f" fillcolor="${BRAND.jade}">
                    <w:anchorlock/>
                    <center style="color:${BRAND.bg};font-family:${BRAND.font};font-size:15px;font-weight:600;">${safeLabel}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a href="${safeUrl}" style="display:inline-block;padding:12px 28px;border-radius:10px;background:${BRAND.jade};color:${BRAND.bg};font-family:${BRAND.font};font-size:15px;font-weight:600;text-decoration:none;">${safeLabel}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`;
}

export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const lang = opts.lang || "it";
  const base = stripBaseTrailingSlash(opts.baseUrl);
  const logo = `${base}/app-icon-192.png`;
  const preview = opts.previewText ? escapeHtml(opts.previewText) : "";
  const footer =
    opts.footerText ||
    `${BRAND.productName} — Trading journal, macro news & risk discipline`;
  const button =
    opts.ctaLabel && opts.ctaUrl ? renderButton(opts.ctaLabel, opts.ctaUrl) : "";

  return `<!doctype html>
<html lang="${escapeHtml(lang)}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(opts.title)}</title>
<!--[if mso]><style>* { font-family: Arial, sans-serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};color:${BRAND.text};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.bg};">${preview}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${BRAND.bg}" style="background:${BRAND.bg};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td align="left" style="padding:0 8px 20px;">
            <img src="${logo}" width="40" height="40" alt="${BRAND.productName}" style="display:block;border:0;border-radius:9px;">
          </td>
        </tr>
        <tr>
          <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:14px;padding:32px 32px 28px;">
            <h1 style="margin:0 0 16px;font-family:${BRAND.font};font-size:20px;line-height:1.3;font-weight:600;color:${BRAND.text};">${escapeHtml(opts.title)}</h1>
            <div style="font-family:${BRAND.font};font-size:15px;line-height:1.6;color:${BRAND.muted};">
              ${opts.bodyHtml}
            </div>${button}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 8px 0;font-family:${BRAND.font};font-size:12px;line-height:1.5;color:${BRAND.muted};">
            ${escapeHtml(footer)}
            <br>
            <span style="color:${BRAND.border};">© ${BRAND.productName}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function renderText(opts: {
  title: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerText?: string;
}): string {
  const lines = [opts.title, "", opts.bodyText];
  if (opts.ctaUrl) {
    lines.push("", `${opts.ctaLabel ? `${opts.ctaLabel}: ` : ""}${opts.ctaUrl}`);
  }
  lines.push(
    "",
    "—",
    opts.footerText || `${BRAND.productName}`,
  );
  return lines.join("\n");
}
