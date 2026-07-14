import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { QueryErrorState } from "@/components/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchiveRail } from "@/components/archive/ArchiveRail";
import { ArchiveToolbar, type ArchiveDensity, type ArchiveView } from "@/components/archive/ArchiveToolbar";
import { TypeChips } from "@/components/archive/TypeChips";
import { ArchiveGrid } from "@/components/archive/ArchiveGrid";
import { ArchiveList } from "@/components/archive/ArchiveList";
import { ArchiveBoard, type BoardColumn } from "@/components/archive/ArchiveBoard";
import { ArchiveDetailModal } from "@/components/archive/ArchiveDetailModal";
import { ArchiveAddDialog } from "@/components/archive/ArchiveAddDialog";
import {
  collectionsFromFolders,
  filterSources,
  tagCloud,
  type ArchiveFolder,
  type ArchiveType,
  type WikiSource,
} from "@/lib/archive";
import { API_BASE as API, apiFetch, apiUpload } from "@/lib/apiFetch";
import { uiText } from "@/contexts/LanguageContext";

function mutationMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return uiText("archive.noresults.body");
}

export default function Wiki() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ArchiveType | "all">("all");
  const [collectionFilter, setCollectionFilter] = useState<"all" | "root" | number>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [view, setView] = useState<ArchiveView>("grid");
  const [density, setDensity] = useState<ArchiveDensity>("comoda");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const {
    data: sources = [],
    isLoading: sourcesLoading,
    isError: sourcesError,
    refetch: refetchSources,
  } = useQuery({
    queryKey: ["wiki", "sources"],
    queryFn: () => apiFetch<WikiSource[]>(`${API}/wiki/sources`),
    refetchInterval: (query) =>
      (query.state.data as WikiSource[] | undefined)?.some((s) => ["queued", "processing"].includes(s.status))
        ? 2500
        : false,
  });
  const { data: folders = [] } = useQuery({
    queryKey: ["wiki", "folders"],
    queryFn: () => apiFetch<ArchiveFolder[]>(`${API}/wiki/folders`),
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
    mutationFn: (input: { title: string; content: string }) =>
      apiFetch<WikiSource>(`${API}/wiki/sources/text`, {
        method: "POST",
        body: JSON.stringify({ title: input.title || undefined, content: input.content }),
      }),
    onSuccess: invalidate,
  });
  const urlMutation = useMutation({
    mutationFn: (url: string) =>
      apiFetch<WikiSource>(`${API}/wiki/sources/url`, { method: "POST", body: JSON.stringify({ url }) }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/wiki/sources/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
    },
  });
  const moveMutation = useMutation({
    mutationFn: (input: { id: number; folderId: number | null }) =>
      apiFetch(`${API}/wiki/sources/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ folderId: input.folderId }),
      }),
    onSuccess: invalidate,
  });
  const tagsMutation = useMutation({
    mutationFn: (input: { id: number; tags: string[] }) =>
      apiFetch(`${API}/wiki/sources/${input.id}`, { method: "PATCH", body: JSON.stringify({ tags: input.tags }) }),
    onSuccess: invalidate,
  });
  const createCollectionMutation = useMutation({
    mutationFn: (name: string) => apiFetch(`${API}/wiki/folders`, { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: invalidate,
  });

  const collections = useMemo(() => collectionsFromFolders(folders, sources), [folders, sources]);
  const tags = useMemo(() => tagCloud(sources), [sources]);
  const filtered = useMemo(
    () => filterSources(sources, { search, type: typeFilter, collection: collectionFilter, tag: tagFilter }),
    [sources, search, typeFilter, collectionFilter, tagFilter],
  );
  const unfiledCount = useMemo(() => sources.filter((s) => s.folderId == null).length, [sources]);

  const boardColumns = useMemo<BoardColumn[]>(() => {
    const cols: BoardColumn[] = collections.map((c) => ({
      collection: c,
      items: filtered.filter((s) => s.folderId === c.id),
    }));
    const unfiled = filtered.filter((s) => s.folderId == null);
    if (unfiled.length) cols.push({ collection: null, items: unfiled });
    return cols.filter((c) => c.items.length > 0);
  }, [collections, filtered]);

  const selected = useMemo(() => sources.find((s) => s.id === selectedId) ?? null, [sources, selectedId]);
  const selectedCollection = useMemo(
    () => (selected ? collections.find((c) => c.id === selected.folderId) ?? null : null),
    [selected, collections],
  );

  const isFiltered =
    search.trim() !== "" || typeFilter !== "all" || collectionFilter !== "all" || tagFilter !== null;
  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setCollectionFilter("all");
    setTagFilter(null);
  };

  // Page-level drop target: dropping files anywhere uploads them.
  const onDrop = useCallback(
    (files: File[]) => {
      for (const f of files) uploadMutation.mutate(f);
    },
    [uploadMutation],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true, noClick: true });

  const addError = mutationMessage(uploadMutation.error || textMutation.error || urlMutation.error);

  return (
    <PageLayout>
      <ProUpgradeGate feature="wiki" fillViewport>
        <div
          {...getRootProps()}
          style={
            {
              "--arc-gap": density === "compatta" ? "10px" : "16px",
              "--arc-cover": density === "compatta" ? "118px" : "150px",
              "--arc-pad": density === "compatta" ? "9px" : "13px",
              "--arc-rowpad": density === "compatta" ? "7px" : "11px",
            } as React.CSSProperties
          }
          className="relative"
        >
          <input {...getInputProps()} />
          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-semibold text-primary">
              {uiText("archive.add.drop_title")}
            </div>
          )}

          <PageHeader
            title={uiText("archive.title")}
            subtitle={uiText("archive.subtitle")}
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {uiText("archive.add")}
              </Button>
            }
          />

          <div className="mt-2 flex flex-col gap-5 xl:flex-row xl:items-start">
            <ArchiveRail
              collections={collections}
              collectionFilter={collectionFilter}
              onCollectionChange={setCollectionFilter}
              allCount={sources.length}
              unfiledCount={unfiledCount}
              tagCloud={tags}
              tagFilter={tagFilter}
              onTagChange={setTagFilter}
              onMoveSource={(id, folderId) => moveMutation.mutate({ id, folderId })}
              onCreateCollection={(name) => createCollectionMutation.mutate(name)}
            />

            <div className="min-w-0 flex-1 space-y-4">
              <ArchiveToolbar
                search={search}
                onSearch={setSearch}
                view={view}
                onViewChange={setView}
                density={density}
                onDensityChange={setDensity}
                count={filtered.length}
                filtered={isFiltered}
                onClear={clearFilters}
              />
              <TypeChips value={typeFilter} onChange={setTypeFilter} />

              {sourcesError ? (
                <QueryErrorState onRetry={() => void refetchSources()} />
              ) : sourcesLoading ? (
                <ArchiveGridSkeleton />
              ) : sources.length === 0 ? (
                <EmptyState onAdd={() => setAddOpen(true)} />
              ) : filtered.length === 0 ? (
                <NoResults onClear={clearFilters} />
              ) : view === "grid" ? (
                <ArchiveGrid items={filtered} onOpen={setSelectedId} />
              ) : view === "list" ? (
                <ArchiveList items={filtered} onOpen={setSelectedId} />
              ) : (
                <ArchiveBoard columns={boardColumns} onOpen={setSelectedId} />
              )}
            </div>
          </div>
        </div>

        {selected && (
          <ArchiveDetailModal
            source={selected}
            collection={selectedCollection}
            onClose={() => setSelectedId(null)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onSaveTags={(id, t) => tagsMutation.mutate({ id, tags: t })}
          />
        )}

        <ArchiveAddDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onUploadFiles={(files) => files.forEach((f) => uploadMutation.mutate(f))}
          onAddNote={(title, content) => textMutation.mutate({ title, content })}
          onAddUrl={(url) => urlMutation.mutate(url)}
          pending={uploadMutation.isPending}
          error={addError}
        />
      </ProUpgradeGate>
    </PageLayout>
  );
}

function ArchiveGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="archive-grid-skeleton">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mx-auto flex max-w-[580px] flex-col items-center gap-5 py-10 text-center">
      <h2 className="text-2xl font-semibold text-foreground">{uiText("archive.empty.title")}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{uiText("archive.empty.body")}</p>
      <Button onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        {uiText("archive.empty.cta")}
      </Button>
    </div>
  );
}

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3.5 py-12 text-center">
      <h3 className="text-base font-semibold text-foreground">{uiText("archive.noresults.title")}</h3>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{uiText("archive.noresults.body")}</p>
      <Button variant="outline" size="sm" onClick={onClear}>
        {uiText("archive.clear_filters")}
      </Button>
    </div>
  );
}
