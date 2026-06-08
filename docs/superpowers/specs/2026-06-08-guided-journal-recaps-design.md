# Guided Journal Recaps Design

## Goal

Add guided manual recap forms to the journal so traders can review the just-finished week and each four-week cycle in a structured way. Recaps are only editable during their allowed weekend window and remain readable afterward.

## Current Context

`artifacts/trader-dashboard/src/pages/Journal.tsx` already has weekly and monthly recap tabs, but those tabs only compute trade statistics from `journal_entries`. The existing `journal_entries` table represents individual trades, including title, content, trade date, result, tags, and images. A structured period review does not fit that model cleanly because it has its own period identity, edit window, and multiple reflection fields.

## Recommended Approach

Create a dedicated recap model, API, and frontend helper layer.

The recap record stores one user-authored review for a specific period:

- `kind`: `weekly` or `four_week`
- `periodStart`: ISO date for the first day covered
- `periodEnd`: ISO date for the last day covered
- `overallJudgment`
- `wentWell`
- `wentWrong`
- `improvements`
- `patterns`
- `focusAreas`
- `nextPeriodExpectations`
- `nextPeriodGoals`

Use a unique index on `(user_id, kind, period_start, period_end)` so saving the same recap updates the existing record instead of creating duplicates.

## Period Rules

Weekly recaps:

- Weeks start on Monday and end on Sunday.
- The recap is editable only on Saturday and Sunday of that same week.
- The recap covers Monday through Sunday of the current week.
- Outside Saturday/Sunday, the weekly recap is read-only if it exists and locked if it does not.

Four-week recaps:

- Four-week cycles start from Monday, June 8, 2026.
- The first cycle is June 8, 2026 through July 5, 2026.
- Every cycle lasts exactly 28 days.
- The recap is editable only on the Saturday and Sunday at the end of the active four-week cycle.
- The first editable window is Saturday, July 4, 2026 and Sunday, July 5, 2026.
- Outside that final weekend, the recap is read-only if it exists and locked if it does not.

The existing tab currently labeled monthly should become a four-week recap surface in behavior and copy. Italian UI copy should prefer "Recap 4 settimane" over "Recap mensile" so the cadence is honest.

## User Experience

The recap tab keeps the existing period navigation and statistics cards. Below the computed stats, add a guided review panel.

When editable, the panel shows structured text fields and a save button. Saving gives a success toast and keeps the user on the same recap.

When not editable and no recap exists, the panel explains the next allowed window with exact dates.

When not editable and a recap exists, the panel displays the saved answers in read-only sections. This lets users review old periods without changing them after the window closes.

## API Design

Add endpoints under the journal domain:

- `GET /journal/recaps?kind=weekly&periodStart=YYYY-MM-DD&periodEnd=YYYY-MM-DD`
- `PUT /journal/recaps`

The GET endpoint returns the recap for the authenticated user and exact period, or `null` if none exists.

The PUT endpoint validates:

- `kind` is `weekly` or `four_week`
- period dates match the supported period rules
- the current server date is inside the editable window for that recap
- text fields are strings, trimmed, and bounded to a reasonable length

If the window is closed, return HTTP 403 with a clear error. Client-side locking is for UX only; the server is the source of truth.

## Frontend Design

Add focused helpers near the journal feature:

- period calculation for weekly and four-week recap windows
- editable-window detection
- payload normalization for blank fields

Update `Journal.tsx` to use those helpers inside `RecapTab`. Keep trade statistics derived from `journal_entries`; add recap loading/saving separately.

The form should use existing UI primitives: `Textarea`, `Button`, and the current card/border style used by the journal.

## Testing

Add tests before implementation:

- Frontend helper tests for weekly windows, four-week windows, first cycle dates, and locked states.
- Server helper tests for period validation and edit-window checks.
- API route static or focused tests to ensure recap routes are registered before dynamic `/journal/:id` routes.
- Frontend static test to ensure the guided fields and four-week label are present.

Manual verification after implementation:

- Weekly recap is editable on Saturday/Sunday only.
- Four-week recap is editable on July 4-5, 2026 for the first cycle.
- A saved recap can be read after the window closes but cannot be edited.
- Existing trade statistics still render in both recap tabs.

## Out Of Scope

- Push reminders for recap windows.
- AI-generated recap text.
- Changing the trade journal entry model.
- Backfilling old recap records.
