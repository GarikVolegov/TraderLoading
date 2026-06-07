# TraderLoadings Stabilization Design

## Goal

Make TraderLoadings reliably install, start, verify, and debug on the local Windows workspace before doing broader product or UI redesign work.

The first milestone is not to redesign every feature visually. It is to make the current application trustworthy: one repeatable local startup path, clear diagnostics when dependencies fail, generated clients in sync with the OpenAPI contract, and a single verification command that proves the workspace is healthy.

## Current State

The workspace is a pnpm monorepo with:

- `artifacts/api-server`: Express API server.
- `artifacts/trader-dashboard`: Vite React dashboard.
- `artifacts/mockup-sandbox`: Vite mockup sandbox.
- `lib/db`: Drizzle schema and DB access.
- `lib/api-spec`: OpenAPI source and Orval codegen.
- `lib/api-client-react`: generated React Query client.
- `lib/api-zod`: generated Zod validators.
- shared libraries such as `pair-catalog`, `replit-auth-web`, and OpenAI integration helpers.

Recent stabilization already fixed the build/typecheck path. Remaining risk is runtime reliability: local env loading, Docker/Postgres readiness, schema sync, port/process conflicts, generated client drift, and ambiguous debugging output.

## Scope

This phase includes:

- Local startup reliability on Windows.
- Database readiness and schema sync diagnostics.
- A single verification command for install, codegen, typecheck, build, and optional health probes.
- Healthcheck consolidation for API, DB, and frontend availability.
- Contract hygiene between `openapi.yaml`, Orval generated clients, and server behavior.
- Developer-facing documentation for starting, stopping, verifying, and debugging.

This phase does not include:

- Redesigning the entire visual UI.
- Rebuilding Chat, Brain AI, Tools, or Dashboard internals from scratch.
- Replacing Clerk, Drizzle, Vite, pnpm, or Docker.
- Adding a production deployment system.

## Recommended Approach

Use a staged hardening pass.

1. Keep the current app architecture.
2. Add a reliable local orchestration layer around it.
3. Add repeatable verification commands.
4. Move feature redesign into later, smaller phases.

This keeps risk low. The app must first become easy to start and easy to diagnose. After that, individual product modules can be redesigned without fighting the environment.

## Architecture

### Local Orchestration

Create Node-based local scripts instead of relying only on batch shell behavior.

The scripts should:

- Load `.env.local`.
- Validate required env vars.
- Check required tools: Node, pnpm, Docker.
- Start or reuse PostgreSQL.
- Wait for PostgreSQL with condition polling.
- Run Drizzle schema push with a clear timeout and clear error output.
- Detect occupied ports `3001` and `5173`.
- Start backend and frontend with logs written to a local ignored log directory.

`start-local.bat` should become a thin wrapper around the Node script, so Windows users can still double-click it.

### Verification

Add root scripts:

- `pnpm run codegen`: regenerate Orval clients from `lib/api-spec/openapi.yaml`.
- `pnpm run verify`: run install-safe checks, codegen, typecheck, build, and static config checks.
- `pnpm run verify:runtime`: check API health and frontend HTTP response when services are running.

The verification command should be the acceptance gate before claiming the app is fixed.

### Healthchecks

Health should be consistent and useful:

- `/api/healthz`: lightweight liveness endpoint.
- `/api/health`: deeper readiness endpoint if already present in the main app.
- The local verifier should call whichever endpoint the server actually exposes and print a clear pass/fail summary.

The frontend health probe should fetch `http://127.0.0.1:5173/` and confirm HTTP 200 plus HTML content.

### Database

The local script should not assume Docker success just because `docker run` was invoked.

It should:

- Check whether `127.0.0.1:5432` is reachable.
- Attempt DB authentication using `DATABASE_URL`.
- If authentication fails, explain that an existing Postgres instance may be running with different credentials.
- Avoid destructive DB reset by default.
- Offer a separate explicit reset command later if needed.

### Generated API Contracts

Generated files must be treated as build artifacts derived from OpenAPI.

The stable flow:

1. Edit server behavior and `lib/api-spec/openapi.yaml` together.
2. Run `pnpm --filter @workspace/api-spec run codegen`.
3. Run `pnpm run typecheck:libs`.
4. Run app typechecks.

`pnpm run verify` should enforce this by regenerating clients before typecheck.

### Frontend State

For this stabilization phase:

- Keep existing local-only settings such as custom background presets if they do not require backend schema changes.
- Do not add new database columns unless there is a migration-safe plan.
- Prefer defensive parsing and clear fallback behavior in contexts that hydrate settings.

Later redesign phases can decide whether settings like background presets should become server-persisted.

## Error Handling

Local scripts should fail with actionable messages:

- Missing Docker: tell user to start Docker Desktop.
- Docker daemon timeout: say Docker is installed but not responding.
- Port occupied: show the owning PID/process and the URL that is already live.
- DB auth failure: show the `DATABASE_URL` host/user/database, but never print passwords.
- Codegen failure: point to native optional dependency issues or OpenAPI parse errors.
- Health failure: show the endpoint, status, and last log file path.

## Testing And Verification

The phase is complete only when these pass:

- `pnpm install`
- `pnpm --filter @workspace/api-spec run codegen`
- `pnpm run typecheck:libs`
- `pnpm run typecheck`
- `pnpm run build`
- frontend HTTP probe returns 200
- API health probe returns JSON status OK

Runtime DB verification should be included when the local `DATABASE_URL` authenticates successfully. If DB authentication fails because an unrelated local Postgres is already bound to port `5432`, the verifier should report that as an environment issue, not silently pass.

## Follow-Up Redesign Phases

After stabilization, redesign should proceed by module:

1. Settings and profile persistence.
2. Chat and E2EE flow.
3. Brain AI analysis flow.
4. Tools and backtest.
5. Dashboard information architecture and visual polish.

Each module should get its own design and implementation plan.

## Acceptance Criteria

- A non-expert user can run one local start command and understand failures.
- A developer can run one verify command before and after changes.
- Build and typecheck no longer depend on stale TypeScript build info.
- Windows native optional dependencies required by Vite, Rollup, Tailwind, and esbuild are installed.
- API/generated-client drift is caught during verification.
- No new DB schema requirement is introduced without a migration-safe path.

## Self-Review

- No placeholders remain.
- Scope is focused on stabilization, not full product redesign.
- The design avoids destructive DB actions by default.
- The plan leaves room for later UI and feature redesign without mixing it into the local reliability work.
