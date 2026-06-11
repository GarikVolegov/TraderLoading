# Google OAuth Branding for TraderLoading

This is required so the Google account chooser and OAuth consent screens show
TraderLoading instead of Clerk.

## Why This Is Required

The React auth page can hide Clerk branding inside the app, but the Google account
chooser is rendered by Google during OAuth. Its app name and logo come from the
Google OAuth client used by the auth provider.

For Clerk development instances, Clerk can use shared OAuth credentials. Shared
credentials can show Clerk as the OAuth app. Production must use custom Google
OAuth credentials with TraderLoading branding.

## Target Branding

- App name: `TraderLoading`
- Logo: use `artifacts/trader-dashboard/public/app-icon-512.png`
- Homepage: production app URL
- Privacy policy URL: production privacy policy URL
- Terms URL: production terms URL
- Support email: the official TraderLoading support/contact email

## Clerk Setup

1. Open the Clerk Dashboard for the production TraderLoading application.
2. Go to SSO connections.
3. Add or edit Google for all users.
4. Enable sign-up and sign-in.
5. Enable custom credentials.
6. Copy the Authorized Redirect URI shown by Clerk. Keep this exact value for Google Cloud.

If the deployment environment exposes auth through a Replit/Auth pane instead of
the normal Clerk Dashboard, configure the same Google custom credentials there.

## Google Cloud Setup

1. Open Google Cloud Console.
2. Select or create the TraderLoading project.
3. Configure OAuth app branding:
   - App name: `TraderLoading`
   - App logo: `app-icon-512.png`
   - Support email: official support/contact email
   - App domain links: homepage, privacy policy, and terms
   - Authorized domains: production domain without protocol
4. Create an OAuth client ID.
5. Application type: Web application.
6. Authorized JavaScript origins:
   - production origin, for example `https://traderloading.app`
   - `https://www...` origin if the app uses a www domain
   - local origin only if testing custom credentials locally, for example `http://localhost:5173`
7. Authorized redirect URIs:
   - paste the exact Authorized Redirect URI copied from Clerk
8. Create the OAuth client.
9. Copy the Google Client ID and Client Secret.

## Finish in Clerk

1. Paste the Google Client ID and Client Secret into the Google SSO connection.
2. Save the connection.
3. Confirm the production app uses the matching Clerk production keys:
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_CLERK_PROXY_URL`, if using the Clerk proxy
4. Redeploy.

## Verification

1. Open the deployed `/sign-in` page.
2. Confirm the app page shows TraderLoading and the official app logo.
3. Click Google sign-in.
4. Confirm the Google account chooser says `Continua su TraderLoading` or the localized equivalent.
5. Confirm the Google OAuth consent screen shows the TraderLoading app name and logo after Google brand verification is complete.

## Notes

Google may require OAuth app/brand verification before the app name or logo is
shown to all users. Until verification completes, Google can hide or limit the
custom branding even if the app is configured correctly.

Do not commit Google Client IDs, Client Secrets, or real Clerk secret keys to the
repository.
