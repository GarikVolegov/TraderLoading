import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { uiText } from "@/contexts/LanguageContext";
import {
  getAdminReviews,
  approveAdminReview,
  rejectAdminReview,
  hideAdminReview,
  type AdminReviewRow,
} from "@/lib/adminApi";
import { OperationalPageHeader, OperationalLoadingGrid } from "./operational";
import { formatAdminDate, AdminErrorState } from "./shared";

type ReviewFilter = "pending" | "approved" | "rejected" | "withdrawn" | "all";
const FILTERS: ReviewFilter[] = ["pending", "approved", "rejected", "withdrawn", "all"];

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className="h-3.5 w-3.5"
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

export function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReviewFilter>("pending");
  const [reason, setReason] = useState("");

  const reviews = useQuery({
    queryKey: ["admin", "reviews", filter],
    queryFn: () => getAdminReviews({ status: filter, limit: 100 }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
  };

  const approve = useMutation({
    mutationFn: (id: number) => approveAdminReview(id),
    onSuccess: invalidate,
  });
  const hide = useMutation({
    mutationFn: (id: number) => hideAdminReview(id),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (id: number) => rejectAdminReview(id, reason),
    onSuccess: () => {
      setReason("");
      invalidate();
    },
  });

  const reasonReady = reason.trim().length >= 3;
  const rows: AdminReviewRow[] = reviews.data?.reviews ?? [];
  const actionPending = approve.isPending || hide.isPending || reject.isPending;

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title={uiText("admin.reviews.title")}
        description={uiText("admin.reviews.subtitle")}
        onRefresh={() => reviews.refetch()}
        refreshing={reviews.isFetching}
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {uiText(`admin.reviews.filter.${f}`)}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={uiText("admin.reviews.reject_reason")}
          aria-label={uiText("admin.reviews.reject_reason")}
        />
      </div>

      {reviews.isLoading ? (
        <OperationalLoadingGrid />
      ) : reviews.isError ? (
        <AdminErrorState
          title={uiText("admin.reviews.unavailable")}
          description={uiText("admin.reviews.subtitle")}
        />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/70 p-6 text-sm text-muted-foreground">
          {uiText("admin.reviews.empty")}
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-card/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{uiText("admin.reviews.col.author")}</TableHead>
                <TableHead>{uiText("admin.reviews.col.rating")}</TableHead>
                <TableHead>{uiText("admin.reviews.col.review")}</TableHead>
                <TableHead>{uiText("admin.reviews.col.status")}</TableHead>
                <TableHead>{uiText("admin.reviews.col.date")}</TableHead>
                <TableHead className="text-right">{uiText("admin.reviews.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    {row.role && (
                      <div className="text-xs text-muted-foreground">{row.role}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <ReviewStars rating={row.rating} />
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="line-clamp-3 text-sm text-muted-foreground">{row.text}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.published ? "default" : "secondary"}>
                      {uiText(`admin.reviews.filter.${row.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatAdminDate(row.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {row.status !== "approved" && (
                        <Button
                          size="sm"
                          disabled={actionPending}
                          onClick={() => approve.mutate(row.id)}
                        >
                          {uiText("admin.reviews.approve")}
                        </Button>
                      )}
                      {row.published && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionPending}
                          onClick={() => hide.mutate(row.id)}
                        >
                          {uiText("admin.reviews.hide")}
                        </Button>
                      )}
                      {row.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/50 text-destructive hover:bg-destructive/10"
                          disabled={actionPending || !reasonReady}
                          onClick={() => reasonReady && reject.mutate(row.id)}
                        >
                          {uiText("admin.reviews.reject")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
