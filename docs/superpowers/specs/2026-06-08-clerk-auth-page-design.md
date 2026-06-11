# Clerk Auth Page Design

## Goal

Customize the Clerk authentication pages so sign-in and sign-up feel native to TraderLoading instead of looking like an external Clerk screen.

The implementation keeps Clerk as the authentication engine and only changes the app-owned page shell and Clerk appearance styling.

## Approved Direction

Use the integrated dashboard style.

The auth page should read as a secure trading command center:

- dark app background with subtle grid and market-terminal atmosphere;
- TraderLoading brand block and concise security/account copy;
- compact benefits or status cards next to the form;
- Clerk sign-in/sign-up form placed in a polished app-styled panel;
- responsive layout that becomes a single-column flow on small screens.

## Scope

In scope:

- Create a reusable auth page shell for `/sign-in` and `/sign-up`.
- Reuse the existing Clerk `SignIn` and `SignUp` components.
- Keep existing routes, redirects, base path support, proxy URL support, and Clerk provider behavior.
- Update Clerk appearance so typography, colors, borders, controls, errors, social buttons, and OTP fields match the app.
- Use existing app assets such as `app-icon-192.png`.
- Add focused verification for build/type safety and, if practical, a static test for auth page structure.

Out of scope:

- Replacing Clerk.
- Changing auth backend or middleware.
- Changing landing page behavior beyond links that already point to `/sign-in` and `/sign-up`.
- Adding new auth providers or changing Clerk dashboard configuration.

## User Experience

Signed-out users can still reach `/sign-in` and `/sign-up` directly. Each page shows the same branded shell with copy adjusted to the current flow:

- sign-in: return to the command center;
- sign-up: create the secure trading workspace.

The form remains the main interactive element. Supporting content should strengthen confidence and context without slowing login.

## Components

Add a small auth-shell component or local helper in `App.tsx` if the change stays compact. If the JSX grows too large, move it to `src/components/AuthPageShell.tsx`.

The shell should accept:

- mode: `sign-in` or `sign-up`;
- children: the Clerk form component.

The shell owns the page layout, brand, status cards, and responsive composition. Clerk owns form state, validation, OAuth buttons, email/password, OTP, and navigation between sign-in and sign-up.

## Visual System

Use the existing command-center palette:

- background: `#020617` / app `--background`;
- panel: `#07111f` / `#0e1223`;
- border: slate-like app border;
- primary accent: `#22c55e` / app primary green;
- warning/accent highlights: restrained amber or blue for status cards.

Avoid a generic landing-page hero. The screen should feel operational, compact, and app-like.

## Error Handling

Clerk remains responsible for authentication errors and form validation. The app styling must keep error messages legible with sufficient contrast. The shell should not intercept or reinterpret Clerk errors.

If Clerk is not loaded yet, the existing app loading fallback remains unchanged.

## Testing

Run at minimum:

- `pnpm --filter @workspace/trader-dashboard typecheck`
- `pnpm --filter @workspace/trader-dashboard build`

If a static test is added, it should check that both auth routes use the shared shell and preserve Clerk `SignIn` / `SignUp` routing props.

## Risks

Clerk element class names can change across Clerk versions. Keep appearance overrides focused on documented/global element keys already used in the app and avoid brittle DOM assumptions.

Responsive fit is the main UI risk. Verify mobile width around 375px and desktop width around 1440px so the Clerk form does not overflow and the supporting content does not compete with the form.
