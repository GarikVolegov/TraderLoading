# DM Generic Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow direct messages to send videos, PDFs, and generic documents from the existing attachment button.

**Architecture:** Add one backend upload endpoint for generic chat files and keep current image/voice endpoints compatible. The frontend will route selected files by MIME type, encrypt file metadata into the DM payload, and render video/file bubbles alongside existing text/image/voice bubbles.

**Tech Stack:** Express, Multer, React, TanStack Query, E2EE helpers, static Node tests, TypeScript.

---

## File Structure

- Modify `artifacts/api-server/src/routes/social.ts`: add `POST /social/upload-file`, `CHAT_FILES_DIR`, 50 MB limit, and blocked extension filtering.
- Modify `artifacts/api-server/src/routes/friends.test.ts`: no change.
- Modify `artifacts/trader-dashboard/src/pages/Chat.tsx`: extend decrypted message types, upload selected files through the correct endpoint, and render video/file bubbles.
- Modify `artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts`: add static assertions covering generic attachments.

---

### Task 1: Backend Generic File Upload

**Files:**
- Modify: `artifacts/api-server/src/routes/social.ts`
- Test: `artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts`

- [ ] **Step 1: Write failing static assertions**

Add assertions that require `upload-file`, `chat-files`, `50 * 1024 * 1024`, and blocked extension names.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import file:///C:/Users/osman/Desktop/TraderLoadingsLOCALE/node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/loader.mjs src/pages/Chat.friend-requests.static.test.ts
```

Expected: FAIL because backend and frontend source do not yet contain the generic attachment flow.

- [ ] **Step 3: Implement generic file upload**

Add a `CHAT_FILES_DIR`, `chatFileUpload`, blocked extension set, and `POST /social/upload-file`. Return `{ fileUrl, fileName, mimeType, size }`.

- [ ] **Step 4: Run backend typecheck**

Run:

```bash
pnpm --filter @workspace/api-server run typecheck
```

Expected: PASS.

---

### Task 2: Frontend Send/Render Generic Attachments

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Chat.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts`

- [ ] **Step 1: Extend failing static assertions**

Require `"video" | "file"`, `social/upload-file`, `video controls`, `Download`, and `accept="*"`.

- [ ] **Step 2: Implement send flow**

Update selected file handler so image files still use `social/upload-image`; every other file uses `social/upload-file`. Encrypt payload `{ type, url, fileName, mimeType, size }`, where `type` is `video` for video MIME types and `file` otherwise.

- [ ] **Step 3: Implement render flow**

Render video messages with `<video controls>` and generic files with a compact card showing name, size/type, and an open/download link.

- [ ] **Step 4: Run frontend checks**

Run:

```bash
node --import file:///C:/Users/osman/Desktop/TraderLoadingsLOCALE/node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/loader.mjs src/pages/Chat.friend-requests.static.test.ts
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

---

### Task 3: Final Verification

**Files:**
- Review: `artifacts/api-server/src/routes/social.ts`
- Review: `artifacts/trader-dashboard/src/pages/Chat.tsx`
- Review: `artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts`

- [ ] **Step 1: Run full tests**

Run:

```bash
pnpm test
```

Expected: `0 failed`.

- [ ] **Step 2: Run targeted typechecks**

Run:

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

## Self-Review

- Spec coverage: backend upload, frontend upload routing, video rendering, file rendering, existing images/vocals preserved.
- Deferred-work scan: no deferred implementation is required.
- Type consistency: DM message types are `text`, `image`, `voice`, `video`, and `file`.
