# Backtest chart workspace

The replay terminal keeps Lightweight Charts as its renderer. Appearance, tool defaults, favorite colors, ordered favorite tools and named templates belong to the account; drawings, replay position, trade execution and costs belong to the session.

## Interaction

- Open chart settings from the gear or by double-clicking the chart. Tabs: Aspetto, Strumenti, Indicatori, Template.
- Colors support HEX and opacity. Stars save colors and tools. Drag the favorites grip to move its toolbar; drag tools or use Alt+Left/Right to reorder. The grip also supports arrow keys.
- Two-point drawings support two clicks or dragging. Select a drawing to reveal its handles and properties. Position drawings have independent entry, stop and target handles.
- The object list can reveal hidden drawings and unlock locked drawings. Undo/redo is bounded to 100 edits and treats a completed drag as one edit. Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z or Ctrl/Cmd+Y redoes; Escape cancels a gesture. Modal dialogs and editable fields retain their own shortcuts.
- Templates include chart appearance, indicator configurations and tool defaults. Applying one preserves spread, commission, ticket, trades and drawings.

## Persistence and deployment

`GET /api/settings/backtest-chart` returns `{ revision, preferences }`, with a null preference value for a new account. Authenticated `PUT` accepts `{ revision, preferences }` and returns the incremented revision. A stale revision returns HTTP 409 with the current server snapshot. The client keeps local edits until the user chooses a conflict version.

The versioned shared contract is `contracts/backtestChart.ts`; OpenAPI clients and validators are regenerated. Local cache keys include account identity. Writes are debounced, edits made during a save remain pending, and offline changes retry on reconnection. Legacy settings/templates are imported only if no account preferences exist. Invalid legacy fields fall back independently; execution settings are excluded from portable templates.

Migration `0049_backtest_chart_preferences.sql` adds the dedicated per-user table. Account deletion removes its rows. Apply the normal database migrations when deploying. During implementation only this additive table was created in the local database; unrelated pending migrations and their journal entries were not advanced.

## Verification

From the repository root:

```sh
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/replay/chartPreferencesSync.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/replay/drawingWorkspace.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/replay/terminalPersistence.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/backtest-chart.test.ts
node scripts/verify-backtest-chart/browser.mjs
pnpm --filter ./scripts exec tsx --env-file="$PWD/.env.local" verify-backtest-chart-postgres.mjs
```

For the full replay suite, run `pnpm exec tsx --test src/lib/replay/*.test.ts` from `artifacts/trader-dashboard`.

The browser harness uses production chart/UI/sync code with disposable authentication and in-memory HTTP fixtures. The PostgreSQL probe separately verifies the real storage adapter, migration, account isolation and concurrent creation/update in a temporary schema; it accepts only localhost databases and removes its schema afterward. Neither harness modifies real account preferences.
