# Journal Saved Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist journal tags independently from journal entries so new tags can be reused on later trades.

**Architecture:** Add a `journal_tags` DB table and small backend helpers for normalization, persistence, and summary merging. Add `POST /journal/tags` for immediate library saves from the tag chip input, while keeping journal create/update as a fallback persistence path.

**Tech Stack:** TypeScript, Express, Drizzle, React Query, pnpm/tsx tests.

---

### Task 1: Backend Tag Helpers And Schema

**Files:**
- Modify: `lib/db/src/schema/journal.ts`
- Modify: `artifacts/api-server/src/routes/journal.ts`
- Test: `artifacts/api-server/src/routes/journal.test.ts`

- [ ] **Step 1: Write failing helper tests**

Add assertions that import `normalizeJournalTags` and `mergeJournalTagSummaries` from `journal.ts`, expecting `" Breakout, breakout, NY Open "` to normalize to `["Breakout", "NY Open"]` and saved tag `"London"` to merge with count `0`.

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @workspace/api-server exec tsx src/routes/journal.test.ts`

Expected: FAIL because the helper exports do not exist yet.

- [ ] **Step 3: Add DB table and helpers**

Create `journalTagsTable` with `id`, `tag`, `tagKey`, `userId`, `createdAt`, and `updatedAt`. Export helper functions from `journal.ts`: `normalizeJournalTags`, `serializeJournalTags`, `mergeJournalTagSummaries`.

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter @workspace/api-server exec tsx src/routes/journal.test.ts`

Expected: PASS.

### Task 2: Persist Tags On Journal Save

**Files:**
- Modify: `artifacts/api-server/src/routes/journal.ts`
- Test: `artifacts/api-server/src/routes/journal.test.ts`

- [ ] **Step 1: Write failing persistence-oriented tests**

Extend the route test to assert that the tag route remains before the dynamic id route and that merging saved tags with entry counts returns sorted summaries.

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @workspace/api-server exec tsx src/routes/journal.test.ts`

Expected: FAIL until route/helper behavior is updated.

- [ ] **Step 3: Implement persistence**

On `POST /journal` and `PUT /journal/:id`, normalize the submitted tags, store normalized tags on the entry, and insert missing normalized tag keys into `journal_tags`. Update `GET /journal/tags` to read both saved tags and entry tags.

- [ ] **Step 4: Run backend route tests**

Run: `pnpm --filter @workspace/api-server exec tsx src/routes/journal.test.ts`

Expected: PASS.

### Task 3: Frontend API Contract

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/journalTagsApi.test.ts`
- Modify: `artifacts/trader-dashboard/src/lib/journalTagsApi.ts`

- [ ] **Step 1: Write failing frontend API test**

Add a test case where `fetchJournalTags()` returns `[{ tag: "London", count: 0 }]`.

- [ ] **Step 2: Run test**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/lib/journalTagsApi.test.ts`

Expected: PASS if the existing API client already accepts count `0`; otherwise update the type/logic minimally.

### Task 4: Verification

**Files:**
- Verify touched backend and frontend tests.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/routes/journal.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/journalTagsApi.test.ts
```

- [ ] **Step 2: Run typechecks where practical**

Run:

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/trader-dashboard run typecheck
```
