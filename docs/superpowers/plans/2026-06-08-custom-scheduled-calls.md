# Custom Scheduled Calls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build fully configurable scheduled calls that can fire outside the app through server-side push notifications and open into a bank-style in-app call overlay.

**Architecture:** Store scheduled call configs in the existing `user_settings.alarm_configs` JSON field. Add focused parser/scheduler helpers, extend settings and push preferences, update the service worker payload handling, then add a settings editor and global runtime overlay.

**Tech Stack:** React, TypeScript, Vite, Express, Drizzle, Web Push, service worker notifications, local Node `assert` tests run with `tsx`.

---

## File Structure

- Create `artifacts/trader-dashboard/src/lib/scheduledCalls.ts`
  - Frontend scheduled call types, defaults, parsing, serialization, matching, and payload helpers.
- Create `artifacts/trader-dashboard/src/lib/scheduledCalls.test.ts`
  - Covers parsing, malformed configs, defaults, matching, and payload encoding.
- Create `artifacts/trader-dashboard/src/components/ScheduledCallOverlay.tsx`
  - Configurable bank-style call overlay with ringtone and dismiss/snooze controls.
- Create `artifacts/trader-dashboard/src/components/ScheduledCallRuntime.tsx`
  - Global runtime for in-app matching and opening overlays from push URLs.
- Create `artifacts/trader-dashboard/src/components/ScheduledCallsSettings.tsx`
  - Settings editor for creating and editing call configurations.
- Create `artifacts/trader-dashboard/src/components/ScheduledCallsSettings.static.test.ts`
  - Static coverage for editor controls and app mounting.
- Create `artifacts/api-server/src/services/notifications/scheduledCalls.ts`
  - Server parser, local-time matching, payload builder, dedupe key helpers.
- Create `artifacts/api-server/src/services/notifications/scheduledCalls.test.ts`
  - Covers server matching, malformed config handling, and payload construction.
- Modify `artifacts/api-server/src/routes/settings.ts`
  - Round-trip `alarmConfigs` in settings.
- Modify `artifacts/api-server/src/routes/settings.test.ts`
  - Cover `alarmConfigs` serialization and update.
- Modify `artifacts/api-server/src/routes/push.ts`
  - Add `scheduledCalls` preference and scheduler path.
- Modify `artifacts/trader-dashboard/src/lib/notifications.ts`
  - Add `scheduledCalls` preference copy and defaults.
- Modify `artifacts/trader-dashboard/src/lib/notifications.test.ts`
  - Cover `scheduledCalls` normalization.
- Modify `artifacts/trader-dashboard/public/sw.js`
  - Respect scheduled-call notification options and click URLs.
- Modify `artifacts/trader-dashboard/src/pages/Settings.tsx`
  - Render the scheduled calls editor in notification settings.
- Modify `artifacts/trader-dashboard/src/App.tsx`
  - Mount scheduled call runtime globally.

---

### Task 1: Frontend Scheduled Call Helpers

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/scheduledCalls.test.ts`
- Create: `artifacts/trader-dashboard/src/lib/scheduledCalls.ts`

- [ ] **Step 1: Write the failing helper test**

Add tests proving defaults, safe parsing, matching, and URL payload creation.

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/lib/scheduledCalls.test.ts`
Expected: FAIL because `scheduledCalls.js` does not exist.

- [ ] **Step 2: Implement helpers**

Implement `createDefaultScheduledCall`, `parseScheduledCalls`, `serializeScheduledCalls`, `isScheduledCallDue`, `encodeScheduledCallUrl`, and `decodeScheduledCallFromLocation`.

- [ ] **Step 3: Run helper test**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/lib/scheduledCalls.test.ts`
Expected: PASS and print `scheduled call helper checks passed`.

### Task 2: Settings Round Trip

**Files:**
- Modify: `artifacts/api-server/src/routes/settings.test.ts`
- Modify: `artifacts/api-server/src/routes/settings.ts`

- [ ] **Step 1: Add failing settings assertions**

Add assertions that `serializeSettings` parses `alarmConfigs` and `buildSettingsUpdateData` stringifies valid arrays.

Run: `pnpm --filter @workspace/api-server exec tsx src/routes/settings.test.ts`
Expected: FAIL because `alarmConfigs` is not round-tripped.

- [ ] **Step 2: Implement settings support**

Add `alarmConfigs` to `SettingsRecord`, parse in `serializeSettings`, and update in `buildSettingsUpdateData`.

- [ ] **Step 3: Run settings test**

Run: `pnpm --filter @workspace/api-server exec tsx src/routes/settings.test.ts`
Expected: PASS and print `settings route helper checks passed`.

### Task 3: Server Scheduled Call Push Logic

**Files:**
- Create: `artifacts/api-server/src/services/notifications/scheduledCalls.test.ts`
- Create: `artifacts/api-server/src/services/notifications/scheduledCalls.ts`
- Modify: `artifacts/api-server/src/routes/push.ts`

- [ ] **Step 1: Write failing server scheduler tests**

Cover malformed configs, weekday/time matching in `Europe/Rome`, empty days as every day, payload construction, and dedupe keys.

Run: `pnpm --filter @workspace/api-server exec tsx src/services/notifications/scheduledCalls.test.ts`
Expected: FAIL because the helper module does not exist.

- [ ] **Step 2: Implement server helpers**

Implement parser, formatter, matching, payload, vibration preset, and dedupe helpers.

- [ ] **Step 3: Wire push scheduler**

Add `scheduledCalls` notification preference and send scheduled-call pushes from `startSessionScheduler`.

- [ ] **Step 4: Run server tests**

Run: `pnpm --filter @workspace/api-server exec tsx src/services/notifications/scheduledCalls.test.ts`
Expected: PASS and print `server scheduled call checks passed`.

### Task 4: Notifications and Service Worker

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/notifications.test.ts`
- Modify: `artifacts/trader-dashboard/src/lib/notifications.ts`
- Create: `artifacts/trader-dashboard/public/sw.scheduled-calls.test.ts`
- Modify: `artifacts/trader-dashboard/public/sw.js`

- [ ] **Step 1: Add failing notification preference assertions**

Add assertions for `scheduledCalls` default and label.

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/lib/notifications.test.ts`
Expected: FAIL until the preference exists.

- [ ] **Step 2: Implement notification preference copy**

Add `scheduledCalls` to defaults, order, labels, and descriptions.

- [ ] **Step 3: Add failing service worker static test**

Assert `scheduledCall`, `requireInteraction`, `vibrate`, `actions`, and URL handling are present.

Run: `pnpm --filter @workspace/trader-dashboard exec tsx public/sw.scheduled-calls.test.ts`
Expected: FAIL until `sw.js` handles scheduled calls.

- [ ] **Step 4: Update service worker**

Map scheduled-call payload fields to notification options and click behavior.

### Task 5: Frontend UI and Runtime

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ScheduledCallOverlay.tsx`
- Create: `artifacts/trader-dashboard/src/components/ScheduledCallRuntime.tsx`
- Create: `artifacts/trader-dashboard/src/components/ScheduledCallsSettings.tsx`
- Create: `artifacts/trader-dashboard/src/components/ScheduledCallsSettings.static.test.ts`
- Modify: `artifacts/trader-dashboard/src/pages/Settings.tsx`
- Modify: `artifacts/trader-dashboard/src/App.tsx`

- [ ] **Step 1: Add failing static frontend tests**

Assert the settings editor exposes caller, days, time, preset, ringtone, vibration, and push status controls, and that `App.tsx` mounts `ScheduledCallRuntime`.

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/ScheduledCallsSettings.static.test.ts`
Expected: FAIL until files and mounts exist.

- [ ] **Step 2: Implement overlay and runtime**

Add bank-style overlay, ringtone handling, URL payload opening, in-app due checks, dismiss, and snooze.

- [ ] **Step 3: Implement settings editor**

Add list/editor UI that round-trips `alarmConfigs` through `useUpdateUserSettings`, includes full customization controls, and can preview the call overlay.

- [ ] **Step 4: Mount editor/runtime**

Render `ScheduledCallsSettings` inside notification settings and mount `ScheduledCallRuntime` in `AuthenticatedShell`.

### Task 6: Verification

**Files:**
- No new files expected.

- [ ] **Step 1: Run focused tests**

Run all focused scheduled-call and notification tests.

- [ ] **Step 2: Run typechecks**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
pnpm --filter @workspace/api-server run typecheck
```

- [ ] **Step 3: Run broader tests when focused checks pass**

Run: `pnpm test`

- [ ] **Step 4: Manual QA note**

Start local runtime, subscribe to push, create a call for the next minute, close the tab, confirm push, click it, and confirm the bank overlay opens.
