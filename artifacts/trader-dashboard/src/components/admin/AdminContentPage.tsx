import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { uiText } from "@/contexts/LanguageContext";
import { getAdminContentItems, getAdminContentOverview, publishAdminContentItem, unpublishAdminContentItem, type AdminContentItem } from "@/lib/adminApi";
import { BookOpen, CheckCircle2, FileText, Library, MessageSquare, RefreshCw, TrendingUp } from "lucide-react";
import { OperationalPageHeader, OperationalLoadingGrid } from "./operational";
import { formatAdminDate, AdminErrorState } from "./shared";

function AdminContentInventoryTable({
  items,
  actionPending,
  onAction,
}: {
  items: AdminContentItem[];
  actionPending: boolean;
  onAction: (item: AdminContentItem, action: "publish" | "unpublish") => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/70 p-6 text-sm text-muted-foreground">
        Nessun contenuto library presente. Crea o importa contenuti dalla sezione
        Library per renderli gestibili qui.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/80">
      <div className="flex flex-col gap-1 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold">{uiText("admin.content.publishing_queue")}</h2>
          <p className="text-xs text-muted-foreground">
            Contenuti library ordinati per ultimo aggiornamento.
          </p>
        </div>
        <Badge variant="outline">{items.length} elementi</Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{uiText("auto.ui.fd19042867")}</TableHead>
            <TableHead>{uiText("auto.ui.30c54a96f8")}</TableHead>
            <TableHead>{uiText("auto.ui.227771829c")}</TableHead>
            <TableHead>{uiText("auto.ui.148c60ecba")}</TableHead>
            <TableHead>{uiText("auto.ui.4e35f7f30b")}</TableHead>
            <TableHead className="text-right">{uiText("auto.ui.f18824e55d")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.title}</div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.type}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.collectionTitle ?? "Senza collection"}
              </TableCell>
              <TableCell className="tabular-nums">
                {item.requiredLevel}
              </TableCell>
              <TableCell>
                <Badge variant={item.published ? "default" : "secondary"}>
                  {item.published ? "Pubblicato" : "Bozza"}
                </Badge>
              </TableCell>
              <TableCell>{formatAdminDate(item.updatedAt)}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant={item.published ? "outline" : "default"}
                  size="sm"
                  disabled={actionPending}
                  onClick={() =>
                    onAction(item, item.published ? "unpublish" : "publish")
                  }
                >
                  {item.published ? "Ritira" : "Pubblica"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

export function AdminContentPage() {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const content = useQuery({
    queryKey: ["admin", "content", "overview"],
    queryFn: getAdminContentOverview,
  });
  const contentItems = useQuery({
    queryKey: ["admin-content-items"],
    queryFn: () => getAdminContentItems({ limit: 25 }),
  });
  const contentAction = useMutation({
    mutationFn: ({
      item,
      action,
    }: {
      item: AdminContentItem;
      action: "publish" | "unpublish";
    }) =>
      action === "publish"
        ? publishAdminContentItem(item.id, reason)
        : unpublishAdminContentItem(item.id, reason),
    onSuccess: () => {
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-content-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "content", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
  const metrics = content.data?.metrics;
  const reasonReady = reason.trim().length >= 3;

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title={uiText("auto.ui.4f9be057f0")}
        description="Inventario publishing: library, missioni, milestone, quote e community."
        onRefresh={() => {
          content.refetch();
          contentItems.refetch();
        }}
        refreshing={content.isFetching || contentItems.isFetching}
      />
      {content.isLoading || contentItems.isLoading ? (
        <OperationalLoadingGrid />
      ) : content.isError || contentItems.isError ? (
        <AdminErrorState
          title={uiText("admin.content.unavailable")}
          description="L'inventario contenuti non e stato caricato."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AdminMetricCard
              label="Collection"
              value={metrics?.collections ?? 0}
              detail={`${metrics?.publishedCollections ?? 0} pubblicate`}
              icon={Library}
            />
            <AdminMetricCard
              label="Contenuti"
              value={metrics?.contents ?? 0}
              detail={`${metrics?.publishedContents ?? 0} pubblicati`}
              icon={BookOpen}
            />
            <AdminMetricCard
              label="Mission template"
              value={metrics?.missionTemplates ?? 0}
              detail="Template riutilizzabili"
              icon={CheckCircle2}
            />
            <AdminMetricCard
              label="Milestone"
              value={metrics?.levelMilestones ?? 0}
              detail="Progressione livelli"
              icon={TrendingUp}
            />
            <AdminMetricCard
              label="Quote"
              value={metrics?.quotes ?? 0}
              detail="Frasi motivazionali"
              icon={FileText}
            />
            <AdminMetricCard
              label="Community"
              value={metrics?.communities ?? 0}
              detail={`${metrics?.communityMessages ?? 0} messaggi`}
              icon={MessageSquare}
            />
          </div>
          <Alert variant={contentAction.isError ? "destructive" : "default"}>
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{uiText("auto.ui.99ad88bfd8")}</AlertTitle>
            <AlertDescription>
              Inserisci un motivo prima di pubblicare o ritirare un contenuto.
              Ogni modifica viene scritta nell'audit trail.
            </AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={uiText("auto.ui.070e39fc1a")}
              aria-label={uiText("auto.ui.54e00a6d80")}
            />
            <Button
              variant="outline"
              onClick={() => {
                content.refetch();
                contentItems.refetch();
              }}
              disabled={content.isFetching || contentItems.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Aggiorna
            </Button>
          </div>
          {!reasonReady && (
            <p className="text-xs text-muted-foreground">
              Il motivo deve avere almeno 3 caratteri per abilitare le azioni.
            </p>
          )}
          <AdminContentInventoryTable
            items={contentItems.data?.items ?? []}
            actionPending={contentAction.isPending || !reasonReady}
            onAction={(item, action) => {
              if (!reasonReady) return;
              contentAction.mutate({ item, action });
            }}
          />
        </>
      )}
    </div>
  );
}
