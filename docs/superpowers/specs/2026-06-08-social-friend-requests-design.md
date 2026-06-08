# Social Friend Requests Design

## Goal

Users need a clear way to search traders in the Social section and add them as friends. The approved behavior is an explicit "Aggiungi amico" action that sends a friend request. The friendship becomes active only after the other user accepts.

## Current Behavior

`artifacts/trader-dashboard/src/pages/Chat.tsx` already has a Social tab with user search, but the search actions only follow or unfollow users through `/social/follow/:id`. Messaging and routine social features rely on accepted friendships or mutual social connections, so users can search traders without a clear way to save them as friends.

The backend already exposes dedicated friendship endpoints in `artifacts/api-server/src/routes/friends.ts`:

- `GET /friends/search`
- `POST /friends/request`
- `GET /friends/requests`
- `PATCH /friends/requests/:id`
- `GET /friends`
- `DELETE /friends/:id`

The OpenAPI types and generated client already include friend request and friend list shapes.

## Design

Add friend-request controls to the Social experience without removing the existing follow system.

The Social search panel should show a primary action labeled `Aggiungi amico` for users who are not already friends and do not already have a pending request. Clicking it calls `POST /friends/request` with `friendUserId`. After success, the result row changes to a disabled `Richiesta inviata` state.

Add a compact received-requests area in the Social tab. It should call `GET /friends/requests` and show pending requests with sender avatar/name plus `Accetta` and `Rifiuta` actions. Accepting calls `PATCH /friends/requests/:id` with `action: "accept"`; rejecting uses `action: "reject"`.

Accepted friends should flow into the existing friend-backed areas through `GET /friends`, including routine friend metrics and any UI that uses accepted friendship data. The private-message contact list must include accepted friends as well as current mutual-follow contacts, because the chat backend already permits messaging when users are accepted friends.

## UI States

Search result actions:

- `Aggiungi amico`: available when no friendship exists.
- `Richiesta inviata`: disabled after a successful request or when the API reports an existing pending request.
- `Rispondi`: optional shortcut when the searched user has already sent the current user a pending request.
- `Gia' amico`: disabled when the searched user is already an accepted friend.
- Error state: keep the row usable and show a toast or inline error if the request fails.

Received request actions:

- `Accetta`: accepts the request, removes it from the pending list, and refreshes friends.
- `Rifiuta`: rejects the request and removes it from the pending list.
- Loading state: disable both buttons while the row mutation is in flight.

## API Flow

The frontend can use the existing generated API client if it fits the current local patterns, or add a small hand-written helper matching the style of nearby modules.

Queries to invalidate after sending, accepting, rejecting, or deleting friendship state:

- friend search query for the active search term;
- pending friend requests;
- friend list;
- social mutual followers if chat availability depends on it;
- routine friend competition data if visible.

## Backend Notes

The backend is mostly present. Implementation should verify whether `GET /friends/search` needs to include relationship status (`none`, `pending_sent`, `pending_received`, `accepted`) so the UI can render stable row states without guessing. If not present, add it server-side rather than deriving it only in the client.

Existing duplicate handling on `POST /friends/request` returns conflict for an existing request. The UI should convert that into the `Richiesta inviata` state when appropriate.

## Non-Goals

- Do not replace the follow/unfollow social feed behavior.
- Do not auto-accept friendships.
- Do not make every mutual follow an accepted friend.
- Do not add a separate full friend-management page for this change.

## Testing

Backend tests should cover:

- friend search excludes the current user;
- friend search reports enough relationship state for pending and accepted friendships;
- sending a duplicate request does not create another friendship;
- accepting a request makes it appear in `GET /friends`;
- rejecting a request removes it.

Frontend tests should cover:

- the Social search renders `Aggiungi amico`;
- clicking it calls the friend request endpoint and updates the row state;
- pending requests render with accept and reject controls;
- accepting invalidates and refreshes the friend list;
- empty request and empty search states remain readable.

## Verification

- `pnpm --filter @workspace/api-server run test`
- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/trader-dashboard run typecheck`
- `pnpm --filter @workspace/trader-dashboard run build`

## Self-Review

- The design keeps follow and friendship as separate concepts.
- Friendships require acceptance and are not created silently.
- The scope is limited to Social search, pending requests, and existing friend-backed consumers.
- Backend relationship state is preferred over fragile client-side inference.
