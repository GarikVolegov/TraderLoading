import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  Clock,
  Flag,
  Lightbulb,
  Newspaper,
  Plus,
  Target,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useGetEconomicCalendar,
  useGetIdeas,
  useGetJournalEntries,
  useGetMacroNews,
  useGetMissions,
  type CalendarEvent,
  type Idea,
  type JournalEntry,
  type Mission,
  type NewsArticle,
} from "@workspace/api-client-react";

const MANUAL_ITEMS_KEY = "tl_calendar_manual_items_v1";

type ManualItemType = "appointment" | "note" | "review" | "trade-plan";
type Priority = "low" | "medium" | "high";
type AgendaSource = "market" | "goal" | "idea" | "mission" | "news" | "journal" | "manual";

interface ManualPlannerItem {
  id: string;
  type: ManualItemType;
  title: string;
  notes: string;
  startAt: string;
  endAt: string | null;
  priority: Priority;
  createdAt: string;
}

interface AgendaItem {
  id: string;
  source: AgendaSource;
  title: string;
  notes?: string;
  startAt: string;
  endAt?: string | null;
  priority: Priority;
  meta?: string;
  manual?: ManualPlannerItem;
}

const SOURCE_CONFIG: Record<AgendaSource, { label: string; className: string; Icon: typeof CalendarClock }> = {
  market: { label: "Market", className: "border-red-500/30 bg-red-500/10 text-red-300", Icon: CalendarClock },
  goal: { label: "Goal", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", Icon: Target },
  idea: { label: "Idea", className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300", Icon: Lightbulb },
  mission: { label: "Missione", className: "border-primary/30 bg-primary/10 text-primary", Icon: Flag },
  news: { label: "News", className: "border-sky-500/30 bg-sky-500/10 text-sky-300", Icon: Newspaper },
  journal: { label: "Journal", className: "border-violet-500/30 bg-violet-500/10 text-violet-300", Icon: BookOpen },
  manual: { label: "Manuale", className: "border-accent/30 bg-accent/10 text-accent", Icon: CalendarClock },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  low: { label: "Bassa", className: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
  medium: { label: "Media", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  high: { label: "Alta", className: "border-red-500/30 bg-red-500/10 text-red-300" },
};

const MANUAL_TYPE_LABELS: Record<ManualItemType, string> = {
  appointment: "Appuntamento",
  note: "Nota",
  review: "Review",
  "trade-plan": "Trade plan",
};

function isPriority(value: unknown): value is Priority {
  return value === "low" || value === "medium" || value === "high";
}

function isManualType(value: unknown): value is ManualItemType {
  return value === "appointment" || value === "note" || value === "review" || value === "trade-plan";
}

function isManualPlannerItem(value: unknown): value is ManualPlannerItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ManualPlannerItem>;
  return (
    typeof item.id === "string" &&
    isManualType(item.type) &&
    typeof item.title === "string" &&
    typeof item.notes === "string" &&
    typeof item.startAt === "string" &&
    (typeof item.endAt === "string" || item.endAt === null) &&
    isPriority(item.priority) &&
    typeof item.createdAt === "string"
  );
}

function readManualItems(): ManualPlannerItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(MANUAL_ITEMS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isManualPlannerItem) : [];
  } catch {
    return [];
  }
}

function saveManualItems(items: ManualPlannerItem[]) {
  window.localStorage.setItem(MANUAL_ITEMS_KEY, JSON.stringify(items));
}

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function withTime(dateValue: string, hours: number, minutes = 0): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function todayAt(hours: number, minutes = 0): string {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function toDateTimeInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(date: Date): string {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  if (dayKey(date) === dayKey(now)) return "Oggi";
  if (dayKey(date) === dayKey(tomorrow)) return "Domani";

  return date.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function formatTime(value: string): string {
  const date = toDate(value);
  if (!date) return "--:--";
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function mapImpactToPriority(impact: CalendarEvent["impact"]): Priority {
  if (impact === "High") return "high";
  if (impact === "Low" || impact === "Holiday") return "low";
  return "medium";
}

function mapIdeaPriority(idea: Idea): Priority {
  return isPriority(idea.importance) ? idea.importance : "medium";
}

function getIdeaStartAt(idea: Idea): string {
  if (idea.deadlineDate) return withTime(idea.deadlineDate, 9);
  if (idea.reminderTime) {
    const [hours, minutes] = idea.reminderTime.split(":").map(Number);
    return todayAt(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0);
  }
  return idea.createdAt;
}

function resultLabel(entry: JournalEntry): string {
  if (entry.result === "win") return "Win";
  if (entry.result === "loss") return "Loss";
  if (entry.result === "breakeven") return "Break even";
  return "Trade";
}

function articlePriority(article: NewsArticle): Priority {
  if (article.sentiment === "bullish" || article.sentiment === "bearish") return "medium";
  return "low";
}

function buildAgendaItems({
  events,
  ideas,
  missions,
  news,
  journal,
  manualItems,
}: {
  events?: CalendarEvent[];
  ideas?: Idea[];
  missions?: Mission[];
  news?: NewsArticle[];
  journal?: JournalEntry[];
  manualItems: ManualPlannerItem[];
}): AgendaItem[] {
  const marketItems =
    events?.map((event, index) => ({
      id: `market-${event.date}-${event.country}-${index}`,
      source: "market" as const,
      title: event.title,
      notes: [event.forecast ? `Forecast: ${event.forecast}` : null, event.previous ? `Previous: ${event.previous}` : null]
        .filter(Boolean)
        .join(" | "),
      startAt: event.date,
      priority: mapImpactToPriority(event.impact),
      meta: `${event.country} - ${event.impact}`,
    })) ?? [];

  const ideaItems =
    ideas?.map((idea) => ({
      id: `idea-${idea.id}`,
      source: idea.type === "goal" ? ("goal" as const) : ("idea" as const),
      title: idea.content,
      notes: idea.completed ? "Completato" : idea.cadence ? `Cadenza: ${idea.cadence}` : undefined,
      startAt: getIdeaStartAt(idea),
      priority: mapIdeaPriority(idea),
      meta: idea.deadlineDate ? "Deadline" : idea.reminderTime ? `Reminder ${idea.reminderTime}` : "Creato",
    })) ?? [];

  const missionItems =
    missions?.map((mission) => ({
      id: `mission-${mission.id}`,
      source: "mission" as const,
      title: mission.title,
      notes: mission.description,
      startAt: mission.completedAt ?? todayAt(8, 30),
      priority: mission.completed ? ("low" as const) : ("medium" as const),
      meta: mission.completed ? "Completata" : `${mission.xpReward} XP`,
    })) ?? [];

  const newsItems =
    news?.map((article, index) => ({
      id: `news-${article.publishedAt ?? index}-${article.title}`,
      source: "news" as const,
      title: article.title,
      notes: article.summary,
      startAt: article.publishedAt ?? new Date().toISOString(),
      priority: articlePriority(article),
      meta: article.source,
    })) ?? [];

  const journalItems =
    journal?.map((entry) => ({
      id: `journal-${entry.id}`,
      source: "journal" as const,
      title: entry.title,
      notes: entry.content,
      startAt: withTime(entry.tradeDate, 18),
      priority: entry.result === "loss" ? ("high" as const) : entry.result === "win" ? ("medium" as const) : ("low" as const),
      meta: resultLabel(entry),
    })) ?? [];

  const manualAgendaItems = manualItems.map((item) => ({
    id: `manual-${item.id}`,
    source: "manual" as const,
    title: item.title,
    notes: item.notes,
    startAt: item.startAt,
    endAt: item.endAt,
    priority: item.priority,
    meta: MANUAL_TYPE_LABELS[item.type],
    manual: item,
  }));

  const merged = [...marketItems, ...ideaItems, ...missionItems, ...newsItems, ...journalItems, ...manualAgendaItems]
    .filter((item) => toDate(item.startAt))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  // Dedup: import multipli (es. stesso trade FX Blue) producono voci identiche
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = `${item.source}|${item.title}|${item.startAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function CalendarPlannerWorkspace() {
  const [manualItems, setManualItems] = useState<ManualPlannerItem[]>([]);
  const [type, setType] = useState<ManualItemType>("trade-plan");
  const [priority, setPriority] = useState<Priority>("medium");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startAt, setStartAt] = useState(() => toDateTimeInputValue(new Date()));
  const [endAt, setEndAt] = useState("");
  const [showPast, setShowPast] = useState(false);

  const { data: events, isLoading: eventsLoading } = useGetEconomicCalendar();
  const { data: ideas, isLoading: ideasLoading } = useGetIdeas();
  const { data: missions, isLoading: missionsLoading } = useGetMissions();
  const { data: journal, isLoading: journalLoading } = useGetJournalEntries();
  const { data: macroNews, isLoading: newsLoading } = useGetMacroNews();

  useEffect(() => {
    setManualItems(readManualItems());
  }, []);

  const agendaItems = useMemo(
    () =>
      buildAgendaItems({
        events,
        ideas,
        missions,
        news: macroNews?.articles,
        journal,
        manualItems,
      }),
    [events, ideas, missions, macroNews?.articles, journal, manualItems],
  );

  const { pastGroups, upcomingGroups } = useMemo(() => {
    const groups = new Map<string, { date: Date; items: AgendaItem[] }>();

    agendaItems.forEach((item) => {
      const date = toDate(item.startAt);
      if (!date) return;
      const key = dayKey(date);
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, { date, items: [item] });
      }
    });

    const sorted = Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return {
      pastGroups: sorted.filter((g) => g.date < startOfToday),
      upcomingGroups: sorted.filter((g) => g.date >= startOfToday),
    };
  }, [agendaItems]);

  const groupedAgenda = showPast ? [...pastGroups, ...upcomingGroups] : upcomingGroups;

  const summary = useMemo(() => {
    const now = new Date();
    const today = dayKey(now);
    return {
      total: agendaItems.length,
      today: agendaItems.filter((item) => {
        const date = toDate(item.startAt);
        return date ? dayKey(date) === today : false;
      }).length,
      upcoming: agendaItems.filter((item) => {
        const date = toDate(item.startAt);
        return date ? date >= now : false;
      }).length,
      high: agendaItems.filter((item) => item.priority === "high").length,
      manual: manualItems.length,
    };
  }, [agendaItems, manualItems.length]);

  const isLoading = eventsLoading || ideasLoading || missionsLoading || journalLoading || newsLoading;

  const handleCreateManualItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !startAt) return;

    const item: ManualPlannerItem = {
      id: makeId(),
      type,
      title: title.trim(),
      notes: notes.trim(),
      startAt: new Date(startAt).toISOString(),
      endAt: endAt ? new Date(endAt).toISOString() : null,
      priority,
      createdAt: new Date().toISOString(),
    };

    setManualItems((current) => {
      const next = [...current, item];
      saveManualItems(next);
      return next;
    });

    setTitle("");
    setNotes("");
    setEndAt("");
    setStartAt(toDateTimeInputValue(new Date()));
    setPriority("medium");
    setType("trade-plan");
  };

  const handleDeleteManualItem = (id: string) => {
    setManualItems((current) => {
      const next = current.filter((item) => item.id !== id);
      saveManualItems(next);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryTile label="Agenda" value={summary.total} tone="text-foreground" />
        <SummaryTile label="Oggi" value={summary.today} tone="text-primary" />
        <SummaryTile label="Prossimi" value={summary.upcoming} tone="text-accent" />
        <SummaryTile label="Alta prio." value={summary.high} tone="text-red-300" />
        <SummaryTile label="Manuali" value={summary.manual} tone="text-amber-300" />
      </section>

      <form
        onSubmit={handleCreateManualItem}
        className="rounded-xl border border-border/40 bg-card/60 p-3 shadow-lg shadow-black/10 backdrop-blur-sm"
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <CalendarClock className="h-4 w-4 text-primary" />
          Planner manuale
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_150px_130px]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titolo"
            className="h-10 rounded-lg border border-border/50 bg-secondary/40 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
          <select
            value={type}
            onChange={(event) => setType(event.target.value as ManualItemType)}
            className="h-10 rounded-lg border border-border/50 bg-secondary/40 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
          >
            {Object.entries(MANUAL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            className="h-10 rounded-lg border border-border/50 bg-secondary/40 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
          >
            <option value="low">Bassa</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-[170px_170px_1fr_auto]">
          <input
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            className="h-10 rounded-lg border border-border/50 bg-secondary/40 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
          />
          <input
            type="datetime-local"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            className="h-10 rounded-lg border border-border/50 bg-secondary/40 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
          />
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Note opzionali"
            className="h-10 rounded-lg border border-border/50 bg-secondary/40 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
          <Button type="submit" disabled={!title.trim() || !startAt} className="h-10 gap-2">
            <Plus className="h-4 w-4" />
            Aggiungi
          </Button>
        </div>
      </form>

      <section className="rounded-xl border border-border/40 bg-card/55 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/35 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Agenda unificata</h3>
            <p className="text-xs text-muted-foreground">Market, obiettivi, missioni, news, journal e note manuali.</p>
          </div>
          <div className="flex items-center gap-2">
            {pastGroups.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                className="rounded-md border border-border/40 bg-secondary/30 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPast ? "Nascondi passati" : `Mostra passati (${pastGroups.length})`}
              </button>
            )}
            {isLoading && <span className="text-xs text-muted-foreground">Sync...</span>}
          </div>
        </div>

        {groupedAgenda.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nessun elemento in agenda. Aggiungi un piano manuale o attendi la sincronizzazione dei dati.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {groupedAgenda.map((group) => (
              <div key={dayKey(group.date)} className="p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {formatDayLabel(group.date)}
                  </h4>
                  <span className="rounded-md bg-secondary/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.items.map((item) => (
                    <AgendaRow key={item.id} item={item} onDeleteManual={handleDeleteManualItem} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold leading-none ${tone}`}>{value}</p>
    </div>
  );
}

function AgendaRow({
  item,
  onDeleteManual,
}: {
  item: AgendaItem;
  onDeleteManual: (id: string) => void;
}) {
  const source = SOURCE_CONFIG[item.source];
  const priority = PRIORITY_CONFIG[item.priority];
  const SourceIcon = source.Icon;

  return (
    <article className="group rounded-lg border border-border/35 bg-secondary/18 p-3 transition-colors hover:border-primary/30 hover:bg-secondary/30">
      <div className="flex items-start gap-3">
        <div className="flex w-[58px] shrink-0 flex-col items-center rounded-lg border border-border/35 bg-background/30 px-2 py-1.5 text-center">
          <Clock className="mb-1 h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-xs font-bold text-foreground">{formatTime(item.startAt)}</span>
          {item.endAt && <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">{formatTime(item.endAt)}</span>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${source.className}`}>
              <SourceIcon className="h-3 w-3" />
              {source.label}
            </span>
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${priority.className}`}>
              {priority.label}
            </span>
            {item.meta && <span className="text-[11px] text-muted-foreground">{item.meta}</span>}
          </div>

          <h5 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{item.title}</h5>
          {item.notes && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.notes}</p>}
        </div>

        {item.manual && (
          <button
            type="button"
            onClick={() => onDeleteManual(item.manual!.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition-colors hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
            aria-label="Elimina item manuale"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}
