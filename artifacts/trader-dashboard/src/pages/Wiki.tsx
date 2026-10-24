import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useGetProfile } from "@workspace/api-client-react";
import { Plus } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { SectionTabs } from "@/components/SectionTabs";
import { useBillingStatus } from "@/lib/billingApi";
import { useArchiveCatalog } from "@/lib/useArchiveCatalog";
import { buildArchiveResources, filterArchiveResources, canUsePersonalArchive, catalogMilestones, CATALOG_COLLECTION, REWARD_COLLECTION } from "@/lib/archiveResources";
import { ContentViewer, ContentForm } from "./Library";
import { RewardCard } from "@/components/LevelRewardModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  tagCloud,
  type ArchiveFolder,
  type ArchiveType,
  type WikiSource,
} from "@/lib/archive";
import { API_BASE as API, apiFetch, apiUpload, apiJSON } from "@/lib/apiFetch";
import { updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import { uiText } from "@/contexts/LanguageContext";

function mutationMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return uiText("archive.noresults.body");
}

export default function Wiki() {
  const qc = useQueryClient();
  const routeSearch = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(routeSearch);
  const tab = params.get("t") === "unlocked" ? "unlocked" : "all";
  const billing = useBillingStatus();
  const pro = canUsePersonalArchive(billing.data?.pro);
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const level = profile?.level ?? 0;
  const catalog = useArchiveCatalog();
  const contents = useMemo(() => catalog.data ?? [], [catalog.data]);
  const admin = useQuery<{ isAdmin: boolean }>({ queryKey: ["library", "admin"], queryFn: () => apiJSON("library/admin/status") });
  const [editContent, setEditContent] = useState<import("@/lib/archiveResources").LibraryContent | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ArchiveType | "all">("all");
  const [collectionFilter, setCollectionFilter] = useState<"all" | "root" | number>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [view, setView] = useState<ArchiveView>("grid");
  const [density, setDensity] = useState<ArchiveDensity>("comoda");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("resource"));
  useEffect(() => { setSelectedId(new URLSearchParams(routeSearch).get("resource")); }, [routeSearch]);
  const [addOpen, setAddOpen] = useState(false);
  const openResource = (resource: string | null) => {
    setSelectedId(resource);
    navigate(`/wiki${updateWorkspaceQuery(routeSearch, { resource })}`);
  };

  const {
    data: sources = [],
    isLoading: sourcesLoading,
    isError: sourcesError,
    refetch: refetchSources,
  } = useQuery({
    queryKey: ["wiki", "sources"],
    enabled: pro,
    queryFn: () => apiFetch<WikiSource[]>(`${API}/wiki/sources`),
    refetchInterval: (query) =>
      (query.state.data as WikiSource[] | undefined)?.some((s) => ["queued", "processing"].includes(s.status))
        ? 2500
        : false,
  });
  const { data: folders = [] } = useQuery({
    queryKey: ["wiki", "folders"],
    enabled: pro,
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
      openResource(null);
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

  const resources = useMemo(() => buildArchiveResources({ personal: sources, contents, level, pro }), [sources, contents, level, pro]);
  const visibleResources = useMemo(() => resources.filter(r => tab === "all" || r.origin !== "personal"), [resources, tab]);
  const collections = useMemo(() => [
    ...(pro && tab === "all" ? collectionsFromFolders(folders, sources) : []),
    { id: CATALOG_COLLECTION, name: uiText("reorg.archive.catalog_folder"), count: resources.filter(r => r.origin === "library").length, accent: "hsl(var(--primary))" },
    { id: REWARD_COLLECTION, name: uiText("reorg.archive.reward_folder"), count: resources.filter(r => r.origin === "reward").length, accent: "hsl(38 92% 52%)" },
  ], [folders, sources, resources, pro, tab]);
  const tags = useMemo(() => tagCloud(visibleResources.map(r => r.source)), [visibleResources]);
  const filteredResources = useMemo(() => filterArchiveResources(resources, { search, type: typeFilter, collection: collectionFilter, tag: tagFilter }, tab),
    [resources, search, typeFilter, collectionFilter, tagFilter, tab]);
  const filtered = filteredResources.map(r => r.source);
  const unfiledCount = pro && tab === "all" ? sources.filter(s => s.folderId == null).length : 0;
  const boardColumns: BoardColumn[] = collections.map(collection => ({ collection, items: filtered.filter(s => s.folderId === collection.id) }));
  const unfiled = filtered.filter(s => s.folderId == null);
  if (unfiled.length) boardColumns.push({ collection: null, items: unfiled });
  const selected = resources.find(r => r.ref === selectedId) ?? null;
  const selectedCollection = selected ? collections.find(c => c.id === selected.source.folderId) ?? null : null;
  const nextLevel = catalogMilestones(contents).find(m => m > level);
  const changeTab = (value: string) => {
    clearFilters(); setSelectedId(null);
    navigate(`/wiki?t=${value === "unlocked" ? "unlocked" : "all"}`);
  };
  const deleteCatalog = useMutation({ mutationFn: (id: number) => apiJSON(`library/contents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "contents"] }) });

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
      if (pro) for (const f of files) uploadMutation.mutate(f);
    },
    [uploadMutation, pro],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true, noClick: true, disabled: !pro });

  const addError = mutationMessage(uploadMutation.error || textMutation.error || urlMutation.error);

  return (
    <PageLayout quiet>

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

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 pt-1">
            <SectionTabs value={tab} onValueChange={changeTab} ariaLabel={uiText("reorg.archive.tabs")}
              items={[{ value: "all", label: uiText("reorg.archive.all") }, { value: "unlocked", label: uiText("reorg.archive.unlocked") }]} />
            {pro && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {uiText("archive.add")}
              </Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{uiText("reorg.archive.level", { level })}</span>
            {nextLevel && <span>{uiText("reorg.archive.next", { level: nextLevel })}</span>}
          </div>
          {!billing.isPending && !pro && <p className="mt-3 text-sm text-muted-foreground">{uiText("reorg.archive.free")}</p>}
          <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-start">
            <ArchiveRail
              collections={collections}
              collectionFilter={collectionFilter}
              onCollectionChange={setCollectionFilter}
              allCount={visibleResources.length}
              readOnly={!pro || tab === "unlocked"}
              unfiledCount={unfiledCount}
              tagCloud={tags}
              tagFilter={tagFilter}
              onTagChange={setTagFilter}
              onMoveSource={(id, folderId) => { if (pro && sources.some(s => s.id === id) && (folderId === null || folderId > 0)) moveMutation.mutate({ id, folderId }); }}
              onCreateCollection={(name) => { if (pro) createCollectionMutation.mutate(name); }}
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

              {catalog.isError && <QueryErrorState onRetry={() => void catalog.refetch()} />}
              {pro && sourcesError && <QueryErrorState onRetry={() => void refetchSources()} />}
              {profileLoading || catalog.isLoading || (pro && sourcesLoading) ? (
                <ArchiveGridSkeleton />
              ) : visibleResources.length === 0 ? (
                <EmptyState onAdd={pro ? () => setAddOpen(true) : undefined} />
              ) : filtered.length === 0 ? (
                <NoResults onClear={clearFilters} />
              ) : view === "grid" ? (
                <ArchiveGrid items={filtered} onOpen={openResource} />
              ) : view === "list" ? (
                <ArchiveList items={filtered} onOpen={openResource} />
              ) : (
                <ArchiveBoard columns={boardColumns} onOpen={openResource} />
              )}
            </div>
          </div>
        </div>

        {selected?.origin === "personal" && pro && (
          <ArchiveDetailModal
            key={selected.ref}
            source={selected.personal}
            collection={selectedCollection}
            onClose={() => openResource(null)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onSaveTags={(id, t) => tagsMutation.mutate({ id, tags: t })}
          />
        )}

        {selected?.origin === "library" && <ContentViewer content={selected.content} onClose={() => openResource(null)} />}
        {selected?.origin === "reward" && <Dialog open onOpenChange={open => { if (!open) openResource(null); }}>
          <DialogContent><DialogHeader><DialogTitle>{selected.reward.title}</DialogTitle></DialogHeader>
            <RewardCard reward={selected.reward} />
          </DialogContent>
        </Dialog>}
        {admin.data?.isAdmin && <details className="mt-5 rounded-lg border border-border/50 p-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">{uiText("reorg.archive.manage")}</summary>
          <Button size="sm" className="mt-3" onClick={() => setEditContent("new")}>{uiText("auto.ui.fd19042867")}</Button>
          {contents.map(c => <div key={c.id} className="mt-2 flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{c.title}</span>
            <Button variant="ghost" size="sm" onClick={() => setEditContent(c)}>{uiText("common.edit")}</Button>
            <Button variant="ghost" size="sm" disabled={deleteCatalog.isPending} onClick={() => { if (window.confirm(uiText("archive.delete_confirm", { title: c.title }))) deleteCatalog.mutate(c.id); }}>{uiText("common.delete")}</Button>
          </div>)}
          {deleteCatalog.isError && <p role="alert" className="text-sm text-destructive">{mutationMessage(deleteCatalog.error)}</p>}
        </details>}
        {editContent !== null && admin.data?.isAdmin && <ContentForm initial={editContent === "new" ? null : editContent} onClose={() => setEditContent(null)} />}
        {pro && <ArchiveAddDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onUploadFiles={(files) => files.forEach((f) => uploadMutation.mutate(f))}
          onAddNote={(title, content) => textMutation.mutateAsync({ title, content })}
          onAddUrl={(url) => urlMutation.mutateAsync(url)}
          pending={uploadMutation.isPending || textMutation.isPending || urlMutation.isPending}
          error={addError}
        />}

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

function EmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="mx-auto flex max-w-[580px] flex-col items-center gap-5 py-10 text-center">
      <h2 className="text-2xl font-semibold text-foreground">{uiText("reorg.archive.empty")}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{uiText("reorg.archive.empty_body")}</p>
      {onAdd && <Button variant="outline" onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        {uiText("archive.empty.cta")}
      </Button>}
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
