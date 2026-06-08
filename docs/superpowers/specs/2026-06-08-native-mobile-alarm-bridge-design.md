# Native Mobile Alarm Bridge Design

## Goal

Upgrade scheduled calls from browser-only reminders into mobile-aware alarms. Android should be able to wake the screen and show a custom full-screen alarm/call surface. iOS 26+ should behave like a real alarm by using AlarmKit, with a dedicated TraderLOADING alarm presentation on system surfaces and the existing custom call overlay when the app opens.

These reminders are not real VoIP calls. The implementation must not use iOS PushKit or CallKit to fake incoming phone calls.

## Platform Reality

Android supports full-screen notification intents for urgent alarms and calls. For target SDK 34 and newer, the app must declare and verify `USE_FULL_SCREEN_INTENT`, and users can disable this permission. The Android path is allowed only because this feature is an alarm/reminder configured by the user.

iOS 26+ provides AlarmKit for third-party alarms and timers. AlarmKit is the primary iOS path because it is designed for user-scheduled alarms that can appear prominently on system surfaces such as the Lock Screen, Dynamic Island, StandBy, and Apple Watch. It supports schedules, snooze, stop actions, and customizable alarm presentation metadata.

Older iOS versions cannot provide the same alarm behavior for third-party apps. For those devices, the fallback remains Time Sensitive notifications, with optional Critical Alerts only if Apple grants the entitlement. Critical Alerts can play strong sounds even through mute or Focus, but require a special entitlement. CallKit and PushKit are only for real VoIP calls and are out of scope for these reminders.

References:

- Android urgent notifications and full-screen intents: https://developer.android.com/develop/ui/views/notifications/build-notification
- Android 14 full-screen intent limits: https://developer.android.com/about/versions/14/behavior-changes-14
- Apple AlarmKit: https://developer.apple.com/documentation/AlarmKit
- Apple AlarmKit scheduling sample: https://developer.apple.com/documentation/AlarmKit/scheduling-an-alarm-with-alarmkit
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
- iOS AlarmKit: available, unsupported OS, unavailable, or permission disabled.
- iOS fallback alerts: Time Sensitive available, Critical Alerts available, or permission disabled.
- Web push fallback: available or blocked.

The copy should be direct and platform-specific. On iOS 26+ it should say alarms use the native iOS alarm system with TraderLOADING presentation. On older iOS versions it must say that only alert-style fallback delivery is available and the full custom call surface appears after opening the alert.

Add a device test action:

- Android: test full-screen alarm.
- iOS 26+: test AlarmKit alarm.
- Older iOS: test Time Sensitive or Critical alert, depending on entitlement status.
- Web: test browser push fallback.

## Architecture

Create a `MobileAlarmBridge` boundary with three implementations:

- `webAlarmBridge`: current service worker push behavior.
- `androidAlarmBridge`: native Android alarm/full-screen notification integration.
- `iosAlarmBridge`: native iOS alarm integration using AlarmKit on iOS 26+, with Time Sensitive and optional Critical Alerts fallback on older versions.

The React app talks to a small shared interface:

```ts
interface MobileAlarmCapabilities {
  platform: "web" | "android" | "ios";
  fullScreenAlarm: "available" | "blocked" | "unsupported";
  alarmKit: "available" | "blocked" | "unsupported";
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

iOS 26+ should use AlarmKit for local alarm scheduling and presentation. This is the primary iOS implementation because the user wants these reminders to behave like alarms, not ordinary notifications.

The AlarmKit implementation should:

- request AlarmKit authorization through `AlarmManager`;
- schedule one-time and repeating alarms from `ScheduledCallConfig`;
- map configured weekdays and local time to AlarmKit schedules;
- configure alarm presentation metadata with TraderLOADING title, subtitle, accent, icon, and button labels;
- support stop and snooze through AlarmKit actions;
- expose a native open action that launches the app into `ScheduledCallOverlay`;
- keep alarm identifiers synced with saved scheduled-call ids so edits, disables, and deletes update the native schedule.

The dedicated iOS graphics should use native AlarmKit/SwiftUI surfaces, not a React view embedded directly in the Lock Screen. The goal is a clear TraderLOADING alarm identity within Apple's allowed presentation system:

- strong app icon and monogram;
- institutional/risk-desk title and subtitle;
- configured accent color where supported;
- stop/snooze/open button copy that matches the scheduled call;
- widget or Live Activity presentation for compatible system surfaces, including Lock Screen, Dynamic Island, StandBy, and Apple Watch where supported.

Older iOS fallback should use `UNUserNotificationCenter`:

- use `UNNotificationInterruptionLevel.timeSensitive` for urgent reminders where available;
- use Critical Alert sound only when the entitlement and user permission are present;
- include scheduled-call payload data for app routing;
- optionally use a Notification Content Extension for richer branded notification detail when the user expands the alert;
- open the React overlay immediately when the user taps the alert;
- support snooze by scheduling a follow-up local notification from native code.

iOS must not:

- use PushKit for these reminders;
- use CallKit unless the product later adds real live audio calls;
- claim arbitrary React-controlled lock-screen UI outside AlarmKit-supported presentation.

## Data Flow

The existing `ScheduledCallConfig` remains the shared config model.

Server-side scheduler:

1. Reads enabled scheduled-call configs.
2. Checks local weekday/time and dedupe.
3. Sends platform-aware payloads when remote delivery is required.
4. Falls back to existing web push subscriptions when no native token exists.

Mobile app:

1. Registers native notification/device tokens per platform.
2. Reports capabilities to the frontend.
3. Mirrors saved scheduled calls into native schedules.
4. Receives remote alarm payloads when server-side delivery is needed.
5. Opens the appropriate native or React surface.

React app:

1. Keeps the scheduled-call editor and preview.
2. Shows capability and permission state.
3. Calls the mobile bridge after create, update, disable, delete, snooze, and test actions.
4. Routes opened alarm payloads to `ScheduledCallOverlay`.
5. Keeps browser push support for web users.

## Backend Changes

Add native device registration endpoints alongside existing web push endpoints:

- `POST /push/native-device`
- `DELETE /push/native-device`
- `GET /push/native-capabilities`

Store platform, token, user id, environment, app version, and last capability report. The scheduler should prefer native delivery for mobile app devices and web push for browsers.

For iOS AlarmKit, local scheduling should be preferred after the app has synced the user's scheduled calls. Remote push remains useful for cross-device changes, server-authored alarm changes, and devices that cannot keep local schedules synced.

Payloads should include:

- scheduled call id;
- notification title/body;
- ringtone/vibration preset;
- urgency level;
- snooze minutes;
- serialized call overlay data;
- iOS delivery mode: `alarmKit`, `timeSensitive`, or `critical`;
- dedupe key.

## Error Handling

If Android full-screen permission is missing, show a settings CTA and fall back to high-priority notification.

If iOS AlarmKit is unavailable because the OS is too old, show the fallback state and use Time Sensitive or Critical Alerts when available.

If iOS AlarmKit permission is denied, show a settings CTA and use the strongest allowed fallback notification.

If iOS Time Sensitive is disabled on a fallback device, fall back to normal notification and show a permission explanation.

If Critical Alerts entitlement is absent, hide the critical-alert toggle or label it as unavailable. Do not request `criticalAlert` permission unless the entitlement is actually present.

If native delivery fails, keep existing web push behavior where possible and log the platform-specific failure without blocking other users.

Malformed scheduled-call payloads should be ignored safely. The native layer should never crash while handling a reminder payload.

## Testing

Add focused tests for:

- shared capability normalization;
- backend native device registration validation;
- scheduler choosing native vs web delivery;
- Android payload includes full-screen alarm metadata;
- iOS AlarmKit bridge maps `ScheduledCallConfig` to one-time and repeating alarm schedules;
- iOS fallback payload uses Time Sensitive by default and Critical only when available;
- React settings copy accurately distinguishes iOS AlarmKit from older iOS fallback behavior;
- opened native payload routes to `ScheduledCallOverlay`.

Manual QA:

- Android locked device receives full-screen alarm and wakes screen.
- Android full-screen permission disabled falls back and shows settings CTA.
- iOS 26+ locked device receives an AlarmKit alarm with TraderLOADING presentation.
- iOS 26+ snooze and stop work from the alarm surface.
- iOS 26+ open action launches the custom React overlay.
- Older iOS locked device receives Time Sensitive alert.
- Older iOS opens directly into the custom overlay after tapping the alert.
- iOS Critical Alert path is tested only on a build/profile with approved entitlement.
- Web browser push still opens the existing overlay.

## Non-Goals

This project will not make iOS show arbitrary React UI on the Lock Screen. iOS lock-screen alarm presentation must use AlarmKit and supported Apple extension surfaces.

This project will not use CallKit or PushKit for fake calls.

This project will not guarantee delivery when the operating system, user permissions, Focus settings, notification settings, or push providers block alerts.

## Approval Summary

Approved direction: reminders/sveglie, not VoIP calls.

Android target behavior: full-screen alarm with wake-screen behavior.

iOS target behavior: AlarmKit is the primary path on iOS 26+ so reminders behave like real alarms with dedicated native TraderLOADING presentation. Time Sensitive and optional Critical Alerts remain fallback paths for older iOS versions or unavailable AlarmKit permission.
