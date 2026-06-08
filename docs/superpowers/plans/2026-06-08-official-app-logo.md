# Official App Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rocket TraderLOADING mark the official app icon for browser tabs, installed desktop/mobile web apps, and local notifications.

**Architecture:** Keep icons as static public assets in `artifacts/trader-dashboard/public`. Use explicit manifest icon sizes for PWA installation and update browser/notification references to the same official PNG family.

**Tech Stack:** Vite, static public assets, Web App Manifest, TypeScript React notification calls.

---

### Task 1: Generate Logo Assets

**Files:**
- Create: `artifacts/trader-dashboard/public/app-icon-source.png`
- Create: `artifacts/trader-dashboard/public/app-icon.png`
- Create: `artifacts/trader-dashboard/public/app-icon-512.png`
- Create: `artifacts/trader-dashboard/public/app-icon-192.png`
- Create: `artifacts/trader-dashboard/public/apple-touch-icon.png`
- Create: `artifacts/trader-dashboard/public/favicon-32x32.png`

- [ ] **Step 1: Generate a 1024x1024 source PNG**

Use a local drawing script to produce a dark rounded-square icon with a silver rocket, galaxy, stars, gold/cyan exhaust ribbons, and gold `TL` monogram.

- [ ] **Step 2: Generate resized variants**

Resize from the 1024 source to 512, 192, 180, and 32 pixel PNG outputs.

### Task 2: Wire Browser and PWA Metadata

**Files:**
- Modify: `artifacts/trader-dashboard/public/manifest.json`
- Modify: `artifacts/trader-dashboard/index.html`

- [ ] **Step 1: Update manifest icons**

Reference `/app-icon-192.png`, `/app-icon-512.png`, and `/app-icon.png` with explicit sizes and `any maskable` purpose for install surfaces.

- [ ] **Step 2: Update HTML icon links**

Point favicon to `/favicon-32x32.png`, primary app icon to `/app-icon.png`, and Apple touch icon to `/apple-touch-icon.png`.

### Task 3: Wire App Notification Icons

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/GoalReminders.tsx`
- Modify: `artifacts/trader-dashboard/src/components/DailyAlarmNotifier.tsx`
- Modify: `artifacts/trader-dashboard/src/components/MacroNotifier.tsx`
- Modify: `artifacts/trader-dashboard/src/components/SessionStartNotifier.tsx`
- Modify: `artifacts/trader-dashboard/src/components/WelcomeNotification.tsx`

- [ ] **Step 1: Replace legacy favicon references**

Change notification `icon` values from `/favicon.ico` to `/app-icon-192.png`.

### Task 4: Verify

**Files:**
- Read: `artifacts/trader-dashboard/public/manifest.json`
- Run: `pnpm --filter @workspace/trader-dashboard build`

- [ ] **Step 1: Confirm generated files exist**

Check all expected PNG assets are present under `artifacts/trader-dashboard/public`.

- [ ] **Step 2: Build the dashboard**

Run the Vite build and confirm it exits with status 0.
