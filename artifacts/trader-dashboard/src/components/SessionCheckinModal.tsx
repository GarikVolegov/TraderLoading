import { useState, useEffect, useMemo, useRef } from "react";
import { useBackground, type TradingSessionConfig } from "@/contexts/BackgroundContext";
import { useGetIdeas, useGetUserSettings, useCreateCheckin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Target, X } from "lucide-react";
import { MOOD_EMOJIS } from "@/lib/zenEmojis";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalClockHours, getLocalDateKey } from "@/lib/marketSessions";

function todayKey() {
  return getLocalDateKey();
}
function getCheckedSessions(): Set<string> {
  try {
    const raw = localStorage.getItem(`tl_checked_sessions_${todayKey()}`);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}
function markSessionChecked(name: string) {
  try {
    const s = getCheckedSessions();
    s.add(name);
    localStorage.setItem(`tl_checked_sessions_${todayKey()}`, JSON.stringify([...s]));
  } catch { /* ignore */ }
}

const MOODS = MOOD_EMOJIS;

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

function isInSession(localHours: number, session: TradingSessionConfig): boolean {
  const open = parseTime(session.openUTC);
  const close = parseTime(session.closeUTC);
  if (open < close) return localHours >= open && localHours < close;
  return localHours >= open || localHours < close;
}

const INIT = Symbol("init");

export function SessionCheckinModal() {
  const { tradingSessions } = useBackground();
  const { data: settings } = useGetUserSettings();
  const { data: ideas } = useGetIdeas();
  const createCheckin = useCreateCheckin();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [time, setTime] = useState(new Date());
  const prevSessionRef = useRef<string | null | typeof INIT>(INIT);
  const [visible, setVisible] = useState(false);
  const [currentSession, setCurrentSession] = useState<string>("");
  const [mood, setMood] = useState<string>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const activeSession = useMemo(() => {
    const localHours = getLocalClockHours(time);
    return tradingSessions.filter((s) => s.enabled).find((s) => isInSession(localHours, s)) || null;
  }, [time, tradingSessions]);

  useEffect(() => {
    const sessionName = activeSession?.name ?? null;
    const prev = prevSessionRef.current;

    const isFirstLoad = prev === INIT;
    const sessionChanged = !isFirstLoad && sessionName !== prev;

    if (sessionName && (isFirstLoad || sessionChanged)) {
      prevSessionRef.current = sessionName;
      const checked = getCheckedSessions();
      if (!checked.has(sessionName)) {
        setCurrentSession(sessionName);
        setMood("");
        setNote("");
        setVisible(true);
      }
    } else if (!sessionName && prev !== INIT) {
      prevSessionRef.current = null;
    } else if (isFirstLoad) {
      prevSessionRef.current = sessionName;
    }
  }, [activeSession]);

  const goals = ideas?.filter((i) => i.type === "goal" && !i.completed) ?? [];

  const handleSubmit = async () => {
    if (!mood) return;
    try {
      await createCheckin.mutateAsync({
        data: { mood, sessionName: currentSession, note: note || undefined },
      });
      markSessionChecked(currentSession);
      setVisible(false);
      toast({ description: t("checkin.saved") });
    } catch {
      toast({ description: t("checkin.error"), variant: "destructive" });
    }
  };

  const handleSkip = () => {
    markSessionChecked(currentSession);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-xl font-bold">{t("checkin.title")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("checkin.subtitle", { session: currentSession })}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t("checkin.mood_label")}</p>
          <div className="flex gap-2 flex-wrap">
            {MOODS.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={() => setMood(emoji)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-sm transition-all ${
                  mood === emoji
                    ? "border-primary bg-primary/10 scale-105"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {goals.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Target className="w-4 h-4 text-primary" />
              {t("checkin.goals_label")}
            </p>
            <ul className="space-y-1">
              {goals.slice(0, 3).map((g) => (
                <li key={g.id} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span className="line-clamp-1">{g.content}</span>
                </li>
              ))}
              {goals.length > 3 && (
                <li className="text-xs text-muted-foreground/60">
                  {t("checkin.more_goals", { n: goals.length - 3 })}
                </li>
              )}
            </ul>
          </div>
        )}

        {settings?.maxDailyLoss && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
            <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">
              {t("checkin.max_loss", { amount: settings.maxDailyLoss })}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("checkin.note_label")}</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("checkin.note_placeholder")}
            className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={!mood || createCheckin.isPending} className="flex-1">
            {t("checkin.start")}
          </Button>
          <Button variant="ghost" onClick={() => setVisible(false)}>
            {t("checkin.skip")}
          </Button>
        </div>
      </div>
    </div>
  );
}
