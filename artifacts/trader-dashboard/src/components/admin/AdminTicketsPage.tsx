import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminSupportTicketThread,
  getAdminSupportTickets,
  replyAdminSupportTicket,
  setAdminSupportTicketStatus,
} from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  open: "default",
  pending: "outline",
  closed: "secondary",
};

const FILTERS = ["all", "open", "pending", "closed"] as const;

function formatWhen(value: string): string {
  return new Date(value).toLocaleString();
}

export function AdminTicketsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");

  const list = useQuery({
    queryKey: ["admin", "support", "tickets", status],
    queryFn: () => getAdminSupportTickets(status === "all" ? {} : { status }),
  });

  const thread = useQuery({
    queryKey: ["admin", "support", "ticket", selectedId],
    queryFn: () => getAdminSupportTicketThread(selectedId as number),
    enabled: selectedId !== null,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "support", "ticket", selectedId] });
    qc.invalidateQueries({ queryKey: ["admin", "support", "tickets", status] });
  };

  const replyMutation = useMutation({
    mutationFn: (body: string) => replyAdminSupportTicket(selectedId as number, body),
    onSuccess: () => {
      setReply("");
      invalidate();
      toast({ description: t("admin.tickets.toast.replied") });
    },
    onError: () =>
      toast({ description: t("support.error.generic"), variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (next: string) =>
      setAdminSupportTicketStatus(selectedId as number, next),
    onSuccess: () => {
      invalidate();
      toast({ description: t("admin.tickets.toast.status") });
    },
    onError: () =>
      toast({ description: t("support.error.generic"), variant: "destructive" }),
  });

  if (selectedId !== null) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
          {t("admin.tickets.back")}
        </Button>
        {thread.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : thread.isError || !thread.data ? (
          <p className="text-sm text-muted-foreground">{t("admin.tickets.error")}</p>
        ) : (
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="truncate text-lg font-bold">
                  {thread.data.ticket.subject}
                </h3>
                <Badge variant={STATUS_VARIANT[thread.data.ticket.status] ?? "default"}>
                  {t(`support.status.${thread.data.ticket.status}`)}
                </Badge>
              </div>
              <ul className="space-y-3">
                {thread.data.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-lg border px-3 py-2 ${
                      m.authorType === "support"
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-background/40"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {m.authorType === "support"
                          ? t("support.author.support")
                          : t("admin.tickets.user")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatWhen(m.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={t("admin.tickets.reply.ph")}
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => reply.trim() && replyMutation.mutate(reply.trim())}
                    disabled={replyMutation.isPending || !reply.trim()}
                  >
                    {replyMutation.isPending
                      ? t("admin.tickets.reply.sending")
                      : t("admin.tickets.reply.send")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => statusMutation.mutate("open")}
                    disabled={statusMutation.isPending}
                  >
                    {t("admin.tickets.status.open")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => statusMutation.mutate("pending")}
                    disabled={statusMutation.isPending}
                  >
                    {t("admin.tickets.status.pending")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => statusMutation.mutate("closed")}
                    disabled={statusMutation.isPending}
                  >
                    {t("admin.tickets.status.closed")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{t("admin.tickets.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.tickets.subtitle")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={status === f ? "default" : "outline"}
            onClick={() => setStatus(f)}
          >
            {t(`admin.tickets.filter.${f}`)}
          </Button>
        ))}
      </div>
      {list.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : list.isError ? (
        <p className="text-sm text-muted-foreground">{t("admin.tickets.error")}</p>
      ) : !list.data || list.data.tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.tickets.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {list.data.tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(ticket.id);
                  setReply("");
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2 text-left transition-colors hover:bg-background/70"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {ticket.subject}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatWhen(ticket.updatedAt)}
                  </span>
                </span>
                <Badge variant={STATUS_VARIANT[ticket.status] ?? "default"}>
                  {t(`support.status.${ticket.status}`)}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
