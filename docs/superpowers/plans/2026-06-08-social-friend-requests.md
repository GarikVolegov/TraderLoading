# Social Friend Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit `Aggiungi amico` flow to the Social section, backed by friend requests that must be accepted before a friendship is active.

**Architecture:** Keep follow/unfollow for the social feed and add friendship as a separate layer. The backend will expose deterministic relationship status for search results; the frontend will merge existing social search results with friend-search status and pending-request controls. Accepted friends will also appear in the private-message contact list.

**Tech Stack:** Express, Drizzle ORM, React, TanStack Query, generated `@workspace/api-client-react` friend hooks, static Node tests, TypeScript.

---

## File Structure

- Modify `artifacts/api-server/src/routes/friends.ts`: add a pure relationship-status helper and enrich `/friends/search` with `relationshipStatus`.
- Modify `artifacts/api-server/src/routes/friends.test.ts`: test helper behavior for `none`, `pending_sent`, `pending_received`, and `accepted`.
- Modify `lib/api-spec/openapi.yaml`: document the optional search result `relationshipStatus` field.
- Modify `artifacts/trader-dashboard/src/pages/Chat.tsx`: add friend request hooks, received-request panel, search row friendship actions, and include accepted friends in message contacts.
- Create `artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts`: static guard for the new Social UI and friend hooks.

---

### Task 1: Backend Relationship Status

**Files:**
- Modify: `artifacts/api-server/src/routes/friends.ts`
- Modify: `artifacts/api-server/src/routes/friends.test.ts`
- Modify: `lib/api-spec/openapi.yaml`

- [ ] **Step 1: Write the failing backend helper test**

Add these checks to `artifacts/api-server/src/routes/friends.test.ts` after the existing `isFriendActiveToday` assertions:

```ts
const { getFriendRelationshipStatus } = await import("./friends.js");

assert.equal(getFriendRelationshipStatus("me", "ari", null), "none");
assert.equal(
  getFriendRelationshipStatus("me", "ari", { userId: "me", friendId: "ari", status: "pending" }),
  "pending_sent",
);
assert.equal(
  getFriendRelationshipStatus("me", "ari", { userId: "ari", friendId: "me", status: "pending" }),
  "pending_received",
);
assert.equal(
  getFriendRelationshipStatus("me", "ari", { userId: "ari", friendId: "me", status: "accepted" }),
  "accepted",
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
```

Expected: FAIL for `friends.test.ts` because `getFriendRelationshipStatus` is not exported.

- [ ] **Step 3: Add the helper and search enrichment**

In `artifacts/api-server/src/routes/friends.ts`, add near `isFriendActiveToday`:

```ts
export type FriendRelationshipStatus = "none" | "pending_sent" | "pending_received" | "accepted";

export function getFriendRelationshipStatus(
  currentUserId: string,
  targetUserId: string,
  friendship: { userId: string; friendId: string; status: string } | null | undefined,
): FriendRelationshipStatus {
  if (!friendship) return "none";
  if (friendship.status === "accepted") return "accepted";
  if (friendship.status === "pending" && friendship.userId === currentUserId && friendship.friendId === targetUserId) {
    return "pending_sent";
  }
  if (friendship.status === "pending" && friendship.userId === targetUserId && friendship.friendId === currentUserId) {
    return "pending_received";
  }
  return "none";
}
```

Then update `GET /friends/search` after `results` are fetched:

```ts
const resultUserIds = results.map((result) => result.userId).filter((id): id is string => !!id);
const relationships = resultUserIds.length === 0
  ? []
  : await db
      .select({
        userId: friendshipsTable.userId,
        friendId: friendshipsTable.friendId,
        status: friendshipsTable.status,
      })
      .from(friendshipsTable)
      .where(
        or(
          and(eq(friendshipsTable.userId, userId), sql`${friendshipsTable.friendId} IN (${sql.join(resultUserIds.map(id => sql`${id}`), sql`, `)})`),
          and(eq(friendshipsTable.friendId, userId), sql`${friendshipsTable.userId} IN (${sql.join(resultUserIds.map(id => sql`${id}`), sql`, `)})`),
        ),
      );

res.json(results.map((result) => ({
  ...result,
  relationshipStatus: getFriendRelationshipStatus(
    userId,
    result.userId ?? "",
    relationships.find((relationship) =>
      (relationship.userId === userId && relationship.friendId === result.userId) ||
      (relationship.friendId === userId && relationship.userId === result.userId),
    ),
  ),
})));
```

- [ ] **Step 4: Document the API shape**

In `lib/api-spec/openapi.yaml`, extend `components.schemas.UserSearchResult.properties`:

```yaml
        relationshipStatus:
          type: string
          enum: [none, pending_sent, pending_received, accepted]
          description: Friendship state between the current user and this result.
```

- [ ] **Step 5: Run backend checks**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
pnpm --filter @workspace/api-server run typecheck
```

Expected: both commands complete successfully.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/routes/friends.ts artifacts/api-server/src/routes/friends.test.ts lib/api-spec/openapi.yaml
git commit -m "feat: expose friend search relationship status"
```

---

### Task 2: Social Friend Request Controls

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Chat.tsx`
- Create: `artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts`

- [ ] **Step 1: Write the failing static UI test**

Create `artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts`:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/Chat.tsx", "utf8");

assert.match(source, /useSearchUsers/);
assert.match(source, /useSendFriendRequest/);
assert.match(source, /useGetPendingFriendRequests/);
assert.match(source, /useRespondToFriendRequest/);
assert.match(source, /Aggiungi amico/);
assert.match(source, /Richiesta inviata/);
assert.match(source, /Richieste amicizia/);
assert.match(source, /Accetta/);
assert.match(source, /Rifiuta/);

console.log("chat friend request static checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
```

Expected: FAIL because `Chat.tsx` does not import or render the friend request controls yet.

- [ ] **Step 3: Import friend hooks and types**

In `artifacts/trader-dashboard/src/pages/Chat.tsx`, extend the `@workspace/api-client-react` import with:

```ts
  getGetFriendsQueryKey,
  getGetPendingFriendRequestsQueryKey,
  getSearchUsersQueryKey,
  useGetFriends,
  useGetPendingFriendRequests,
  useRespondToFriendRequest,
  useSearchUsers,
  useSendFriendRequest,
  type FriendListItem,
  type UserSearchResult,
```

- [ ] **Step 4: Add a friend-search wrapper**

Add below `useSocialSearch`:

```ts
type FriendRelationshipStatus = "none" | "pending_sent" | "pending_received" | "accepted";
type FriendSearchResult = UserSearchResult & {
  relationshipStatus?: FriendRelationshipStatus;
};

function useFriendSearch(q: string) {
  return useSearchUsers<FriendSearchResult[]>({ q }, {
    query: {
      enabled: q.length >= 2,
    },
  });
}
```

- [ ] **Step 5: Add friend request data and mutations to `SocialTab`**

Inside `SocialTab`, after `const { data: searchResults = [] } = useSocialSearch(searchQ);`, add:

```ts
  const { data: friendSearchResults = [] } = useFriendSearch(searchQ);
  const { data: pendingFriendRequests = [] } = useGetPendingFriendRequests();
  const friendStatusByUserId = useMemo(() => {
    return new Map(
      (friendSearchResults as FriendSearchResult[])
        .filter((result) => result.userId)
        .map((result) => [result.userId!, result.relationshipStatus ?? "none"]),
    );
  }, [friendSearchResults]);

  const refreshFriendQueries = () => {
    qc.invalidateQueries({ queryKey: getSearchUsersQueryKey({ q: searchQ }) });
    qc.invalidateQueries({ queryKey: getGetPendingFriendRequestsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetFriendsQueryKey() });
    qc.invalidateQueries({ queryKey: ["social/mutual-followers"] });
  };

  const sendFriendRequestMutation = useSendFriendRequest({
    mutation: {
      onSuccess: refreshFriendQueries,
      onError: refreshFriendQueries,
    },
  });

  const respondToFriendRequestMutation = useRespondToFriendRequest({
    mutation: {
      onSuccess: refreshFriendQueries,
    },
  });
```

- [ ] **Step 6: Render the received-requests panel**

At the start of the non-search branch inside the Social tab scroll area, before stories, render:

```tsx
            {pendingFriendRequests.length > 0 && (
              <div className="p-4 border-b border-border">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Richieste amicizia
                </p>
                <div className="space-y-2">
                  {pendingFriendRequests.map((request) => (
                    <div key={request.id} className="flex items-center gap-3 p-3 bg-card/40 rounded-xl border border-border">
                      <Avatar name={request.senderName ?? "Trader"} avatarUrl={request.senderAvatar} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{request.senderName ?? "Trader"}</p>
                        <p className="text-xs text-muted-foreground">Vuole aggiungerti agli amici</p>
                      </div>
                      <button
                        onClick={() => respondToFriendRequestMutation.mutate({ id: request.id, data: { action: "accept" } })}
                        disabled={respondToFriendRequestMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                      >
                        Accetta
                      </button>
                      <button
                        onClick={() => respondToFriendRequestMutation.mutate({ id: request.id, data: { action: "reject" } })}
                        disabled={respondToFriendRequestMutation.isPending}
                        className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs font-medium disabled:opacity-50 transition-colors"
                      >
                        Rifiuta
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
```

- [ ] **Step 7: Render `Aggiungi amico` in search rows**

Inside each social search result row, keep the follow/unfollow button and add this friendship action before it:

```tsx
                      {(() => {
                        const relationshipStatus = friendStatusByUserId.get(u.userId!) ?? "none";
                        if (relationshipStatus === "accepted") {
                          return (
                            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-1">
                              Gia' amico
                            </span>
                          );
                        }
                        if (relationshipStatus === "pending_sent") {
                          return (
                            <span className="text-[10px] bg-secondary/60 text-muted-foreground border border-border rounded-full px-2 py-1">
                              Richiesta inviata
                            </span>
                          );
                        }
                        if (relationshipStatus === "pending_received") {
                          return (
                            <button
                              onClick={() => setShowSearch(false)}
                              className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
                            >
                              Rispondi
                            </button>
                          );
                        }
                        return (
                          <button
                            onClick={() => sendFriendRequestMutation.mutate({ data: { friendUserId: u.userId! } })}
                            disabled={sendFriendRequestMutation.isPending}
                            className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                          >
                            Aggiungi amico
                          </button>
                        );
                      })()}
```

- [ ] **Step 8: Run frontend checks**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: both commands complete successfully.

- [ ] **Step 9: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/Chat.tsx artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts
git commit -m "feat: add social friend request controls"
```

---

### Task 3: Accepted Friends in Message Contacts

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Chat.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts`

- [ ] **Step 1: Extend the static test**

Add these assertions to `Chat.friend-requests.static.test.ts`:

```ts
assert.match(source, /acceptedFriends/);
assert.match(source, /messageContacts/);
assert.match(source, /friendUserId/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
```

Expected: FAIL because `MessaggiTab` still renders only mutual followers.

- [ ] **Step 3: Fetch and merge accepted friends**

Inside `MessaggiTab`, near `const { data: mutualFollowers = [], isLoading } = useMutualFollowers();`, add:

```ts
  const { data: acceptedFriends = [], isLoading: friendsLoading } = useGetFriends();
  const messageContacts = useMemo<SocialUser[]>(() => {
    const contacts = new Map<string, SocialUser>();
    for (const user of mutualFollowers as SocialUser[]) {
      if (user.userId) contacts.set(user.userId, user);
    }
    for (const friend of acceptedFriends as FriendListItem[]) {
      contacts.set(friend.friendUserId, {
        userId: friend.friendUserId,
        name: friend.name,
        avatarUrl: friend.avatarUrl,
        hasKey: true,
      });
    }
    return Array.from(contacts.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [acceptedFriends, mutualFollowers]);
```

Then replace list rendering checks:

```ts
isLoading
```

with:

```ts
isLoading || friendsLoading
```

Replace:

```ts
(mutualFollowers as SocialUser[]).length === 0
```

with:

```ts
messageContacts.length === 0
```

Replace:

```tsx
{(mutualFollowers as SocialUser[]).map((u) => (
```

with:

```tsx
{messageContacts.map((u) => (
```

- [ ] **Step 4: Run frontend checks**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: both commands complete successfully.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/Chat.tsx artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts
git commit -m "feat: show accepted friends in messages"
```

---

### Task 4: Final Verification

**Files:**
- Review: `artifacts/api-server/src/routes/friends.ts`
- Review: `artifacts/trader-dashboard/src/pages/Chat.tsx`
- Review: `docs/superpowers/specs/2026-06-08-social-friend-requests-design.md`

- [ ] **Step 1: Run full local verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/trader-dashboard run build
```

Expected: all commands complete successfully.

- [ ] **Step 2: Inspect changed files**

Run:

```bash
git diff --stat HEAD~3..HEAD
git status --short
```

Expected: committed feature files are present in the diff; unrelated pre-existing worktree changes may remain and must not be reverted.

- [ ] **Step 3: Final commit only if verification fixes were needed**

If Step 1 required any follow-up edits, commit just those edits:

```bash
git add artifacts/api-server/src/routes/friends.ts artifacts/api-server/src/routes/friends.test.ts artifacts/trader-dashboard/src/pages/Chat.tsx artifacts/trader-dashboard/src/pages/Chat.friend-requests.static.test.ts lib/api-spec/openapi.yaml
git commit -m "fix: verify social friend requests"
```

Expected: no commit is created when no verification edits were necessary.

---

## Self-Review

- Spec coverage: search users, send request, received request accept/reject, accepted friends in messages, follow system preserved.
- Deferred-work scan: no `TBD`, `TODO`, or deferred future work is required.
- Type consistency: `FriendRelationshipStatus`, `FriendSearchResult`, `FriendListItem`, and generated friend hook names match the current generated client.
