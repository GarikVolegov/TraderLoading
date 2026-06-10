import { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, addWeeks, addMonths, isWithinInterval } from "date-fns";
import { Plus, Edit2, Trash2, Image as ImageIcon, CalendarDays, Tag, Lightbulb, Target, BookOpen, Check, TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, BarChart3, Calendar, Bell, BellOff, CalendarPlus, RefreshCw } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JournalEntryModal } from "@/components/JournalEntryModal";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetJournalEntries,
  useDeleteJournalEntry,
  getGetJournalEntriesQueryKey,
  useGetIdeas,
  useCreateIdea,
  useUpdateIdea,
  useDeleteIdea,
  getGetIdeasQueryKey,
  type JournalEntry,
  type Idea,
} from "@workspace/api-client-react";
import { downloadICS } from "@/utils/icsExport";
import { useLanguage, useDateLocale } from "@/contexts/LanguageContext";
import { getJournalRecapPeriod, isJournalRecapEditable } from "@/lib/journalRecapPeriods";
import { parseTradeContent, tradeDuration, tradeRMultiple } from "@/lib/parseTradeContent";
import { PnlHeatmap } from "@/components/PnlHeatmap";
import { TradeChartSnapshot } from "@/components/TradeChartSnapshot";
import {
  emptyJournalRecapFields,
  fetchJournalRecap,
  journalRecapQueryKey,
  saveJournalRecap,
  type JournalRecapFields,
} from "@/lib/journalRecapsApi";

type Tab = "trades" | "idee" | "obiettivi" | "recap-settimanale" | "recap-mensile";

function SyncedTradeDetails({ content }: { content: string }) {
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
              {rMultiple >= 0 ? "+" : ""}{rMultiple}R
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
            <span className="text-muted-foreground/60">Direzione</span>
            <span className={`rounded px-1.5 py-px font-bold border text-[10px] ${directionClass}`}>{parsed.direction}</span>
          </div>
        )}
        {parsed.volume != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground/60">Volume</span>
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
  const { t } = useLanguage();
  const dateLocale = useDateLocale();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const { data: entries, isLoading } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 10_000 },
  });
  const deleteMutation = useDeleteJournalEntry();

  // Deep-link dalla command palette: /journal?new=1 apre subito il form nuovo trade.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setEditingEntry(null);
      setIsModalOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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
      toast({ description: t("journal.deleted") });
    } catch {
      toast({ description: t("journal.error"), variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4 sm:mb-6">
        <Button onClick={() => { setEditingEntry(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          {t("journal.new_trade")}
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
      ) : entries && entries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <AnimatePresence>
            {entries
              .sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime())
              .map((entry, idx) => {
                const resConfig = getResultConfig(entry.result);
                const syncedTrade = isSyncedTrade(entry);
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
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

                    <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        {syncedTrade ? "Commenta" : t("journal.edit")}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-destructive hover:bg-destructive/20" onClick={() => handleDelete(entry.id)}>
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
            <Button onClick={() => { setEditingEntry(null); setIsModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t("journal.first_trade")}
            </Button>
          </CardContent>
        </Card>
      )}

      <JournalEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entry={editingEntry}
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
  const createMutation = useCreateIdea();
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
      const data: any = { type, content: newContent.trim() };
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
        summary: `Obiettivo: ${item.content}`,
        description: item.cadence ? `Cadence: ${item.cadence}` : undefined,
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
                          +{days}gg
                        </button>
                      );
                    })}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        placeholder="N"
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
                      <span className="text-[10px] text-muted-foreground">gg</span>
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
        <div className="space-y-3">
          <AnimatePresence>
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-card/60 backdrop-blur-sm border border-border/30 rounded-xl p-4 flex items-start gap-4 group hover:border-primary/40 transition-colors"
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
                    className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
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
  const { t } = useLanguage();
  const dateLocale = useDateLocale();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: entries, isLoading } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 10_000 },
  });
  const [offset, setOffset] = useState(0);

  const periodInfo = useMemo(() => {
    const base = offset === 0
      ? new Date()
      : (mode === "weekly" ? addWeeks(new Date(), offset) : addWeeks(new Date(), offset * 4));

    const recapPeriod = getJournalRecapPeriod(mode, base);
    const start = parseISO(recapPeriod.periodStart);
    const end = parseISO(recapPeriod.periodEnd);
    const label = mode === "weekly"
      ? `${format(start, "d MMM", { locale: dateLocale })} - ${format(end, "d MMM yyyy", { locale: dateLocale })}`
      : `${format(start, "d MMM", { locale: dateLocale })} - ${format(end, "d MMM yyyy", { locale: dateLocale })}`;

    return { start, end, label, recapPeriod };
  }, [mode, offset, dateLocale]);

  const recapPeriod = periodInfo.recapPeriod;
  const recapEditable = isJournalRecapEditable(recapPeriod);
  const recapWindow = recapPeriod;
  const recapWindowLabel = `${format(parseISO(recapWindow.editWindowStart), "d MMM", { locale: dateLocale })} - ${format(parseISO(recapWindow.editWindowEnd), "d MMM yyyy", { locale: dateLocale })}`;
  const [recapDraft, setRecapDraft] = useState<JournalRecapFields>(emptyJournalRecapFields);

  const recapQuery = useQuery({
    queryKey: journalRecapQueryKey(recapPeriod),
    queryFn: () => fetchJournalRecap(recapPeriod),
  });

  const recapMutation = useMutation({
    mutationFn: () => saveJournalRecap({
      kind: recapPeriod.kind,
      periodStart: recapPeriod.periodStart,
      periodEnd: recapPeriod.periodEnd,
      ...recapDraft,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: journalRecapQueryKey(recapPeriod) });
      toast({ description: t("journal.recap.saved") });
    },
    onError: () => {
      toast({ description: t("journal.error"), variant: "destructive" });
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
        <Button variant="ghost" size="icon" onClick={() => setOffset((o) => o - 1)} className="h-9 w-9">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-base sm:text-lg font-bold capitalize">{periodInfo.label}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOffset((o) => o + 1)}
          disabled={offset >= 0}
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
            <StatCard label={t("journal.total_trades")} value={stats.total} icon={<BarChart3 className="w-4 h-4" />} color="text-foreground" />
            <StatCard label={t("journal.wins")} value={stats.wins} icon={<TrendingUp className="w-4 h-4" />} color="text-green-400" />
            <StatCard label={t("journal.losses")} value={stats.losses} icon={<TrendingDown className="w-4 h-4" />} color="text-red-400" />
            <StatCard label={t("journal.breakevens")} value={stats.breakevens} icon={<Minus className="w-4 h-4" />} color="text-yellow-400" />
          </div>

          <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-4 sm:p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("journal.win_rate")}</p>
            <div className="flex items-end gap-3">
              <span className={`text-4xl sm:text-5xl font-mono font-bold ${stats.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
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
          </div>

          {stats.dailyBreakdown.length > 0 && (
            <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-4 sm:p-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">{t("journal.daily_breakdown")}</p>
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
            </div>
          )}

          {stats.topTags.length > 0 && (
            <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-4 sm:p-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("journal.top_tags")}</p>
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
            </div>
          )}
          </>
        )}

        <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t("journal.recap.title")}</p>
              <h4 className="text-base font-bold">{periodInfo.label}</h4>
            </div>
            <div className={`text-xs rounded-lg px-3 py-2 border ${recapEditable ? "border-primary/25 bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-muted-foreground"}`}>
              {recapEditable ? t("journal.recap.open") : t("journal.recap.window", { dates: recapWindowLabel })}
            </div>
          </div>

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

          {recapEditable && (
            <div className="mt-5 flex justify-end">
              <Button onClick={() => recapMutation.mutate()} disabled={recapMutation.isPending}>
                {recapMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                {t("journal.recap.save")}
              </Button>
            </div>
          )}
        </div>
      </>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-4 text-center">
      <div className={`flex items-center justify-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl sm:text-3xl font-mono font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function Journal() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("trades");

  const tabs: { id: Tab; labelKey: string; icon: typeof BookOpen }[] = [
    { id: "trades", labelKey: "journal.tab.trades", icon: BookOpen },
    { id: "recap-settimanale", labelKey: "journal.tab.weekly", icon: BarChart3 },
    { id: "recap-mensile", labelKey: "journal.tab.four_week", icon: Calendar },
    { id: "idee", labelKey: "journal.tab.ideas", icon: Lightbulb },
    { id: "obiettivi", labelKey: "journal.tab.goals", icon: Target },
  ];

  return (
    <PageLayout>
      <PageHeader title={t("journal.title")} subtitle={t("journal.subtitle")} />

      <div className="flex items-center gap-1 bg-card/50 backdrop-blur-md p-1.5 rounded-xl border border-border w-full overflow-x-auto">
        {tabs.map(tabItem => {
          const Icon = tabItem.icon;
          return (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 flex-1 ${
                tab === tabItem.id
                  ? "bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(tabItem.labelKey)}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "trades" && <TradesTab />}
          {tab === "recap-settimanale" && <RecapTab mode="weekly" />}
          {tab === "recap-mensile" && <RecapTab mode="four_week" />}
          {tab === "idee" && <IdeasTab type="idea" />}
          {tab === "obiettivi" && <IdeasTab type="goal" />}
        </motion.div>
      </AnimatePresence>
    </PageLayout>
  );
}
