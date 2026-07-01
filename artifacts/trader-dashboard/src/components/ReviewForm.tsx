import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  submitReview,
  updateMyReview,
  myReviewKey,
  reviewPromptStatusKey,
  type MyReview,
} from "@/lib/reviewsApi";

interface ReviewFormProps {
  existing?: MyReview | null;
  onDone?: () => void;
}

export function ReviewForm({ existing, onDone }: ReviewFormProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isEdit = !!existing;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(existing?.text ?? "");
  const [role, setRole] = useState(existing?.role ?? "");
  // In modifica il consenso è già stato dato in fase di primo invio.
  const [consent, setConsent] = useState(isEdit);

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateMyReview({ rating, text: text.trim(), role: role.trim() || null })
        : submitReview({ rating, text: text.trim(), role: role.trim() || null, consent, locale: language }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: myReviewKey() });
      qc.invalidateQueries({ queryKey: reviewPromptStatusKey() });
      toast({ title: t("review.prompt.thanks") });
      onDone?.();
    },
    onError: () => toast({ title: t("review.form.error"), variant: "destructive" }),
  });

  const canSubmit = rating >= 1 && rating <= 5 && text.trim().length > 0 && (isEdit || consent);
  const active = hover || rating;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
    >
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{t("review.form.rating_label")}</p>
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t("review.form.rating_label")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={String(n)}
              className="p-0.5 transition-transform hover:scale-110"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
            >
              <Star
                className="h-7 w-7"
                style={
                  n <= active
                    ? { color: "hsl(38 92% 55%)", fill: "hsl(38 92% 55%)" }
                    : { color: "hsl(var(--muted-foreground))" }
                }
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="review-text" className="text-sm font-semibold text-foreground">
          {t("review.form.text_label")}
        </label>
        <Textarea
          id="review-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("review.form.text_placeholder")}
          rows={4}
          maxLength={2000}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="review-role" className="text-sm font-semibold text-foreground">
          {t("review.form.role_label")}
        </label>
        <Input
          id="review-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder={t("review.form.role_placeholder")}
          maxLength={80}
        />
      </div>

      {!isEdit && (
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5"
            aria-label={t("review.form.consent")}
          />
          <span>{t("review.form.consent")}</span>
        </label>
      )}

      <p className="text-xs text-muted-foreground">{t("review.form.pending_notice")}</p>

      <Button type="submit" disabled={!canSubmit || mutation.isPending} className="w-full">
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("review.form.submitting")}
          </>
        ) : (
          t("review.form.submit")
        )}
      </Button>
    </form>
  );
}
