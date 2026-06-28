import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ChevronLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSupportTicketThreadQueryKey,
  getGetSupportTicketsQueryKey,
  useCreateSupportTicket,
  useCreateSupportTicketMessage,
  useGetSupportTicketThread,
  useGetSupportTickets,
  type SupportTicketMessage,
} from "@workspace/api-client-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "default"}>
      {t(`support.status.${status}`)}
    </Badge>
  );
}

function formatWhen(value: string): string {
  return new Date(value).toLocaleString();
}

function NewTicketForm() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const createTicket = useCreateSupportTicket();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({ description: t("support.error.required"), variant: "destructive" });
      return;
    }
    try {
      await createTicket.mutateAsync({
        data: { subject: subject.trim(), body: message.trim() },
      });
      qc.invalidateQueries({ queryKey: getGetSupportTicketsQueryKey() });
      setSubject("");
      setMessage("");
      toast({ description: t("support.toast.created") });
    } catch {
      toast({ description: t("support.error.generic"), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-6">
        <h3 className="text-lg font-bold">{t("support.new.heading")}</h3>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("support.field.subject")}
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("support.field.subject.ph")}
            maxLength={160}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("support.field.message")}
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("support.field.message.ph")}
            rows={5}
          />
        </div>
        <Button onClick={submit} disabled={createTicket.isPending}>
          {createTicket.isPending
            ? t("support.action.sending")
            : t("support.action.submit")}
        </Button>
      </CardContent>
    </Card>
  );
}

function TicketList() {
  const { t } = useLanguage();
  const { data: tickets, isLoading } = useGetSupportTickets();

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-6">
        <h3 className="text-lg font-bold">{t("support.list.heading")}</h3>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : !tickets || tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("support.list.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/support/${ticket.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2 transition-colors hover:bg-background/70"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {ticket.subject}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatWhen(ticket.updatedAt)}
                    </span>
                  </span>
                  <StatusBadge status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MessageBubble({ message }: { message: SupportTicketMessage }) {
  const { t } = useLanguage();
  const isSupport = message.authorType === "support";
  return (
    <li
      className={`rounded-lg border px-3 py-2 ${
        isSupport ? "border-primary/30 bg-primary/5" : "border-border bg-background/40"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {isSupport ? t("support.author.support") : t("support.author.user")}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {formatWhen(message.createdAt)}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm">{message.body}</p>
    </li>
  );
}

function TicketThread({ id }: { id: number }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useGetSupportTicketThread(id);
  const sendMessage = useCreateSupportTicketMessage();
  const [reply, setReply] = useState("");

  const submit = async () => {
    if (!reply.trim()) return;
    try {
      await sendMessage.mutateAsync({ id, data: { body: reply.trim() } });
      qc.invalidateQueries({ queryKey: getGetSupportTicketThreadQueryKey(id) });
      qc.invalidateQueries({ queryKey: getGetSupportTicketsQueryKey() });
      setReply("");
      toast({ description: t("support.toast.replied") });
    } catch {
      toast({ description: t("support.error.generic"), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">{t("support.notfound")}</p>;
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate text-lg font-bold">{data.ticket.subject}</h3>
          <StatusBadge status={data.ticket.status} />
        </div>
        <ul className="space-y-3">
          {data.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </ul>
        {data.ticket.status !== "closed" && (
          <div className="space-y-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t("support.thread.reply.ph")}
              rows={3}
            />
            <Button onClick={submit} disabled={sendMessage.isPending}>
              {sendMessage.isPending
                ? t("support.thread.sending")
                : t("support.thread.send")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Support() {
  const { t } = useLanguage();
  const [match, params] = useRoute("/support/:id");
  const parsedId = match && params?.id ? Number(params.id) : NaN;
  const ticketId = Number.isInteger(parsedId) ? parsedId : null;

  return (
    <PageLayout>
      <PageHeader title={t("support.title")} subtitle={t("support.subtitle")} />
      {ticketId !== null ? (
        <div className="space-y-4">
          <Link
            href="/support"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("support.thread.back")}
          </Link>
          <TicketThread id={ticketId} />
        </div>
      ) : (
        <div className="space-y-4">
          <NewTicketForm />
          <TicketList />
        </div>
      )}
    </PageLayout>
  );
}
