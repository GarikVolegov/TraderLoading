import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { reportClientError } from "@/lib/clientErrorReporter";
import {
  fetchJoinRequests,
  resolveJoinRequest,
  communityJoinRequestsKey,
} from "@/lib/communityJoinApi";

// Pending join-request queue for a private community (audit 0.5b). Rendered in the
// community settings modal's "Requests" tab, gated on members.kick (same as the
// server endpoints).
export function JoinRequestsPanel({ communityId }: { communityId: number }) {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: communityJoinRequestsKey(communityId),
    queryFn: () => fetchJoinRequests(communityId),
  });

  const resolve = useMutation({
    mutationFn: ({ requestId, decision }: { requestId: number; decision: "approve" | "reject" }) =>
      resolveJoinRequest(communityId, requestId, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityJoinRequestsKey(communityId) });
      qc.invalidateQueries({ queryKey: ["community", communityId] });
    },
    onError: (error) => reportClientError(error, { context: "community join-request resolve", notify: false }),
  });

  const requests = data?.requests ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> …
      </div>
    );
  }
  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("community.requests.empty")}</p>;
  }

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 p-2.5">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
            {r.avatarUrl ? (
              <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              r.userName?.[0]?.toUpperCase() ?? "?"
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{r.userName ?? r.userId}</p>
            {r.message && <p className="truncate text-xs text-muted-foreground">{r.message}</p>}
          </div>
          <button
            onClick={() => resolve.mutate({ requestId: r.id, decision: "approve" })}
            disabled={resolve.isPending}
            title={t("community.requests.approve")}
            aria-label={t("community.requests.approve")}
            className="rounded-lg p-1.5 text-success hover:bg-success/10 disabled:opacity-40"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => resolve.mutate({ requestId: r.id, decision: "reject" })}
            disabled={resolve.isPending}
            title={t("community.requests.reject")}
            aria-label={t("community.requests.reject")}
            className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
