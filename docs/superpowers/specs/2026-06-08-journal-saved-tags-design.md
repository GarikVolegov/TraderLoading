# Journal Saved Tags Design

## Goal

Journal trade tags must be reusable even when they do not already exist on a trade. A user should be able to create a tag while saving a journal entry and see that tag suggested on future entries.

## Current Behavior

The dashboard already has a smart tag input in `artifacts/trader-dashboard/src/components/JournalEntryModal.tsx`. It calls `fetchJournalTags()` from `artifacts/trader-dashboard/src/lib/journalTagsApi.ts`, which reads `GET /journal/tags`. The API currently builds that list by scanning `journal_entries.tags`, so a tag disappears if no current trade uses it.

## Design

Add a persistent journal tag library owned by user id.

The backend will add a `journal_tags` table with:

- `id`
- `tag`
- `userId`
- `createdAt`
- `updatedAt`

When a tag is added in the modal, the dashboard can save it directly to the library through `POST /journal/tags`. When a journal entry is created or updated, the API will also normalize every submitted tag, dedupe it, save missing tags into `journal_tags`, and then store the normalized comma-separated tag string on the entry. `GET /journal/tags` will return the union of saved library tags and tags found on existing entries. Tags used by entries include their usage count; saved-but-unused tags return count `0`.

## Data Flow

1. User types tags in the journal modal.
2. Modal saves each added chip through `POST /journal/tags`.
3. Modal saves the trade through the existing create/update journal mutation.
4. API parses the submitted `tags` string.
5. API upserts each normalized tag into `journal_tags`.
6. API stores the normalized tag string on `journal_entries.tags`.
7. Modal invalidates `journalTagsQueryKey`.
8. Future journal entries show saved tag suggestions from `GET /journal/tags`.

## UX

The current smart tag input remains the main UI. No separate tag management screen is required for this feature. When the user confirms a typed tag into a chip, the app attempts to save it to the library immediately. Saved tags that have never been used in a trade appear in suggestions with usage count `0`.

## Error Handling

If tag saving encounters duplicates, the backend ignores existing records and continues. Empty tags are discarded. Tag matching is case-insensitive for duplicate detection, while the first saved spelling is preserved for display.

## Testing

Add focused tests for:

- normalizing and deduping comma-separated tag strings;
- merging saved library tags with counted entry tags;
- frontend tag API supporting saved-but-unused tags with `count: 0`;
- route ordering still keeping `/journal/tags` before `/journal/:id`.
