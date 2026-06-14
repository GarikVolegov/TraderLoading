import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { uiText } from "@/contexts/LanguageContext";
import { getAdminAudit } from "@/lib/adminApi";
import { RefreshCw } from "lucide-react";
import { getSearchParam, formatAdminDate, AdminErrorState } from "./shared";

function getInitialAuditTargetId(): string {
  return getSearchParam("targetId");
}

export function AdminSecurityPage() {
  const [actor, setActor] = useState("");
  const [targetId, setTargetId] = useState(getInitialAuditTargetId);
  const audit = useQuery({
    queryKey: ["admin", "audit", actor, targetId],
    queryFn: () =>
      getAdminAudit({
        actor: actor.trim() || undefined,
        targetId: targetId.trim() || undefined,
        limit: 50,
      }),
  });
  const rows = audit.data?.audit ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{uiText("admin.security.title")}</h1>
          <p className="text-sm text-muted-foreground">
            Audit log admin con filtri per attore e target.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => audit.refetch()}
          disabled={audit.isFetching}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Aggiorna
        </Button>
      </div>
      <div className="grid gap-3 rounded-lg border border-border bg-card/80 p-4 md:grid-cols-2">
        <Input
          value={actor}
          onChange={(event) => setActor(event.target.value)}
          placeholder={uiText("auto.ui.3650c115b4")}
        />
        <Input
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          placeholder={uiText("auto.ui.01af999d30")}
        />
      </div>
      {audit.isError ? (
        <AdminErrorState
          title={uiText("auto.ui.87e782d865")}
          description="Il log sicurezza non e stato caricato."
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-card/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{uiText("auto.ui.f18824e55d")}</TableHead>
                <TableHead>{uiText("auto.ui.6fe7fde0da")}</TableHead>
                <TableHead>{uiText("auto.ui.61ad50a9b9")}</TableHead>
                <TableHead>{uiText("auto.ui.cbeec536b2")}</TableHead>
                <TableHead>{uiText("auto.ui.e5e429bcc9")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-8" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.action}</TableCell>
                      <TableCell>
                        <div>{item.actorUserId}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.actorRole}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{item.targetType}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {item.targetId}
                        </div>
                      </TableCell>
                      <TableCell>{item.reason ?? "-"}</TableCell>
                      <TableCell>{formatAdminDate(item.createdAt)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {!audit.isLoading && rows.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Nessun evento audit trovato.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
