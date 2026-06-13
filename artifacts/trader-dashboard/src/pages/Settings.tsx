import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useSearch } from "wouter";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProfileWidget } from "@/components/ProfileWidget";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BackgroundPresetsManager } from "@/components/BackgroundPresetsManager";
import { BillingSubscriptionPanel } from "@/components/BillingSubscriptionPanel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Image,
  Upload,
  X,
  LogIn,
  LogOut,
  UserPlus,
  RefreshCw,
  Type,
  Sun,
  TrendingUp,
  Target,
  Plus,
  Pencil,
  Trash2,
  Quote,
  Bell,
  ShieldAlert,
  Lock,
  Globe,
  Music,
  ChevronRight,
  Check,
  Shield,
  KeyRound,
  CheckSquare,
  ChevronDown,
  BarChart2,
  Library,
  HelpCircle,
  ExternalLink,
  Mail,
  MessageSquare,
  BookOpen,
  Zap,
  Star,
  Monitor,
  Smartphone,
  Tablet as TabletIcon,
  Clock,
  FileText,
  Scale,
  LifeBuoy,
  CircleHelp,
  ArrowRight,
  Trophy,
  LayoutGrid,
} from "lucide-react";
import { useGetProfile } from "@workspace/api-client-react";
import {
  getUnlockedRewards,
  getNextMilestone,
  getMilestoneProgress,
  MILESTONES,
  REWARDS,
} from "@/lib/rewardsLibrary";
import { RewardCard } from "@/components/LevelRewardModal";
import {
  useBackground,
  DEFAULT_TRADING_SESSIONS,
  DEFAULT_LOT_DIVISOR,
  type TradingSessionConfig,
} from "@/contexts/BackgroundContext";
import {
  useGetUserSettings,
  useUpdateUserSettings,
  getGetUserSettingsQueryKey,
  useGetMissionTemplates,
  useCreateMissionTemplate,
  useUpdateMissionTemplate,
  useDeleteMissionTemplate,
  getGetMissionTemplatesQueryKey,
  useGetQuotes,
  useCreateQuote,
  useUpdateQuote,
  useDeleteQuote,
  getGetQuotesQueryKey,
  getGetRandomQuoteQueryKey,
  useGetChecklist,
  useCreateChecklistItem,
  useDeleteChecklistItem,
  getGetChecklistQueryKey,
  type UpdateUserSettingsRequestFontChoice,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useClerk } from "@clerk/react";
import { usePinLock } from "@/contexts/PinLockContext";
import { useLanguage, LANGUAGES, type Language, uiText } from "@/contexts/LanguageContext";
import { getPairLabel } from "@workspace/pair-catalog";
import { PairSelectionModal } from "@/components/PairSelectionModal";
import { AppTutorialWizard } from "@/components/AppTutorialWizard";
import { ScheduledCallsSettings } from "@/components/ScheduledCallsSettings";
import {
  usePushNotifications,
  type NotificationPrefs,
} from "@/hooks/usePushNotifications";
import {
  getNotificationCopy,
  NOTIFICATION_PREF_ORDER,
} from "@/lib/notifications";
import { uploadBackgroundImage } from "@/lib/backgroundSettingsApi";
import { reportClientError } from "@/lib/clientErrorReporter";
import {
  detectTradingSessionOverlap,
  getLocalTimeZoneLabel,
  isMarketClosedSession,
  normalizeLocalSessionTime,
  type MarketSessionConfig,
  type TradingSessionKind,
} from "@/lib/marketSessions";
import { FontSettings } from "@/components/settings/FontSettings";
import { DarknessSettings } from "@/components/settings/DarknessSettings";
import { BackgroundSettings } from "@/components/settings/BackgroundSettings";

const WEEKDAY_OPTIONS = [
  { id: 1, label: "L", title: "Lunedì" },
  { id: 2, label: "M", title: "Martedì" },
  { id: 3, label: "M", title: "Mercoledì" },
  { id: 4, label: "G", title: "Giovedì" },
  { id: 5, label: "V", title: "Venerdì" },
  { id: 6, label: "S", title: "Sabato" },
  { id: 0, label: "D", title: "Domenica" },
] as const;

function getSessionDaysForUi(session: MarketSessionConfig): number[] {
  if (!Array.isArray(session.days) || session.days.length === 0) {
    return WEEKDAY_OPTIONS.map((day) => day.id);
  }
  return session.days;
}

function detectOverlap(sessions: TradingSessionConfig[]): string | null {
  return detectTradingSessionOverlap(sessions as MarketSessionConfig[]);
}

function TradingSettings() {
  const { tradingSessions, setTradingSessions, lotDivisor, setLotDivisor } =
    useBackground();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [localSessions, setLocalSessions] =
    useState<MarketSessionConfig[]>(tradingSessions as MarketSessionConfig[]);
  const [localDivisor, setLocalDivisor] = useState(String(lotDivisor));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const localTimeZoneLabel = getLocalTimeZoneLabel();

  useEffect(() => {
    setLocalSessions(tradingSessions as MarketSessionConfig[]);
  }, [tradingSessions]);
  useEffect(() => {
    setLocalDivisor(String(lotDivisor));
  }, [lotDivisor]);
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const overlapError = detectOverlap(localSessions);

  const saveSessions = (sessions: MarketSessionConfig[]) => {
    setLocalSessions(sessions);
    setTradingSessions(sessions);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const err = detectOverlap(sessions);
      if (err) {
        toast({
          description: `Sovrapposizione rilevata: ${err}`,
          variant: "destructive",
        });
        return;
      }
      try {
        await updateMutation.mutateAsync({
          data: {
            tradingSessions: sessions,
            lotDivisor: Number(localDivisor) || DEFAULT_LOT_DIVISOR,
          },
        });
        qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
        toast({ description: "Sessioni salvate." });
      } catch {
        toast({
          description: "Errore nel salvataggio.",
          variant: "destructive",
        });
      }
    }, 800);
  };

  const handleSessionChange = (
    idx: number,
    field: keyof TradingSessionConfig,
    value: string | boolean,
  ) => {
    const updated = localSessions.map((s, i) => {
      if (i === idx) {
        if (field === "openUTC" || field === "closeUTC")
          return { ...s, [field]: normalizeLocalSessionTime(value as string) };
        return { ...s, [field]: value };
      }
      return s;
    });
    saveSessions(updated);
  };

  const handleSessionKindChange = (idx: number, kind: TradingSessionKind) => {
    const updated = localSessions.map((session, i) => {
      if (i !== idx) return session;
      return {
        ...session,
        kind,
        color:
          kind === "market_closed"
            ? "session-closed"
            : session.color === "session-closed"
              ? "session-ny"
              : session.color,
        days:
          kind === "market_closed"
            ? Array.isArray(session.days) && session.days.length > 0
              ? session.days
              : [6, 0]
            : undefined,
      };
    });
    saveSessions(updated);
  };

  const handleClosedSessionDayToggle = (idx: number, day: number) => {
    const updated = localSessions.map((session, i) => {
      if (i !== idx) return session;
      const selected = getSessionDaysForUi(session);
      const nextDays = selected.includes(day)
        ? selected.filter((value) => value !== day)
        : [...selected, day];
      return {
        ...session,
        days: nextDays.sort((a, b) => a - b),
      };
    });
    saveSessions(updated);
  };

  const handleAddSession = () => {
    const newSession: MarketSessionConfig = {
      id: `custom-${Date.now()}`,
      name: `Sessione ${localSessions.length + 1}`,
      openUTC: "07:00",
      closeUTC: "09:00",
      color: "session-ny",
      kind: "trading",
      enabled: false,
    };
    const updated = [...localSessions, newSession];
    setLocalSessions(updated);
    setTradingSessions(updated);
  };

  const handleAddClosedSession = () => {
    const newSession: MarketSessionConfig = {
      id: `closed-${Date.now()}`,
      name: "Mercato chiuso",
      openUTC: "22:00",
      closeUTC: "23:59",
      color: "session-closed",
      kind: "market_closed",
      days: [6, 0],
      enabled: true,
    };
    saveSessions([...localSessions, newSession]);
  };

  const handleDeleteSession = (idx: number) => {
    if (localSessions.length <= 1) return;
    saveSessions(localSessions.filter((_, i) => i !== idx));
  };

  const handleDivisorChange = (value: string) => {
    setLocalDivisor(value);
    const num = Number(value);
    if (num >= 1) {
      setLotDivisor(num);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await updateMutation.mutateAsync({
            data: { lotDivisor: num, tradingSessions: localSessions },
          });
          qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
          toast({ description: "Divisore salvato." });
        } catch {
          toast({
            description: "Errore nel salvataggio.",
            variant: "destructive",
          });
        }
      }, 800);
    }
  };

  const handleReset = async () => {
    setLocalSessions(DEFAULT_TRADING_SESSIONS);
    setTradingSessions(DEFAULT_TRADING_SESSIONS);
    setLocalDivisor(String(DEFAULT_LOT_DIVISOR));
    setLotDivisor(DEFAULT_LOT_DIVISOR);
    try {
      await updateMutation.mutateAsync({
        data: {
          tradingSessions: DEFAULT_TRADING_SESSIONS,
          lotDivisor: DEFAULT_LOT_DIVISOR,
        },
      });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Impostazioni trading ripristinate." });
    } catch {
      toast({ description: "Errore nel ripristino.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />{uiText("auto.ui.49352196f6")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Sessioni di Trading
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Orari solo locali ({localTimeZoneLabel}). Nessuna conversione di
                fuso viene applicata.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Le righe "Mercato chiuso" sono informative: possono sovrapporsi
                alle sessioni operative e non inviano promemoria di apertura.
              </p>
            </div>
          </div>

          {overlapError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
              <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{overlapError}</p>
            </div>
          )}

          {localSessions.map((session, idx) => (
            <motion.div
              key={session.id}
              className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 space-y-3 hover:border-border/80 transition-colors"
              whileHover={{ borderColor: "var(--border-hover)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <Input
                  value={session.name}
                  onChange={(e) =>
                    handleSessionChange(idx, "name", e.target.value)
                  }
                  className="text-sm font-semibold flex-1 bg-secondary/40 border-border/30 rounded-lg"
                  placeholder={uiText("auto.ui.26ce432557")}
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground font-medium">{uiText("auto.ui.97ec36f1ec")}</span>
                  <Switch
                    checked={session.enabled}
                    onCheckedChange={(checked) =>
                      handleSessionChange(idx, "enabled", checked)
                    }
                  />
                  {localSessions.length > 1 && (
                    <button
                      onClick={() => handleDeleteSession(idx)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title={uiText("auto.ui.c4446f0733")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Tipo sessione
                  </label>
                  <select
                    value={(session as MarketSessionConfig).kind ?? "trading"}
                    onChange={(event) =>
                      handleSessionKindChange(
                        idx,
                        event.target.value as TradingSessionKind,
                      )
                    }
                    className="h-10 w-full rounded-lg border border-border/30 bg-secondary/40 px-3 text-sm text-foreground"
                  >
                    <option value="trading">{uiText("auto.ui.7b780520ff")}</option>
                    <option value="market_closed">{uiText("auto.ui.aafe59a8f3")}</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                      isMarketClosedSession(session as MarketSessionConfig)
                        ? "bg-red-500/10 text-red-400 border border-red-500/30"
                        : "bg-primary/10 text-primary border border-primary/25"
                    }`}
                  >
                    {isMarketClosedSession(session as MarketSessionConfig)
                      ? "Chiuso"
                      : "Operativa"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Apertura
                  </label>
                  <Input
                    type="time"
                    value={normalizeLocalSessionTime(session.openUTC)}
                    onChange={(e) =>
                      handleSessionChange(idx, "openUTC", e.target.value)
                    }
                    className="text-sm font-mono bg-secondary/40 border border-border/30 rounded-lg h-10 text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Chiusura
                  </label>
                  <Input
                    type="time"
                    value={normalizeLocalSessionTime(session.closeUTC)}
                    onChange={(e) =>
                      handleSessionChange(idx, "closeUTC", e.target.value)
                    }
                    className="text-sm font-mono bg-secondary/40 border border-border/30 rounded-lg h-10 text-foreground"
                  />
                </div>
              </div>
              {isMarketClosedSession(session as MarketSessionConfig) && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Giorni chiusura
                  </label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const selected = getSessionDaysForUi(session as MarketSessionConfig).includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          title={day.title}
                          aria-pressed={selected}
                          onClick={() => handleClosedSessionDayToggle(idx, day.id)}
                          className={`h-8 rounded-md border text-xs font-bold transition-colors ${
                            selected
                              ? "border-red-400/70 bg-red-500/15 text-red-200"
                              : "border-border/40 bg-secondary/30 text-muted-foreground hover:border-red-400/40 hover:text-red-200"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          <Button
            variant="outline"
            className="w-full rounded-xl border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            onClick={handleAddSession}
          >
            <Plus className="w-4 h-4 mr-2 text-primary" />
            Aggiungi sessione personalizzata
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl border-dashed border-red-500/40 bg-red-500/5 text-red-300 hover:border-red-500/60 hover:bg-red-500/10 transition-colors"
            onClick={handleAddClosedSession}
          >
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi mercato chiuso
          </Button>
        </div>

        <Button
          variant="outline"
          className="w-full rounded-lg"
          onClick={handleReset}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Ripristina valori predefiniti
        </Button>
      </CardContent>
    </Card>
  );
}

function QuotesSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: quotes, isLoading } = useGetQuotes();
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const deleteMutation = useDeleteQuote();
  const [newText, setNewText] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editAuthor, setEditAuthor] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetQuotesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRandomQuoteQueryKey() });
  };

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      await createMutation.mutateAsync({
        data: { text: newText.trim(), author: newAuthor.trim() || undefined },
      });
      setNewText("");
      setNewAuthor("");
      invalidate();
      toast({ description: "Citazione aggiunta." });
    } catch {
      toast({ description: "Errore nell'aggiunta.", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: { text: editText, author: editAuthor },
      });
      setEditingId(null);
      invalidate();
      toast({ description: "Citazione aggiornata." });
    } catch {
      toast({
        description: "Errore nell'aggiornamento.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      invalidate();
      toast({ description: "Citazione eliminata." });
    } catch {
      toast({
        description: "Errore nell'eliminazione.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (q: {
    id: number;
    text: string;
    author?: string | null;
  }) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditAuthor(q.author ?? "");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Quote className="w-5 h-5 text-primary" />
          Citazioni Motivazionali
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Aggiungi le tue citazioni preferite. Se non ne aggiungi, verranno
          mostrate quelle predefinite.
        </p>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <Input
            placeholder={uiText("auto.ui.1d52ab1e92")}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Input
              placeholder={uiText("auto.ui.a6403a2baa")}
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              className="text-sm flex-1"
            />
            <Button
              onClick={handleAdd}
              disabled={!newText.trim() || createMutation.isPending}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Aggiungi
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-4 flex justify-center">
            <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !quotes || quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            Nessuna citazione personalizzata. Verranno usate quelle predefinite.
          </p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <div key={q.id} className="rounded-lg border border-border p-3">
                {editingId === q.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={editAuthor}
                        onChange={(e) => setEditAuthor(e.target.value)}
                        className="text-sm flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(q.id)}
                        disabled={updateMutation.isPending}
                      >{uiText("auto.ui.c5965db5f2")}</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >{uiText("auto.ui.6c3de5381b")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm italic truncate">
                        &ldquo;{q.text}&rdquo;
                      </p>
                      {q.author && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          — {q.author}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => startEdit(q)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(q.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MissionTemplatesSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: templates, isLoading } = useGetMissionTemplates();
  const createMutation = useCreateMissionTemplate();
  const updateMutation = useUpdateMissionTemplate();
  const deleteMutation = useDeleteMissionTemplate();
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newXp, setNewXp] = useState("50");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editXp, setEditXp] = useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getGetMissionTemplatesQueryKey() });

  const handleAdd = async () => {
    if (!newTitle.trim() || !newDesc.trim()) return;
    try {
      await createMutation.mutateAsync({
        data: {
          title: newTitle.trim(),
          description: newDesc.trim(),
          xpReward: Number(newXp) || 50,
        },
      });
      setNewTitle("");
      setNewDesc("");
      setNewXp("50");
      invalidate();
      toast({ description: "Missione aggiunta." });
    } catch {
      toast({ description: "Errore nell'aggiunta.", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          title: editTitle,
          description: editDesc,
          xpReward: Number(editXp) || 50,
        },
      });
      setEditingId(null);
      invalidate();
      toast({ description: "Missione aggiornata." });
    } catch {
      toast({
        description: "Errore nell'aggiornamento.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      invalidate();
      toast({ description: "Missione eliminata." });
    } catch {
      toast({
        description: "Errore nell'eliminazione.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (t: {
    id: number;
    title: string;
    description: string;
    xpReward: number;
  }) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditDesc(t.description);
    setEditXp(String(t.xpReward));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />{uiText("auto.ui.0a38d7a6de")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Personalizza le missioni giornaliere. Se non ne aggiungi, verranno
          usate quelle predefinite.
        </p>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <Input
            placeholder={uiText("auto.ui.120ae9b81a")}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="text-sm"
          />
          <Input
            placeholder={uiText("auto.ui.07dfa30eec")}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              placeholder="XP"
              value={newXp}
              onChange={(e) => setNewXp(e.target.value)}
              className="text-sm w-24"
            />
            <Button
              onClick={handleAdd}
              disabled={
                !newTitle.trim() || !newDesc.trim() || createMutation.isPending
              }
              size="sm"
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-1" />
              Aggiungi
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-4 flex justify-center">
            <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            Nessuna missione personalizzata. Verranno usate le 5 predefinite.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3">
                {editingId === t.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={editXp}
                        onChange={(e) => setEditXp(e.target.value)}
                        className="text-sm w-24"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(t.id)}
                        disabled={updateMutation.isPending}
                      >{uiText("auto.ui.c5965db5f2")}</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >{uiText("auto.ui.6c3de5381b")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold truncate">
                          {t.title}
                        </h4>
                        <span className="text-xs font-mono text-accent bg-secondary/60 px-1.5 py-0.5 rounded">
                          {t.xpReward} XP
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {t.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => startEdit(t)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  const { data: settings, isLoading } = useGetUserSettings();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { language } = useLanguage();
  const notificationCopy = getNotificationCopy(language);
  const push = usePushNotifications();
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  const [reminderTime, setReminderTime] = useState("");
  const [preMacro, setPreMacro] = useState("15");
  const [maxLoss, setMaxLoss] = useState("");
  const ui = {
    it: {
      saved: "Impostazioni notifiche salvate.",
      saveError: "Errore nel salvataggio.",
      pushOff: "Notifiche push disattivate.",
      pushOn: "Notifiche push attivate.",
      pushUnavailable:
        "Notifiche push non configurate sul server. Gli avvisi in-app restano attivi.",
      deniedToast:
        "Permesso notifiche negato. Abilita dalle impostazioni del browser.",
      title: "Notifiche Push",
      unsupported: "Le notifiche push non sono supportate da questo browser.",
      denied:
        "Il permesso e stato negato. Abilita le notifiche dalle impostazioni del browser e ricarica la pagina.",
      background: "Notifiche in background",
      backgroundDesc: "Ricevi notifiche anche ad app chiusa.",
      choose: "Scegli cosa ricevere",
      alerts: "Promemoria e alert",
      dailyTime: "Orario promemoria giornaliero",
      dailyDesc:
        "Ricevi ogni giorno una notifica con il riepilogo delle missioni.",
      macroLead: "Anticipo alert eventi macro",
      macroDesc:
        "Quanto prima ricevere la notifica per eventi ad alto impatto.",
      maxLoss: "Max loss giornaliero",
      maxLossDesc: "Ricevi un avviso alla sessione se hai impostato un limite.",
      maxLossPlaceholder: "es. 200",
      save: "Salva",
    },
    en: {
      saved: "Notification settings saved.",
      saveError: "Save error.",
      pushOff: "Push notifications disabled.",
      pushOn: "Push notifications enabled.",
      pushUnavailable:
        "Push notifications are not configured on the server. In-app alerts remain active.",
      deniedToast:
        "Notification permission denied. Enable it in browser settings.",
      title: "Push Notifications",
      unsupported: "Push notifications are not supported by this browser.",
      denied:
        "Permission was denied. Enable notifications in browser settings and reload the page.",
      background: "Background notifications",
      backgroundDesc: "Receive notifications even when the app is closed.",
      choose: "Choose what to receive",
      alerts: "Reminders and alerts",
      dailyTime: "Daily reminder time",
      dailyDesc: "Receive a daily notification with your mission summary.",
      macroLead: "Macro event alert lead time",
      macroDesc: "How early to receive high-impact event alerts.",
      maxLoss: "Daily max loss",
      maxLossDesc: "Receive a session warning when you set a limit.",
      maxLossPlaceholder: "e.g. 200",
      save: "Save",
    },
    es: {
      saved: "Ajustes de notificaciones guardados.",
      saveError: "Error al guardar.",
      pushOff: "Notificaciones push desactivadas.",
      pushOn: "Notificaciones push activadas.",
      pushUnavailable:
        "Las notificaciones push no estan configuradas en el servidor. Las alertas dentro de la app siguen activas.",
      deniedToast:
        "Permiso de notificaciones denegado. Activalo en el navegador.",
      title: "Notificaciones Push",
      unsupported: "Este navegador no admite notificaciones push.",
      denied:
        "Permiso denegado. Activa las notificaciones en el navegador y recarga la pagina.",
      background: "Notificaciones en segundo plano",
      backgroundDesc: "Recibe notificaciones incluso con la app cerrada.",
      choose: "Elige que recibir",
      alerts: "Recordatorios y alertas",
      dailyTime: "Hora del recordatorio diario",
      dailyDesc: "Recibe un resumen diario de tus misiones.",
      macroLead: "Anticipo de eventos macro",
      macroDesc: "Cuanto antes recibir alertas de alto impacto.",
      maxLoss: "Perdida maxima diaria",
      maxLossDesc: "Recibe un aviso de sesion cuando configures un limite.",
      maxLossPlaceholder: "ej. 200",
      save: "Guardar",
    },
    fr: {
      saved: "Parametres de notifications enregistres.",
      saveError: "Erreur d'enregistrement.",
      pushOff: "Notifications push desactivees.",
      pushOn: "Notifications push activees.",
      pushUnavailable:
        "Les notifications push ne sont pas configurees sur le serveur. Les alertes dans l'app restent actives.",
      deniedToast: "Autorisation refusee. Activez-la dans le navigateur.",
      title: "Notifications Push",
      unsupported:
        "Ce navigateur ne prend pas en charge les notifications push.",
      denied:
        "Autorisation refusee. Activez les notifications dans le navigateur puis rechargez.",
      background: "Notifications en arriere-plan",
      backgroundDesc: "Recevez des notifications meme quand l'app est fermee.",
      choose: "Choisir quoi recevoir",
      alerts: "Rappels et alertes",
      dailyTime: "Heure du rappel quotidien",
      dailyDesc: "Recevez chaque jour un resume de vos missions.",
      macroLead: "Delai des evenements macro",
      macroDesc: "Quand recevoir les alertes a fort impact.",
      maxLoss: "Perte max quotidienne",
      maxLossDesc:
        "Recevez un avertissement de session si une limite est definie.",
      maxLossPlaceholder: "ex. 200",
      save: "Enregistrer",
    },
    de: {
      saved: "Benachrichtigungseinstellungen gespeichert.",
      saveError: "Fehler beim Speichern.",
      pushOff: "Push-Benachrichtigungen deaktiviert.",
      pushOn: "Push-Benachrichtigungen aktiviert.",
      pushUnavailable:
        "Push-Benachrichtigungen sind auf dem Server nicht konfiguriert. In-App-Hinweise bleiben aktiv.",
      deniedToast:
        "Benachrichtigungserlaubnis verweigert. Im Browser aktivieren.",
      title: "Push-Benachrichtigungen",
      unsupported: "Dieser Browser unterstuetzt keine Push-Benachrichtigungen.",
      denied:
        "Erlaubnis verweigert. Aktiviere Benachrichtigungen im Browser und lade neu.",
      background: "Hintergrundbenachrichtigungen",
      backgroundDesc: "Erhalte Benachrichtigungen auch bei geschlossener App.",
      choose: "Auswaehlen, was du erhalten willst",
      alerts: "Erinnerungen und Alerts",
      dailyTime: "Zeit der Tageserinnerung",
      dailyDesc: "Erhalte taeglich eine Zusammenfassung deiner Missionen.",
      macroLead: "Vorlauf fuer Makroevents",
      macroDesc: "Wie frueh du Alerts vor wichtigen Ereignissen erhaelst.",
      maxLoss: "Tages-Max-Loss",
      maxLossDesc: "Erhalte eine Session-Warnung, wenn ein Limit gesetzt ist.",
      maxLossPlaceholder: "z.B. 200",
      save: "Speichern",
    },
  }[language];

  useEffect(() => {
    if (!settings) return;
    setReminderTime(settings.dailyReminderTime ?? "");
    setPreMacro(String(settings.preMacroMinutes ?? 15));
    setMaxLoss(settings.maxDailyLoss ? String(settings.maxDailyLoss) : "");
  }, [settings]);

  const save = async () => {
    try {
      await updateMutation.mutateAsync({
        data: {
          dailyReminderTime: reminderTime || undefined,
          preMacroMinutes: Number(preMacro),
          maxDailyLoss: maxLoss ? Number(maxLoss) : undefined,
        },
      });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: ui.saved });
    } catch {
      toast({ description: ui.saveError, variant: "destructive" });
    }
  };

  const handleTogglePush = async () => {
    if (push.isSubscribed) {
      await push.unsubscribe();
      toast({ description: ui.pushOff });
    } else {
      setShowPushPrompt(true);
    }
  };

  const confirmPushActivation = async () => {
    setShowPushPrompt(false);
    const ok = await push.subscribe();
    if (ok) toast({ description: ui.pushOn });
    else if (
      push.permission === "denied" ||
      ("Notification" in window && Notification.permission === "denied")
    ) {
      toast({ description: ui.deniedToast, variant: "destructive" });
    } else {
      toast({ description: ui.pushUnavailable, variant: "destructive" });
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      <AlertDialog open={showPushPrompt} onOpenChange={setShowPushPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("auto.ui.98661e9e19")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Vuoi ricevere alert utili sulle sessioni, le missioni e gli
                eventi macro? Puoi scegliere quali notifiche ricevere e
                disattivarle in qualsiasi momento.
              </span>
              <span className="block">
                TraderLoading userà il permesso solo per avvisi operativi
                collegati alla tua routine, non per pubblicità.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{uiText("settings.push.not_now")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPushActivation}>
              Attiva notifiche
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Push notifications master toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-400" />
            {ui.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!push.isSupported && (
            <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              {ui.unsupported}
            </p>
          )}

          {push.isSupported && (
            <>
              {push.permission === "denied" && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {ui.denied}
                </p>
              )}

              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">{ui.background}</p>
                  <p className="text-xs text-muted-foreground">
                    {ui.backgroundDesc}
                  </p>
                </div>
                <Switch
                  checked={push.isSubscribed}
                  onCheckedChange={handleTogglePush}
                  disabled={push.loading || push.permission === "denied"}
                />
              </div>

              {push.isSubscribed && push.prefs && (
                <div className="space-y-1 pt-1 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 pb-1">
                    {ui.choose}
                  </p>
                  {NOTIFICATION_PREF_ORDER.map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 py-2 px-1 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {notificationCopy.prefs[key].label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {notificationCopy.prefs[key].description}
                        </span>
                      </span>
                      <Switch
                        checked={push.prefs[key]}
                        onCheckedChange={(v) => push.updatePref(key, v)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ScheduledCallsSettings />

      {/* Reminder & alert settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {ui.alerts}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{ui.dailyTime}</p>
            <p className="text-xs text-muted-foreground">{ui.dailyDesc}</p>
            <Input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{ui.macroLead}</p>
            <p className="text-xs text-muted-foreground">{ui.macroDesc}</p>
            <div className="flex gap-2">
              {["5", "10", "15", "30"].map((v) => (
                <button
                  key={v}
                  onClick={() => setPreMacro(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    preMacro === v
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v} min
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              {ui.maxLoss} (EUR)
            </p>
            <p className="text-xs text-muted-foreground">{ui.maxLossDesc}</p>
            <Input
              type="number"
              min="0"
              placeholder={ui.maxLossPlaceholder}
              value={maxLoss}
              onChange={(e) => setMaxLoss(e.target.value)}
              className="w-40"
            />
          </div>

          <Button size="sm" onClick={save} disabled={updateMutation.isPending}>
            {ui.save}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Login Access History ─────────────────────────────────────────────────────

interface AccessEntry {
  id: number;
  ipAddress: string;
  device: string;
  browser: string;
  os: string;
  createdAt: string;
}

function DeviceIcon({ device }: { device: string }) {
  if (device === "Mobile") return <Smartphone className="w-4 h-4" />;
  if (device === "Tablet") return <TabletIcon className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
}

function LoginAccessSection() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    accesses: AccessEntry[];
  }>({
    queryKey: ["login-access"],
    queryFn: async () => {
      const res = await fetch("/api/login-access", { credentials: "include" });
      if (!res.ok) throw new Error("Errore nel caricamento accessi");
      return res.json();
    },
    staleTime: 60_000,
  });

  const accesses = data?.accesses ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Accessi recenti
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
            />
            Aggiorna
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : accesses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessun accesso registrato
          </p>
        ) : (
          <div className="space-y-2">
            {accesses.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  i === 0
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/40 bg-secondary/20"
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}
                >
                  <DeviceIcon device={a.device} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-medium">
                      {a.ipAddress}
                    </span>
                    {i === 0 && (
                      <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-md border border-primary/30">
                        Attuale
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.device} · {a.browser} · {a.os}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {new Date(a.createdAt).toLocaleString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground/50 text-center pt-1">
              Gli IP vengono registrati al primo accesso ogni ora per
              dispositivo
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PinSettings() {
  const { isPinSet, setPin, removePin, unlock } = usePinLock();
  const { toast } = useToast();
  const [mode, setMode] = useState<
    "idle" | "set" | "change-old" | "change-new"
  >("idle");
  const [pin, setLocalPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [error, setError] = useState("");

  const handleReset = () => {
    setMode("idle");
    setLocalPin("");
    setConfirm("");
    setOldPin("");
    setError("");
  };

  const handleSet = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("Il PIN deve essere di 4 cifre numeriche");
      return;
    }
    if (pin !== confirm) {
      setError("I PIN non coincidono");
      return;
    }
    await setPin(pin);
    toast({
      title: "PIN impostato",
      description: "L'app è ora protetta da PIN.",
    });
    handleReset();
  };

  const handleVerifyOld = async () => {
    const ok = await unlock(oldPin);
    if (!ok) {
      setError("PIN corrente non corretto");
      return;
    }
    setMode("change-new");
    setOldPin("");
    setError("");
  };

  const handleChangeNew = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("Il PIN deve essere di 4 cifre");
      return;
    }
    if (pin !== confirm) {
      setError("I PIN non coincidono");
      return;
    }
    await setPin(pin);
    toast({ title: "PIN aggiornato" });
    handleReset();
  };

  const handleRemove = () => {
    removePin();
    toast({
      title: "PIN rimosso",
      description: "L'app non richiede più autenticazione.",
    });
    handleReset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPinSet ? "bg-primary/15 border border-primary/40" : "bg-secondary border border-border"}`}
          >
            <Shield
              className={`w-5 h-5 ${isPinSet ? "text-primary" : "text-muted-foreground"}`}
            />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {isPinSet ? "PIN attivo" : "PIN non impostato"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPinSet
                ? "L'app richiede PIN ad ogni avvio"
                : "Nessuna protezione PIN"}
            </p>
          </div>
        </div>
        <div
          className={`w-2 h-2 rounded-full ${isPinSet ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`}
        />
      </div>

      {mode === "idle" && (
        <div className="grid grid-cols-1 gap-2">
          {!isPinSet ? (
            <Button
              onClick={() => setMode("set")}
              className="w-full justify-start gap-3"
              variant="outline"
            >
              <KeyRound className="w-4 h-4 text-primary" /> Imposta PIN
            </Button>
          ) : (
            <>
              <Button
                onClick={() => setMode("change-old")}
                className="w-full justify-start gap-3"
                variant="outline"
              >
                <KeyRound className="w-4 h-4 text-primary" /> Cambia PIN
              </Button>
              <Button
                onClick={handleRemove}
                className="w-full justify-start gap-3 text-destructive border-destructive/30 hover:bg-destructive/10"
                variant="outline"
              >
                <X className="w-4 h-4" /> Rimuovi PIN
              </Button>
            </>
          )}
        </div>
      )}

      {mode === "change-old" && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              PIN attuale
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={oldPin}
              onChange={(e) => {
                setOldPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError("");
              }}
              className="font-mono text-center tracking-[0.5em] text-lg"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={handleVerifyOld}
              className="flex-1"
              disabled={oldPin.length < 4}
            >
              <ChevronRight className="w-4 h-4 mr-2" /> Avanti
            </Button>
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Annulla
            </Button>
          </div>
        </div>
      )}

      {(mode === "set" || mode === "change-new") && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Nuovo PIN (4 cifre)
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => {
                setLocalPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError("");
              }}
              className="font-mono text-center tracking-[0.5em] text-lg"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Conferma PIN
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError("");
              }}
              className="font-mono text-center tracking-[0.5em] text-lg"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={mode === "set" ? handleSet : handleChangeNew}
              className="flex-1"
              disabled={pin.length < 4 || confirm.length < 4}
            >
              <Check className="w-4 h-4 mr-2" /> Conferma
            </Button>
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LanguageSettings() {
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();

  const handleSelect = async (lang: Language) => {
    setLanguage(lang);
    try {
      await updateMutation.mutateAsync({ data: { language: lang } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
    } catch {
      // The local language switch still works; the next settings save can retry server sync.
    }
    toast({ title: `Lingua impostata: ${LANGUAGES[lang].name}` });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Seleziona la lingua dell'interfaccia
      </p>
      <div className="grid grid-cols-1 gap-2">
        {(
          Object.entries(LANGUAGES) as [
            Language,
            (typeof LANGUAGES)[Language],
          ][]
        ).map(([code, lang]) => (
          <button
            key={code}
            onClick={() => handleSelect(code)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
              language === code
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/40 hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{lang.flag}</span>
              <div>
                <p className="text-sm font-medium">{lang.name}</p>
                <p className="text-xs text-muted-foreground">{lang.label}</p>
              </div>
            </div>
            {language === code && <Check className="w-4 h-4 text-primary" />}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center pt-1">
        La traduzione completa è in fase di sviluppo
      </p>
    </div>
  );
}

function ChecklistSettings() {
  const { data: items, isLoading } = useGetChecklist();
  const [newText, setNewText] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const createMutation = useCreateChecklistItem();
  const deleteMutation = useDeleteChecklistItem();

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      await createMutation.mutateAsync({
        data: { text: newText.trim(), completed: false },
      });
      setNewText("");
      qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
      toast({ title: "Elemento aggiunto" });
    } catch {
      toast({ description: "Errore", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
    } catch {
      toast({ description: "Errore", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">
          Aggiungi elemento
        </label>
        <div className="flex gap-2">
          <Input
            placeholder={uiText("auto.ui.cba892ec78")}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!newText.trim()} size="sm">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-4">
          Caricamento...
        </div>
      ) : items && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border group hover:bg-secondary/50 transition-colors"
            >
              <p className="text-sm text-muted-foreground">{item.text}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <p>{uiText("auto.ui.dfb6f163d7")}</p>
          <p className="text-xs mt-1">{uiText("auto.ui.83fe33d1ef")}</p>
        </div>
      )}
    </div>
  );
}

function AuthSection({ login, signup }: { login: () => void; signup: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="w-5 h-5 text-primary" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Hai già un account? Accedi per sincronizzare i tuoi dati. Sei nuovo?
          Registrati per iniziare.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={login} className="w-full">
            <LogIn className="w-4 h-4 mr-2" />
            Accedi
          </Button>
          <Button onClick={signup} variant="outline" className="w-full">
            <UserPlus className="w-4 h-4 mr-2" />
            Registrati
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountExportSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-5 h-5 text-primary" />
          Esporta dati
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Scarica un file JSON con profilo, preferenze, journal, routine,
          backtest e dati trading collegati al tuo account. Segreti broker,
          password e log interni di sicurezza non vengono inclusi.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            window.location.href = "/api/account/export";
          }}
        >
          <FileText className="w-4 h-4" />
          Esporta dati
        </Button>
      </CardContent>
    </Card>
  );
}

function AccountDeletionSection({ onDeleted }: { onDeleted: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmation.trim().toUpperCase() === "ELIMINA";

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Non siamo riusciti a eliminare l'account.",
        );
      }
      toast({ description: "Account eliminato. I dati collegati sono stati rimossi." });
      setOpen(false);
      onDeleted();
    } catch (error) {
      reportClientError(error, {
        context: "account deletion",
        fallbackMessage:
          "Non siamo riusciti a eliminare l'account. Contatta il supporto.",
        toast,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/35 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <Trash2 className="w-5 h-5" />
          Elimina account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cancella profilo, diario, dati di trading, notifiche, social, chat e
          connessioni broker collegate al tuo account. Alcuni log tecnici minimi
          possono restare per sicurezza, antifrode o obblighi legali.
        </p>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <Button
            type="button"
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            Elimina account
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{uiText("auto.ui.f5e7dd8614")}</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <span className="block">
                  Questa azione elimina in modo permanente profilo, preferenze,
                  journal, immagini, backtest, messaggi, notifiche push e
                  connessioni broker salvate.
                </span>
                <span className="block">
                  {uiText("settings.delete.confirm_before")} <span className="font-mono text-foreground">{uiText("settings.delete.confirm_token")}</span>.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={uiText("auto.ui.d4d34d9f18")}
              aria-label={uiText("auto.ui.527bbda0b4")}
              autoComplete="off"
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{uiText("auto.ui.6c3de5381b")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={!canDelete || deleting}
                onClick={(event) => {
                  event.preventDefault();
                  void handleDelete();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Eliminazione..." : "Elimina definitivamente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function PairPreferencesSettings() {
  const { selectedPairs, setSelectedPairs } = useBackground();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);

  const removePair = async (symbol: string) => {
    const newPairs = selectedPairs.filter((p) => p !== symbol);
    if (newPairs.length === 0) {
      toast({
        description: "Devi avere almeno un pair selezionato.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPairs(newPairs);
    try {
      await updateMutation.mutateAsync({ data: { selectedPairs: newPairs } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Pair rimosso." });
    } catch {
      toast({ description: "Errore.", variant: "destructive" });
    }
  };

  const handleConfirm = async (pairs: string[]) => {
    setSelectedPairs(pairs);
    setShowModal(false);
    try {
      await updateMutation.mutateAsync({ data: { selectedPairs: pairs } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Pair aggiornati." });
    } catch {
      toast({ description: "Errore.", variant: "destructive" });
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        {/* Card header with count badge */}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-1.5 rounded-lg bg-indigo-500/15 shrink-0">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
              </div>
              Pair Preferiti
            </CardTitle>
            {selectedPairs.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                {selectedPairs.length} attivi
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Usati in tutta la dashboard: news, journal, calcolatori e analisi.
          </p>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* Pair chips grid */}
          {selectedPairs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedPairs.map((sym) => (
                <span
                  key={sym}
                  className="inline-flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-xl text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/25 min-h-[36px]"
                >
                  {getPairLabel(sym)}
                  <button
                    onClick={() => removePair(sym)}
                    aria-label={`Rimuovi ${sym}`}
                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-destructive/15 hover:text-destructive transition-colors ml-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 rounded-xl border border-dashed border-border/50 bg-secondary/20 text-center gap-2">
              <BarChart2 className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground/60">
                Nessun pair selezionato
              </p>
              <p className="text-xs text-muted-foreground/40">
                Aggiungine almeno uno per personalizzare la dashboard
              </p>
            </div>
          )}

          {/* CTA button */}
          <button
            onClick={() => setShowModal(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-primary/30 text-sm font-medium text-primary hover:bg-primary/8 hover:border-primary/50 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            {selectedPairs.length > 0
              ? "Modifica pair selezionati"
              : "Scegli i tuoi pair"}
          </button>
        </CardContent>
      </Card>

      <PairSelectionModal
        open={showModal}
        onConfirm={handleConfirm}
        initialPairs={selectedPairs}
        dismissible
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

// ─── Rewards Library Section ─────────────────────────────────────────────────

function RewardsLibrarySection() {
  const { data: profile } = useGetProfile();
  const level = profile?.level ?? 0;
  const unlocked = getUnlockedRewards(level);
  const nextMilestone = getNextMilestone(level);
  const progress = getMilestoneProgress(level);

  const unlockedMilestones = MILESTONES.filter((m) => level >= m);
  const lockedMilestones = MILESTONES.filter((m) => level < m);

  return (
    <div className="space-y-6">
      {/* Progress bar to next milestone */}
      <div className="bg-secondary/30 rounded-xl p-4 border border-border/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Livello {level}</span>
          </div>
          {nextMilestone ? (
            <span className="text-xs text-muted-foreground">
              Prossimo sblocco al livello{" "}
              <span className="text-primary font-bold">{nextMilestone}</span>
            </span>
          ) : (
            <span className="text-xs text-primary font-semibold">{uiText("auto.ui.195e8d38db")}</span>
          )}
        </div>
        {nextMilestone && (
          <>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {level} / {nextMilestone} livelli — ancora {nextMilestone - level}{" "}
              livello{nextMilestone - level !== 1 ? "i" : ""} per sbloccare
              nuovi contenuti
            </p>
          </>
        )}
      </div>

      {/* Unlocked content */}
      {unlockedMilestones.length > 0 && (
        <div className="space-y-5">
          {unlockedMilestones.map((m) => {
            const mRewards = REWARDS.filter((r) => r.milestone === m);
            return (
              <div key={m}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/15 border border-primary/30 rounded-full">
                    <Zap className="w-3 h-3 text-primary" />
                    <span className="text-xs font-bold text-primary">
                      Livello {m}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mRewards.map((r) => (
                    <RewardCard key={r.id} reward={r} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Locked milestones */}
      {lockedMilestones.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{uiText("auto.ui.cdb9f9ede9")}</p>
          {lockedMilestones.map((m) => {
            const count = REWARDS.filter((r) => r.milestone === m).length;
            return (
              <div
                key={m}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/30 bg-secondary/20 opacity-60"
              >
                <div className="w-10 h-10 rounded-full bg-secondary/60 border border-border/40 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {count} contenuto{count !== 1 ? "i" : ""} al livello {m}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Raggiungi il livello {m} per sbloccarli
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <span className="text-[11px] text-muted-foreground/70 font-mono">
                    Lvl {m}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {unlocked.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Library className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{uiText("settings.library.level_5")}</p>
          <p className="text-xs mt-1">
            Il tuo primo contenuto si sbloccherà al livello 5
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Support & Help Section ───────────────────────────────────────────────────

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Come funziona il sistema di XP e livelli?",
    a: "Guadagni XP completando missioni giornaliere, mantenendo la streak, aprendo sessioni di check-in e compilando il diario. Ogni 500 XP sali di livello. Ogni 5 livelli sblocchi nuovi contenuti formativi nella Biblioteca.",
  },
  {
    q: "Come attivo le notifiche push?",
    a: "Vai in Impostazioni → Notifiche, poi attiva il toggle principale. Il browser chiederà il permesso una sola volta. Riceverai notifiche quando si aprono le tue sessioni di trading e quando ricevi messaggi in chat.",
  },
  {
    q: "Come funzionano le sessioni di trading?",
    a: "In Impostazioni → Trading puoi configurare orari personalizzati per ogni sessione (Londra, New York, Asia...). A ogni apertura ricevi un promemoria push con una citazione disciplinare.",
  },
  {
    q: "Dove vengono salvati i miei dati?",
    a: "Tutti i dati (diario, obiettivi, missioni, profilo) sono salvati in modo persistente nel database dell'app. Puoi accedere tramite autenticazione per sincronizzarli su dispositivi diversi.",
  },
  {
    q: "Come faccio a guadagnare XP velocemente?",
    a: "Mantieni la streak giornaliera (bonus crescente), completa tutte le missioni ogni giorno, usa il check-in sessione, compila il diario con riflessioni e utilizza la checklist pre-trade.",
  },
  {
    q: "Cosa sono i contenuti della Biblioteca?",
    a: "Ogni 5 livelli sblocchi video, PDF e presentazioni su psicologia del trading, risk management, Smart Money Concepts, analisi tecnica avanzata e mindset professionale. Si apriranno nel browser.",
  },
  {
    q: "Come funziona la chat?",
    a: "La chat ti mette in contatto con altri trader dell'app. Puoi inviare messaggi, immagini, note vocali ed emoji. Nelle storie puoi condividere aggiornamenti quotidiani con reply interattive.",
  },
  {
    q: "Come imposto il PIN di sicurezza?",
    a: "Vai in Impostazioni → Sicurezza → Imposta PIN. Dopo aver impostato il PIN, l'app lo richiederà ogni volta che viene aperta. Puoi disattivarlo in qualsiasi momento dalla stessa sezione.",
  },
];

const FEATURE_GUIDES: { icon: React.ReactNode; title: string; desc: string }[] =
  [
    {
      icon: <BookOpen className="w-4 h-4" />,
      title: "Diario di Trading",
      desc: "Registra ogni trade con riflessioni, tag emotivi e immagini. Analizza i pattern del tuo comportamento nel tempo.",
    },
    {
      icon: <Target className="w-4 h-4" />,
      title: "Missioni & Streak",
      desc: "Completa le missioni giornaliere per guadagnare XP. La streak si azzera se salti un giorno — mantienila per bonus crescenti.",
    },
    {
      icon: <TrendingUp className="w-4 h-4" />,
      title: "Sessioni & Check-in",
      desc: "Configura le sessioni di trading. Il check-in apre la sessione con una riflessione mentale e registra il tuo stato emotivo.",
    },
    {
      icon: <Zap className="w-4 h-4" />,
      title: "Backtest Visuale",
      desc: "Allenati su grafici storici in modalità replay. Simula operazioni, gestisci lo stop loss e tieni statistiche precise.",
    },
    {
      icon: <MessageSquare className="w-4 h-4" />,
      title: "Chat & Storie",
      desc: "Connettiti con altri trader. Invia messaggi, vocali, immagini. Pubblica storie quotidiane e rispondi con emoji o testo.",
    },
    {
      icon: <Library className="w-4 h-4" />,
      title: "Biblioteca Premi",
      desc: "Ogni 5 livelli sblocchi contenuti formativi esclusivi: video su mindset, PDF di analisi tecnica, presentazioni avanzate.",
    },
  ];

function SupportSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="space-y-8">
      {/* Quick guides */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Come funziona l'app
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURE_GUIDES.map((g, i) => (
            <div
              key={i}
              className="flex gap-3 p-3 rounded-xl border border-border/40 bg-secondary/20"
            >
              <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                {g.icon}
              </div>
              <div>
                <p className="text-sm font-semibold">{g.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {g.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Domande frequenti
        </h3>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className="border border-border/40 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
              >
                <span className="text-sm font-medium pr-4">{item.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border/30 bg-secondary/10">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Contact & feedback */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Contatti & Feedback
        </h3>
        <div className="space-y-3">
          <a
            href="mailto:assistenza@traderloading.com"
            className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-secondary/20 hover:border-primary/30 hover:bg-secondary/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{uiText("settings.support.write")}</p>
              <p className="text-xs text-muted-foreground">
                assistenza@traderloading.com
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>

          <a
            href="mailto:assistenza@traderloading.com?subject=Feedback%20TraderLoading"
            className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-secondary/20 hover:border-primary/30 hover:bg-secondary/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{uiText("settings.support.feedback")}</p>
              <p className="text-xs text-muted-foreground">
                Suggerimenti, idee, miglioramenti
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>
        </div>
      </div>

      {/* Version info */}
      <div className="pt-2 border-t border-border/30 text-center">
        <p className="text-xs text-muted-foreground/50 font-mono">
          TraderLoading · v1.0 · Fatto con ♥ per i trader disciplinati
        </p>
      </div>
    </div>
  );
}

// ─── Help Section ─────────────────────────────────────────────────────────────

const QUICK_STEPS = [
  {
    n: "1",
    title: "Crea il tuo profilo",
    desc: "Scegli un username, carica un avatar e imposta il tuo obiettivo di trading settimanale.",
  },
  {
    n: "2",
    title: "Configura le sessioni",
    desc: "Vai in Trading → Sessioni e imposta gli orari nel tuo fuso locale per le sessioni che segui (Londra, New York, Asia…).",
  },
  {
    n: "3",
    title: "Apri il tuo primo check-in",
    desc: "Prima di fare trading usa il pulsante sessione nel dashboard per registrare il tuo stato mentale.",
  },
  {
    n: "4",
    title: "Compila il diario",
    desc: "Dopo ogni trade vai in Diario → Nuovo Trade. Tieni traccia di setup, risultato e riflessioni.",
  },
  {
    n: "5",
    title: "Completa le missioni",
    desc: "Ogni giorno hai missioni disponibili. Completarle ti dà XP per salire di livello.",
  },
  {
    n: "6",
    title: "Attiva le notifiche",
    desc: "In Notifiche abilita le push per ricevere avvisi all'apertura delle sessioni di trading.",
  },
];

const SHORTCUT_ITEMS = [
  {
    keys: ["Impostazioni", "→", "Sicurezza"],
    action: "Imposta PIN di protezione",
  },
  { keys: ["Impostazioni", "→", "Aspetto"], action: "Cambia sfondo e font" },
  {
    keys: ["Impostazioni", "→", "Pairs"],
    action: "Seleziona i tuoi pair preferiti",
  },
  { keys: ["Diario", "→", "Recap"], action: "Analisi settimanale / mensile" },
  {
    keys: ["Tools", "→", "Backtest"],
    action: "Allenamento su grafici storici",
  },
  { keys: ["Zen"], action: "Mood tracking e meditazione" },
];

const HELP_FAQS = [
  {
    q: "Come resetto la mia streak?",
    a: "La streak si azzera automaticamente se non esegui almeno un'azione di completamento (check-in, diario, missione) entro la giornata. Non c'è un reset manuale.",
  },
  {
    q: "Come faccio a cambiare la lingua?",
    a: "Vai in Impostazioni → Lingua e seleziona la lingua desiderata. Il cambio è immediato e si applica a tutta l'interfaccia.",
  },
  {
    q: "Posso usare l'app su più dispositivi?",
    a: "Sì. I dati sono sincronizzati tramite il tuo account. Accedi con le stesse credenziali su qualsiasi dispositivo e troverai tutto aggiornato.",
  },
  {
    q: "Come esporto i miei trade?",
    a: "Dal Diario puoi esportare le sessioni in formato ICS (calendario). L'export CSV completo è in arrivo nei prossimi aggiornamenti.",
  },
  {
    q: "Come funziona il calcolo del lot size?",
    a: "In Tools → Calcolatore imposti il tuo capitale, il rischio percentuale e lo stop loss in pips. Il sistema calcola automaticamente il lot size corretto per il pair selezionato.",
  },
  {
    q: "Cosa succede se cambio il PIN e lo dimentico?",
    a: "Il PIN è memorizzato localmente. Se lo dimentichi puoi resettarlo dalla pagina delle impostazioni usando l'opzione «Rimuovi PIN» (richiede di conoscere quello attuale).",
  },
];

function HelpSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      <AppTutorialWizard
        open={tutorialOpen}
        onSkip={() => setTutorialOpen(false)}
        onFinish={() => setTutorialOpen(false)}
      />

      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {t("settings.help.review_tutorial")}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {t("settings.help.review_tutorial_desc")}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setTutorialOpen(true)}
          >
            {t("settings.help.review_tutorial")}
          </Button>
        </div>
      </div>

      {/* Quick start */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Guida rapida — primi passi
        </h3>
        <div className="space-y-3">
          {QUICK_STEPS.map((s) => (
            <div
              key={s.n}
              className="flex gap-4 p-4 rounded-xl border border-border/40 bg-secondary/20"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm font-mono">
                {s.n}
              </div>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation shortcuts */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Percorsi rapidi
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SHORTCUT_ITEMS.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-3 rounded-xl border border-border/30 bg-secondary/10"
            >
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                {item.keys.map((k, ki) => (
                  <span key={ki} className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold bg-card border border-border px-1.5 py-0.5 rounded text-foreground whitespace-nowrap">
                      {k}
                    </span>
                    {ki < item.keys.length - 1 && (
                      <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
                    )}
                  </span>
                ))}
              </div>
              <span className="text-xs text-muted-foreground ml-auto shrink-0 text-right">
                {item.action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Domande frequenti
        </h3>
        <div className="space-y-2">
          {HELP_FAQS.map((item, i) => (
            <div
              key={i}
              className="border border-border/40 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
              >
                <span className="text-sm font-medium pr-4">{item.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border/30 bg-secondary/10">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Hai ancora bisogno di aiuto?
        </h3>
        <a
          href="mailto:assistenza@traderloading.com?subject=Richiesta%20assistenza"
          className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-secondary/20 hover:border-purple-400/30 hover:bg-secondary/40 transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <CircleHelp className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{uiText("settings.support.contact")}</p>
            <p className="text-xs text-muted-foreground">
              assistenza@traderloading.com
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-purple-400 transition-colors" />
        </a>
      </div>
    </div>
  );
}

// ─── Terms & Conditions Section ────────────────────────────────────────────────

const TERMS_UPDATED = "2 maggio 2025";

function TermsBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Scale className="w-4 h-4 text-pink-400 shrink-0" />
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
      </div>
      <div className="pl-6 text-sm text-muted-foreground leading-relaxed space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function TermsSection() {
  return (
    <div className="space-y-8">
      {/* Header banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-pink-500/20 bg-pink-500/5">
        <FileText className="w-5 h-5 text-pink-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Termini di utilizzo · TraderLoading
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ultimo aggiornamento: {TERMS_UPDATED}. Utilizzando l'app accetti i
            termini descritti di seguito.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <TermsBlock title={uiText("auto.ui.ab1929adc0")}>
          <p>
            TraderLoading è uno strumento di supporto alla disciplina e
            all'organizzazione personale per trader. Non fornisce consigli
            finanziari, segnali di trading o raccomandazioni di investimento di
            alcun tipo.
          </p>
          <p>
            Qualsiasi decisione di acquisto o vendita di strumenti finanziari è
            esclusiva responsabilità dell'utente.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.4f66fb5174")}>
          <p>
            Il trading su mercati finanziari comporta un rischio elevato di
            perdita del capitale. I risultati passati non garantiscono risultati
            futuri. Le funzionalità dell'app (calcolatore, backtest, diario)
            sono strumenti educativi e organizzativi, non sistemi di trading
            automatico.
          </p>
          <p className="text-xs bg-secondary/40 border border-border/40 rounded-lg p-3 font-mono">
            ⚠️ Non siamo responsabili per perdite finanziarie derivanti
            dall'utilizzo dell'app.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("settings.terms.data_collection")}>
          <p>
            L'app raccoglie e archivia i seguenti dati personali dell'utente:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>{uiText("auto.ui.d8e57f9607")}</li>
            <li>{uiText("auto.ui.c088dd722f")}</li>
            <li>
              Indirizzo IP al momento dell'accesso (visibile in Sicurezza →
              Accessi recenti)
            </li>
            <li>{uiText("auto.ui.27d7686804")}</li>
            <li>{uiText("auto.ui.d45c9040cb")}</li>
          </ul>
          <p>
            I dati sono archiviati in database sicuri. Non vengono venduti né
            condivisi con terze parti per scopi commerciali. Possono essere
            utilizzati in forma anonima e aggregata per migliorare l'app.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.032fd86405")}>
          <p>
            Usiamo i dati per fornire autenticazione, sincronizzazione,
            sicurezza dell'account, notifiche operative e funzioni di diario,
            backtest, community e broker. Non vendiamo dati personali e non li
            usiamo per pubblicita comportamentale.
          </p>
          <p>
            Puoi chiedere accesso, esportazione, rettifica o cancellazione dei
            dati da Impostazioni → Account oppure scrivendo a
            assistenza@traderloading.com. I consensi facoltativi, come notifiche e
            comunicazioni prodotto, possono essere revocati in qualsiasi
            momento.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.f2b7cf6583")}>
          <p>
            L'utente è responsabile della sicurezza delle proprie credenziali.
            In caso di accesso non autorizzato è necessario contattare il
            supporto immediatamente. Il PIN locale è uno strumento aggiuntivo di
            privacy sul dispositivo e non sostituisce la password dell'account.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.3e92bce63a")}>
          <p>
            Tutti i contenuti dell'app (interfaccia, testi, grafica, logiche di
            gamification, contenuti formativi della Biblioteca) sono di
            proprietà esclusiva di TraderLoading. È vietata la riproduzione,
            copia o ridistribuzione senza autorizzazione scritta.
          </p>
          <p>
            I dati inseriti dall'utente (diario, note, obiettivi) rimangono di
            proprietà dell'utente.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.7cbeb972b3")}>
          <p>
            L'app è fornita «così com'è». Non garantiamo la disponibilità
            continua del servizio né l'assenza di bug. Non siamo responsabili
            per perdite di dati causate da eventi eccezionali (guasti hardware,
            disastri naturali, attacchi informatici).
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.b961fe3a36")}>
          <p>
            Ci riserviamo il diritto di aggiornare questi termini in qualsiasi
            momento. Le modifiche saranno comunicate tramite notifica in-app.
            L'uso continuato dell'app dopo la notifica costituisce accettazione
            dei nuovi termini.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.5f39b18401")}>
          <p>
            Per richieste relative a privacy, cancellazione dati o questioni
            legali:
          </p>
          <a
            href="mailto:assistenza@traderloading.com"
            className="inline-flex items-center gap-1.5 text-pink-400 hover:text-pink-300 transition-colors text-xs font-medium"
          >
            <Mail className="w-3.5 h-3.5" />
            assistenza@traderloading.com
            <ExternalLink className="w-3 h-3" />
          </a>
        </TermsBlock>
      </div>

      <div className="pt-2 border-t border-border/30 text-center">
        <p className="text-xs text-muted-foreground/50 font-mono">
          TraderLoading · Termini v1.0 · Aggiornato il {TERMS_UPDATED}
        </p>
      </div>
    </div>
  );
}

type TileId =
  | "profilo"
  | "abbonamento"
  | "pairs"
  | "audio"
  | "aspetto"
  | "notifiche"
  | "sicurezza"
  | "lingua"
  | "trading"
  | "missioni"
  | "citazioni"
  | "checklist"
  | "account"
  | "biblioteca"
  | "traguardi"
  | "supporto"
  | "aiuto"
  | "termini";

interface SettingsTile {
  id: TileId;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  color: string;
  glow: string;
}

const SETTINGS_TILE_IDS: TileId[] = [
  "profilo",
  "abbonamento",
  "pairs",
  "audio",
  "aspetto",
  "notifiche",
  "sicurezza",
  "lingua",
  "trading",
  "missioni",
  "citazioni",
  "checklist",
  "account",
  "biblioteca",
  "traguardi",
  "supporto",
  "aiuto",
  "termini",
];

function getRequestedSection(search: string): TileId | null {
  const requested = new URLSearchParams(search).get("section");
  return SETTINGS_TILE_IDS.includes(requested as TileId) ? (requested as TileId) : null;
}

export default function Settings() {
  const { isSignedIn, isLoaded } = useAuth();
  const { signOut } = useClerk();
  const { isPinSet } = usePinLock();
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const isAuthenticated = !!isSignedIn;
  const isLoading = !isLoaded;
  const login = () => navigate("/sign-in");
  const signup = () => navigate("/sign-up");
  const logout = () => {
    void signOut({ redirectUrl: "/" });
  };
  const searchString = useSearch();
  const requestedSection = getRequestedSection(searchString);
  const [activeDesktopSection, setActiveDesktopSection] =
    useState<TileId>(requestedSection ?? "audio");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    pairs: false,
    abbonamento: false,
    audio: false,
    aspetto: false,
    notifiche: false,
    sicurezza: false,
    lingua: false,
    trading: false,
    missioni: false,
    citazioni: false,
    checklist: false,
    account: false,
    biblioteca: false,
    traguardi: false,
    supporto: false,
    aiuto: false,
    termini: false,
    ...(requestedSection ? { [requestedSection]: true } : {}),
  });

  // Reagisce ai cambi di query string anche a componente già montato
  // (es. click sul badge Pro del TopNav mentre si è già su /settings).
  useEffect(() => {
    if (!requestedSection) return;
    setActiveDesktopSection(requestedSection);
    setOpenSections((prev) => (prev[requestedSection] ? prev : { ...prev, [requestedSection]: true }));
  }, [requestedSection]);

  const tiles: SettingsTile[] = [
    {
      id: "profilo",
      icon: <UserPlus className="w-6 h-6" />,
      label: t("settings.tile.profile"),
      subtitle: t("settings.tile.profile_sub"),
      color: "text-primary",
      glow: "group-hover:shadow-primary/20",
    },
    {
      id: "pairs",
      icon: <BarChart2 className="w-6 h-6" />,
      label: t("settings.tile.pairs"),
      subtitle: t("settings.tile.pairs_sub"),
      color: "text-indigo-400",
      glow: "group-hover:shadow-indigo-400/20",
    },
    {
      id: "abbonamento",
      icon: <Star className="w-6 h-6" />,
      label: "Abbonamento",
      subtitle: "Piano Pro, rinnovo e fatture",
      color: "text-primary",
      glow: "group-hover:shadow-primary/20",
    },
    {
      id: "audio",
      icon: <Music className="w-6 h-6" />,
      label: t("settings.tile.audio"),
      subtitle: t("settings.tile.audio_sub"),
      color: "text-blue-400",
      glow: "group-hover:shadow-blue-400/20",
    },
    {
      id: "aspetto",
      icon: <Sun className="w-6 h-6" />,
      label: t("settings.tile.appearance"),
      subtitle: t("settings.tile.appearance_sub"),
      color: "text-yellow-400",
      glow: "group-hover:shadow-yellow-400/20",
    },
    {
      id: "notifiche",
      icon: <Bell className="w-6 h-6" />,
      label: t("settings.tile.notifications"),
      subtitle: t("settings.tile.notifications_sub"),
      color: "text-orange-400",
      glow: "group-hover:shadow-orange-400/20",
    },
    {
      id: "sicurezza",
      icon: <Lock className="w-6 h-6" />,
      label: t("settings.tile.security"),
      subtitle: isPinSet
        ? t("settings.tile.security_active")
        : t("settings.tile.security_inactive"),
      color: "text-emerald-400",
      glow: "group-hover:shadow-emerald-400/20",
    },
    {
      id: "lingua",
      icon: <Globe className="w-6 h-6" />,
      label: t("settings.tile.language"),
      subtitle: `${LANGUAGES[language].flag} ${LANGUAGES[language].name}`,
      color: "text-cyan-400",
      glow: "group-hover:shadow-cyan-400/20",
    },
    {
      id: "trading",
      icon: <TrendingUp className="w-6 h-6" />,
      label: t("settings.tile.trading"),
      subtitle: t("settings.tile.trading_sub"),
      color: "text-violet-400",
      glow: "group-hover:shadow-violet-400/20",
    },
    {
      id: "missioni",
      icon: <Target className="w-6 h-6" />,
      label: t("settings.tile.missions"),
      subtitle: t("settings.tile.missions_sub"),
      color: "text-rose-400",
      glow: "group-hover:shadow-rose-400/20",
    },
    {
      id: "citazioni",
      icon: <Quote className="w-6 h-6" />,
      label: t("settings.tile.quotes"),
      subtitle: t("settings.tile.quotes_sub"),
      color: "text-amber-400",
      glow: "group-hover:shadow-amber-400/20",
    },
    {
      id: "checklist",
      icon: <CheckSquare className="w-6 h-6" />,
      label: t("settings.tile.checklist"),
      subtitle: t("settings.tile.checklist_sub"),
      color: "text-teal-400",
      glow: "group-hover:shadow-teal-400/20",
    },
    {
      id: "biblioteca",
      icon: <Library className="w-6 h-6" />,
      label: t("settings.tile.library"),
      subtitle: t("settings.tile.library_sub"),
      color: "text-primary",
      glow: "group-hover:shadow-primary/20",
    },
    {
      id: "traguardi",
      icon: <Trophy className="w-6 h-6" />,
      label: t("nav.milestones"),
      subtitle: "Certificati NFT e livelli sbloccati",
      color: "text-yellow-400",
      glow: "group-hover:shadow-yellow-400/20",
    },
    {
      id: "supporto",
      icon: <HelpCircle className="w-6 h-6" />,
      label: t("settings.tile.support"),
      subtitle: t("settings.tile.support_sub"),
      color: "text-sky-400",
      glow: "group-hover:shadow-sky-400/20",
    },
    {
      id: "aiuto",
      icon: <LifeBuoy className="w-6 h-6" />,
      label: "Aiuto",
      subtitle: "Guida rapida e tutorial",
      color: "text-purple-400",
      glow: "group-hover:shadow-purple-400/20",
    },
    {
      id: "termini",
      icon: <FileText className="w-6 h-6" />,
      label: "Termini & Condizioni",
      subtitle: "Privacy, licenza e disclaimer",
      color: "text-pink-400",
      glow: "group-hover:shadow-pink-400/20",
    },
    {
      id: "account",
      icon: isAuthenticated ? (
        <LogOut className="w-6 h-6" />
      ) : (
        <LogIn className="w-6 h-6" />
      ),
      label: t("settings.tile.account"),
      subtitle: isAuthenticated
        ? t("settings.tile.account_active")
        : t("settings.tile.account_inactive"),
      color: "text-slate-400",
      glow: "group-hover:shadow-slate-400/20",
    },
  ];

  const collapsibleSections = tiles.filter((tile) => tile.id !== "profilo");

  const tileContent: Record<TileId, React.ReactNode> = {
    profilo: <ProfileWidget />,
    abbonamento: <BillingSubscriptionPanel />,
    pairs: <PairPreferencesSettings />,
    audio: <AudioPlayer />,
    aspetto: (
      <div className="space-y-6">
        <FontSettings />
        <DarknessSettings />
        <BackgroundPresetsManager />
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => navigate("/?layout=edit")}
        >
          <LayoutGrid className="w-4 h-4" />
          Modifica layout dashboard
        </Button>
      </div>
    ),
    notifiche: <NotificationSettings />,
    sicurezza: (
      <div className="space-y-6">
        <PinSettings />
        <LoginAccessSection />
      </div>
    ),
    lingua: <LanguageSettings />,
    trading: <TradingSettings />,
    missioni: <MissionTemplatesSettings />,
    citazioni: <QuotesSettings />,
    checklist: <ChecklistSettings />,
    biblioteca: <RewardsLibrarySection />,
    traguardi: null,
    supporto: <SupportSection />,
    aiuto: <HelpSection />,
    termini: <TermsSection />,
    account: isAuthenticated ? (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("settings.account.logged_in")}
        </p>
        <Button
          onClick={logout}
          variant="outline"
          className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4 mr-2" /> {t("settings.account.logout")}
        </Button>
        <AccountExportSection />
        <AccountDeletionSection
          onDeleted={() => {
            void signOut({ redirectUrl: "/" });
          }}
        />
      </div>
    ) : !isLoading ? (
      <AuthSection login={login} signup={signup} />
    ) : (
      <p className="text-sm text-muted-foreground">
        {t("settings.account.loading")}
      </p>
    ),
  };

  return (
    <PageLayout>
      <PageHeader
        title={uiText("auto.ui.8f710ac6af")}
        subtitle={uiText("auto.ui.8d80245829")}
      />
      <div className="space-y-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-5 sm:p-6">
            <ProfileWidget />
          </div>
        </motion.div>

        <div className="hidden lg:flex gap-6">
          <div className="w-64 shrink-0 space-y-1 self-start sticky top-16">
            <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-2">
              {collapsibleSections.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() =>
                    tile.id === "traguardi"
                      ? navigate("/milestones")
                      : setActiveDesktopSection(tile.id)
                  }
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                    activeDesktopSection === tile.id
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-card/80 hover:text-foreground border border-transparent"
                  }`}
                >
                  <div
                    className={`${activeDesktopSection === tile.id ? tile.color : "text-muted-foreground"} shrink-0`}
                  >
                    {React.cloneElement(
                      tile.icon as React.ReactElement<{ className?: string }>,
                      { className: "w-4 h-4" },
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tile.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {tile.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDesktopSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className={
                        tiles.find((t) => t.id === activeDesktopSection)?.color
                      }
                    >
                      {tiles.find((t) => t.id === activeDesktopSection)?.icon}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">
                        {
                          tiles.find((t) => t.id === activeDesktopSection)
                            ?.label
                        }
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {
                          tiles.find((t) => t.id === activeDesktopSection)
                            ?.subtitle
                        }
                      </p>
                    </div>
                  </div>
                  {tileContent[activeDesktopSection]}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
          {collapsibleSections.map((tile, i) => (
            <motion.div
              key={tile.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (i + 1) * 0.05 }}
              className="space-y-2"
            >
              <button
                onClick={() =>
                  tile.id === "traguardi"
                    ? navigate("/milestones")
                    : setOpenSections((prev) => ({
                        ...prev,
                        [tile.id]: !prev[tile.id],
                      }))
                }
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card/60 backdrop-blur-sm hover:border-primary/30 hover:bg-card transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`${tile.color} transition-transform duration-200 group-hover:scale-110`}
                  >
                    {tile.icon}
                  </div>
                  <div className="text-left">
                    <h2 className="text-base font-bold">{tile.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {tile.subtitle}
                    </p>
                  </div>
                </div>
                {tile.id === "traguardi" ? (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                      openSections[tile.id] ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              <AnimatePresence>
                {openSections[tile.id] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-5 sm:p-6">
                      {tileContent[tile.id]}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
