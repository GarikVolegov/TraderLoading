# Branded email templates

The app ships a single dark, jade-accented email identity (see
[`artifacts/api-server/src/services/email/emailLayout.ts`](../../artifacts/api-server/src/services/email/emailLayout.ts)).
That layout is used **in code** for support-ticket emails sent via Resend. The
HTML files here are **reference templates for emails the app does NOT send** —
the Clerk authentication emails — so they match the same look.

## Why these are separate

Verification-code, magic-link and password-reset emails are sent by **Clerk**
(the auth provider), not by our backend. We can't take over Clerk's transport
without rewriting auth, but we *can* restyle the emails: paste the HTML below
into the Clerk Dashboard.

These files are **reference artifacts** (i18n-exempt: they live in `docs/`, not
in `trader-dashboard/src`, so the i18n static tests don't scan them).

## Files

| File | Clerk template | Merge variables |
|---|---|---|
| `clerk-verification-code.html` | Verification code | `{{otp_code}}`, `{{app.name}}` |
| `clerk-magic-link.html` | Magic link | `{{magic_link}}`, `{{app.name}}` |
| `clerk-reset-password.html` | Reset password | `{{otp_code}}`, `{{app.name}}` |

## How to apply

1. Clerk Dashboard → **Customization → Emails**.
2. Open the template (e.g. *Verification code*).
3. Switch the editor to **HTML** and paste the matching file's contents.
4. Keep Clerk's merge variables intact (`{{otp_code}}` etc.).
5. Send a test to a real inbox and check the dark rendering on mobile + desktop.

## Caveats

- **Clerk plan**: full HTML customization of email templates may require a paid
  Clerk plan. If the HTML editor isn't available on your plan, these remain a
  visual reference / upgrade target — not a blocker.
- **Logo**: emails can't read `APP_BASE_URL`, so the logo is the absolute URL
  `https://traderloading.com/app-icon-192.png`. Update it if the asset host
  changes. SVG is intentionally avoided (Gmail/Outlook don't render it).
- **Localization**: Clerk's per-locale email templating is limited. The files
  default to Italian; duplicate per locale in Clerk if/when needed.
- **Palette** (keep in sync with `emailLayout.ts`): bg `#0a0c10`, surface
  `#13161b`, jade `#51a488`, text `#f3f5f7`, muted `#9ca6b4`, border `#2d3139`.
