import { ProcessReviewWorkspace } from "@/components/process/ProcessReview";
import { orderJournalEntries, journalPage } from "@/lib/journalPagination";
import { useState, useRef, useMemo, useEffect } from "react";
import { useAuth } from "@clerk/react";
import { Link, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, addWeeks, isWithinInterval } from "date-fns";
import { Plus, Edit2, Trash2, Image as ImageIcon, CalendarDays, Tag, Lightbulb, Target, BookOpen, Check, TrendingUp, Minus, ChevronLeft, ChevronRight, BarChart3, Calendar, Bell, BellOff, CalendarPlus, RefreshCw, Sparkles, Wallet } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
import { QueryErrorState } from "@/components/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/StatTile";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JournalEntryModal } from "@/components/JournalEntryModal";
import { traderProcessKey } from "@/lib/traderProcessApi";
import { saveProcessImprovement } from "@/lib/processEvidenceApi";
import { processText } from "@/lib/processCopy";
import { useTraderProcess } from "@/hooks/useTraderProcess";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetJournalEntries,
  useDeleteJournalEntry,
  getGetJournalEntriesQueryKey,
  getGetJournalEdgeQueryKey,
  useGetIdeas,
  useCreateIdea,
  useUpdateIdea,
  useDeleteIdea,
  getGetIdeasQueryKey,
  type JournalEntry,
  type Idea,
  type CreateIdeaRequest,
} from "@workspace/api-client-react";
import { downloadICS } from "@/utils/icsExport";
import { useLanguage, useDateLocale, uiText } from "@/contexts/LanguageContext";
import { getJournalRecapPeriod, isJournalRecapEditable } from "@/lib/journalRecapPeriods";
import { parseTradeContent, tradeDuration, tradeRMultiple } from "@/lib/parseTradeContent";
import { PnlHeatmap } from "@/components/PnlHeatmap";
import { TradeChartSnapshot } from "@/components/TradeChartSnapshot";
import { SessionJournal } from "@/components/journal/SessionJournal";
import { JournalOverview } from "@/components/journal/JournalOverview";
import { CsvImportButton } from "@/components/journal/CsvImportButton";
import {
  emptyJournalRecapFields,
  fetchJournalRecap,
  generateJournalRecap,
  journalRecapQueryKey,
  saveJournalRecap,
  type JournalRecapFields,
} from "@/lib/journalRecapsApi";
import { parseJournalTab, parseJournalRecapKind, type JournalTab } from "@/lib/journalTabs";
import { SectionTabs } from "@/components/SectionTabs";
import { JournalPlan } from "@/components/journal/JournalPlan";
import { BrokerWorkspace } from "@/pages/Broker";
import { updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import { MarketDecisionReview } from "@/components/journal/MarketDecisionReview";

function SyncedTradeDetails({ content }: { content: string }) {
  const { language } = useLanguage();
  const parsed = useMemo(() => parseTradeContent(content), [content]);
  if (!parsed) return null;

  const profit = parsed.profit ?? 0;
  const profitClass = profit > 0 ? "text-success" : profit < 0 ? "text-destructive" : "text-muted-foreground";
  const profitSign = profit > 0 ? "+" : "";
  const duration = tradeDuration(parsed);
  const rMultiple = tradeRMultiple(parsed);
  const directionClass = parsed.direction === "BUY"
    ? "bg-success/10 text-success border-success/30"
    : "bg-destructive/10 text-destructive border-destructive/30";

  return (
    <div className="mb-6 flex-grow space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-mono text-2xl font-bold ${profitClass}`}>
          {parsed.profit != null ? `${profitSign}${profit.toFixed(2)} ${parsed.currency ?? ""}`.trim() : "—"}
        </span>
        <div className="flex items-center gap-1.5">
          {rMultiple != null && (
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold font-mono ${rMultiple >= 0 ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}`}>
              {rMultiple >= 0 ? "+" : ""}{rMultiple}R · {processText(language, "estimated")}
            </span>
          )}
          {duration && (
            <span className="rounded-md border border-border/50 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {duration}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {parsed.direction && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground/60">{uiText("auto.ui.fdd6ae3476")}</span>
            <span className={`rounded px-1.5 py-px font-bold border text-[10px] ${directionClass}`}>{parsed.direction}</span>
          </div>
        )}
        {parsed.volume != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground/60">{uiText("auto.ui.3b18e8e332")}</span>
            <span className="font-mono text-foreground/90">{parsed.volume}</span>
          </div>
        )}
        {parsed.entryPrice != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground/60">Entry</span>
            <span className="font-mono text-foreground/90">{parsed.entryPrice}</span>
          </div>
        )}
        {parsed.exitPrice != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground/60">Exit</span>
            <span className="font-mono text-foreground/90">{parsed.exitPrice}</span>
          </div>
        )}
        {parsed.stopLoss != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground/60">Stop Loss</span>
            <span className="font-mono text-foreground/90">{parsed.stopLoss}</span>
          </div>
        )}
        {parsed.takeProfit != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground/60">Take Profit</span>
            <span className="font-mono text-foreground/90">{parsed.takeProfit}</span>
          </div>
        )}
      </div>

      <TradeChartSnapshot parsed={parsed} />

      {parsed.comment && (
        <p className="border-t border-border/30 pt-2 text-sm text-muted-foreground/80 line-clamp-2 whitespace-pre-wrap">
          {parsed.comment}
        </p>
      )}
    </div>
  );
}

function TradesTab() {
  const { t, language } = useLanguage();
  const process = useTraderProcess();
  const dateLocale = useDateLocale();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const { data: entries, isLoading, isError, refetch } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 30_000 },
  });
  const [requestedPage, setRequestedPage] = useState(1);
  const journalGrid = useRef<HTMLDivElement>(null);
  const sortedEntries = useMemo(() => orderJournalEntries(entries ?? []), [entries]);
  const visible = journalPage(sortedEntries, requestedPage);
  const changePage = (page: number) => {
    setRequestedPage(page);
    journalGrid.current?.scrollIntoView({ block: "start" });
  };
  // handleDelete's own catch already shows its own toast below — opt out of
  // App.tsx's global mutation-error toast to avoid a double toast.
  const deleteMutation = useDeleteJournalEntry({ mutation: { meta: { suppressGlobalError: true } } });

  const search = useSearch();
  const [, navigate] = useLocation();
  // React to repeat visits on the same tab and preserve the tab when consuming new=1.
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("new") === "1") {
      setEditingEntry(null);
      setIsModalOpen(true);
      params.delete("new");
      params.set("t", "trades");
      navigate(`/journal?${params.toString()}`, { replace: true });
    }
  }, [search, navigate]);

  const getResultConfig = (result: string) => {
    switch (result) {
      case "win": return { label: "Win", class: "bg-success/10 text-success border-success/30" };
      case "loss": return { label: "Loss", class: "bg-destructive/10 text-destructive border-destructive/30" };
      case "breakeven": return { label: "Break Even", class: "bg-warning/10 text-warning border-warning/30" };
      default: return { label: "–", class: "bg-white/5 text-muted-foreground border-white/10" };
    }
  };

  const isSyncedTrade = (entry: JournalEntry) =>
    (entry.tags ?? "").toLowerCase().split(",").map((tag) => tag.trim()).some((tag) => tag === "account-import" || tag === "fxblue");

  const handleDelete = async (id: number) => {
    if (!confirm(t("journal.delete_confirm"))) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetJournalEdgeQueryKey() });
      toast({ description: t("journal.deleted") });
    } catch {
      toast({ description: t("journal.error"), variant: "destructive" });
    }
  };

  const accountsOpen = new URLSearchParams(search).get("panel") === "conti";
  if (accountsOpen) return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{t("journal.workspace.accounts")}</h2>
      <Button variant="ghost" onClick={() => navigate(`/journal${updateWorkspaceQuery(search, { panel: null, tab: null })}`)}>
        <ChevronLeft className="mr-2 h-4 w-4" />{t("journal.workspace.back_trades")}
      </Button>
    </div>
    <BrokerWorkspace />
  </section>;

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2 mb-4 sm:mb-6">
        <CsvImportButton />
        <Button variant="outline" onClick={() => navigate(`/journal${updateWorkspaceQuery(search, { t: "trades", panel: "conti", tab: null })}`)}>
          <Wallet className="w-4 h-4 mr-2" />{t("journal.workspace.accounts")}
        </Button>
      </div>

      <div className="mb-4 sm:mb-6">
        <PnlHeatmap entries={entries} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-2xl animate-pulse bg-card/60 border border-border/30" />
          ))}
        </div>
      ) : isError ? (
        <QueryErrorState onRetry={() => void refetch()} />
      ) : entries && entries.length > 0 ? (
        <div ref={journalGrid} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 scroll-mt-24">
          <AnimatePresence initial={false}>
            {visible.entries.map((entry, idx) => {
                const resConfig = getResultConfig(entry.result);
                const syncedTrade = isSyncedTrade(entry);
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(idx * 0.01, 0.12) }}
                    className="bg-card/60 backdrop-blur-sm border border-border/30 rounded-2xl p-3 sm:p-5 flex flex-col group hover:border-primary/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        <CalendarDays className="w-4 h-4" />
                        {format(parseISO(entry.tradeDate), "d MMM yyyy", { locale: dateLocale })}
                      </div>
                      <div className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${resConfig.class}`}>
                        {resConfig.label}
                      </div>
                    </div>

                    {syncedTrade && (
                      <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                        <RefreshCw className="h-3 w-3" />
                        Sync FX Blue
                      </div>
                    )}

                    <h3 className="text-xl font-bold mb-2 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      {entry.title}
                    </h3>
                    {entry.manualTrade && <div className="mb-3 text-sm text-muted-foreground">{process.data?.evidence.filter(e => e.accountTradeId === entry.manualTrade?.accountTradeId).slice(0,1).map(e => <span key={e.id}>{e.netPnl == null ? "—" : e.netPnl.toFixed(2)} {e.currency} · {e.costsStatus === "included" && e.initialRisk ? `${e.netR?.toFixed(2)} R` : "—"} · {processText(language, e.provenance)}</span>)}</div>}

                    {entry.tags && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {entry.tags.split(",").map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground text-xs border border-white/5">
                            <Tag className="w-3 h-3" />
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    {entry.images && entry.images.length > 0 && (
                      <div className="mb-4 aspect-video w-full rounded-lg overflow-hidden border border-white/10 relative">
                        <img src={entry.images[0].url} alt="Thumbnail" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        {entry.images.length > 1 && (
                          <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />+{entry.images.length - 1}
                          </div>
                        )}
                      </div>
                    )}

                    {syncedTrade && entry.content && parseTradeContent(entry.content) ? (
                      <SyncedTradeDetails content={entry.content} />
                    ) : (
                      <p className="text-sm text-muted-foreground/80 line-clamp-3 mb-6 flex-grow">
                        {entry.content || t("journal.no_note")}
                      </p>
                    )}

                    <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-border/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        {syncedTrade ? uiText("auto.ui.8459cac879") : t("journal.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:bg-destructive/20"
                        aria-label={uiText("common.delete")}
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      ) : (
        <Card className="bg-card/60 backdrop-blur-sm border-dashed border-border/30">
          <CardContent className="p-16 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold mb-2">{t("journal.no_trades")}</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {t("journal.no_trades_desc")}
            </p>
            <Button variant="outline" onClick={() => { setEditingEntry(null); setIsModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t("journal.first_trade")}
            </Button>
          </CardContent>
        </Card>
      )}

      {visible.pages > 1 && <nav aria-label={t("journal.pagination")} className="flex items-center justify-between gap-3 mt-5">
        <Button variant="outline" disabled={visible.page === 1} onClick={() => changePage(visible.page - 1)} aria-label={t("journal.previous_page")}><ChevronLeft size={16} /></Button>
        <span role="status" className="text-sm text-muted-foreground">{t("journal.page_count", { page: visible.page, pages: visible.pages, total: entries?.length ?? 0 })}</span>
        <Button variant="outline" disabled={visible.page === visible.pages} onClick={() => changePage(visible.page + 1)} aria-label={t("journal.next_page")}><ChevronRight size={16} /></Button>
      </nav>}

      <JournalEntryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); navigate(new URLSearchParams(search).has("processSessionId") ? "/" : `/journal${updateWorkspaceQuery(search, { marketDecisionId: null, processSessionId: null, methodVersionId: null, new: null })}`, { replace: true }); }}
        entry={editingEntry}
        initialPair={new URLSearchParams(search).get("pair") ?? undefined}
        marketDecisionId={new URLSearchParams(search).get("marketDecisionId") ?? undefined}
        processSessionId={new URLSearchParams(search).get("processSessionId") ?? undefined}
        methodVersionId={new URLSearchParams(search).get("methodVersionId") ?? undefined}
      />
    </>
  );
}

function IdeasTab({ type }: { type: "idea" | "goal" }) {
  const { t } = useLanguage();
  const dateLocale = useDateLocale();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newContent, setNewContent] = useState("");
  const [newImportance, setNewImportance] = useState<"low" | "medium" | "high">("medium");
  const [newDeadline, setNewDeadline] = useState("");
  const [customDays, setCustomDays] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: all, isLoading } = useGetIdeas();
  // handleAdd's own catch already shows its own toast below — opt out of
  // App.tsx's global mutation-error toast to avoid a double toast. update/delete
  // below have no local handling, so they correctly keep the global fallback.
  const createMutation = useCreateIdea({ mutation: { meta: { suppressGlobalError: true } } });
  const updateMutation = useUpdateIdea();
  const deleteMutation = useDeleteIdea();
  const invalidate = () => qc.invalidateQueries({ queryKey: getGetIdeasQueryKey() });

  const todayStr = new Date().toISOString().split("T")[0];

  const daysUntil = (dateStr: string): number => {
    const d = parseISO(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86_400_000);
  };

  const deadlineBadgeClass = (dateStr: string): string => {
    const days = daysUntil(dateStr);
    if (days < 0)  return "text-muted-foreground/50 bg-muted/20";
    if (days <= 2) return "text-red-400 bg-red-500/15 border border-red-500/30";
    if (days <= 7) return "text-amber-400 bg-amber-500/15 border border-amber-500/30";
    return "text-emerald-400 bg-emerald-500/15 border border-emerald-500/30";
  };

  const deadlineBadgeLabel = (dateStr: string): string => {
    const days = daysUntil(dateStr);
    if (days < 0)  return t("journal.deadline.expired", { n: String(Math.abs(days)) });
    if (days === 0) return t("journal.deadline.today");
    if (days === 1) return t("journal.deadline.tomorrow");
    if (days <= 14) return t("journal.deadline.days", { n: String(days) });
    if (days <= 60) return t("journal.deadline.weeks", { n: String(Math.round(days / 7)) });
    return format(parseISO(dateStr), "d MMM", { locale: dateLocale });
  };

  const baseItems = all?.filter(i => i.type === type) ?? [];
  const items = baseItems.filter(item => {
    if (type === "goal" && item.deadlineDate && !item.completed) {
      return daysUntil(item.deadlineDate) >= 0;
    }
    return true;
  });
  const Icon = type === "idea" ? Lightbulb : Target;
  const placeholder = type === "idea" ? t("journal.add_idea") : t("journal.add_goal");
  const listTitle = type === "idea" ? t("journal.ideas.list_title") : t("journal.goals.list_title");
  const listSubtitle = type === "idea" ? t("journal.ideas.list_subtitle") : t("journal.goals.list_subtitle");

  const CADENCE_LABELS: Record<string, string> = {
    daily: t("journal.cadence.daily"),
    weekly: t("journal.cadence.weekly"),
    monthly: t("journal.cadence.monthly"),
  };

  const IMPORTANCE_LABELS: Record<string, string> = {
    low: t("journal.importance.low"),
    medium: t("journal.importance.medium"),
    high: t("journal.importance.high"),
  };

  const IMPORTANCE_COLORS: Record<string, string> = {
    low: "text-blue-400 bg-blue-400/10",
    medium: "text-yellow-400 bg-yellow-400/10",
    high: "text-red-400 bg-red-400/10",
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) { setNewContent(c => c + emoji); return; }
    const start = el.selectionStart ?? newContent.length;
    const end = el.selectionEnd ?? newContent.length;
    const next = newContent.slice(0, start) + emoji + newContent.slice(end);
    setNewContent(next);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + emoji.length; el.focus(); });
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    try {
      const data: CreateIdeaRequest = { type, content: newContent.trim() };
      if (type === "goal") {
        data.importance = newImportance;
        if (newDeadline) data.deadlineDate = newDeadline;
      }
      await createMutation.mutateAsync({ data });
      setNewContent("");
      setNewImportance("medium");
      setNewDeadline("");
      setCustomDays("");
      invalidate();
    } catch {
      toast({ description: t("journal.error"), variant: "destructive" });
    }
  };

  const handleSetImportance = async (id: number, importance: "low" | "medium" | "high") => {
    await updateMutation.mutateAsync({ id, data: { importance } });
    invalidate();
  };

  const handleSetDeadline = async (id: number, deadline: string | null) => {
    await updateMutation.mutateAsync({ id, data: { deadlineDate: deadline ?? undefined } });
    invalidate();
  };

  const handleToggle = async (id: number, content: string, completed: boolean) => {
    await updateMutation.mutateAsync({ id, data: { content, completed: !completed } });
    invalidate();
  };

  const handleSetReminder = async (id: number, time: string | null) => {
    await updateMutation.mutateAsync({ id, data: { reminderTime: time } });
    invalidate();
  };

  const handleSetCadence = async (id: number, cadence: "daily" | "weekly" | "monthly" | null) => {
    await updateMutation.mutateAsync({ id, data: { cadence: cadence ?? undefined } });
    invalidate();
  };

  const handleToggleRecurrence = async (item: Idea) => {
    await updateMutation.mutateAsync({ id: item.id, data: { recurrence: !item.recurrence } });
    invalidate();
  };

  const handleExportGoal = (item: Idea) => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    const reminderMin = item.reminderTime
      ? (() => {
          const [h, m] = item.reminderTime!.split(":").map(Number);
          const rDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, 0);
          return Math.max(0, Math.round((start.getTime() - rDate.getTime()) / 60_000));
        })()
      : 15;
    downloadICS(`obiettivo-${item.id}.ics`, [
      {
        uid: `goal-${item.id}-${today.toISOString().slice(0, 10)}@traderloading`,
        summary: uiText("auto.ui.29c0a275cf", { content: item.content }),
        description: item.cadence ? uiText("auto.ui.f1ddb939f2", { cadence: item.cadence }) : undefined,
        dtstart: start,
        dtend: end,
        alarm: reminderMin,
      },
    ]);
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync({ id });
    invalidate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  placeholder={placeholder}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="flex-1 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(s => !s)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 text-base transition-colors ${showEmojiPicker ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                >
                  😊
                </button>
              </div>
              <Button onClick={handleAdd} disabled={!newContent.trim() || createMutation.isPending}>
                <Plus className="w-4 h-4 mr-2" />
                {t("journal.add_button")}
              </Button>
            </div>
            {showEmojiPicker && (
              <EmojiPickerPanel onSelect={insertEmoji} />
            )}
          </div>
          {type === "goal" && (
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-fit">
                <label className="text-xs text-muted-foreground mb-1 block">{t("journal.importance")}</label>
                <select
                  value={newImportance}
                  onChange={(e) => setNewImportance(e.target.value as "low" | "medium" | "high")}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-secondary/50 border border-border hover:border-primary/50 transition-colors focus:outline-none focus:border-primary/50"
                >
                  <option value="low">{t("journal.importance.low")}</option>
                  <option value="medium">{t("journal.importance.medium")}</option>
                  <option value="high">{t("journal.importance.high")}</option>
                </select>
              </div>
              <div className="flex-1 min-w-fit">
                <label className="text-xs text-muted-foreground mb-1.5 block">{t("journal.deadline")}</label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {[7, 14, 30, 60, 90, 180].map(days => {
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      const val = d.toISOString().split("T")[0];
                      const isSelected = newDeadline === val;
                      return (
                        <button
                          key={days}
                          type="button"
                          onClick={() => { setNewDeadline(isSelected ? "" : val); setCustomDays(""); }}
                          className={`text-[11px] px-2 py-1 rounded-lg border transition-all ${isSelected ? "border-primary bg-primary/15 text-primary font-medium" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary/70"}`}
                        >
                          {uiText("auto.ui.601739fd77", { days })}
                        </button>
                      );
                    })}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        placeholder={uiText("auto.ui.b51a60734d")}
                        value={customDays}
                        onChange={(e) => {
                          setCustomDays(e.target.value);
                          const n = parseInt(e.target.value);
                          if (!isNaN(n) && n > 0) {
                            const d = new Date();
                            d.setDate(d.getDate() + n);
                            setNewDeadline(d.toISOString().split("T")[0]);
                          } else {
                            setNewDeadline("");
                          }
                        }}
                        className="w-14 px-2 py-1 text-[11px] rounded-lg bg-secondary/50 border border-border hover:border-primary/50 focus:border-primary/50 focus:outline-none text-center"
                      />
                      <span className="text-[10px] text-muted-foreground">{uiText("auto.ui.f3226f91f7")}</span>
                    </div>
                  </div>
                  {newDeadline ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-primary/70 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(newDeadline), "d MMM yyyy", { locale: dateLocale })}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setNewDeadline(""); setCustomDays(""); }}
                        className="text-[10px] text-muted-foreground/50 hover:text-destructive transition-colors leading-none"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/30">{t("journal.deadline.optional")}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-white/10">
          <CardContent className="p-10 text-center">
            <Icon className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">{type === "idea" ? t("journal.no_ideas") : t("journal.no_goals")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">{listTitle}</p>
                <p className="text-xs text-muted-foreground">{listSubtitle}</p>
              </div>
            </div>
            <Badge variant="secondary">{items.length}</Badge>
          </CardHeader>
          <AnimatePresence>
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.04 }}
                className="group flex items-start gap-4 border-t border-border/20 px-4 py-3 transition-colors hover:bg-secondary/20"
              >
                <button
                  onClick={() => handleToggle(item.id, item.content, item.completed)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    item.completed ? "bg-primary border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  {item.completed && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                    {item.content}
                  </p>
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <p className="text-xs text-muted-foreground/50">
                      {format(parseISO(item.createdAt), "d MMM yyyy", { locale: dateLocale })}
                    </p>
                    {type === "goal" && item.importance && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPORTANCE_COLORS[item.importance] || "text-yellow-400 bg-yellow-400/10"}`}>
                        {IMPORTANCE_LABELS[item.importance] || t("journal.importance.medium")}
                      </span>
                    )}
                    {type === "goal" && item.deadlineDate && (
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${deadlineBadgeClass(item.deadlineDate)}`}>
                        <Calendar className="w-3 h-3" />
                        {deadlineBadgeLabel(item.deadlineDate)}
                      </span>
                    )}
                    {type === "goal" && !item.deadlineDate && !item.completed && (
                      <label className="inline-flex items-center gap-1 text-xs text-muted-foreground/40 hover:text-primary/60 cursor-pointer transition-colors">
                        <CalendarPlus className="w-3 h-3" />
                        <span>{t("journal.deadline")}</span>
                        <input
                          type="date"
                          min={todayStr}
                          className="absolute opacity-0 w-0 h-0 pointer-events-none"
                          onChange={(e) => { if (e.target.value) handleSetDeadline(item.id, e.target.value); }}
                        />
                      </label>
                    )}
                    {type === "goal" && item.reminderTime && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary/70">
                        <Bell className="w-3 h-3" /> {item.reminderTime}
                      </span>
                    )}
                    {type === "goal" && item.cadence && (
                      <span className="inline-flex items-center gap-1 text-xs text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded">
                        <RefreshCw className="w-2.5 h-2.5" />
                        {CADENCE_LABELS[item.cadence] ?? item.cadence}
                      </span>
                    )}
                    {type === "goal" && item.recurrence && (
                      <span className="text-xs text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded">{t("journal.recurring")}</span>
                    )}
                  </div>

                  {type === "goal" && !item.completed && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {(["daily", "weekly", "monthly"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => handleSetCadence(item.id, item.cadence === c ? null : c)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                            item.cadence === c
                              ? "border-accent/60 bg-accent/15 text-accent"
                              : "border-border/50 text-muted-foreground/60 hover:border-accent/40"
                          }`}
                        >
                          {CADENCE_LABELS[c]}
                        </button>
                      ))}
                      <button
                        onClick={() => handleToggleRecurrence(item)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
                          item.recurrence
                            ? "border-primary/60 bg-primary/15 text-primary"
                            : "border-border/50 text-muted-foreground/60 hover:border-primary/40"
                        }`}
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        {t("journal.recurring")}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {type === "goal" && !item.completed && (
                    item.reminderTime ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                        onClick={() => handleSetReminder(item.id, null)}
                      >
                        <BellOff className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <label className="relative cursor-pointer">
                        <Bell className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors mx-1.5" />
                        <input
                          type="time"
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          onChange={(e) => { if (e.target.value) handleSetReminder(item.id, e.target.value); }}
                        />
                      </label>
                    )
                  )}
                  {type === "goal" && !item.completed && (
                    <label className="relative cursor-pointer h-7 w-7 flex items-center justify-center rounded hover:bg-primary/10 transition-colors">
                      <Calendar className={`w-3.5 h-3.5 transition-colors ${item.deadlineDate ? "text-primary/70" : "text-muted-foreground hover:text-primary"}`} />
                      <input
                        type="date"
                        min={todayStr}
                        defaultValue={item.deadlineDate ?? ""}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => handleSetDeadline(item.id, e.target.value || null)}
                      />
                    </label>
                  )}
                  {type === "goal" && item.deadlineDate && !item.completed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleSetDeadline(item.id, null)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                  )}
                  {type === "goal" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                      onClick={() => handleExportGoal(item)}
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    aria-label={uiText("common.delete")}
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </Card>
      )}
    </div>
  );
}

const RECAP_FIELDS: Array<{ key: keyof JournalRecapFields; labelKey: string; rows: number }> = [
  { key: "overallJudgment", labelKey: "journal.recap.overall_judgment", rows: 3 },
  { key: "wentWell", labelKey: "journal.recap.went_well", rows: 3 },
  { key: "wentWrong", labelKey: "journal.recap.went_wrong", rows: 3 },
  { key: "improvements", labelKey: "journal.recap.improvements", rows: 3 },
  { key: "patterns", labelKey: "journal.recap.patterns", rows: 3 },
  { key: "focusAreas", labelKey: "journal.recap.focus_areas", rows: 3 },
  { key: "nextPeriodExpectations", labelKey: "journal.recap.next_expectations", rows: 3 },
  { key: "nextPeriodGoals", labelKey: "journal.recap.next_goals", rows: 3 },
];

function RecapTab({ mode }: { mode: "weekly" | "four_week" }) {
  const { t, language } = useLanguage();
  const copy = (key: Parameters<typeof processText>[1]) => processText(language, key);
  const dateLocale = useDateLocale();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: entries, isLoading } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 30_000 },
  });
  const search = useSearch();
  const [, navigate] = useLocation();
  const requestedPeriod = new URLSearchParams(search).get("period");
  const currentPeriod = getJournalRecapPeriod(mode);

  const periodInfo = useMemo(() => {
    const requested = requestedPeriod && /^\d{4}-\d{2}-\d{2}$/.test(requestedPeriod) ? parseISO(requestedPeriod) : null;
    const base = requested && Number.isFinite(requested.getTime()) && requested <= new Date() ? requested : new Date();
    const recapPeriod = getJournalRecapPeriod(mode, base);
    const start = parseISO(recapPeriod.periodStart);
    const end = parseISO(recapPeriod.periodEnd);
    const label = mode === "weekly"
      ? `${format(start, "d MMM", { locale: dateLocale })} - ${format(end, "d MMM yyyy", { locale: dateLocale })}`
      : `${format(start, "d MMM", { locale: dateLocale })} - ${format(end, "d MMM yyyy", { locale: dateLocale })}`;

    return { start, end, label, recapPeriod };
  }, [mode, requestedPeriod, dateLocale]);

  const recapPeriod = periodInfo.recapPeriod;
  const recapEditable = isJournalRecapEditable(recapPeriod);
  const recapWindow = recapPeriod;
  const recapWindowLabel = `${format(parseISO(recapWindow.editWindowStart), "d MMM", { locale: dateLocale })} - ${format(parseISO(recapWindow.editWindowEnd), "d MMM yyyy", { locale: dateLocale })}`;
  const [recapDraft, setRecapDraft] = useState<JournalRecapFields>(emptyJournalRecapFields);
  const processQuery = useTraderProcess();
  const [improvementAction, setImprovementAction] = useState("");
  const [improvementCriterion, setImprovementCriterion] = useState("");
  const improvementRequestId = useRef(crypto.randomUUID());

  const recapQuery = useQuery({
    queryKey: journalRecapQueryKey(recapPeriod),
    queryFn: () => fetchJournalRecap(recapPeriod),
  });

  const recapMutation = useMutation({
    mutationFn: async () => {
      const method = processQuery.data?.activeMethod;
      if (method && (!improvementAction.trim() || !improvementCriterion.trim())) throw new Error(copy("improveRequired"));
      const recap = await saveJournalRecap({
      kind: recapPeriod.kind,
      periodStart: recapPeriod.periodStart,
      periodEnd: recapPeriod.periodEnd,
      ...recapDraft,
      });
      if (method) await saveProcessImprovement({ methodVersionId: method.id, recapId: recap.id,
        action: improvementAction.trim(), criterion: improvementCriterion.trim(), requestId: improvementRequestId.current });
      return recap;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: journalRecapQueryKey(recapPeriod) });
      qc.invalidateQueries({ queryKey: traderProcessKey });
      improvementRequestId.current = crypto.randomUUID();
      toast({ description: t("journal.recap.saved") });
    },
    onError: (error: Error) => {
      toast({ description: error.message || t("journal.error"), variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateJournalRecap(recapPeriod),
    onSuccess: (fields) => {
      setRecapDraft(fields);
      toast({ description: t("journal.recap.generated") });
    },
    onError: (error: unknown) => {
      const status = error instanceof Error ? error.message : "";
      const description = status === "422"
        ? t("journal.recap.generate_no_trades")
        : status === "503"
          ? t("journal.recap.generate_unconfigured")
          : t("journal.error");
      toast({ description, variant: "destructive" });
    },
  });

  useEffect(() => {
    const recap = recapQuery.data;
    setRecapDraft(recap ? {
      overallJudgment: recap.overallJudgment,
      wentWell: recap.wentWell,
      wentWrong: recap.wentWrong,
      improvements: recap.improvements,
      patterns: recap.patterns,
      focusAreas: recap.focusAreas,
      nextPeriodExpectations: recap.nextPeriodExpectations,
      nextPeriodGoals: recap.nextPeriodGoals,
    } : { ...emptyJournalRecapFields });
  }, [recapQuery.data]);

  const savedImprovementAction = processQuery.data?.improvement?.action ?? "";
  const savedImprovementCriterion = processQuery.data?.improvement?.criterion ?? "";
  const savedImprovementRecapId = processQuery.data?.improvement?.recapId;
  useEffect(() => {
    const linked = savedImprovementRecapId === recapQuery.data?.id;
    setImprovementAction(linked ? savedImprovementAction : "");
    setImprovementCriterion(linked ? savedImprovementCriterion : "");
    improvementRequestId.current = crypto.randomUUID();
  }, [recapQuery.data?.id, savedImprovementRecapId, savedImprovementAction, savedImprovementCriterion]);

  const patchRecapDraft = (key: keyof JournalRecapFields, value: string) => {
    setRecapDraft((draft) => ({ ...draft, [key]: value }));
  };

  const stats = useMemo(() => {
    if (!entries) return null;

    const filtered = entries.filter((e) => {
      const d = parseISO(e.tradeDate);
      return isWithinInterval(d, { start: periodInfo.start, end: periodInfo.end });
    });

    const wins = filtered.filter((e) => e.result === "win").length;
    const losses = filtered.filter((e) => e.result === "loss").length;
    const breakevens = filtered.filter((e) => e.result === "breakeven").length;
    const total = filtered.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    const tagMap = new Map<string, number>();
    filtered.forEach((e) => {
      if (e.tags) {
        e.tags.split(",").forEach((tg) => {
          const tag = tg.trim();
          if (tag) tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
        });
      }
    });
    const topTags = Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const dailyMap = new Map<string, { wins: number; losses: number; breakevens: number }>();
    filtered.forEach((e) => {
      const dayKey = format(parseISO(e.tradeDate), "EEE d", { locale: dateLocale });
      const existing = dailyMap.get(dayKey) ?? { wins: 0, losses: 0, breakevens: 0 };
      if (e.result === "win") existing.wins++;
      else if (e.result === "loss") existing.losses++;
      else existing.breakevens++;
      dailyMap.set(dayKey, existing);
    });

    return { total, wins, losses, breakevens, winRate, topTags, dailyBreakdown: Array.from(dailyMap.entries()), trades: filtered };
  }, [entries, periodInfo, dateLocale]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/journal${updateWorkspaceQuery(search, { t: "revisione", kind: mode, period: format(addWeeks(periodInfo.start, mode === "weekly" ? -1 : -4), "yyyy-MM-dd") })}`)} disabled={recapMutation.isPending || generateMutation.isPending} aria-label={t("journal.workspace.previous_period")} className="h-9 w-9">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-base sm:text-lg font-bold capitalize">{periodInfo.label}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/journal${updateWorkspaceQuery(search, { t: "revisione", kind: mode, period: format(addWeeks(periodInfo.start, mode === "weekly" ? 1 : 4), "yyyy-MM-dd") })}`)}
          disabled={recapPeriod.periodStart >= currentPeriod.periodStart || recapMutation.isPending || generateMutation.isPending}
          aria-label={t("journal.workspace.next_period")}
          className="h-9 w-9"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <>
        {!stats || stats.total === 0 ? (
          <Card className="border-dashed border-white/10">
            <CardContent className="p-10 text-center">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground">{t("journal.no_trades_period")}</p>
            </CardContent>
          </Card>
        ) : (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label={t("journal.total_trades")} value={String(stats.total)} size="lg" />
            <StatTile label={t("journal.wins")} value={String(stats.wins)} tone="success" size="lg" />
            <StatTile label={t("journal.losses")} value={String(stats.losses)} tone="destructive" size="lg" />
            <StatTile label={t("journal.breakevens")} value={String(stats.breakevens)} size="lg" />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{t("journal.win_rate")}</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <span className="text-4xl sm:text-5xl font-mono font-bold text-foreground">
                  {stats.winRate}%
                </span>
                <span className="text-sm text-muted-foreground mb-1.5">
                  ({stats.wins}W / {stats.losses}L / {stats.breakevens}BE)
                </span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-secondary/40 overflow-hidden flex">
                {stats.wins > 0 && (
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${(stats.wins / stats.total) * 100}%` }}
                  />
                )}
                {stats.breakevens > 0 && (
                  <div
                    className="h-full bg-yellow-500 transition-all duration-500"
                    style={{ width: `${(stats.breakevens / stats.total) * 100}%` }}
                  />
                )}
                {stats.losses > 0 && (
                  <div
                    className="h-full bg-red-500 transition-all duration-500"
                    style={{ width: `${(stats.losses / stats.total) * 100}%` }}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {stats.dailyBreakdown.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("journal.daily_breakdown")}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                {stats.dailyBreakdown.map(([day, data]) => {
                  const dayTotal = data.wins + data.losses + data.breakevens;
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 capitalize">{day}</span>
                      <div className="flex-1 h-6 rounded-md bg-secondary/30 overflow-hidden flex">
                        {data.wins > 0 && (
                          <div
                            className="h-full bg-green-500/80 flex items-center justify-center"
                            style={{ width: `${(data.wins / dayTotal) * 100}%` }}
                          >
                            {data.wins > 0 && <span className="text-[10px] font-bold text-white">{data.wins}W</span>}
                          </div>
                        )}
                        {data.breakevens > 0 && (
                          <div
                            className="h-full bg-yellow-500/80 flex items-center justify-center"
                            style={{ width: `${(data.breakevens / dayTotal) * 100}%` }}
                          >
                            <span className="text-[10px] font-bold text-white">{data.breakevens}BE</span>
                          </div>
                        )}
                        {data.losses > 0 && (
                          <div
                            className="h-full bg-red-500/80 flex items-center justify-center"
                            style={{ width: `${(data.losses / dayTotal) * 100}%` }}
                          >
                            <span className="text-[10px] font-bold text-white">{data.losses}L</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground w-6 text-right">{dayTotal}</span>
                    </div>
                  );
                })}
                </div>
              </CardContent>
            </Card>
          )}

          {stats.topTags.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("journal.top_tags")}</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {stats.topTags.map(([tag, count]) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                      <span className="bg-primary/20 px-1.5 py-0.5 rounded text-[10px] font-bold">{count}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          </>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">{t("journal.recap.title")}</p>
                <p className="text-xs text-muted-foreground">{periodInfo.label}</p>
              </div>
            </div>
            <Badge variant={recapEditable ? "secondary" : "outline"}>
              {recapEditable ? t("journal.recap.open") : t("journal.recap.window", { dates: recapWindowLabel })}
            </Badge>
          </CardHeader>
          <CardContent>
          {!recapEditable && !recapQuery.data && (
            <p className="mb-4 text-sm text-muted-foreground">{t("journal.recap.locked")}</p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {RECAP_FIELDS.map((field) => (
              <label key={field.key} className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t(field.labelKey)}
                </span>
                <Textarea
                  value={recapDraft[field.key]}
                  onChange={(event) => patchRecapDraft(field.key, event.target.value)}
                  disabled={!recapEditable || recapMutation.isPending || recapQuery.isLoading}
                  rows={field.rows}
                  className="resize-y bg-background/70"
                />
              </label>
            ))}
          </div>

          {processQuery.data?.activeMethod && <fieldset className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <legend className="px-1 text-sm font-semibold">{copy("improvement")}</legend>
            <p className="text-xs text-muted-foreground">{copy("improveRequired")}</p>
            <label className="block space-y-1 text-sm">{copy("improvement")}<Textarea value={improvementAction} onChange={event => setImprovementAction(event.target.value)} rows={2} maxLength={4000} disabled={!recapEditable || recapMutation.isPending} /></label>
            <label className="block space-y-1 text-sm">{copy("criterion")}<Textarea value={improvementCriterion} onChange={event => setImprovementCriterion(event.target.value)} rows={2} maxLength={4000} disabled={!recapEditable || recapMutation.isPending} /></label>
          </fieldset>}

          {recapEditable && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || recapMutation.isPending}
              >
                {generateMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {t("journal.recap.generate")}
              </Button>
              <Button onClick={() => recapMutation.mutate()} disabled={recapMutation.isPending || generateMutation.isPending}>
                {recapMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                {t("journal.recap.save")}
              </Button>
            </div>
          )}
          </CardContent>
        </Card>
      </>
    </div>
  );
}

function ReviewTab() {
  const { userId } = useAuth();
  const { t, language } = useLanguage();
  const search = useSearch();
  const [, navigate] = useLocation();
  const kind = new URLSearchParams(search).get("kind") === "market" ? "market" : parseJournalRecapKind(search);
  const period = new URLSearchParams(search).get("period") ?? "current";
  const process = useTraderProcess();
  const legacy = new URLSearchParams(search).get("history") === "1" || new URLSearchParams(search).has("period");
  if (process.data?.activeMethod && kind !== "market" && !legacy) return <div className="space-y-5">
    <ProcessReviewWorkspace />
    <details className="process-plan-summary">
      <summary>{processText(language, "historyAccess")}</summary>
      <div className="flex flex-wrap gap-3 pt-3">
        <Link href="/journal?t=revisione&history=1" className="text-sm text-primary underline underline-offset-4">{t("journal.tab.weekly")} / {t("journal.tab.four_week")}</Link>
        <Link href="/journal?t=revisione&kind=market" className="text-sm text-primary underline underline-offset-4">{t("intelligence.review")}</Link>
      </div>
    </details>
  </div>;
  return <div className="space-y-5">
    <SectionTabs value={kind} ariaLabel={t("journal.workspace.review")} items={[
      { value: "weekly", label: t("journal.tab.weekly") },
      { value: "four_week", label: t("journal.tab.four_week") },
      { value: "market", label: t("intelligence.review") },
    ]} onValueChange={next => navigate(`/journal${updateWorkspaceQuery(search, { t: "revisione", kind: next, period: null })}`)} />
    {kind === "market" ? <MarketDecisionReview key={userId ?? "guest"} ownerKey={userId ?? "guest"} /> : <RecapTab key={`${kind}:${period}`} mode={kind} />}
  </div>;
}

export default function Journal() {
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
  const search = useSearch();
  const tab = parseJournalTab(search);
  const setTab = (next: JournalTab, options: Record<string, string> = {}) => navigate(`/journal${updateWorkspaceQuery(search, {
    t: next, panel: null, start: null, focus: null, new: null,
    ...(next !== "piano" ? { vista: null } : {}),
    ...(next !== "revisione" ? { kind: null, period: null } : {}),
    ...options,
  })}`);

  useEffect(() => {
    const legacy = new URLSearchParams(search).get("t");
    if (["idee", "obiettivi", "idee-obiettivi"].includes(legacy ?? "")) {
      navigate(`/journal${updateWorkspaceQuery(search, { t: "piano", vista: "idee-obiettivi", focus: legacy === "idee-obiettivi" ? null : legacy })}`, { replace: true });
    } else if (legacy === "recap-settimanale" || legacy === "recap-mensile") {
      navigate(`/journal${updateWorkspaceQuery(search, { t: "revisione", kind: legacy === "recap-mensile" ? "four_week" : "weekly" })}`, { replace: true });
    }
  }, [search, navigate]);

  return (
    <PageLayout quiet>
      <PageHeader title={t("journal.title")} subtitle={t("journal.subtitle")}
        action={tab === "trades" && new URLSearchParams(search).get("panel") !== "conti" ? <Button onClick={() => setTab("trades", { new: "1" })}><Plus className="w-4 h-4 mr-2" />{t("journal.new_trade")}</Button> : undefined}
      />
      <SectionTabs value={tab} ariaLabel={t("journal.title")} items={[
        { value: "sessioni", label: processText(language, "journalSessions") },
        { value: "panoramica", label: t("journal.tab.overview") },
        { value: "trades", label: t("journal.tab.trades") },
        { value: "revisione", label: t("journal.workspace.review") },
      ]} onValueChange={next => setTab(next as JournalTab)} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          {tab === "sessioni" && <SessionJournal />}
          {tab === "panoramica" && <JournalOverview onNavigate={setTab} />}
          {tab === "trades" && <TradesTab />}
          {tab === "piano" && <JournalPlan ideasGoals={<div className="space-y-6">
            <section id="journal-idee"><IdeasTab type="idea" /></section>
            <section id="journal-obiettivi"><IdeasTab type="goal" /></section>
          </div>} />}
          {tab === "revisione" && <ReviewTab />}
        </motion.div>
      </AnimatePresence>
    </PageLayout>
  );
}
