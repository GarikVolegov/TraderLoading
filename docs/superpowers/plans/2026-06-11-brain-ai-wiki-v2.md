# Brain AI Wiki V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the private Brain AI wiki by improving ingestion, storage safety, query evidence handling, and the `/wiki` user interface.

**Architecture:** Keep the current Postgres-backed wiki graph and async ingest flow. Add focused helpers in the existing wiki services rather than introducing a new subsystem.

**Tech Stack:** TypeScript, Express, Drizzle/Postgres, React, TanStack Query, local filesystem storage, optional S3-compatible storage.

---

### Task 1: Backend Ingest And Storage Hardening

**Files:**
- Modify: `artifacts/api-server/src/services/wikiProcessor.ts`
- Modify: `artifacts/api-server/src/services/wikiProcessor.test.ts`
- Modify: `artifacts/api-server/src/services/wikiStorage.ts`
- Modify: `artifacts/api-server/src/services/wikiStorage.test.ts`

- [ ] Write failing tests for Office ZIP XML extraction, URL cleanup, unsupported Office guidance, and local storage path containment.
- [ ] Implement minimal Office XML extraction for DOCX/PPTX/XLSX without adding heavy runtime dependencies.
- [ ] Add fetch timeout and max response guard for URL ingestion.
- [ ] Harden local storage `get` and `delete` against path traversal.
- [ ] Run focused backend tests.

### Task 2: Query Evidence Quality

**Files:**
- Modify: `artifacts/api-server/src/services/wikiGraph.ts`
- Create: `artifacts/api-server/src/services/wikiGraph.static.test.ts`

- [ ] Write a static regression test proving pending transcription text is excluded from query evidence.
- [ ] Filter `pending_transcription:` chunks from query retrieval and wiki analysis context.
- [ ] Run focused graph static test and API typecheck.

### Task 3: Wiki UI Polish

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Wiki.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Wiki.static.test.ts`

- [ ] Write static tests for concrete copy, status/type filters, and visible error handling.
- [ ] Replace missing copy placeholders with production text.
- [ ] Add source status/type filters and mutation error banners.
- [ ] Run focused dashboard test and dashboard typecheck.

### Task 4: Verification

**Files:**
- No new files.

- [ ] Run all focused wiki tests.
- [ ] Run API and dashboard typechecks.
- [ ] Smoke test `/wiki` and `/api/healthz` locally if the dev stack is available.
