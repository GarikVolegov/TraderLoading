import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  FileText,
  GitBranch,
  Globe2,
  Layers3,
  Loader2,
  MessageSquareText,
  Network,
  RefreshCw,
  Send,
  Upload,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WikiGraphView } from "@/components/WikiGraphView";
import {
  WikiFolderTree,
  WIKI_SOURCE_DND_TYPE,
  type WikiFolderFilter,
} from "@/components/WikiFolderTree";
import { API_BASE as API, apiFetch, apiUpload } from "@/lib/apiFetch";
import { uiText } from "@/contexts/LanguageContext";

type WikiStatus = "queued" | "processing" | "ready" | "error" | "pending_transcription";
type WikiKind = "text" | "pdf" | "image" | "office" | "audio" | "video" | "url" | "unknown";

interface WikiSource {
  id: number;
  kind: WikiKind;
  title: string;
  status: WikiStatus;
  error: string | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  folderId: number | null;
  createdAt: string;
}

interface WikiGraphData {
  stats: { sources: number; nodes: number; edges: number; communities: number };
  communities: WikiCommunity[];
  nodes: Array<{
    id: number;
    label: string;
    type: string;
    communityId: number | null;
    sourceId: number | null;
  }>;
  edges: Array<{ id: number; fromNodeId: number; toNodeId: number; relation: string }>;
}

interface WikiCommunity {
  id: number;
  label: string;
  summary: string;
  nodeCount: number;
  cohesion: string;
}

interface WikiAnswer {
  answer: string;
  citations: Array<{ sourceId: number; title: string; excerpt: string }>;
  nodes: Array<{ id: number; label: string; type: string }>;
}

interface SelectedNode {
  nodeId: number;
  sourceId: number | null;
  label: string;
}

const KIND_ICON: Record<string, typeof FileText> = {
  text: FileText,
  pdf: FileText,
  image: Layers3,
  office: FileText,
  audio: Volume2,
  video: Video,
  url: Globe2,
  unknown: FileText,
};

const STATUS_OPTIONS: Array<{ value: "all" | WikiStatus; label: string }> = [
  { value: "all", label: "Tutti gli stati" },
  { value: "ready", label: "Pronte" },
  { value: "queued", label: "In coda" },
  { value: "processing", label: "In elaborazione" },
  { value: "pending_transcription", label: "Da trascrivere" },
  { value: "error", label: "Con errore" },
];

const KIND_OPTIONS: Array<{ value: "all" | WikiKind; label: string }> = [
  { value: "all", label: "Tutti i tipi" },
  { value: "text", label: "Note e testo" },
  { value: "pdf", label: "PDF" },
  { value: "office", label: "Office" },
  { value: "image", label: "Immagini" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "url", label: "URL" },
  { value: "unknown", label: "Altri file" },
];

function mutationMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Operazione non riuscita. Riprova tra poco.";
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="leading-relaxed">{message}</span>
    </div>
  );
}

function StatusPill({ status }: { status: WikiStatus }) {
  const meta = {
    queued: { label: "in coda", color: "text-sky-300", icon: Loader2 },
    processing: { label: "elaborazione", color: "text-amber-300", icon: Loader2 },
    ready: { label: "pronta", color: "text-emerald-300", icon: CheckCircle2 },
    error: { label: "errore", color: "text-red-300", icon: AlertCircle },
    pending_transcription: { label: "da trascrivere", color: "text-violet-300", icon: Volume2 },
  }[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold ${meta.color}`}
    >
      <Icon
        className={`h-3 w-3 ${status === "processing" || status === "queued" ? "animate-spin" : ""}`}
      />
      {meta.label}
    </span>
  );
}

function SourceRow({ source, onDelete }: { source: WikiSource; onDelete: (id: number) => void }) {
  const Icon = KIND_ICON[source.kind] ?? FileText;
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(WIKI_SOURCE_DND_TYPE, String(source.id));
        event.dataTransfer.effectAllowed = "move";
      }}
      className="grid cursor-grab grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/45 bg-card/60 px-3 py-2 active:cursor-grabbing"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold">{source.title}</p>
          <StatusPill status={source.status} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {source.fileName ?? source.kind} · {new Date(source.createdAt).toLocaleString("it-IT")}
        </p>
        {source.error && (
          <p className="whitespace-normal break-words text-xs leading-relaxed text-red-300">
            {source.error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(source.id)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-300"
        aria-label={uiText("wiki.source.delete")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Wiki() {
  const qc = useQueryClient();
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [url, setUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<WikiAnswer[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | WikiStatus>("all");
  const [kindFilter, setKindFilter] = useState<"all" | WikiKind>("all");
  const [folderFilter, setFolderFilter] = useState<WikiFolderFilter>("all");
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);

  const { data: sources = [] } = useQuery({
    queryKey: ["wiki", "sources"],
    queryFn: () => apiFetch<WikiSource[]>(`${API}/wiki/sources`),
    refetchInterval: (query) =>
      (query.state.data as WikiSource[] | undefined)?.some((source) =>
        ["queued", "processing"].includes(source.status),
      )
        ? 2500
        : false,
  });

  const { data: graph } = useQuery({
    queryKey: ["wiki", "graph"],
    queryFn: () => apiFetch<WikiGraphData>(`${API}/wiki/graph`),
    refetchInterval: 15000,
  });

  const { data: communities = [] } = useQuery({
    queryKey: ["wiki", "communities"],
    queryFn: () => apiFetch<WikiCommunity[]>(`${API}/wiki/communities`),
    refetchInterval: 15000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wiki", "sources"] });
    qc.invalidateQueries({ queryKey: ["wiki", "graph"] });
    qc.invalidateQueries({ queryKey: ["wiki", "communities"] });
    qc.invalidateQueries({ queryKey: ["wiki", "folders"] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiUpload<WikiSource>(`${API}/wiki/sources/upload`, form);
    },
    onSuccess: invalidate,
  });

  const textMutation = useMutation({
    mutationFn: () =>
      apiFetch<WikiSource>(`${API}/wiki/sources/text`, {
        method: "POST",
        body: JSON.stringify({ title: noteTitle.trim() || undefined, content: noteText.trim() }),
      }),
    onSuccess: () => {
      setNoteTitle("");
      setNoteText("");
      invalidate();
    },
  });

  const urlMutation = useMutation({
    mutationFn: () =>
      apiFetch<WikiSource>(`${API}/wiki/sources/url`, {
        method: "POST",
        body: JSON.stringify({ url: url.trim() }),
      }),
    onSuccess: () => {
      setUrl("");
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/wiki/sources/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const queryMutation = useMutation({
    mutationFn: () =>
      apiFetch<WikiAnswer>(`${API}/wiki/query`, {
        method: "POST",
        body: JSON.stringify({ question: question.trim() }),
      }),
    onSuccess: (answer) => {
      setAnswers((current) => [answer, ...current].slice(0, 8));
      setQuestion("");
      qc.invalidateQueries({ queryKey: ["wiki", "graph"] });
    },
  });

  const reindexMutation = useMutation({
    mutationFn: () => apiFetch(`${API}/wiki/reindex`, { method: "POST", body: "{}" }),
    onSuccess: invalidate,
  });

  const onDrop = useCallback(
    (files: File[]) => {
      for (const file of files) uploadMutation.mutate(file);
    },
    [uploadMutation],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: true,
    noClick: true,
  });

  const readyCount = useMemo(
    () => sources.filter((source) => source.status === "ready").length,
    [sources],
  );

  const folderCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const source of sources) {
      const key = source.folderId == null ? "root" : String(source.folderId);
      acc[key] = (acc[key] ?? 0) + 1;
    }
    return acc;
  }, [sources]);

  const filteredSources = useMemo(
    () =>
      sources.filter(
        (source) =>
          (statusFilter === "all" || source.status === statusFilter) &&
          (kindFilter === "all" || source.kind === kindFilter) &&
          (folderFilter === "all" ||
            (folderFilter === "root"
              ? source.folderId == null
              : source.folderId === folderFilter)) &&
          (!selectedNode?.sourceId || source.id === selectedNode.sourceId),
      ),
    [kindFilter, sources, statusFilter, folderFilter, selectedNode],
  );

  const onGraphNodeClick = useCallback(
    (nodeId: number) => {
      const node = graph?.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;
      setSelectedNode((current) =>
        current?.nodeId === nodeId
          ? null
          : { nodeId, sourceId: node.sourceId, label: node.label },
      );
    },
    [graph],
  );

  const uploadError = mutationMessage(uploadMutation.error);
  const textError = mutationMessage(textMutation.error);
  const urlError = mutationMessage(urlMutation.error);
  const queryError = mutationMessage(queryMutation.error);
  const deleteError = mutationMessage(deleteMutation.error);
  const reindexError = mutationMessage(reindexMutation.error);

  const statTiles: Array<[string, number]> = [
    ["Fonti", graph?.stats.sources ?? sources.length],
    ["Ready", readyCount],
    ["Nodi", graph?.stats.nodes ?? 0],
    ["Relazioni", graph?.stats.edges ?? 0],
  ];

  return (
    <PageLayout>
      <ProUpgradeGate feature="wiki">
        <PageHeader
          title={uiText("wiki.title")}
          subtitle={uiText("wiki.subtitle")}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => reindexMutation.mutate()}
              disabled={reindexMutation.isPending}
            >
              {reindexMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Reindex
            </Button>
          }
        />

        <div className="mt-2 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">
            <Card>
              <CardContent className="space-y-4 p-4">
                <ErrorBanner message={uploadError || textError || urlError || reindexError} />
                <div
                  {...getRootProps()}
                  className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center transition-colors ${
                    isDragActive
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-card/40 hover:border-primary/40"
                  }`}
                >
                  <input {...getInputProps()} />
                  {uploadMutation.isPending ? (
                    <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
                  ) : (
                    <Upload className="mb-3 h-8 w-8 text-primary" />
                  )}
                  <p className="text-sm font-semibold">{uiText("wiki.upload.drop_title")}</p>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Carica file locali da qualunque cartella o provider. Se il contenuto e testuale
                    lo imparo; altrimenti conservo l'originale nella wiki.
                  </p>
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={open}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Scegli file dal computer
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Input
                      placeholder={uiText("wiki.note.title_placeholder")}
                      value={noteTitle}
                      onChange={(event) => setNoteTitle(event.target.value)}
                    />
                    <textarea
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder={uiText("wiki.note.placeholder")}
                      className="min-h-[112px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                    <Button
                      className="w-full"
                      disabled={!noteText.trim() || textMutation.isPending}
                      onClick={() => textMutation.mutate()}
                    >
                      {textMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      Aggiungi nota
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder={uiText("wiki.url.placeholder")}
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                    />
                    <div className="rounded-lg border border-border/45 bg-secondary/20 p-3 text-xs leading-relaxed text-muted-foreground">
                      Importo il contenuto testuale della pagina, lo pulisco e lo collego al grafo
                      della tua wiki personale.
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!url.trim() || urlMutation.isPending}
                      onClick={() => urlMutation.mutate()}
                    >
                      {urlMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Globe2 className="mr-2 h-4 w-4" />
                      )}
                      Importa URL
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Network className="h-4 w-4 text-primary" />
                  {uiText("wiki.graph.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {statTiles.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border/40 bg-secondary/20 p-2.5"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {label}
                      </div>
                      <div className="mt-1 font-mono text-lg font-bold">{value}</div>
                    </div>
                  ))}
                </div>
                {selectedNode && (
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                  >
                    <span className="truncate">Nodo: {selectedNode.label}</span>
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                )}
                <WikiGraphView
                  nodes={graph?.nodes ?? []}
                  edges={graph?.edges ?? []}
                  selectedNodeId={selectedNode?.nodeId ?? null}
                  onNodeClick={onGraphNodeClick}
                />
                <p className="text-[11px] text-muted-foreground">
                  Trascina i nodi, usa rotella e mouse per esplorare. Clicca un nodo per filtrare le
                  fonti collegate.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquareText className="h-4 w-4 text-primary" />
                  {uiText("wiki.ask.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ErrorBanner message={queryError} />
                <div className="flex gap-2">
                  <Input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && question.trim()) queryMutation.mutate();
                    }}
                    placeholder={uiText("wiki.ask.placeholder")}
                  />
                  <Button
                    disabled={!question.trim() || queryMutation.isPending}
                    onClick={() => queryMutation.mutate()}
                  >
                    {queryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {answers.length === 0 ? (
                  <div className="rounded-lg border border-border/40 bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
                    <BrainCircuit className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    Fai una domanda: Brain AI risponderà solo con ciò che trova nella tua wiki e
                    mostrerà le fonti.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {answers.map((answer, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-border/45 bg-card/60 p-3"
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {answer.answer}
                        </p>
                        {answer.citations.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            {answer.citations.map((citation) => (
                              <div
                                key={`${citation.sourceId}-${citation.title}`}
                                className="rounded-md bg-background/70 px-2 py-1.5 text-xs text-muted-foreground"
                              >
                                <span className="font-semibold text-foreground">
                                  {citation.title}
                                </span>{" "}
                                · {citation.excerpt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0 space-y-4">
            <Card>
              <CardContent className="p-3">
                <WikiFolderTree
                  selected={folderFilter}
                  onSelect={setFolderFilter}
                  counts={folderCounts}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{uiText("wiki.sources.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ErrorBanner message={deleteError} />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-muted-foreground">
                    Stato
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value as "all" | WikiStatus)
                      }
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-muted-foreground">
                    Tipo
                    <select
                      value={kindFilter}
                      onChange={(event) => setKindFilter(event.target.value as "all" | WikiKind)}
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    >
                      {KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {uiText("wiki.sources.subtitle")} Trascina una fonte su una cartella per spostarla.
                </p>
                {sources.length === 0 ? (
                  <p className="rounded-lg border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
                    Nessuna fonte ancora caricata. Aggiungi una nota, un URL o un file per iniziare
                    a costruire il grafo.
                  </p>
                ) : filteredSources.length === 0 ? (
                  <p className="rounded-lg border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
                    Nessuna fonte corrisponde ai filtri selezionati.
                  </p>
                ) : (
                  filteredSources.map((source) => (
                    <SourceRow
                      key={source.id}
                      source={source}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {communities.length || graph?.communities.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GitBranch className="h-4 w-4 text-primary" />
                    Comunità
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {(communities.length ? communities : graph!.communities)
                    .slice(0, 8)
                    .map((community) => (
                      <div
                        key={community.id}
                        className="flex items-center gap-2 rounded-md border border-border/35 px-2 py-1.5"
                      >
                        <GitBranch className="h-3.5 w-3.5 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                          {community.label}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {community.nodeCount}
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </ProUpgradeGate>
    </PageLayout>
  );
}
