# Auth UI Kit — Accesso & Registrazione

Faithful pull of the **TraderLoading** authentication screen from the Claude Design
project *TraderLoading Design System* (`templates/auth/`). Unlike the landing kit (plain
React JSX), this is authored in Claude Design's interactive **DesignCode** format
(`.dc.html`): a parameterised template + child component with editor-exposed props.

## Files
- `Auth.dc.html` — the screen shell. Props: **screen** (Accedi / Registrati / Reimposta
  password), **layout** (Split con pannello / Centrato), **bgTheme** (aurora · nebula ·
  ember · abyss), **showStats**. Renders the brand panel + ambient `tl-app-bg` and imports
  the form.
- `AuthForm.dc.html` — the card. Self-contained state machine over four screens:
  **login**, **register**, **reset** and the **reset → email sent** confirmation. Handles
  show/hide password, "ricordami", and inter-screen navigation locally.
- `ds-base.js` — loads the DS tokens + `_ds_bundle.js`. `base` points at `../..` (the
  Claude Design project root); it won't resolve from this `design-ref/` snapshot — repoint
  it if you want to render standalone.
- `support.js` — generated DesignCode runtime (parses `<x-dc>` / `sc-if` / `dc-import` and
  renders via React UMD). Infrastructure, not design content.

## Screens
- **Login** — Google SSO, email/password (icon-prefixed inputs, reveal toggle), Ricordami +
  Password dimenticata, primary CTA, link to register.
- **Registrazione** — Google SSO, name/email/password, terms+privacy note, link to login.
- **Reset password** — back-to-login, email field, "Inviami il link".
- **Email inviata** — success confirmation with check icon, back-to-login.

## Layouts
- **Split** (≥881px) — left brand panel (logo, gradient headline, three E2EE/read-only/GDPR
  trust rows, 4.9/5 social proof) + right form; panel hidden on mobile, form stacks.
- **Centrato** — single centered card with logo header, social proof and a security footer.

## Design language
Liquid-glass card (`hsl(var(--card)/0.92)` + `backdrop-filter:blur`, `--tl-shadow-panel`),
jade `--primary` chrome, `--tl-font-mono` headings, all on the tokenised `tl-app-bg`
ambient background. Tokens/materials match the app design system (see
[index.css](../../artifacts/trader-dashboard/src/index.css)).

> Reference only — the live app auth currently uses Clerk's `<SignIn>`/`<SignUp>` inside
> [AuthPageShell](../../artifacts/trader-dashboard/src/components/AuthPageShell.tsx). To adopt
> this look, restyle via Clerk's appearance API + the shell (not by swapping in this markup).
