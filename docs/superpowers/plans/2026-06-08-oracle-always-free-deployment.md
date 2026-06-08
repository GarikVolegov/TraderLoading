# Oracle Always Free Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure TraderLoadings for a free Oracle Cloud Always Free VM deployment that can keep scheduled push calls running 24/7.

**Architecture:** Build the existing monorepo into a Docker image, run the app with Docker Compose, put Caddy in front for HTTPS, and run Postgres locally in a persistent Docker volume.

**Tech Stack:** Oracle Cloud Always Free VM.Standard.A1.Flex, Docker Compose, Caddy, PostgreSQL, pnpm, Express, Vite.

---

### Task 1: Deployment Contract

**Files:**
- Create: `scripts/local/oracleDeploy.test.ts`

- [x] **Step 1: Write the failing test**

The test verifies the Oracle Dockerfile, Compose stack, Caddyfile, env example, Docker ignore rules, and deployment guide.

- [x] **Step 2: Run it to verify it fails**

Run: `pnpm --filter ./scripts exec tsx local/oracleDeploy.test.ts`

Expected: FAIL while deployment files are absent.

### Task 2: Oracle Docker Stack

**Files:**
- Create: `Dockerfile.oracle`
- Create: `compose.oracle.yml`
- Create: `deploy/oracle/Caddyfile`
- Create: `.env.oracle.example`
- Create: `.dockerignore`

- [x] **Step 1: Add Dockerfile**

Build dependencies with pnpm 11, pass Vite build args, run `pnpm run build:railway`, and start `artifacts/api-server/dist/index.cjs`.

- [x] **Step 2: Add Compose stack**

Define Caddy, app, and Postgres services with persistent volumes and health checks.

- [x] **Step 3: Add env example**

Document domain, Postgres, Clerk, VAPID, and optional integrations without real secrets.

### Task 3: Operator Guide

**Files:**
- Create: `docs/deploy/oracle-always-free.md`

- [x] **Step 1: Add VM setup steps**

Document VM shape, ingress ports, Docker install, env creation, database push, startup, updates, and backup.

### Task 4: Verification

**Files:**
- Test: `scripts/local/oracleDeploy.test.ts`

- [ ] **Step 1: Run Oracle deploy test**

Run: `pnpm --filter ./scripts exec tsx local/oracleDeploy.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run: `pnpm test`

Expected: PASS.
