# Permission-hygiene guard — design

**Date:** 2026-07-03
**Status:** approved (brainstorm 2026-07-03)
**Scope:** `artifacts/trader-dashboard` only. No runtime behavior change.

## Problem

The user reported browser-permission prompts appearing at first launch of the installed
PWA. Investigation showed the app code is already "just-in-time": `Notification.requestPermission()`
is only reachable from the Settings push toggle ([usePushNotifications.ts](../../../artifacts/trader-dashboard/src/hooks/usePushNotifications.ts));
`getUserMedia` only from the voice-record buttons. The prompt seen on the phone is the
one-time Android 13+ OS migration prompt for a web-granted notification permission on
WebAPK first launch — not app code, and not suppressible from a web app.

What **can** regress is the just-in-time policy itself: `feat/community-management` is a
long-lived multi-agent branch, and any future feature could add a permission request at
mount/startup. This design locks the policy in at build time.

## Goal

A static guard test that fails `pnpm test` / `pnpm verify` whenever a permission-prompting
browser API appears in dashboard source outside an explicitly allowlisted call site.

## Non-goals

- No runtime changes, no UX changes, no new prompts or primers.
- Not attempting to verify "behind a user gesture" statically — the guard forces every new
  call site through a visible allowlist edit (same philosophy as the i18n static guards).
- Not covering the API server or other workspaces.

## Design

New file `artifacts/trader-dashboard/src/permission-hygiene.static.test.ts`, following the
existing static-guard convention (`production-copy.static.test.ts`, `i18n.parity.static.test.ts`):
a plain Node script using `node:assert/strict`, self-contained, ending with a `console.log`
success line.

### Forbidden patterns (substring match per line)

| Pattern | Catches |
|---|---|
| `.requestPermission(` | Notification, DeviceMotionEvent, DeviceOrientationEvent |
| `getUserMedia(` | microphone / camera |
| `getDisplayMedia(` | screen capture |
| `.getCurrentPosition(` / `.watchPosition(` | geolocation |
| `pushManager.subscribe(` | web push subscription |
| `clipboard.read` | clipboard read/readText (write stays free) |
| `storage.persist(` | persistent-storage prompt (Firefox) — deliberately **not** bare `persist(` (zustand) |
| `requestMIDIAccess` | Web MIDI |
| `.requestDevice(` | WebUSB / WebBluetooth / WebHID |

### Scan scope

- All `.ts`/`.tsx` under `src/`, excluding `*.test.*` files (mocks legitimately reference
  these APIs) and the guard itself.
- Plus `public/sw.js` (a service worker can call `pushManager.subscribe`); no allowlist
  entries for it — it must stay clean.

### Allowlist (file → allowed patterns)

Per-file **and per-pattern**, so an allowlisted mic file can't silently add geolocation:

| File (relative to `src/`) | Allowed patterns |
|---|---|
| `hooks/usePushNotifications.ts` | `.requestPermission(`, `pushManager.subscribe(` |
| `components/social/MessaggiTab.tsx` | `getUserMedia(` |
| `components/social/StoryViewer.tsx` | `getUserMedia(` |
| `components/social/VoiceChannelView.tsx` | `getUserMedia(` |

Stale allowlist entries (file no longer exists or no longer uses the pattern) fail the
test too, so the list can't rot.

### Failure message

States the policy explicitly: browser-permission prompts must be requested just-in-time
behind an explicit user gesture, never at mount/startup; a new call site requires a
deliberate allowlist edit in this file, which surfaces in the diff for review.

### Self-test of the scanner

The scan logic lives in a pure function (`findPermissionViolations(source, relPath)`)
inside the test file, exercised against synthetic sources before the real tree scan:

1. a source containing a forbidden pattern in a non-allowlisted file → flagged;
2. a clean source → no findings;
3. an allowlisted pattern in an allowlisted file → passes, while a *different* forbidden
   pattern in that same file → flagged.

## Error handling

None beyond the assertions — the guard is a build-time script; any I/O failure fails the
test run loudly, which is the desired behavior.

## Testing / acceptance

- `pnpm test` (workspace dashboard) green with the guard included — current tree has
  exactly the four allowlisted call sites.
- Mutation check during development: temporarily adding `navigator.geolocation.getCurrentPosition(...)`
  to a page must fail the guard with the policy message.
