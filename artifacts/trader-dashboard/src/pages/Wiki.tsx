import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Globe2,
  Layers3,
  Loader2,
  Search,
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
  extractedText: string;
  tags: string;
  createdAt: string;
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
          {source.fileUrl ? (
            <a
              href={source.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm font-semibold hover:underline"
            >
              {source.title}
            </a>
          ) : (
            <p className="truncate text-sm font-semibold">{source.title}</p>
          )}
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

// Parse the JSON-encoded tag list defensively; the column is a stringified array.
function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function Wiki() {
  const qc = useQueryClient();
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [url, setUrl] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WikiStatus>("all");
  const [kindFilter, setKindFilter] = useState<"all" | WikiKind>("all");
  const [folderFilter, setFolderFilter] = useState<WikiFolderFilter>("all");

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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wiki", "sources"] });
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

  const filteredSources = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sources.filter((source) => {
      if (statusFilter !== "all" && source.status !== statusFilter) return false;
      if (kindFilter !== "all" && source.kind !== kindFilter) return false;
      if (folderFilter !== "all") {
        if (folderFilter === "root" ? source.folderId != null : source.folderId !== folderFilter) {
          return false;
        }
      }
      if (needle) {
        const haystack = [
          source.title,
          source.extractedText ?? "",
          parseTags(source.tags ?? "[]").join(" "),
          source.fileName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [kindFilter, sources, statusFilter, folderFilter, search]);

  const uploadError = mutationMessage(uploadMutation.error);
  const textError = mutationMessage(textMutation.error);
  const urlError = mutationMessage(urlMutation.error);
  const deleteError = mutationMessage(deleteMutation.error);

  return (
    <PageLayout>
      <ProUpgradeGate feature="wiki">
        <PageHeader title={uiText("wiki.title")} subtitle={uiText("wiki.subtitle")} />

        <div className="mt-2 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{uiText("wiki.sources.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ErrorBanner message={deleteError} />
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={uiText("wiki.search.placeholder")}
                    className="pl-9"
                  />
                </div>
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
                  · {readyCount}/{sources.length} pronte
                </p>
                {sources.length === 0 ? (
                  <p className="rounded-lg border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
                    Nessun appunto ancora salvato. Aggiungi una nota, un URL o un file per iniziare a
                    costruire il tuo archivio di trading.
                  </p>
                ) : filteredSources.length === 0 ? (
                  <p className="rounded-lg border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
                    Nessun appunto corrisponde alla ricerca o ai filtri selezionati.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredSources.map((source) => (
                      <SourceRow
                        key={source.id}
                        source={source}
                        onDelete={(id) => deleteMutation.mutate(id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0 space-y-4">
            <Card>
              <CardContent className="space-y-4 p-4">
                <ErrorBanner message={uploadError || textError || urlError} />
                <div
                  {...getRootProps()}
                  className={`flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center transition-colors ${
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
                    Carica i tuoi file (PDF, immagini, note, audio): li conservo nell'archivio e ne
                    estraggo il testo per la ricerca.
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
                    className="min-h-[96px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <WikiFolderTree
                  selected={folderFilter}
                  onSelect={setFolderFilter}
                  counts={folderCounts}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </ProUpgradeGate>
    </PageLayout>
  );
}
