# Native Mobile Alarm Bridge Design

## Goal

Upgrade scheduled calls from browser-only reminders into mobile-aware alarms. Android should be able to wake the screen and show a custom full-screen alarm/call surface. iOS should deliver the strongest compliant reminder path available for non-VoIP alarms, then open the existing custom call overlay in the app.

These reminders are not real VoIP calls. The implementation must not use iOS PushKit or CallKit to fake incoming phone calls.

## Platform Reality

Android supports full-screen notification intents for urgent alarms and calls. For target SDK 34 and newer, the app must declare and verify `USE_FULL_SCREEN_INTENT`, and users can disable this permission. The Android path is allowed only because this feature is an alarm/reminder configured by the user.

iOS does not allow a generic reminder app to launch a custom full-screen lock-screen UI automatically. For reminders, iOS supports normal, Time Sensitive, and, with Apple approval, Critical Alerts. Critical Alerts can play strong sounds even through mute or Focus, but require a special entitlement. CallKit and PushKit are only for real VoIP calls and are out of scope for these reminders.

References:

- Android urgent notifications and full-screen intents: https://developer.android.com/develop/ui/views/notifications/build-notification
- Android 14 full-screen intent limits: https://developer.android.com/about/versions/14/behavior-changes-14
- Apple Time Sensitive notifications: https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive
- Apple Critical Alerts entitlement: https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.usernotifications.critical-alerts
- Apple PushKit VoIP rules: https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit

## Recommended Approach

Add a native mobile bridge around the existing React scheduled-call feature.

Use the current web/PWA implementation as the fallback and configuration layer. The React app remains responsible for the editor, preview, stored configuration, and in-app overlay. Native mobile code becomes responsible for device-level delivery, wake behavior, and platform-specific permissions.

This keeps one product model while letting each platform use the strongest compliant behavior it actually supports.

## User Experience

Users continue creating scheduled calls in `Settings > Notifications`.

Add a delivery status area that explains device capability:

- Android full-screen alarm: available, unavailable, or permission disabled.
- iOS Time Sensitive alerts: available, unavailable, or permission disabled.
- iOS Critical Alerts: not requested, pending entitlement, available, or permission disabled.
- Web push fallback: available or blocked.

The copy should be direct and platform-specific. On iOS it must say that the custom full-screen call surface appears after opening the alert, not automatically on the lock screen.

Add a device test action:

- Android: test full-screen alarm.
- iOS: test Time Sensitive or Critical alert, depending on entitlement status.
- Web: test browser push fallback.

## Architecture

Create a `MobileAlarmBridge` boundary with three implementations:

- `webAlarmBridge`: current service worker push behavior.
- `androidAlarmBridge`: native Android alarm/full-screen notification integration.
- `iosAlarmBridge`: native iOS notification integration using Time Sensitive and optional Critical Alerts.

The React app talks to a small shared interface:

```ts
interface MobileAlarmCapabilities {
  platform: "web" | "android" | "ios";
  fullScreenAlarm: "available" | "blocked" | "unsupported";
  timeSensitive: "available" | "blocked" | "unsupported";
  criticalAlerts: "available" | "blocked" | "notEntitled" | "unsupported";
}

interface MobileAlarmBridge {
  getCapabilities(): Promise<MobileAlarmCapabilities>;
  requestPermissions(): Promise<MobileAlarmCapabilities>;
  testAlarm(call: ScheduledCallConfig): Promise<void>;
}
```

The bridge can be implemented with Capacitor or another native shell. The existing Vite/React app can stay intact inside that shell.

## Android Design

Android should create a high-importance alarm notification channel and schedule/show an alarm notification with a full-screen intent. The full-screen intent opens a dedicated alarm activity or route that renders the scheduled-call overlay immediately.

The Android alarm activity should:

- call `setShowWhenLocked(true)`;
- call `setTurnScreenOn(true)`;
- keep the screen awake while the alarm is active;
- use an alarm audio stream or clearly audible ringtone;
- vibrate according to the configured preset;
- expose dismiss and snooze actions;
- return to the app shell after the user dismisses or accepts.

Permissions and settings:

- declare `USE_FULL_SCREEN_INTENT`;
- check `NotificationManager.canUseFullScreenIntent()` where available;
- provide a settings shortcut using `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT` when blocked;
- request notification permission on Android 13+;
- degrade to a heads-up/high-priority notification if full-screen is disabled.

## iOS Design

iOS should use `UNUserNotificationCenter` for local or remote reminders. Default delivery is Time Sensitive where the app is entitled and the user allows it. Critical Alerts are optional and require Apple approval before implementation can fully work in production.

The iOS notification should:

- use `UNNotificationInterruptionLevel.timeSensitive` for urgent reminders;
- use Critical Alert sound only when the entitlement and user permission are present;
- include scheduled-call payload data for app routing;
- open the React overlay immediately when the user taps the alert;
- support snooze by scheduling a follow-up local notification from native code.

iOS must not:

- use PushKit for these reminders;
- use CallKit unless the product later adds real live audio calls;
- claim a custom full-screen lock-screen UI for reminders.

## Data Flow

The existing `ScheduledCallConfig` remains the shared config model.

Server-side scheduler:

1. Reads enabled scheduled-call configs.
2. Checks local weekday/time and dedupe.
3. Sends platform-aware payloads when a native device token exists.
4. Falls back to existing web push subscriptions when no native token exists.

Mobile app:

1. Registers native notification/device tokens per platform.
2. Reports capabilities to the frontend.
3. Receives alarm payloads.
4. Opens the appropriate native or React surface.

React app:

1. Keeps the scheduled-call editor and preview.
2. Shows capability and permission state.
3. Routes opened alarm payloads to `ScheduledCallOverlay`.
4. Keeps browser push support for web users.

## Backend Changes

Add native device registration endpoints alongside existing web push endpoints:

- `POST /push/native-device`
- `DELETE /push/native-device`
- `GET /push/native-capabilities`

Store platform, token, user id, environment, app version, and last capability report. The scheduler should prefer native delivery for mobile app devices and web push for browsers.

Payloads should include:

- scheduled call id;
- notification title/body;
- ringtone/vibration preset;
- urgency level;
- snooze minutes;
- serialized call overlay data;
- dedupe key.

## Error Handling

If Android full-screen permission is missing, show a settings CTA and fall back to high-priority notification.

If iOS Time Sensitive is disabled, fall back to normal notification and show a permission explanation.

If Critical Alerts entitlement is absent, hide the critical-alert toggle or label it as unavailable. Do not request `criticalAlert` permission unless the entitlement is actually present.

If native delivery fails, keep existing web push behavior where possible and log the platform-specific failure without blocking other users.

Malformed scheduled-call payloads should be ignored safely. The native layer should never crash while handling a reminder payload.

## Testing

Add focused tests for:

- shared capability normalization;
- backend native device registration validation;
- scheduler choosing native vs web delivery;
- Android payload includes full-screen alarm metadata;
- iOS payload uses Time Sensitive by default and Critical only when available;
- React settings copy accurately describes iOS limits;
- opened native payload routes to `ScheduledCallOverlay`.

Manual QA:

- Android locked device receives full-screen alarm and wakes screen.
- Android full-screen permission disabled falls back and shows settings CTA.
- iOS locked device receives Time Sensitive alert.
- iOS opens directly into the custom overlay after tapping the alert.
- iOS Critical Alert path is tested only on a build/profile with approved entitlement.
- Web browser push still opens the existing overlay.

## Non-Goals

This project will not make iOS show a custom full-screen lock-screen interface for non-VoIP reminders, because iOS does not provide that capability.

This project will not use CallKit or PushKit for fake calls.

This project will not guarantee delivery when the operating system, user permissions, Focus settings, notification settings, or push providers block alerts.

## Approval Summary

Approved direction: reminders/sveglie, not VoIP calls.

Android target behavior: full-screen alarm with wake-screen behavior.

iOS target behavior: strongest compliant notification path, with Time Sensitive by default and Critical Alerts only if Apple grants the entitlement. Custom overlay appears after the user opens the alert.
