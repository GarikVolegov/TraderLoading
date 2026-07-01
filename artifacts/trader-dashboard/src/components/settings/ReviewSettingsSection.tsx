import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Loader2, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { ReviewForm } from "@/components/ReviewForm";
import {
  fetchMyReview,
  withdrawMyReview,
  myReviewKey,
  reviewPromptStatusKey,
  type MyReview,
  type ReviewStatus,
} from "@/lib/reviewsApi";

function StatusBadge({ status }: { status: ReviewStatus }) {
  const { t } = useLanguage();
  const cls: Record<ReviewStatus, string> = {
    pending: "text-amber-400 bg-amber-400/15 border-amber-400/30",
    approved: "text-primary bg-primary/15 border-primary/30",
    rejected: "text-destructive bg-destructive/15 border-destructive/30",
    withdrawn: "text-muted-foreground bg-muted/40 border-border",
  };
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${cls[status]}`}>
      {t(`review.me.status.${status}`)}
    </span>
  );
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className="h-4 w-4"
          style={
            n <= rating
              ? { color: "hsl(38 92% 55%)", fill: "hsl(38 92% 55%)" }
              : { color: "hsl(var(--muted-foreground))" }
          }
        />
      ))}
    </span>
  );
}

export function ReviewSettingsSection() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: myReviewKey(),
    queryFn: () => fetchMyReview(),
    retry: false,
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawMyReview(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: myReviewKey() });
      qc.invalidateQueries({ queryKey: reviewPromptStatusKey() });
      toast({ title: t("review.me.status.withdrawn") });
    },
  });

  const review: MyReview | null = data?.review ?? null;
  const isLive = review && review.status !== "withdrawn" && review.status !== "rejected";

  return (
    <div className="tl-panel rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquareQuote className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">{t("review.me.title")}</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> …
        </div>
      ) : editing ? (
        <ReviewForm existing={isLive ? review : null} onDone={() => setEditing(false)} />
      ) : isLive && review ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <ReviewStars rating={review.rating} />
            <StatusBadge status={review.status} />
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{`"${review.text}"`}</p>
          {review.role && <p className="text-xs text-muted-foreground">{review.role}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {t("review.me.edit")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              disabled={withdraw.isPending}
              onClick={() => {
                if (window.confirm(t("review.me.withdraw_confirm"))) withdraw.mutate();
              }}
            >
              {t("review.me.withdraw")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("review.me.empty")}</p>
          <Button size="sm" onClick={() => setEditing(true)}>
            {t("review.me.write")}
          </Button>
        </div>
      )}
    </div>
  );
}
