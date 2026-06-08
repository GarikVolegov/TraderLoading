# Custom Scheduled Calls Design

## Goal

Add fully configurable scheduled "calls" that can notify the user outside the app on specific days and times. The external notification uses browser push capabilities. When the user taps the notification, the app opens into a highly customized call-style overlay, with a formal bank-like visual treatment by default.

## Browser Constraint

A web app cannot fully redesign the operating system or browser notification UI. The external push can customize title, body, icon, badge, tag, vibration, persistence, click target, and data payload. The full visual design, ringtone, animations, caller identity, and call controls happen inside the app after the notification is opened.

## User Experience

In `Settings > Notifications`, add a "Scheduled calls" section.

Users can create, edit, enable, disable, duplicate, and delete calls. Each call supports:

- caller name, such as `Banca - Ufficio Risk`
- department or subtitle, such as `Controllo Operativo`
- notification title
- notification message
- in-app call message
- specific weekdays
- local time in `HH:MM`
- enabled state
- external icon URL or preset icon
- notification persistence
- vibration pattern preset
- snooze minutes
- ringtone preset
- visual preset, defaulting to `bank`
- accent color
- logo or monogram
- primary and secondary action labels

The default bank preset should feel institutional, sober, and urgent without looking like a generic marketing screen. Use restrained dark surfaces, a bank/risk-desk caller identity, precise typography, clear hierarchy, and large touch targets.

## Runtime Behavior

When the app is closed, the server-side push scheduler checks configured calls every minute for users with push subscriptions. If a call is enabled, today is one of its selected weekdays, and the local time matches, the server sends one push for that call occurrence.

When the app is open, the existing in-app scheduler can still show the call overlay immediately. This is a convenience path, not the primary scheduling mechanism.

When the user clicks the push, the service worker opens the app with call data in the URL or notification data. The app renders the call overlay using the configured visual preset and call content.

## Data Model

Reuse `user_settings.alarm_configs` as the storage field. Store JSON with a versioned array:

```ts
interface ScheduledCallConfig {
  id: string;
  enabled: boolean;
  callerName: string;
  department: string;
  notificationTitle: string;
  notificationBody: string;
  callMessage: string;
  time: string;
  days: number[];
  timezone: string;
  iconUrl?: string;
  logoText?: string;
  visualPreset: "bank" | "broker" | "risk" | "custom";
  accentColor: string;
  ringtone: "institutional" | "digital" | "gentle" | "pulse";
  vibration: "standard" | "urgent" | "silent";
  requireInteraction: boolean;
  snoozeMins: number;
  primaryActionLabel: string;
  secondaryActionLabel: string;
}
```

`days` uses JavaScript weekday numbers: `0` Sunday through `6` Saturday. Empty `days` means every day. The default timezone is the browser timezone captured when the call is created, with `Europe/Rome` as fallback.

## Backend Design

Extend settings serialization and updates so `alarmConfigs` round-trips through `GET /settings` and `PUT /settings`.

Extend the push notification preferences with a `scheduledCalls` key so the user can control this category separately from sessions, messages, goals, and macro alerts.

Add scheduled-call checking to the existing push scheduler in `artifacts/api-server/src/routes/push.ts`:

- select users with push subscriptions
- load `alarmConfigs` from user settings
- parse and validate the versioned scheduled calls
- compare configured local weekday/time against the current time
- dedupe by user, call id, and local date/time
- send a push payload tagged as `scheduled-call:<id>`
- include `data.url` pointing to the app and `data.scheduledCall` with enough information to render the overlay

If VAPID keys are missing, keep the existing server behavior: push scheduling remains disabled and the UI should show that external delivery is unavailable.

## Service Worker

Update `public/sw.js` to respect scheduled-call payload fields:

- `requireInteraction` should be true for scheduled calls unless disabled by the user
- `vibrate` should use the configured vibration preset
- `icon` and `badge` should use configured assets when provided
- `tag` should be stable per scheduled call
- notification click should open the call route or add query params so the app can render the overlay

Actions can be included where supported, but the system must not rely on action-button support because browser support varies.

## Frontend Design

Create a focused scheduled-call editor rather than inflating the existing notification settings block too much. The settings section should include:

- a compact list of configured calls
- an add/edit panel
- weekday segmented controls
- time input
- toggles for enabled, persistent notification, and push category
- icon/logo input
- visual preset selector
- accent color swatch/input
- ringtone and vibration selectors
- test buttons for in-app overlay and push readiness

Mount the scheduled-call runtime globally in the authenticated app shell. It should:

- read scheduled call configs
- show the in-app overlay if a matching call fires while the app is open
- show the overlay when the app is opened from a scheduled-call push
- support dismiss and snooze

The existing `AppCallOverlay` should be evolved into a configurable call overlay. It should preserve the current sound behavior while adding a bank preset and payload-driven copy, colors, logo, and action labels.

## Error Handling

Invalid or malformed `alarmConfigs` should be ignored safely and replaced with an empty valid list in the UI.

If push is unsupported, blocked, or VAPID keys are absent, the UI should state that external calls cannot be delivered and still allow in-app preview.

If a custom icon URL is invalid, the notification should fall back to the default app icon.

The server scheduler must not throw on one malformed user's config; it should skip that config and continue processing other users.

## Testing

Add focused tests for:

- scheduled-call config parsing and serialization
- settings route helper round-tripping `alarmConfigs`
- notification preference normalization with `scheduledCalls`
- scheduler matching by weekday, time, timezone, and dedupe key
- service worker source containing scheduled-call fields such as `requireInteraction`, `vibrate`, and stable tags
- static frontend coverage that settings exposes the scheduled calls editor and app mounts the runtime

Manual QA:

- subscribe to push notifications
- create a bank-style scheduled call for the next minute
- close the app tab
- confirm the push appears
- click the push
- confirm the app opens into the customized bank call overlay
- verify dismiss and snooze behavior
- verify disabled calls do not fire
- verify selected weekdays are respected

## Non-Goals

This feature will not make browser push notifications visually identical to native phone calls, because the browser and operating system control that UI. It will not guarantee delivery when the device, browser, operating system, or push provider blocks notifications.
