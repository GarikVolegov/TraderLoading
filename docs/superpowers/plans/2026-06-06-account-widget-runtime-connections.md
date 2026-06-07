# Account Widget Runtime Connections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the account widget connect MT5/FP Trading profiles, show connected accounts, and open orders from the account workspace.

**Architecture:** Add a runtime account bridge controller that can switch configurations without restarting the API. Store local connection profiles in `.local/account-connections.json` without passwords, expose REST endpoints for listing/saving/activating profiles, and update the widget/workspace to open directly into Connect, Accounts, or Order tabs.

**Tech Stack:** Express, TypeScript, WebSocket `ws`, React, Radix Tabs, existing MT5 local socket adapter.

---

### Task 1: Runtime Profile Store

**Files:**
- Create: `artifacts/api-server/src/services/accountBridge/profileStore.ts`
- Test: `artifacts/api-server/src/services/accountBridge/profileStore.test.ts`

- [ ] Write tests that create a temporary store, save a live MT5 profile, reload it, and verify no password field is accepted or persisted.
- [ ] Implement atomic-ish JSON persistence with a default store path under `.local/account-connections.json`.
- [ ] Run `pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/profileStore.test.ts`.

### Task 2: Switchable Runtime

**Files:**
- Create: `artifacts/api-server/src/services/accountBridge/accountBridgeRuntime.ts`
- Modify: `artifacts/api-server/src/services/accountBridge/socketServer.ts`
- Test: `artifacts/api-server/src/services/accountBridge/accountBridgeRuntime.test.ts`

- [ ] Write a test that starts in demo mode, activates another demo config with `orderEnabled: true`, and verifies subsequent snapshots use the new config.
- [ ] Implement runtime forwarding for events, snapshot, order, start/stop, and `activateConfig`.
- [ ] Wire the WebSocket server to use the runtime while preserving the current test API.

### Task 3: Connection REST API

**Files:**
- Create: `artifacts/api-server/src/routes/account-bridge.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`

- [ ] Add `GET /account/connections`, `POST /account/connections`, `POST /account/connections/:id/activate`, `DELETE /account/connections/:id`.
- [ ] Add `POST /account/connections/:id/test` for a TCP reachability check against the profile host and port.
- [ ] Keep orders disabled unless the profile explicitly enables them.

### Task 4: Widget And Workspace UI

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`
- Modify: `artifacts/trader-dashboard/src/components/account-bridge/types.ts`
- Create: `artifacts/trader-dashboard/src/components/account-bridge/useAccountConnections.ts`
- Modify: `artifacts/trader-dashboard/src/components/account-bridge/AccountBridgeWidget.tsx`
- Modify: `artifacts/trader-dashboard/src/components/account-bridge/AccountBridgeWorkspace.tsx`

- [ ] Add widget action buttons for Connect, Accounts, and Order.
- [ ] Open the account workspace on the requested tab through a dashboard event.
- [ ] Add workspace tabs with a connection form, connected profiles list, and the existing order ticket.
- [ ] Show live-order status and require explicit enablement before live orders can be sent.

### Task 5: Verification

- [ ] Run targeted backend tests.
- [ ] Run frontend and API typecheck.
- [ ] Smoke-test the API health endpoint and account WebSocket if the local dev stack is running.
