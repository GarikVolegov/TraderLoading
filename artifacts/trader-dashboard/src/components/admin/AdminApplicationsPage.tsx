import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  admitAdminCandidate,
  getAdminCandidateApplications,
  updateAdminCandidateStatus,
  updateAdminCandidateServices,
  type CandidateApplicationItem,
} from "@/lib/adminApi";
import {
  CheckCircle2,
  Clock,
  Euro,
  FileText,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { formatAdminDate, AdminErrorState } from "./shared";

function statusBadge(status: CandidateApplicationItem["status"]) {
  switch (status) {
    case "in_valutazione":
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-400 bg-amber-500/10">
          In valutazione
        </Badge>
      );
    case "ammesso":
      return (
        <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
          Ammesso · pagamento separato
        </Badge>
      );
    case "respinto":
      return (
        <Badge variant="outline" className="border-rose-500/50 text-rose-400 bg-rose-500/10">
          Respinto
        </Badge>
      );
    case "contattato":
      return (
        <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10">
          Contattato
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function renderServiceBadges(services?: string[] | null) {
  const list = services && services.length > 0 ? services : ["base_protocol"];
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((s) => {
        switch (s) {
          case "base_protocol":
            return (
              <Badge
                key={s}
                variant="outline"
                className="border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059] text-[10px] whitespace-nowrap"
              >
                Base
              </Badge>
            );
          case "forge_of_the_past":
            return (
              <Badge
                key={s}
                variant="outline"
                className="border-cyan-500/40 bg-cyan-500/10 text-cyan-400 text-[10px] whitespace-nowrap"
              >
                +Forgia 10€/m
              </Badge>
            );
          case "financial_architecture":
            return (
              <Badge
                key={s}
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] whitespace-nowrap"
              >
                +Patrimonio 10€/m
              </Badge>
            );
          case "doctrine_of_time":
            return (
              <Badge
                key={s}
                variant="outline"
                className="border-purple-500/40 bg-purple-500/10 text-purple-400 text-[10px] whitespace-nowrap"
              >
                +Dottrina 170€
              </Badge>
            );
          default:
            return (
              <Badge key={s} variant="secondary" className="text-[10px] whitespace-nowrap">
                {s}
              </Badge>
            );
        }
      })}
    </div>
  );
}

export function AdminApplicationsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<CandidateApplicationItem | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [approvedServicesDraft, setApprovedServicesDraft] = useState<string[]>(["base_protocol"]);

  const applicationsQuery = useQuery({
    queryKey: ["admin", "candidate-applications", statusFilter, query],
    queryFn: () =>
      getAdminCandidateApplications({
        status: statusFilter === "all" ? undefined : statusFilter,
        q: query.trim() || undefined,
        limit: 50,
      }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "candidate-applications"] });
    qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    qc.invalidateQueries({ queryKey: ["limen-entitlements"] });
  };

  const statusMutation = useMutation({
    mutationFn: (variables: {
      id: number;
      status: "in_valutazione" | "ammesso" | "respinto" | "contattato";
      notes?: string;
    }) => updateAdminCandidateStatus(variables.id, variables.status, variables.notes),
    onSuccess: () => {
      invalidate();
      setSelectedApp(null);
      setActionNotes("");
      toast({
        title: "Stato Aggiornato",
        description: "Lo stato della candidatura è stato aggiornato con successo.",
      });
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "Errore Aggiornamento",
        description: err instanceof Error ? err.message : "Impossibile aggiornare lo stato.",
      });
    },
  });

  const admitMutation = useMutation({
    mutationFn: (variables: {
      id: number;
      userId?: string;
      notes?: string;
      approvedServices?: string[];
    }) =>
      admitAdminCandidate(variables.id, {
        userId: variables.userId || undefined,
        notes: variables.notes,
        approvedServices: variables.approvedServices,
      }),
    onSuccess: () => {
      invalidate();
      setSelectedApp(null);
      setActionNotes("");
      toast({
        title: "Candidatura Ammessa",
        description: "L'operatore e i servizi approvati sono stati sbloccati nel Protocollo LIMEN.",
      });
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "Errore Ammissione",
        description: err instanceof Error ? err.message : "Impossibile ammettere la candidatura.",
      });
    },
  });

  const updateServicesMutation = useMutation({
    mutationFn: (variables: {
      id: number;
      approvedServices: string[];
      notes?: string;
    }) =>
      updateAdminCandidateServices(
        variables.id,
        variables.approvedServices,
        variables.notes,
      ),
    onSuccess: () => {
      invalidate();
      setSelectedApp(null);
      setActionNotes("");
      toast({
        title: "Servizi Aggiornati",
        description: "La dotazione di servizi approvati per l'operatore è stata sincronizzata.",
      });
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "Errore Servizi",
        description: err instanceof Error ? err.message : "Impossibile aggiornare i servizi.",
      });
    },
  });

  const data = applicationsQuery.data;
  const rows = data?.applications ?? [];
  const pendingCount = data?.pendingCount ?? 0;
  const admittedCount = data?.admittedCount ?? 0;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Candidature · Protocollo €150/mese</h1>
          <a href="/admin/scuole" className="text-primary underline">Richieste partnership scuole e invii email →</a>
          <p className="text-sm text-muted-foreground">
            Valuta le candidature e invia l’invito al pagamento. L’ammissione non attiva l’abbonamento.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applicationsQuery.refetch()}
          disabled={applicationsQuery.isFetching}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Aggiorna
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="In Valutazione"
          value={pendingCount}
          detail="Richieste da esaminare"
          icon={Clock}
        />
        <AdminMetricCard
          label="Membri Ammessi"
          value={admittedCount}
          detail="Posti riservati"
          icon={UserCheck}
        />
        <AdminMetricCard
          label="Posti riservati"
          value={`${admittedCount}/25`}
          detail="Ammissioni, non pagamenti"
          icon={Euro}
        />
        <AdminMetricCard
          label="Totale Richieste"
          value={total}
          detail="Storico candidature"
          icon={Users}
        />
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card/80 p-4 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per codice, nome, email, recapito..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtra per stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="in_valutazione">In valutazione</SelectItem>
            <SelectItem value="ammesso">Ammesso · pagamento separato</SelectItem>
            <SelectItem value="contattato">Contattato</SelectItem>
            <SelectItem value="respinto">Respinto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {applicationsQuery.isError ? (
        <AdminErrorState
          title="Errore di caricamento"
          description="Impossibile caricare le candidature dal server."
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-card/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Candidato</TableHead>
                <TableHead>Recapito</TableHead>
                <TableHead>Dotazione & Quota</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicationsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-9" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Nessuna candidatura trovata con i filtri correnti.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-mono font-medium text-xs">
                      {app.candidateCode}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{app.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3 inline" /> {app.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs flex items-center gap-1 font-mono">
                        <MessageSquare className="h-3 w-3 text-emerald-400" />
                        <span className="capitalize">{app.contactType}:</span> {app.contactHandle}
                      </div>
                      {app.referredBy && (
                        <div className="text-[10px] text-muted-foreground">
                          Ref: <span className="font-mono text-primary">{app.referredBy}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {renderServiceBadges(app.approvedServices ?? app.selectedServices)}
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#C5A059]/35 bg-[#C5A059]/10 text-[#E8C56A] whitespace-nowrap">
                            {app.billingCycle === "yearly" ? "Annuale" : "Mensile"}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#E8C56A] whitespace-nowrap">
                            {app.billingCycle === "yearly"
                              ? (app.yearlyFeeCents ?? 0) > 0
                                ? `${(app.yearlyFeeCents ?? 0) / 100} €/anno`
                                : "Base 0€"
                              : (app.monthlyFeeCents ?? 0) > 0
                                ? `${(app.monthlyFeeCents ?? 0) / 100} €/mese`
                                : "Base 0€"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(app.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatAdminDate(app.createdAt)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedApp(app);
                          setActionNotes(app.notes ?? "");
                          setApprovedServicesDraft(
                            app.approvedServices && app.approvedServices.length > 0
                              ? app.approvedServices
                              : app.selectedServices && app.selectedServices.length > 0
                                ? app.selectedServices
                                : ["base_protocol"],
                          );
                        }}
                      >
                        <FileText className="mr-1 h-3.5 w-3.5" /> Dettagli
                      </Button>
                      {app.status === "in_valutazione" && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                          disabled={admitMutation.isPending}
                          onClick={() =>
                            admitMutation.mutate({
                              id: app.id,
                              notes: "Ammesso direttamente da tabella",
                              approvedServices:
                                app.approvedServices ?? app.selectedServices ?? ["base_protocol"],
                            })
                          }
                        >
                          <UserCheck className="mr-1 h-3.5 w-3.5" /> Accetta
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      )}

      {/* MODAL DETTAGLIO E AMMISSIONE CANDIDATURA */}
      {selectedApp && (
        <Dialog open={Boolean(selectedApp)} onOpenChange={() => setSelectedApp(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 pr-6">
                <div>
                  <DialogTitle className="text-lg flex items-center gap-2">
                    Candidatura {selectedApp.candidateCode} - {selectedApp.name}
                  </DialogTitle>
                  <DialogDescription>
                    Questionario di ammissione al Protocollo e piano Tributo 150€/m
                  </DialogDescription>
                </div>
                <div>{statusBadge(selectedApp.status)}</div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 text-xs bg-muted/40">
                <div>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span className="font-medium text-foreground">{selectedApp.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Recapito:</span>{" "}
                  <span className="font-medium text-foreground capitalize">
                    {selectedApp.contactType} ({selectedApp.contactHandle})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Piano selezionato:</span>{" "}
                  <span className="font-semibold text-primary">
                    {selectedApp.planChosen === "founders_10"
                      ? "Esclusiva Prime Persone (10€/m · 100€/a)"
                      : selectedApp.planChosen === "complete_150" || selectedApp.planChosen === "direct_150"
                        ? "Progetto Completo (150€/m · 1.500€/a)"
                        : selectedApp.planChosen === "base_free"
                          ? "Soglia Base Inclusa (0€)"
                          : selectedApp.planChosen}{" "}
                    ({selectedApp.billingCycle === "yearly" ? "Cadenza Annuale" : "Cadenza Mensile"})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Codice Partner (Ref):</span>{" "}
                  <span className="font-mono text-foreground">{selectedApp.referredBy ?? "Nessuno (Diretto)"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data invio:</span>{" "}
                  <span>{formatAdminDate(selectedApp.createdAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Account User ID collegato:</span>{" "}
                  <span className="font-mono">{selectedApp.userId ?? "Non ancora associato"}</span>
                </div>
              </div>

              {/* RISPOSTE AL QUESTIONARIO */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Risposte Questionario Operativo
                </h4>
                <div className="rounded-md border border-border p-3 text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground">Situazione Operativa:</p>
                  <p className="text-foreground">{selectedApp.situation || "Non specificata"}</p>
                </div>
                <div className="rounded-md border border-border p-3 text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground">Orizzonte / Obiettivo:</p>
                  <p className="text-foreground">{selectedApp.horizon || "Non specificato"}</p>
                </div>
                <div className="rounded-md border border-border p-3 text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground">Ostacolo Principale:</p>
                  <p className="text-foreground">{selectedApp.obstacle || "Non specificato"}</p>
                </div>
                <div className="rounded-md border border-border p-3 text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground">Impegno Temporale Dichiarato:</p>
                  <p className="text-foreground">{selectedApp.commitment || "Non specificato"}</p>
                </div>
              </div>

              {/* SELEZIONE SERVIZI DA ATTIVARE / SBLOCCARE */}
              <div className="space-y-3 rounded-md border border-[#C5A059]/40 bg-[#07080b]/70 p-3.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#C5A059]">
                    Configurazione Servizi da Sbloccare
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setApprovedServicesDraft(["base_protocol"])}
                      className="rounded border border-[#C5A059]/30 bg-[#11131c] px-2 py-0.5 font-mono text-[10px] font-bold text-[#94a3b8] hover:border-[#C5A059] hover:text-white transition-colors whitespace-nowrap"
                    >
                      Soglia Base (0€)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setApprovedServicesDraft([
                          "base_protocol",
                          "forge_of_the_past",
                          "financial_architecture",
                        ])
                      }
                      className="rounded border border-[#10b981]/40 bg-[#10b981]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#10b981] hover:bg-[#10b981]/20 transition-colors whitespace-nowrap"
                    >
                      Prime Persone 10€ (Forgia + Patrimonio)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setApprovedServicesDraft([
                          "base_protocol",
                          "forge_of_the_past",
                          "financial_architecture",
                          "doctrine_of_time",
                        ])
                      }
                      className="rounded border border-[#C5A059]/50 bg-[#C5A059]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#E8C56A] hover:bg-[#C5A059]/25 transition-colors whitespace-nowrap"
                    >
                      Progetto Completo 150€ (Tutto)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2.5 rounded border border-[#C5A059]/40 bg-[#11131c] cursor-default">
                    <input type="checkbox" checked disabled className="accent-[#C5A059] h-4 w-4" />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-white">Dotazione Base (0 €)</p>
                      <p className="text-[10px] text-muted-foreground">Varco, Diario, Fratellanza, Gradi (no tornei)</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded border border-border bg-[#11131c] cursor-pointer hover:border-[#C5A059]/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={approvedServicesDraft.includes("forge_of_the_past")}
                      onChange={(e) => {
                        setApprovedServicesDraft((prev) =>
                          e.target.checked
                            ? [...prev, "forge_of_the_past"]
                            : prev.filter((s) => s !== "forge_of_the_past"),
                        );
                      }}
                      className="accent-[#C5A059] h-4 w-4"
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-white">La Forgia (Prime Persone 10€/m · 100€/a)</p>
                      <p className="text-[10px] text-muted-foreground">Banco di Forgiatura & Replay storico</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded border border-border bg-[#11131c] cursor-pointer hover:border-[#C5A059]/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={approvedServicesDraft.includes("financial_architecture")}
                      onChange={(e) => {
                        setApprovedServicesDraft((prev) =>
                          e.target.checked
                            ? [...prev, "financial_architecture"]
                            : prev.filter((s) => s !== "financial_architecture"),
                        );
                      }}
                      className="accent-[#C5A059] h-4 w-4"
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-white">Architettura Patrimoniale (Inclusa nel Piano 10€)</p>
                      <p className="text-[10px] text-muted-foreground">Fondamenta di rischio & Radar drawdown</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded border border-border bg-[#11131c] cursor-pointer hover:border-[#C5A059]/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={approvedServicesDraft.includes("doctrine_of_time")}
                      onChange={(e) => {
                        setApprovedServicesDraft((prev) =>
                          e.target.checked
                            ? [...prev, "doctrine_of_time"]
                            : prev.filter((s) => s !== "doctrine_of_time"),
                        );
                      }}
                      className="accent-[#C5A059] h-4 w-4"
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-white">Dottrina del Tempo & Finestra (Completo 150€/m · 1500€/a)</p>
                      <p className="text-[10px] text-muted-foreground">Accademia video, Finestra operativa & Tornei</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* GESTIONE STATO & NOTE ADMIN */}
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Decisione & Note Admin
                </h4>
                <Input
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Inserisci note interne sull'ammissione o colloquio..."
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({
                      id: selectedApp.id,
                      status: "contattato",
                      notes: actionNotes,
                    })
                  }
                >
                  <MessageSquare className="mr-1 h-3.5 w-3.5" /> Segna Contattato
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({
                      id: selectedApp.id,
                      status: "respinto",
                      notes: actionNotes,
                    })
                  }
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Respingi
                </Button>
              </div>

              <div className="flex gap-1.5">
                {selectedApp.status === "ammesso" ? (
                  <Button
                    size="sm"
                    className="bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080b] font-semibold"
                    disabled={updateServicesMutation.isPending}
                    onClick={() =>
                      updateServicesMutation.mutate({
                        id: selectedApp.id,
                        notes: actionNotes,
                        approvedServices: approvedServicesDraft,
                      })
                    }
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Salva Modifiche Servizi
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    disabled={admitMutation.isPending}
                    onClick={() =>
                      admitMutation.mutate({
                        id: selectedApp.id,
                        notes: actionNotes,
                        approvedServices: approvedServicesDraft,
                      })
                    }
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Accetta Candidatura & Attiva Servizi
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
