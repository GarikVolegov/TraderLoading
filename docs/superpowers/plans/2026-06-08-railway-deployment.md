# Railway Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure the monorepo so Railway can run TraderLoadings as one always-on web service for the API, frontend, and app-closed push notifications.

**Architecture:** Build the Vite frontend and Express API in one Railway deployment. The API service starts on Railway's `PORT`, serves `/api/*` from Express, and serves the frontend build as the SPA fallback from the same HTTPS origin.

**Tech Stack:** Railway Config as Code, pnpm workspaces, Express, Vite, Drizzle/Postgres, Web Push VAPID.

---

### Task 1: Static Deployment Contract

**Files:**
- Create: `scripts/local/railwayDeploy.test.ts`

- [ ] **Step 1: Add a static test for the Railway contract**

Create a test that verifies `railway.json`, production scripts, healthcheck configuration, and frontend static serving are wired.

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm --filter ./scripts exec tsx local/railwayDeploy.test.ts`

Expected: FAIL because the Railway deployment files are not configured yet.

### Task 2: Railway Runtime Configuration

**Files:**
- Create: `railway.json`
- Modify: `package.json`
- Modify: `artifacts/api-server/package.json`
- Modify: `artifacts/api-server/src/app.ts`
- Modify: `.env.production.example`

- [ ] **Step 1: Add production scripts**

Add root scripts for `build:railway`, `start:railway`, and `db:push`. Add an API `start` script that runs `node ./dist/index.cjs`.

- [ ] **Step 2: Add Railway config as code**

Create `railway.json` with Railpack build command, start command, `/api/healthz` healthcheck, and an always-restart policy.

- [ ] **Step 3: Serve frontend from the API**

Update the Express app to serve `../trader-dashboard/dist/public` in production and fall back to `index.html` for non-API routes.

- [ ] **Step 4: Document production variables**

Add Railway-specific variables to `.env.production.example`.

### Task 3: Verification

**Files:**
- Test: `scripts/local/railwayDeploy.test.ts`

- [ ] **Step 1: Run the Railway deployment test**

Run: `pnpm --filter ./scripts exec tsx local/railwayDeploy.test.ts`

Expected: PASS.

- [ ] **Step 2: Run typechecks**

Run: `pnpm --filter @workspace/api-server run typecheck`

Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`

Expected: PASS.
