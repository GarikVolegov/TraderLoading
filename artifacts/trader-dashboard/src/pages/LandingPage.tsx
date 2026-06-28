import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calculator,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Crown,
  FlaskConical,
  Globe,
  Instagram,
  Link2,
  LineChart,
  Lock,
  Newspaper,
  Pause,
  Play,
  Plus,
  PlayCircle,
  Rocket,
  RotateCcw,
  Send,
  Sparkles,
  Star,
  Target,
  Trophy,
  Twitter,
  Users,
  X,
  Youtube,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PAIR_CATALOG } from "@workspace/pair-catalog";
import {
  LANGUAGES,
  useLanguage,
  type Language,
} from "@/contexts/LanguageContext";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { TOUR_SCENE_COUNT, initialTourState, tourReducer } from "@/lib/landingTour";
import { Seo } from "@/components/Seo";
import {
  absoluteUrl,
  faqJsonLd,
  landingAlternates,
  landingPath,
} from "@/lib/seo";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Real landing data (public, unauthenticated endpoints) ──────────────
interface PublicStats {
  traders: number;
  trades: number;
  pairs: number;
}
interface PublicTestimonial {
  id: number;
  name: string;
  role: string | null;
  text: string;
  rating: number;
}
interface LandingNewsArticle {
  title: string;
  impact: string;
  direction: string;
  currency: string;
  affectedPairs?: string[];
  primaryAssets?: string[];
}
interface LandingNewsData {
  articles: LandingNewsArticle[];
  summary?: string;
}

function usePublicStats() {
  return useQuery({
    queryKey: ["landing", "public-stats"],
    queryFn: () => fetchJSON<PublicStats>("/api/public/stats"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

function usePublicTestimonials() {
  return useQuery({
    queryKey: ["landing", "public-testimonials"],
    queryFn: () => fetchJSON<{ testimonials: PublicTestimonial[] }>("/api/public/testimonials"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

function useLandingNews(language: Language) {
  return useQuery({
    queryKey: ["landing", "macro-news", language],
    queryFn: () => fetchJSON<LandingNewsData>(`/api/tools/macro-news?lang=${language}`),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

const NEWS_IMPACT: Record<string, { key: string; color: string }> = {
  alto: { key: "landing.showcase.impact.high", color: "0 84% 60%" },
  medio: { key: "landing.showcase.impact.medium", color: "38 92% 50%" },
  basso: { key: "landing.showcase.impact.low", color: "142 71% 45%" },
};
const NEWS_DIRECTION: Record<string, { key: string; color: string }> = {
  bullish: { key: "landing.showcase.sentiment.bullish", color: "142 71% 45%" },
  bearish: { key: "landing.showcase.sentiment.bearish", color: "0 84% 60%" },
  neutrale: { key: "landing.showcase.sentiment.neutral", color: "38 92% 50%" },
};

/* ── Decorative color tones (no project token exists for these accents) ── */
const TONE = {
  green: "142 71% 45%",
  blue: "217 91% 60%",
  violet: "262 83% 65%",
  amber: "38 92% 50%",
  red: "0 84% 60%",
} as const;

const NUMBER_LOCALES: Record<Language, string> = {
  it: "it-IT",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
};

const NAV_LINKS = [
  { href: "#features", labelKey: "landing.nav.features" },
  { href: "#how", labelKey: "landing.nav.how" },
  { href: "#pricing", labelKey: "landing.nav.pricing" },
  { href: "#faq", labelKey: "landing.nav.faq" },
] as const;

const TRUST = [
  { icon: Check, labelKey: "landing.hero.trust.no_card" },
  { icon: Lock, labelKey: "landing.hero.trust.read_only" },
  { icon: Globe, labelKey: "landing.hero.trust.languages" },
] as const;

const FEATURES = [
  { icon: BookOpen, titleKey: "landing.features.journal.title", descKey: "landing.features.journal.desc", tone: TONE.green, big: true },
  { icon: Newspaper, titleKey: "landing.features.news.title", descKey: "landing.features.news.desc", tone: TONE.blue, big: false },
  { icon: Calculator, titleKey: "landing.features.risk.title", descKey: "landing.features.risk.desc", tone: TONE.green, big: false },
  { icon: FlaskConical, titleKey: "landing.features.backtest.title", descKey: "landing.features.backtest.desc", tone: TONE.violet, big: false },
  { icon: Brain, titleKey: "landing.features.discipline.title", descKey: "landing.features.discipline.desc", tone: TONE.amber, big: false },
  { icon: Users, titleKey: "landing.features.community.title", descKey: "landing.features.community.desc", tone: TONE.blue, big: false },
] as const;

const STEPS = [
  { n: "01", icon: Link2, titleKey: "landing.how.step1.title", descKey: "landing.how.step1.desc" },
  { n: "02", icon: LineChart, titleKey: "landing.how.step2.title", descKey: "landing.how.step2.desc" },
  { n: "03", icon: Trophy, titleKey: "landing.how.step3.title", descKey: "landing.how.step3.desc" },
] as const;

const FREE_ITEMS = [
  "landing.pricing.free.item1",
  "landing.pricing.free.item2",
  "landing.pricing.free.item3",
  "landing.pricing.free.item4",
] as const;

const PRO_ITEMS = [
  "landing.pricing.pro.item1",
  "landing.pricing.pro.item2",
  "landing.pricing.pro.item3",
  "landing.pricing.pro.item4",
] as const;

export const FAQ_ITEMS = [
  { questionKey: "landing.faq.free.question", answerKey: "landing.faq.free.answer" },
  { questionKey: "landing.faq.sync.question", answerKey: "landing.faq.sync.answer" },
  { questionKey: "landing.faq.safety.question", answerKey: "landing.faq.safety.answer" },
  { questionKey: "landing.faq.difference.question", answerKey: "landing.faq.difference.answer" },
  { questionKey: "landing.faq.install.question", answerKey: "landing.faq.install.answer" },
] as const;

const FOOTER_COLS = [
  {
    titleKey: "landing.footer.col.product",
    items: [
      { labelKey: "landing.footer.product.diary", href: "/trading-journal" },
      { labelKey: "landing.footer.product.news", href: "/macro-news" },
      { labelKey: "landing.footer.product.backtest", href: "/backtesting" },
      { labelKey: "landing.footer.product.risk", href: "/risk-management" },
      { labelKey: "landing.footer.product.pricing", href: "/pricing" },
    ],
  },
  {
    titleKey: "landing.footer.col.resources",
    items: [
      { labelKey: "landing.footer.resources.guide", href: "/guide" },
      { labelKey: "landing.footer.resources.blog", href: "/guide" },
      { labelKey: "landing.footer.resources.community", href: "/sign-up" },
      { labelKey: "landing.footer.resources.status", href: "/guide" },
    ],
  },
  {
    titleKey: "landing.footer.col.company",
    items: [
      { labelKey: "landing.footer.company.about", href: "/about" },
      { labelKey: "landing.footer.company.contact", href: "/contact" },
      { labelKey: "landing.footer.privacy", href: "/privacy" },
      { labelKey: "landing.footer.terms", href: "/terms" },
    ],
  },
] as const;

const SOCIALS = [Twitter, Instagram, Youtube, Send];

/* ── Helpers ───────────────────────────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const { language } = useLanguage();
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const duration = 1500;
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setN(value * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return (
    <span ref={ref}>
      {n.toLocaleString(NUMBER_LOCALES[language], {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-primary">
      <span className="h-px w-4 bg-primary/60" />
      {children}
    </span>
  );
}

/* ── Live market session (self-contained, pre-auth safe) ───────────── */

type SessionKey = "sydney" | "tokyo" | "london" | "newyork" | "closed";

function getActiveSession(date: Date): SessionKey {
  const day = date.getUTCDay();
  const h = date.getUTCHours() + date.getUTCMinutes() / 60;
  // Forex week: closed Fri 22:00 UTC → Sun 22:00 UTC.
  const closed = (day === 5 && h >= 22) || day === 6 || (day === 0 && h < 22);
  if (closed) return "closed";
  const inWindow = (open: number, close: number) =>
    open < close ? h >= open && h < close : h >= open || h < close;
  if (inWindow(8, 17)) return "london";
  if (inWindow(13, 22)) return "newyork";
  if (inWindow(0, 9)) return "tokyo";
  if (inWindow(22, 7)) return "sydney";
  return "newyork";
}

const SESSION_COLOR: Record<SessionKey, string> = {
  london: "var(--session-london)",
  newyork: "var(--session-ny)",
  tokyo: "var(--session-asian)",
  sydney: "var(--session-asian)",
  closed: TONE.red,
};

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* ── Hero product mock (live clock + real session, illustrative KPIs) ── */

const MOCK_EQUITY = [0, 6, 3, 9, 7, 13, 11, 18, 15, 22, 26, 23, 30, 34];

function MockSpark() {
  const w = 230;
  const h = 56;
  const p = 4;
  const max = Math.max(...MOCK_EQUITY);
  const min = Math.min(...MOCK_EQUITY);
  const pts = MOCK_EQUITY.map((v, i) => [
    p + (i / (MOCK_EQUITY.length - 1)) * (w - p * 2),
    h - p - ((v - min) / (max - min || 1)) * (h - p * 2),
  ]);
  const line = pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="ms" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(${TONE.green})`} stopOpacity="0.35" />
          <stop offset="100%" stopColor={`hsl(${TONE.green})`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ms)" />
      <path d={line} fill="none" stroke={`hsl(${TONE.green})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Product tour (in-place self-playing walkthrough) ──────────────── */

const TOUR_SCENE_DURATION_MS = 3400;
const tile = "rounded-xl border border-border/50 bg-secondary/50 px-3 py-2.5";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function TourSceneEdge() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { k: "landing.features.edge.win_rate", v: "64%" },
          { k: "landing.features.edge.expectancy", v: "+0.42R" },
          { k: "landing.features.edge.profit_factor", v: "1.9" },
        ].map((m) => (
          <div key={m.k} className={`${tile} text-center`}>
            <div className="text-[9px] uppercase tracking-[0.07em] text-muted-foreground/80">{t(m.k)}</div>
            <div className="font-mono text-base font-bold" style={{ color: `hsl(${TONE.green})` }}>{m.v}</div>
          </div>
        ))}
      </div>
      <div className={tile}>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground">{"Equity"}</span>
          <span className="font-mono text-[11px] font-bold" style={{ color: `hsl(${TONE.green})` }}>{"+8.6R"}</span>
        </div>
        <MockSpark />
      </div>
    </div>
  );
}

function TourSceneMissions() {
  const { t } = useLanguage();
  return (
    <div className={tile}>
      <div className="mb-2 flex items-center gap-1.5">
        <Target className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-foreground">{t("landing.mock.missions")}</span>
        <span className="ml-auto font-mono text-[10px] font-bold text-primary">{"+75 XP"}</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300" style={{ width: "72%" }} />
      </div>
      {[
        { k: "landing.mock.journaling", done: false },
        { k: "landing.mock.checkin", done: true },
      ].map((m) => (
        <div
          key={m.k}
          className={`mt-1.5 flex items-center gap-2 text-[12px] ${m.done ? "text-muted-foreground/60" : "text-foreground"}`}
        >
          {m.done ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
          {t(m.k)}
        </div>
      ))}
    </div>
  );
}

function TourSceneNews() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2.5">
        <Newspaper className="h-4 w-4 shrink-0 text-primary" />
        <p className="m-0 line-clamp-2 text-[12.5px] leading-snug text-foreground/90">{t("landing.tour.s3_sub")}</p>
      </div>
      {[
        { title: "FOMC", color: TONE.green },
        { title: "CPI", color: TONE.red },
      ].map((n) => (
        <div key={n.title} className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-card/50 p-3">
          <div className="flex gap-1.5">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{ color: `hsl(${n.color})`, background: `hsl(${n.color} / 0.12)`, border: `1px solid hsl(${n.color} / 0.3)` }}
            >
              {n.title}
            </span>
          </div>
          <div className="h-2 w-3/4 rounded bg-muted-foreground/15" />
          <div className="h-2 w-1/2 rounded bg-muted-foreground/10" />
        </div>
      ))}
    </div>
  );
}

function TourSceneLive() {
  const { t } = useLanguage();
  const now = useLiveClock();
  const session = getActiveSession(now);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative flex items-center justify-between overflow-hidden rounded-xl border border-border/50 bg-card/60 px-3 py-2.5">
        <span className="absolute inset-x-0 top-0 h-0.5 bg-primary shadow-[0_0_14px_hsl(var(--primary))]" />
        <span className="font-sans text-[22px] font-bold tabular-nums text-foreground">{format(now, "HH:mm:ss")}</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold"
          style={{ color: `hsl(${SESSION_COLOR[session]})`, background: `hsl(${SESSION_COLOR[session]} / 0.12)`, borderColor: `hsl(${SESSION_COLOR[session]} / 0.3)` }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: `hsl(${SESSION_COLOR[session]})` }} />
          {t(`landing.session.${session}`)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {["landing.session.london", "landing.session.newyork", "landing.session.tokyo"].map((k) => (
          <div key={k} className={`${tile} text-center`}>
            <div className="mx-auto mb-1 h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: `hsl(${TONE.green})` }} />
            <div className="text-[10px] font-semibold text-muted-foreground">{t(k)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TourPlayer({ onExit }: { onExit: () => void }) {
  const { t } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const [state, dispatch] = useReducer(tourReducer, initialTourState);

  const scenes = [
    { node: <TourSceneEdge />, title: "landing.tour.s1_title", sub: "landing.tour.s1_sub" },
    { node: <TourSceneMissions />, title: "landing.tour.s2_title", sub: "landing.tour.s2_sub" },
    { node: <TourSceneNews />, title: "landing.tour.s3_title", sub: "landing.tour.s3_sub" },
    { node: <TourSceneLive />, title: "landing.tour.s4_title", sub: "landing.tour.s4_sub" },
  ];

  // auto-advance while playing
  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setTimeout(() => dispatch({ type: "tick" }), TOUR_SCENE_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [state.status, state.index]);

  // Esc exits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const ended = state.status === "ended";
  const scene = scenes[state.index];
  const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
  const motionProps = reduced
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.4, ease },
      };

  return (
    <div className="flex flex-col" role="group" aria-label={t("landing.tour.aria_region")}>
      {/* segmented progress */}
      <div className="flex gap-1 px-3.5 pt-3">
        {Array.from({ length: TOUR_SCENE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => dispatch({ type: "goto", index: i })}
            aria-label={`${t("landing.tour.ctrl_next")} ${i + 1}`}
            className="h-1 flex-1 overflow-hidden rounded-full bg-secondary"
          >
            <span
              className="block h-full rounded-full bg-primary transition-all"
              style={{ width: i <= state.index || ended ? "100%" : "0%", opacity: i <= state.index || ended ? 1 : 0.25 }}
            />
          </button>
        ))}
      </div>

      {/* stage */}
      <div className="relative min-h-[228px] p-3.5">
        <AnimatePresence mode="wait">
          {ended ? (
            <motion.div key="end" {...motionProps} className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
              <Rocket className="h-9 w-9 text-primary" />
              <h3 className="font-mono text-lg font-bold text-foreground">{t("landing.tour.end_title")}</h3>
              <p className="max-w-[260px] text-[13px] text-muted-foreground">{t("landing.tour.end_sub")}</p>
              <Link
                href="/sign-up"
                className="mt-1 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_0_28px_hsl(var(--primary)/0.34)]"
              >
                {t("landing.tour.end_cta")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ) : (
            <motion.div key={state.index} {...motionProps}>
              {scene.node}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* caption + controls */}
      <div className="border-t border-border/40 px-3.5 py-3">
        {!ended && (
          <div className="mb-2.5 min-h-[44px]">
            <div className="text-[13px] font-bold text-foreground">{t(scene.title)}</div>
            <div className="text-[11.5px] leading-snug text-muted-foreground">{t(scene.sub)}</div>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => dispatch({ type: "prev" })}
            aria-label={t("landing.tour.ctrl_prev")}
            className="rounded-lg border border-border/50 p-1.5 text-foreground transition-colors hover:border-primary/40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {ended ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "replay" })}
              aria-label={t("landing.tour.ctrl_replay")}
              className="rounded-lg border border-border/50 p-1.5 text-foreground transition-colors hover:border-primary/40"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          ) : state.status === "playing" ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "pause" })}
              aria-label={t("landing.tour.ctrl_pause")}
              className="rounded-lg border border-border/50 p-1.5 text-foreground transition-colors hover:border-primary/40"
            >
              <Pause className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => dispatch({ type: "resume" })}
              aria-label={t("landing.tour.ctrl_play")}
              className="rounded-lg border border-border/50 p-1.5 text-foreground transition-colors hover:border-primary/40"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: "next" })}
            aria-label={t("landing.tour.ctrl_next")}
            className="rounded-lg border border-border/50 p-1.5 text-foreground transition-colors hover:border-primary/40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onExit}
            aria-label={t("landing.tour.ctrl_close")}
            className="ml-auto rounded-lg border border-border/50 p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductPreview({
  playing,
  onPlay,
  onExit,
}: {
  playing: boolean;
  onPlay: () => void;
  onExit: () => void;
}) {
  const { t } = useLanguage();
  const now = useLiveClock();
  const session = getActiveSession(now);

  const kpis: Array<{ labelKey: string; value: string; color: string }> = [
    { labelKey: "landing.features.edge.win_rate", value: "64%", color: `hsl(${TONE.green})` },
    { labelKey: "landing.mock.level", value: "12", color: "hsl(var(--foreground))" },
  ];

  return (
    <div className="animate-float [perspective:1200px]">
      <div className="overflow-hidden rounded-[18px] border border-border/60 bg-card/[0.86] shadow-[0_40px_90px_rgba(0,0,0,0.55),0_0_60px_hsl(var(--primary)/0.05)] backdrop-blur-md">
        {/* window bar */}
        <div className="flex items-center gap-1.5 border-b border-border/40 px-3.5 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${TONE.red})` }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${TONE.amber})` }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${TONE.green})` }} />
          <span className="ml-2 font-mono text-[11px] text-muted-foreground/70">{"app.traderloading.com"}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
            {"Live"}
          </span>
        </div>
        {playing ? (
          <TourPlayer onExit={onExit} />
        ) : (
          <div className="relative">
            <div className="flex flex-col gap-2.5 p-3.5">
          {/* live clock + session */}
          <div className="relative flex items-center justify-between overflow-hidden rounded-xl border border-border/50 bg-card/60 px-3 py-2.5">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-primary shadow-[0_0_14px_hsl(var(--primary))]" />
            <span className="font-sans text-[22px] font-bold tabular-nums text-foreground">
              {format(now, "HH:mm:ss")}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold"
              style={{
                color: `hsl(${SESSION_COLOR[session]})`,
                background: `hsl(${SESSION_COLOR[session]} / 0.12)`,
                borderColor: `hsl(${SESSION_COLOR[session]} / 0.3)`,
              }}
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ background: `hsl(${SESSION_COLOR[session]})` }}
              />
              {t(`landing.session.${session}`)}
            </span>
          </div>
          {/* equity + missions */}
          <div className="grid grid-cols-[1.3fr_1fr] gap-2.5">
            <div className={tile}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground">{"Equity"}</span>
                <span className="font-mono text-[11px] font-bold" style={{ color: `hsl(${TONE.green})` }}>{"+8.6R"}</span>
              </div>
              <MockSpark />
            </div>
            <div className={tile}>
              <div className="mb-2 flex items-center gap-1.5">
                <Target className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-semibold text-foreground">{t("landing.mock.missions")}</span>
                <span className="ml-auto font-mono text-[9px] font-bold text-primary">{"+75 XP"}</span>
              </div>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300" style={{ width: "72%" }} />
              </div>
              {[
                { labelKey: "landing.mock.journaling", done: false },
                { labelKey: "landing.mock.checkin", done: true },
              ].map((m) => (
                <div
                  key={m.labelKey}
                  className={`mt-1 flex items-center gap-1.5 text-[10px] ${m.done ? "text-muted-foreground/60" : "text-foreground"}`}
                >
                  {m.done ? (
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                  ) : (
                    <Circle className="h-3 w-3 text-muted-foreground/40" />
                  )}
                  {t(m.labelKey)}
                </div>
              ))}
            </div>
          </div>
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className={`${tile} text-center`}>
              <div className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground/80">{"P&L"}</div>
              <div className="font-mono text-lg font-bold tabular-nums" style={{ color: `hsl(${TONE.green})` }}>{"+24.6R"}</div>
            </div>
            {kpis.map((k) => (
              <div key={k.labelKey} className={`${tile} text-center`}>
                <div className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground/80">{t(k.labelKey)}</div>
                <div className="font-mono text-lg font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
            </div>
            <button
              type="button"
              onClick={onPlay}
              className="group absolute inset-0 flex items-center justify-center bg-background/0 transition-colors hover:bg-background/30"
              aria-label={t("landing.tour.idle_play")}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/80 px-4 py-2 text-[13px] font-semibold text-foreground opacity-0 shadow-[0_0_30px_hsl(var(--primary)/0.25)] backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                <Play className="h-4 w-4 fill-primary text-primary" />
                {t("landing.tour.idle_play")}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Showcase visuals ──────────────────────────────────────────────── */

function GlassPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-border/[0.55] bg-card/60 p-5 shadow-[0_30px_70px_rgba(0,0,0,0.4)] backdrop-blur-md">
      {children}
    </div>
  );
}

function NewsVisual() {
  const { t, language } = useLanguage();
  const { data } = useLandingNews(language);
  const articles = (data?.articles ?? []).slice(0, 2);
  const summary = data?.summary || t("landing.showcase.news.summary");
  return (
    <GlassPanel>
      <div className="mb-3 flex gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2.5">
        <Newspaper className="h-4 w-4 shrink-0 text-primary" />
        <p className="m-0 line-clamp-3 text-[13px] leading-snug text-foreground/90">{summary}</p>
      </div>
      {articles.length === 0 ? (
        <p className="m-0 px-1 py-2 text-[12px] text-muted-foreground">{t("landing.showcase.news.empty")}</p>
      ) : (
        articles.map((a, i) => {
          const imp = NEWS_IMPACT[a.impact] ?? NEWS_IMPACT.medio;
          const dir = NEWS_DIRECTION[a.direction] ?? NEWS_DIRECTION.neutrale;
          const pairs = (
            a.affectedPairs?.length ? a.affectedPairs : a.primaryAssets?.length ? a.primaryAssets : [a.currency]
          )
            .filter(Boolean)
            .slice(0, 3);
          return (
            <div key={i} className="mb-2.5 flex flex-col gap-1.5 rounded-xl border border-border/50 bg-card/50 p-3 last:mb-0">
              <div className="flex gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ color: `hsl(${imp.color})`, background: `hsl(${imp.color} / 0.12)`, border: `1px solid hsl(${imp.color} / 0.3)` }}
                >
                  {t(imp.key)}
                </span>
                <span
                  className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                  style={{ color: `hsl(${dir.color})`, background: `hsl(${dir.color} / 0.1)`, border: `1px solid hsl(${dir.color} / 0.25)` }}
                >
                  {t(dir.key)}
                </span>
              </div>
              <p className="m-0 line-clamp-2 text-[13.5px] font-semibold text-foreground">{a.title}</p>
              <div className="flex gap-1.5">
                {pairs.map((p) => (
                  <span key={p} className="rounded px-1.5 py-px font-mono text-[9px] font-bold text-primary" style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.25)" }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          );
        })
      )}
    </GlassPanel>
  );
}

function BacktestVisual() {
  const { t } = useLanguage();
  const timeframes = ["M15", "H1", "H4"];
  const candles = [40, 62, 54, 78, 72, 90, 84, 100, 116, 108, 130, 122, 144, 138];
  return (
    <GlassPanel>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-base font-bold text-foreground">{"XAU/USD"}</span>
        <div className="flex gap-1">
          {timeframes.map((tf, i) => (
            <span
              key={tf}
              className={`rounded-md px-2 py-1 font-mono text-[11px] font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground"}`}
            >
              {tf}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 360 130" width="100%" height="130" preserveAspectRatio="none" className="mb-3 block" aria-hidden="true">
        {candles.map((c, i) => {
          const x = i * 26 + 14;
          const up = i % 2 === 0;
          const col = up ? `hsl(${TONE.green})` : `hsl(${TONE.red})`;
          const high = c;
          const low = c - 26;
          const o = up ? low + 6 : high - 6;
          const cl = up ? high - 4 : low + 4;
          const bt = 130 - Math.max(o, cl);
          const bb = 130 - Math.min(o, cl);
          return (
            <g key={i}>
              <line x1={x} y1={130 - high} x2={x} y2={130 - low} stroke={col} strokeWidth="1.5" />
              <rect x={x - 6} y={bt} width="12" height={Math.max(2, bb - bt)} fill={col} rx="1.5" />
            </g>
          );
        })}
      </svg>
      <div className="flex gap-2.5">
        <div className="flex-1 rounded-[10px] py-2.5 text-center text-[13px] font-bold" style={{ color: `hsl(${TONE.green})`, background: `hsl(${TONE.green} / 0.1)`, border: `1px solid hsl(${TONE.green} / 0.4)` }}>
          {t("landing.showcase.backtest.buy")}
        </div>
        <div className="flex-1 rounded-[10px] py-2.5 text-center text-[13px] font-bold" style={{ color: `hsl(${TONE.red})`, background: `hsl(${TONE.red} / 0.1)`, border: `1px solid hsl(${TONE.red} / 0.4)` }}>
          {t("landing.showcase.backtest.sell")}
        </div>
      </div>
    </GlassPanel>
  );
}

function DisciplineVisual() {
  const { t } = useLanguage();
  const missions = [
    { labelKey: "landing.showcase.discipline.m1", done: true, xp: "+75" },
    { labelKey: "landing.showcase.discipline.m2", done: true, xp: "+40" },
    { labelKey: "landing.showcase.discipline.m3", done: false, xp: "+60" },
  ];
  return (
    <GlassPanel>
      <div className="mb-4 flex items-center gap-3.5">
        <div className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <span className="text-[8px] uppercase text-primary/70">{t("landing.mock.level")}</span>
          <span className="font-mono text-2xl font-bold text-primary">{"12"}</span>
        </div>
        <div className="flex-1">
          <p className="mb-1.5 text-sm font-bold text-foreground">{t("landing.showcase.discipline.badge")}</p>
          <div className="h-[7px] overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-gradient-to-r from-primary to-emerald-300" style={{ width: "72%" }} />
          </div>
        </div>
      </div>
      {missions.map((m) => (
        <div key={m.labelKey} className="flex items-center gap-2.5 border-t border-border/30 py-2.5">
          {m.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
          <span className={`flex-1 text-[13px] ${m.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{t(m.labelKey)}</span>
          <span className="rounded-md bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{`${m.xp} XP`}</span>
        </div>
      ))}
    </GlassPanel>
  );
}

function ShowcaseRow({
  flip,
  eyebrowKey,
  titleKey,
  descKey,
  points,
  children,
}: {
  flip?: boolean;
  eyebrowKey: string;
  titleKey: string;
  descKey: string;
  points: readonly string[];
  children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className={`flex flex-col items-center gap-12 lg:gap-[50px] ${flip ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
      <Reveal className="flex-1">
        <Eyebrow>{t(eyebrowKey)}</Eyebrow>
        <h3 className="mt-3.5 font-mono text-[28px] font-extrabold leading-tight tracking-tight text-foreground sm:text-[32px]">
          {t(titleKey)}
        </h3>
        <p className="mt-3.5 text-[17px] leading-relaxed text-muted-foreground">{t(descKey)}</p>
        <ul className="mt-5 flex flex-col gap-3">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-3 text-[15px] text-foreground">
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-primary/[0.12] text-primary">
                <Check className="h-3 w-3" />
              </span>
              {t(p)}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={0.1} className="w-full flex-1">
        {children}
      </Reveal>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const [solid, setSolid] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(false);
  const { data: stats } = usePublicStats();
  const { data: testimonialsData } = usePublicTestimonials();
  const testimonials = testimonialsData?.testimonials ?? [];

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const faqSchema = faqJsonLd(
    language,
    FAQ_ITEMS.map(({ questionKey, answerKey }) => ({
      question: t(questionKey),
      answer: t(answerKey),
    })),
  );

  return (
    <div className="relative min-h-screen scroll-smooth bg-background text-foreground">
      <Seo
        title={t("landing.meta.title")}
        description={t("landing.meta.description")}
        keywords={t("landing.meta.keywords")}
        lang={language}
        canonical={absoluteUrl(landingPath(language))}
        alternates={landingAlternates()}
        jsonLd={[faqSchema]}
      />
      {/* animated background orbs — fixed layer that clips itself */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="animate-float absolute -right-[6%] -top-[12%] h-[620px] w-[620px] rounded-full blur-[130px]" style={{ background: `hsl(${TONE.green} / 0.16)` }} />
        <div className="animate-float absolute -left-[10%] top-[26%] h-[520px] w-[520px] rounded-full blur-[120px]" style={{ background: `hsl(${TONE.blue} / 0.14)` }} />
        <div className="animate-float absolute -bottom-[18%] left-[40%] h-[560px] w-[560px] rounded-full blur-[140px]" style={{ background: `hsl(${TONE.violet} / 0.1)` }} />
      </div>

      {/* ── NAV — position:fixed so it stays pinned even though body has
          overflow-x:hidden (which would break position:sticky) ──────────── */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="mx-auto w-full max-w-6xl rounded-full bg-gradient-to-r from-primary/15 via-white/10 to-blue-500/10 p-px shadow-[0_0_36px_rgba(34,197,94,0.16),0_24px_70px_rgba(0,0,0,0.55)]">
          <div className={`relative flex min-h-16 items-center justify-between gap-3 overflow-hidden rounded-full border border-white/20 px-3 py-2 backdrop-blur-[30px] transition-colors sm:px-5 ${solid ? "bg-background/80" : "bg-background/55"}`}>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.13)_34%,transparent_43%)] opacity-80" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-blue-500/10 via-transparent to-primary/10" />
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />

            <div className="relative z-10 flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_18px_rgba(34,197,94,0.12)]">
                <Rocket className="h-[18px] w-[18px]" />
              </span>
              <span className="hidden whitespace-nowrap font-mono text-base font-bold tracking-tight text-foreground min-[380px]:inline sm:text-lg">
                TraderLoading
              </span>
            </div>

            <nav className="relative z-10 hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
                  {t(l.labelKey)}
                </a>
              ))}
            </nav>

            <div className="relative z-10 flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              <button
                onClick={() => setLocation("/sign-in")}
                className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground sm:block"
              >
                {t("landing.nav.sign_in")}
              </button>
              <label className="sr-only" htmlFor="landing-language">{t("landing.language.label")}</label>
              <select
                id="landing-language"
                value={language}
                onChange={(event) => {
                  const next = event.target.value as Language;
                  setLanguage(next);
                  setLocation(landingPath(next));
                }}
                className="h-9 cursor-pointer appearance-none rounded-full border border-white/20 bg-card/60 px-3 text-center text-xs font-bold text-foreground outline-none transition-colors hover:border-primary/40 focus:border-primary"
                aria-label={t("landing.language.label")}
              >
                {Object.entries(LANGUAGES).map(([code, config]) => (
                  <option key={code} value={code}>{config.label}</option>
                ))}
              </select>
              <button
                onClick={() => setLocation("/sign-up")}
                className="whitespace-nowrap rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_0_22px_rgba(34,197,94,0.24)] transition-colors hover:bg-primary/90 sm:px-6"
              >
                {t("landing.nav.get_started")}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO (pt clears the fixed nav) ──────────────────────────── */}
      <main className="relative z-10 px-4 pb-16 pt-32 sm:px-6 sm:pb-20 sm:pt-44">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 sm:gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <h1 className="mb-5 text-center font-mono text-[30px] font-extrabold leading-[1.08] tracking-tight text-foreground min-[400px]:text-[34px] sm:text-5xl lg:text-6xl">
              {t("landing.hero.title_a")}
              <br className="hidden sm:block" />{" "}
              <span className="bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                {t("landing.hero.title_b")}
              </span>
            </h1>
            <p className="mb-8 max-w-[540px] text-[17px] leading-relaxed text-muted-foreground sm:text-xl">
              {t("landing.hero.subtitle")}
            </p>
            <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-3.5">
              <button
                onClick={() => setLocation("/sign-up")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground shadow-[0_0_34px_rgba(34,197,94,0.34)] transition-transform hover:-translate-y-0.5 sm:w-auto"
              >
                {t("landing.hero.start_free")}
                <ArrowRight className="h-[18px] w-[18px]" />
              </button>
              <button
                onClick={() => setTourPlaying(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/50 px-6 py-3.5 text-base font-medium text-foreground backdrop-blur-sm transition-colors hover:border-primary/40 sm:w-auto"
              >
                <PlayCircle className="h-[18px] w-[18px]" />
                {t("landing.tour.cta_button")}
              </button>
            </div>
            <div className="mb-8 flex justify-center">
              <a
                href="#features"
                className="group inline-flex rounded-full bg-gradient-to-r from-primary/45 via-primary/15 to-blue-500/35 p-px shadow-[0_0_30px_rgba(34,197,94,0.16)] transition-shadow hover:shadow-[0_0_42px_rgba(34,197,94,0.28)]"
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-[12.5px] font-semibold text-foreground backdrop-blur-md">
                  <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {t("landing.hero.badge")}
                  <ArrowRight
                    className="h-3.5 w-3.5 text-primary transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13.5px] text-muted-foreground">
              {TRUST.map(({ icon: Icon, labelKey }) => (
                <span key={labelKey} className="inline-flex items-center gap-1.5">
                  <Icon className="h-[15px] w-[15px] text-primary" />
                  {t(labelKey)}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.12} y={36}>
            <ProductPreview
              playing={tourPlaying}
              onPlay={() => setTourPlaying(true)}
              onExit={() => setTourPlaying(false)}
            />
          </Reveal>
        </div>
      </main>

      {/* ── STATS (real, from /api/public/stats + pair catalog + langs) ── */}
      <section className="relative z-10 px-4 pb-9 sm:px-6">
        <Reveal className="mx-auto w-full max-w-6xl">
          <div className="grid grid-cols-2 gap-4 rounded-[20px] border border-border/50 bg-card/40 px-4 py-6 backdrop-blur-md sm:px-6 sm:py-7 md:grid-cols-4">
            {[
              { value: stats?.traders ?? 0, labelKey: "landing.stats.traders" },
              { value: stats?.trades ?? 0, labelKey: "landing.stats.journaled" },
              { value: stats?.pairs ?? PAIR_CATALOG.length, labelKey: "landing.stats.pairs" },
              { value: SUPPORTED_LANGUAGES.length, labelKey: "landing.stats.languages" },
            ].map((s) => (
              <div key={s.labelKey} className="text-center">
                <div className="font-mono text-[28px] font-extrabold sm:text-[34px] tracking-tight text-foreground">
                  <CountUp value={s.value} />
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground">{t(s.labelKey)}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── FEATURES (bento) ────────────────────────────────────────── */}
      <section id="features" className="relative z-10 scroll-mt-24 px-4 py-14 sm:px-6 sm:py-[70px]">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal className="mb-10 max-w-[620px]">
            <Eyebrow>{t("landing.features.eyebrow")}</Eyebrow>
            <h2 className="mt-3.5 font-mono text-[28px] sm:text-[40px] font-extrabold leading-tight tracking-tight text-foreground">
              {t("landing.features.title")}
            </h2>
            <p className="mt-3.5 text-[17px] leading-relaxed text-muted-foreground">{t("landing.features.lede")}</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-[18px] sm:auto-rows-[1fr] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, titleKey, descKey, tone, big }, i) => (
              <Reveal
                key={titleKey}
                delay={(i % 3) * 0.06}
                className={big ? "sm:col-span-2 sm:row-span-2" : ""}
              >
                <div className="group flex h-full flex-col gap-3.5 rounded-[20px] border border-border/50 bg-card/50 p-5 sm:p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-[14px]"
                    style={{ background: `hsl(${tone} / 0.12)`, border: `1px solid hsl(${tone} / 0.25)`, color: `hsl(${tone})` } as CSSProperties}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className={`font-mono font-bold tracking-tight text-foreground ${big ? "text-2xl" : "text-lg"}`}>{t(titleKey)}</h3>
                  <p className={`leading-relaxed text-muted-foreground ${big ? "text-base" : "text-sm"}`}>{t(descKey)}</p>
                  {big && (
                    <div className="mt-auto pt-4">
                      <div className="mb-3 flex gap-2.5">
                        {[
                          { labelKey: "landing.features.edge.win_rate", value: "64%" },
                          { labelKey: "landing.features.edge.expectancy", value: "+0.42R" },
                          { labelKey: "landing.features.edge.profit_factor", value: "1.9" },
                        ].map((e) => (
                          <div key={e.labelKey} className="flex-1 rounded-xl border border-border/50 bg-secondary/50 px-2 py-2.5 text-center">
                            <div className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground/80">{t(e.labelKey)}</div>
                            <div className="font-mono text-base font-bold" style={{ color: `hsl(${TONE.green})` }}>{e.value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-border/50 bg-secondary/40 px-3 py-2.5">
                        <MockSpark />
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section id="how" className="relative z-10 scroll-mt-24 px-4 py-14 sm:px-6 sm:py-[70px]">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal className="mx-auto mb-12 max-w-[620px] text-center">
            <Eyebrow>{t("landing.how.eyebrow")}</Eyebrow>
            <h2 className="mt-3.5 font-mono text-[28px] sm:text-[40px] font-extrabold leading-tight tracking-tight text-foreground">{t("landing.how.title")}</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
            {STEPS.map(({ n, icon: Icon, titleKey, descKey }, i) => (
              <Reveal key={n} delay={i * 0.08}>
                <div className="h-full rounded-[20px] border border-border/50 bg-card/[0.45] p-5 sm:p-7 backdrop-blur-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[13px] border border-primary/[0.22] bg-primary/10 text-primary">
                      <Icon className="h-[22px] w-[22px]" />
                    </span>
                    <span className="font-mono text-[28px] font-extrabold sm:text-[34px] text-primary/[0.18]">{n}</span>
                  </div>
                  <h3 className="mb-2.5 font-mono text-lg font-bold tracking-tight text-foreground">{t(titleKey)}</h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{t(descKey)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SHOWCASE ────────────────────────────────────────────────── */}
      <section className="relative z-10 px-4 py-12 sm:px-6 sm:py-14">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 sm:gap-[72px]">
          <ShowcaseRow
            flip
            eyebrowKey="landing.showcase.news.eyebrow"
            titleKey="landing.showcase.news.title"
            descKey="landing.showcase.news.desc"
            points={["landing.showcase.news.point1", "landing.showcase.news.point2", "landing.showcase.news.point3"]}
          >
            <NewsVisual />
          </ShowcaseRow>
          <ShowcaseRow
            eyebrowKey="landing.showcase.backtest.eyebrow"
            titleKey="landing.showcase.backtest.title"
            descKey="landing.showcase.backtest.desc"
            points={["landing.showcase.backtest.point1", "landing.showcase.backtest.point2", "landing.showcase.backtest.point3"]}
          >
            <BacktestVisual />
          </ShowcaseRow>
          <ShowcaseRow
            flip
            eyebrowKey="landing.showcase.discipline.eyebrow"
            titleKey="landing.showcase.discipline.title"
            descKey="landing.showcase.discipline.desc"
            points={["landing.showcase.discipline.point1", "landing.showcase.discipline.point2", "landing.showcase.discipline.point3"]}
          >
            <DisciplineVisual />
          </ShowcaseRow>
        </div>
      </section>

      {/* ── TESTIMONIALS (real, from /api/public/testimonials; hidden if none) ── */}
      {testimonials.length > 0 && (
        <section className="relative z-10 px-4 py-14 sm:px-6 sm:py-[70px]">
          <div className="mx-auto w-full max-w-6xl">
            <Reveal className="mx-auto mb-11 max-w-[620px] text-center">
              <Eyebrow>{t("landing.testimonials.eyebrow")}</Eyebrow>
              <h2 className="mt-3.5 font-mono text-[28px] sm:text-[40px] font-extrabold leading-tight tracking-tight text-foreground">{t("landing.testimonials.title")}</h2>
            </Reveal>
            <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
              {testimonials.map((q, i) => (
                <Reveal key={q.id} delay={i * 0.08}>
                  <div className="flex h-full flex-col gap-4 rounded-[20px] border border-border/50 bg-card/50 p-5 sm:p-6 backdrop-blur-sm">
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.max(1, Math.min(5, q.rating)) }).map((_, s) => (
                        <Star key={s} className="h-[15px] w-[15px]" style={{ color: `hsl(${TONE.amber})`, fill: `hsl(${TONE.amber})` }} />
                      ))}
                    </div>
                    <p className="m-0 flex-1 text-[15px] leading-relaxed text-foreground/90">{`“${q.text}”`}</p>
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-card font-mono text-sm font-bold text-primary">
                        {q.name.split(" ").map((w) => w[0]).join("")}
                      </span>
                      <div>
                        <p className="m-0 text-sm font-bold text-foreground">{q.name}</p>
                        {q.role && <p className="m-0 text-xs text-muted-foreground">{q.role}</p>}
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRICING ─────────────────────────────────────────────────── */}
      <section id="pricing" className="relative z-10 scroll-mt-24 px-4 py-14 sm:px-6 sm:py-[70px]">
        <div className="mx-auto w-full max-w-[860px]">
          <Reveal className="mb-10 text-center">
            <Eyebrow>{t("landing.nav.pricing")}</Eyebrow>
            <h2 className="mt-3.5 font-mono text-[28px] sm:text-[40px] font-extrabold leading-tight tracking-tight text-foreground">{t("landing.pricing.heading")}</h2>
          </Reveal>
          <Reveal>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col rounded-[22px] border border-border/50 bg-card/[0.45] p-6 sm:p-[30px] backdrop-blur-sm">
                <h3 className="mb-1 text-xl font-bold text-foreground">{t("landing.pricing.free")}</h3>
                <p className="mb-5 font-mono text-[40px] font-extrabold text-foreground">
                  {"0€"}
                  <span className="text-[15px] font-normal text-muted-foreground">{t("landing.pricing.month")}</span>
                </p>
                <ul className="mb-7 flex flex-1 flex-col gap-3">
                  {FREE_ITEMS.map((itemKey) => (
                    <li key={itemKey} className="flex items-center gap-3 text-[14.5px] text-muted-foreground">
                      <Check className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                      {t(itemKey)}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setLocation("/sign-up")}
                  className="w-full rounded-xl border border-border bg-card/50 px-6 py-3 text-[15px] font-medium text-foreground transition-colors hover:border-primary/40"
                >
                  {t("landing.hero.start_free")}
                </button>
              </div>

              <div className="relative flex flex-col rounded-[22px] border border-primary/45 bg-card/[0.65] p-6 sm:p-[30px] shadow-[0_0_50px_rgba(34,197,94,0.14)] backdrop-blur-sm">
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-[11px] font-bold text-primary-foreground shadow-[0_0_18px_rgba(34,197,94,0.4)]">
                  {t("landing.pricing.popular")}
                </span>
                <h3 className="mb-1 flex items-center gap-2 text-xl font-bold text-foreground">
                  <Crown className="h-5 w-5 text-primary" />
                  {t("landing.pricing.pro")}
                </h3>
                <p className="mb-5 font-mono text-[40px] font-extrabold text-foreground">
                  {"7€"}
                  <span className="text-[15px] font-normal text-muted-foreground">{t("landing.pricing.month")}</span>
                </p>
                <p className="mb-3 text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t("landing.pricing.pro_intro")}</p>
                <ul className="mb-7 flex flex-1 flex-col gap-3">
                  {PRO_ITEMS.map((itemKey) => (
                    <li key={itemKey} className="flex items-center gap-3 text-[14.5px] font-medium text-foreground">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {t(itemKey)}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setLocation("/sign-up")}
                  className="w-full rounded-xl bg-primary px-6 py-3 text-[15px] font-bold text-primary-foreground shadow-[0_0_24px_rgba(34,197,94,0.3)] transition-colors hover:bg-primary/90"
                >
                  {t("landing.pricing.go_pro")}
                </button>
              </div>
            </div>
            <p className="mt-5 text-center text-[13.5px] text-muted-foreground">{t("landing.pricing.note")}</p>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section id="faq" className="relative z-10 scroll-mt-24 px-4 py-14 sm:px-6 sm:py-[70px]">
        <div className="mx-auto w-full max-w-[760px]">
          <Reveal className="mb-10 text-center">
            <Eyebrow>{t("landing.nav.faq")}</Eyebrow>
            <h2 className="mt-3.5 font-mono text-[28px] sm:text-[40px] font-extrabold leading-tight tracking-tight text-foreground">{t("landing.faq.heading")}</h2>
          </Reveal>
          <Reveal>
            <div className="flex flex-col gap-3.5">
              {FAQ_ITEMS.map(({ questionKey, answerKey }, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={questionKey}
                    className={`rounded-2xl border backdrop-blur-sm transition-colors ${isOpen ? "border-primary/35 bg-card/60" : "border-border/50 bg-card/40"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? -1 : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 px-6 py-[18px] text-left"
                    >
                      <span className="text-[16.5px] font-bold text-foreground">{t(questionKey)}</span>
                      <Plus className={`h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? "rotate-45" : ""}`} />
                    </button>
                    <div className={`grid px-6 transition-all ${isOpen ? "grid-rows-[1fr] pb-[18px]" : "grid-rows-[0fr]"}`}>
                      <div className="overflow-hidden">
                        <p className="text-[14.5px] leading-relaxed text-muted-foreground">{t(answerKey)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────── */}
      <section className="relative z-10 px-4 pb-20 pt-8 sm:px-6 sm:pb-24 sm:pt-10">
        <Reveal className="mx-auto w-full max-w-6xl">
          <div className="relative overflow-hidden rounded-[28px] border border-primary/25 bg-gradient-to-br from-card/80 to-background/80 px-6 py-12 text-center sm:px-10 sm:py-16">
            <div className="pointer-events-none absolute -top-[40%] left-1/2 h-[400px] w-[600px] -translate-x-1/2 blur-[120px]" style={{ background: "hsl(var(--primary) / 0.12)" }} />
            <div className="relative">
              <h2 className="mb-3.5 font-mono text-[28px] font-extrabold tracking-tight text-foreground sm:text-[42px]">{t("landing.cta.title")}</h2>
              <p className="mx-auto mb-7 max-w-[520px] text-lg leading-relaxed text-muted-foreground">{t("landing.cta.subtitle")}</p>
              <button
                onClick={() => setLocation("/sign-up")}
                className="inline-flex items-center gap-2 rounded-[14px] bg-primary px-9 py-4 text-[17px] font-bold text-primary-foreground shadow-[0_0_40px_rgba(34,197,94,0.4)] transition-transform hover:-translate-y-0.5"
              >
                {t("landing.hero.start_free")}
                <ArrowRight className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border/40 bg-background/60 backdrop-blur-md">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-x-4 gap-y-9 px-4 pb-8 pt-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-8">
          <div className="col-span-3 md:col-span-1">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-primary/35 bg-primary/15 text-primary">
                <Rocket className="h-[17px] w-[17px]" />
              </span>
              <span className="font-mono text-[17px] font-bold text-foreground">TraderLoading</span>
            </div>
            <p className="m-0 max-w-[280px] text-[13.5px] leading-relaxed text-muted-foreground">{t("landing.footer.tagline")}</p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.titleKey}>
              <p className="mb-3.5 text-xs font-bold uppercase tracking-[0.1em] text-foreground">{t(col.titleKey)}</p>
              <div className="flex flex-col gap-2.5">
                {col.items.map((item) => (
                  <Link key={item.href} href={item.href} className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">
                    {t(item.labelKey)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 border-t border-border/30 px-4 py-5 text-center sm:flex-row sm:justify-between sm:gap-3 sm:px-6 sm:text-left">
          <p className="m-0 text-[13px] text-muted-foreground/70">
            {`© ${new Date().getFullYear()} TraderLoading. ${t("landing.footer.rights")}`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 sm:justify-end sm:gap-3">
            <Link href="/privacy" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
              {t("landing.footer.privacy")}
            </Link>
            <Link href="/terms" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
              {t("landing.footer.terms")}
            </Link>
            <a href="mailto:assistenza@traderloading.com" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
              {t("landing.footer.support")}
            </a>
            {SOCIALS.map((Icon, i) => (
              <span key={i} className="flex h-8 w-8 items-center justify-center rounded-md border border-border/50 text-muted-foreground">
                <Icon className="h-[15px] w-[15px]" />
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
