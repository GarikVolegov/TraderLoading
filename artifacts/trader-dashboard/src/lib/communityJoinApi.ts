// Client off-contract per le richieste di accesso alle community private (come
// torneiApi): tipi a mano + apiJSON. Endpoint in routes/community.ts +
// routes/communityModeration.ts.
import { apiJSON } from "./apiFetch";

export interface CommunityJoinRequest {
  id: number;
  userId: string;
  userName: string | null;
  avatarUrl: string | null;
  message: string | null;
  createdAt: string;
}

export const communityJoinRequestsKey = (communityId: number) =>
  ["/api/community", communityId, "join-requests"] as const;

/** POST join: public → joins; private → creates/refreshes a pending request. */
export function requestJoin(
  communityId: number,
  message?: string,
): Promise<{ status?: string; ok?: boolean; alreadyMember?: boolean }> {
  return apiJSON(`community/${communityId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message ? { message } : {}),
  });
}

export function fetchJoinRequests(communityId: number): Promise<{ requests: CommunityJoinRequest[] }> {
  return apiJSON(`community/${communityId}/join-requests`);
}

export function resolveJoinRequest(
  communityId: number,
  requestId: number,
  decision: "approve" | "reject",
): Promise<{ ok: boolean }> {
  return apiJSON(`community/${communityId}/join-requests/${requestId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
}
