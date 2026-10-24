import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uiText } from "@/contexts/LanguageContext";
import {
  assignAdminRole,
  getAdminAudit,
  getAdminRoles,
  revokeAdminRole,
  type AdminRole,
} from "@/lib/adminApi";
import { RefreshCw, UserPlus, UserX } from "lucide-react";
import { getSearchParam, formatAdminDate, AdminErrorState } from "./shared";

function getInitialAuditTargetId(): string {
  return getSearchParam("targetId");
}

export function AdminSecurityPage() {
  const qc = useQueryClient();
  const [actor, setActor] = useState("");
  const [targetId, setTargetId] = useState(getInitialAuditTargetId);

  // New admin role form state
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<AdminRole>("support_agent");
  const [roleMessage, setRoleMessage] = useState<string | null>(null);

  const audit = useQuery({
    queryKey: ["admin", "audit", actor, targetId],
    queryFn: () =>
      getAdminAudit({
        actor: actor.trim() || undefined,
        targetId: targetId.trim() || undefined,
        limit: 50,
      }),
  });

  const rolesQuery = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: getAdminRoles,
  });

  const assignMutation = useMutation({
    mutationFn: (variables: { userId: string; role: AdminRole }) =>
      assignAdminRole(variables.userId, variables.role),
    onSuccess: () => {
      setRoleMessage("Ruolo admin assegnato con successo.");
      setNewUserId("");
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
    onError: (err: Error) => {
      setRoleMessage(`Errore: ${err.message}`);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => revokeAdminRole(userId, "Revocato da console admin"),
    onSuccess: () => {
      setRoleMessage("Ruolo staff revocato con successo.");
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
    onError: (err: Error) => {
      setRoleMessage(`Errore: ${err.message}`);
    },
  });

  const rows = audit.data?.audit ?? [];
  const staffMembers = rolesQuery.data?.roles ?? [];
  const bootstrapIds = rolesQuery.data?.bootstrapUserIds ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{uiText("admin.security.title")}</h1>
          <p className="text-sm text-muted-foreground">
            Gestione ruoli staff amministrativo e audit log sicurezza.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            audit.refetch();
            rolesQuery.refetch();
          }}
          disabled={audit.isFetching || rolesQuery.isFetching}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Aggiorna
        </Button>
      </div>

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">Audit Log Sicurezza</TabsTrigger>
          <TabsTrigger value="staff">Staff & Ruoli Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          {roleMessage && (
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
              {roleMessage}
            </div>
          )}

          {/* ASSEGNAZIONE RUOLO RAPIDA */}
          <section className="rounded-lg border border-border bg-card/80 p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Nomina Nuovo Membro dello Staff
            </h3>
            <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
              <Input
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="User ID utente (es. user_3F4xxkSM...)"
                className="font-mono text-xs"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AdminRole)}
                className="min-h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="support_agent">support_agent (Supporto)</option>
                <option value="moderator">moderator (Moderazione)</option>
                <option value="admin_operator">admin_operator (Operatore)</option>
                <option value="content_manager">content_manager (Contenuti)</option>
                <option value="developer_ops">developer_ops (DevOps)</option>
                <option value="super_admin">super_admin (Super Amministratore)</option>
                <option value="read_only_auditor">read_only_auditor (Auditor)</option>
              </select>
              <Button
                disabled={assignMutation.isPending || !newUserId.trim()}
                onClick={() =>
                  assignMutation.mutate({
                    userId: newUserId.trim(),
                    role: newRole,
                  })
                }
              >
                Assegna Ruolo
              </Button>
            </div>
          </section>

          {/* TABELLA STAFF ADMIN */}
          <section className="overflow-hidden rounded-lg border border-border bg-card/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data Nomina</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : staffMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Nessun operatore configurato nel database.
                    </TableCell>
                  </TableRow>
                ) : (
                  staffMembers.map((member) => {
                    const isBootstrap = bootstrapIds.includes(member.userId);
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-mono text-xs">
                          {member.userId}
                          {isBootstrap && (
                            <Badge variant="outline" className="ml-2 text-[10px] text-primary border-primary/40">
                              Bootstrap
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {member.userName || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="font-mono text-xs">
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={member.status === "active" ? "outline" : "secondary"}
                            className={member.status === "active" ? "text-emerald-400 border-emerald-500/30" : ""}
                          >
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatAdminDate(member.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isBootstrap && member.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-400 hover:text-rose-300"
                              disabled={revokeMutation.isPending}
                              onClick={() => revokeMutation.mutate(member.userId)}
                            >
                              <UserX className="mr-1 h-3.5 w-3.5" /> Revoca
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
