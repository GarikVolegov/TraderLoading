import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Flag, MessageSquare, EyeOff, Eye, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";
import { StarRating } from "./StarRating";
import { useCommunityReviews } from "./hooks";
import type { CommunityDetail, CommunityReview } from "./types";

export function CommunityReviews({ detail }: { detail: CommunityDetail }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { data, isLoading } = useCommunityReviews(detail.id);

  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<Set<number>>(new Set());
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");

  useEffect(() => {
    if (data?.myReview) {
      setRating(data.myReview.rating);
      setText(data.myReview.text);
    }
  }, [data?.myReview?.id]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["communityReviews", detail.id] });
    qc.invalidateQueries({ queryKey: ["community", detail.id] });
    qc.invalidateQueries({ queryKey: ["communities"] });
  };

  const submit = async () => {
    if (rating < 1) return;
    setBusy(true);
    try {
      await apiJSON(`community/${detail.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text }),
      });
      refresh();
    } catch (error) {
      reportClientError(error, { context: "community review submit", notify: false });
    } finally {
      setBusy(false);
    }
  };

  const deleteMine = async () => {
    setBusy(true);
    try {
      await apiFetch(`community/${detail.id}/reviews/mine`, { method: "DELETE" });
      setRating(0);
      setText("");
      refresh();
    } catch (error) {
      reportClientError(error, { context: "community review delete", notify: false });
    } finally {
      setBusy(false);
    }
  };

  const report = async (review: CommunityReview) => {
    try {
      await apiJSON(`community/reviews/${review.id}/report`, { method: "POST" });
      setReported((prev) => new Set(prev).add(review.id));
    } catch (error) {
      reportClientError(error, { context: "community review report", notify: false });
    }
  };

  const sendResponse = async (review: CommunityReview) => {
    try {
      await apiJSON(`community/reviews/${review.id}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: responseText }),
      });
      setRespondingTo(null);
      setResponseText("");
      refresh();
    } catch (error) {
      reportClientError(error, { context: "community review respond", notify: false });
    }
  };

  const toggleHide = async (review: CommunityReview) => {
    try {
      await apiJSON(`community/reviews/${review.id}/hide`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !review.hidden }),
      });
      refresh();
    } catch (error) {
      reportClientError(error, { context: "community review hide", notify: false });
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full p-4 space-y-5 overflow-y-auto">
      {/* Aggregate */}
      <div className="flex items-center gap-3">
        <div className="text-3xl font-bold">{data.ratingCount > 0 ? data.ratingAvg.toFixed(1) : "—"}</div>
        <div>
          <StarRating value={data.ratingAvg} readOnly size={18} />
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("community.review.count", { count: data.ratingCount })}
          </p>
        </div>
      </div>

      {/* Composer */}
      {data.isMember ? (
        <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {t("community.review.yourReview")}
          </p>
          <StarRating value={rating} onChange={setRating} size={22} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={t("community.review.placeholder")}
            className="w-full bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={busy || rating < 1}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              {data.myReview ? t("community.review.update") : t("community.review.submit")}
            </button>
            {data.myReview && (
              <button
                onClick={deleteMine}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                {t("community.review.delete")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("community.review.memberOnly")}</p>
      )}

      {/* List */}
      <div className="space-y-2.5">
        {data.reviews.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">{t("community.review.empty")}</p>
        ) : (
          data.reviews.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border border-border bg-secondary/20 p-3 ${r.hidden ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                  {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="w-full h-full object-cover" /> : r.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{r.name}</p>
                  <StarRating value={r.rating} readOnly size={12} />
                </div>
                {r.hidden && (
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("community.review.hidden")}
                  </span>
                )}
              </div>
              {r.text && <p className="text-sm text-foreground/90 whitespace-pre-line">{r.text}</p>}

              {r.ownerResponse && (
                <div className="mt-2 ml-3 pl-3 border-l-2 border-primary/40">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">
                    {t("community.review.ownerReply")}
                  </p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{r.ownerResponse}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 mt-2">
                {data.isMember && (
                  <button
                    onClick={() => report(r)}
                    disabled={reported.has(r.id)}
                    className="text-[11px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <Flag className="w-3 h-3" />
                    {reported.has(r.id) ? t("community.review.reported") : t("community.review.report")}
                  </button>
                )}
                {data.canRespond && !r.ownerResponse && (
                  <button
                    onClick={() => { setRespondingTo(r.id); setResponseText(""); }}
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {t("community.review.respond")}
                  </button>
                )}
                {data.canModerate && (
                  <button
                    onClick={() => toggleHide(r)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    {r.hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {r.hidden ? t("community.review.unhide") : t("community.review.hide")}
                  </button>
                )}
              </div>

              {respondingTo === r.id && (
                <div className="mt-2 space-y-1.5">
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    maxLength={2000}
                    rows={2}
                    placeholder={t("community.review.responsePlaceholder")}
                    className="w-full bg-secondary/40 border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/50 resize-none"
                  />
                  <button
                    onClick={() => sendResponse(r)}
                    className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors"
                  >
                    {t("community.review.send")}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
