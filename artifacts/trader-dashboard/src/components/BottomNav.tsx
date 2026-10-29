import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "@/components/BrandMark";
import { Link, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { synestheticClick } from "@/lib/soundFx";
import { ROOT_ITEMS, rootDestination, SECONDARY_ITEMS } from "@/lib/navHubs";
import { MoreHorizontal, GraduationCap, Shield, Coins, LifeBuoy, ChevronDown, ChevronRight, MessageSquare, ScrollText, Trophy, Layers, BookOpen, Award, Sunrise, Gamepad2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { LimenPageEmblem, type LimenEmblemVariant } from "@/components/ui/LimenPageEmblem";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { parseSocialLocation } from "@/lib/chatTabs";
import { socialText } from "@/lib/i18n/reorganizationSocial";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ACADEMY_SUB_ITEMS = {
  it: {
    canoni: "I Canoni Operativi",
    trattato: "Il Trattato dei Generali",
    espansione: "Il Mandato d'Espansione",
  },
  en: {
    canoni: "Operating Canons",
    trattato: "Treatise of the Generals",
    espansione: "Expansion Mandate",
  },
  es: {
    canoni: "Cánones Operativos",
    trattato: "Tratado de los Generales",
    espansione: "Mandato de Expansión",
  },
  fr: {
    canoni: "Canons Opérationnels",
    trattato: "Traité des Généraux",
    espansione: "Mandat d’Expansion",
  },
  de: {
    canoni: "Operative Kanons",
    trattato: "Traktat der Generäle",
    espansione: "Expansionsmandat",
  },
} as const;

const ORDER_ITEMS = [
  { id: "patrimonio", href: "/patrimonio", icon: Coins, labelKey: "nav.financial_architecture", emblemVariant: "patrimonio" as LimenEmblemVariant },
  { id: "academy", href: "/academy", icon: GraduationCap, labelKey: "nav.doctrine_of_time", emblemVariant: "dottrina" as LimenEmblemVariant },
  { id: "milestones", href: "/milestones", icon: Shield, labelKey: "nav.5_grades", emblemVariant: "gradi-ascesa" as LimenEmblemVariant },
] as const;

const TRAINING_ORDER_ITEMS = [
  SECONDARY_ITEMS[1], // La Fratellanza (/chat)
  ORDER_ITEMS[1],     // La Dottrina del Tempo (/academy)
  ORDER_ITEMS[0],     // Architettura Patrimoniale (/patrimonio)
  ORDER_ITEMS[2],     // I 5 Gradi di Ascesa (/milestones)
] as const;

import { getLimenSessionInfo, getRichMarketSessions } from "@/lib/limenSession";
import { useFreeTrial } from "@/lib/useFreeTrial";

const MOBILE_ROOT_LABELS = {
  it: ["Il Varco", "La Verità", "La Forgia"],
  en: ["The Threshold", "The Truth", "The Forge"],
  es: ["El Umbral", "La Verdad", "La Forja"],
  fr: ["Le Seuil", "La Vérité", "La Forge"],
  de: ["Die Schwelle", "Die Wahrheit", "Die Schmiede"],
} as const;

/** Unified LIMEN PROTOCOL navigation shell across all workspaces. */
export function BottomNav() {
  const { t, language } = useLanguage();
  const { isFreeTrial } = useFreeTrial();
  const [location] = useLocation();
  const search = useSearch();
  const active = rootDestination(location, search);
  const activePair = new URLSearchParams(search).get("pair");

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("aureus_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-sidebar-collapsed", isSidebarCollapsed ? "true" : "false");
    }
    try {
      localStorage.setItem("aureus_sidebar_collapsed", isSidebarCollapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [isSidebarCollapsed]);

  const toggleSidebar = () => {
    synestheticClick();
    setIsSidebarCollapsed((prev) => !prev);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (
        (e.key === "[" && !e.ctrlKey && !e.metaKey && !e.altKey) ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b")
      ) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const visibleTrainingItems = isFreeTrial
    ? TRAINING_ORDER_ITEMS.filter((item) => item.id !== "patrimonio")
    : TRAINING_ORDER_ITEMS;

  const inFratellanza = location === "/chat" || location.startsWith("/chat/") || location === "/tornei" || location.startsWith("/tornei/");
  const [fratellanzaOpen, setFratellanzaOpen] = useState<boolean | null>(null);
  const isFratellanzaExpanded = fratellanzaOpen ?? inFratellanza;

  const socialLoc = parseSocialLocation(search);
  const activeSocialTab = socialLoc.tab;
  const fratellanzaSubItems = [
    {
      id: "conversazioni",
      label: socialText(language, "conversations"),
      href: "/chat?t=conversazioni",
      icon: MessageSquare,
      isActive: inFratellanza && (activeSocialTab === "conversazioni" || !search.includes("t=")),
    },
    {
      id: "social",
      label: socialText(language, "activity"),
      href: "/chat?t=social",
      icon: ScrollText,
      isActive: inFratellanza && activeSocialTab === "social",
    },
    {
      id: "competizioni",
      label: socialText(language, "competitions"),
      href: "/chat?t=competizioni",
      icon: Trophy,
      isActive: inFratellanza && (activeSocialTab === "competizioni" || location === "/tornei" || location.startsWith("/tornei/")),
    },
  ];

  const inAcademy = location === "/academy" || location.startsWith("/academy/");
  const [academyOpen, setAcademyOpen] = useState<boolean | null>(null);
  const isAcademyExpanded = academyOpen ?? inAcademy;

  const academyParams = new URLSearchParams(search);
  const academyTab = academyParams.get("tab") ?? "canoni";
  const academySubText = ACADEMY_SUB_ITEMS[language] ?? ACADEMY_SUB_ITEMS.it;
  const academySubItems = [
    {
      id: "canoni",
      label: academySubText.canoni,
      href: "/academy?tab=canoni",
      icon: Layers,
      isActive: inAcademy && (academyTab === "canoni" || !academyParams.has("tab") || academyTab === ""),
    },
    {
      id: "trattato",
      label: academySubText.trattato,
      href: "/academy?tab=trattato",
      icon: BookOpen,
      isActive: inAcademy && (academyTab === "trattato" || academyTab === "codex"),
    },
    {
      id: "espansione",
      label: academySubText.espansione,
      href: "/academy?tab=espansione",
      icon: Award,
      isActive: inAcademy && (academyTab === "espansione" || academyTab === "affiliate"),
    },
  ];

  const now = useMinuteClock();
  const [, setSessionPrefTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPref = () => setSessionPrefTick((v) => v + 1);
    window.addEventListener("aureus:session-preferences-updated", onPref);
    return () => window.removeEventListener("aureus:session-preferences-updated", onPref);
  }, []);

  const timeString = now.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });

  const [hoveredCollapsedId, setHoveredCollapsedId] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState<number>(0);
  const closeFlyoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openCollapsedFlyout = (id: string, anchorEl: HTMLElement | null) => {
    if (closeFlyoutTimerRef.current) {
      clearTimeout(closeFlyoutTimerRef.current);
      closeFlyoutTimerRef.current = null;
    }
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const maxTop = typeof window !== "undefined" ? Math.max(12, window.innerHeight - 210) : rect.top;
      setFlyoutTop(Math.min(rect.top, maxTop));
    }
    setHoveredCollapsedId(id);
  };

  const cancelCloseCollapsedFlyout = () => {
    if (closeFlyoutTimerRef.current) {
      clearTimeout(closeFlyoutTimerRef.current);
      closeFlyoutTimerRef.current = null;
    }
  };

  const scheduleCloseCollapsedFlyout = () => {
    if (closeFlyoutTimerRef.current) {
      clearTimeout(closeFlyoutTimerRef.current);
    }
    closeFlyoutTimerRef.current = setTimeout(() => {
      setHoveredCollapsedId(null);
      closeFlyoutTimerRef.current = null;
    }, 160);
  };

  const closeCollapsedFlyoutImmediate = () => {
    if (closeFlyoutTimerRef.current) {
      clearTimeout(closeFlyoutTimerRef.current);
      closeFlyoutTimerRef.current = null;
    }
    setHoveredCollapsedId(null);
  };

  useEffect(() => {
    return () => {
      if (closeFlyoutTimerRef.current) {
        clearTimeout(closeFlyoutTimerRef.current);
      }
    };
  }, []);

  const renderItems = (desktop: boolean) =>
    ROOT_ITEMS.map((item, index) => {
      const selected = active === item.id;
      const itemHref =
        item.id === "today" && activePair
          ? `/?pair=${encodeURIComponent(activePair)}`
          : item.href;

      if (desktop && isSidebarCollapsed) {
        const isFlyoutOpen = hoveredCollapsedId === `root:${item.id}`;
        return (
          <div
            key={item.id}
            className="relative group"
            onMouseEnter={(e) => openCollapsedFlyout(`root:${item.id}`, e.currentTarget)}
            onMouseLeave={scheduleCloseCollapsedFlyout}
          >
            <Link
              href={itemHref}
              onClick={() => {
                synestheticClick();
                closeCollapsedFlyoutImmediate();
              }}
              aria-current={selected ? "page" : undefined}
              aria-label={t(item.labelKey)}
              className="relative flex min-h-[44px] w-full items-center justify-center rounded-lg p-1.5 transition-all hover:bg-secondary/60"
            >
              {selected && (
                <motion.span
                  layoutId="limen-sidebar-active-pill"
                  className="absolute inset-0 rounded-lg border border-[#C5A059]/40 bg-gradient-to-r from-[#C5A059]/20 via-[#C5A059]/10 to-transparent shadow-[0_0_14px_rgba(197,160,89,0.2)]"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <div className="relative z-10 shrink-0">
                <LimenPageEmblem
                  variant={item.emblemVariant}
                  size={28}
                  className={`transition-[transform,opacity] duration-200 group-hover:scale-110 ${
                    selected
                      ? "drop-shadow-[0_0_8px_rgba(212,175,55,0.55)] scale-105"
                      : "opacity-85 group-hover:opacity-100"
                  }`}
                />
              </div>
              {item.id === "today" && (
                <span className="absolute top-1.5 right-1.5 z-10 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </Link>

            {/* Flyout a tendina al passaggio del mouse con hover-bridge continuo */}
            {typeof document !== "undefined" &&
              isFlyoutOpen &&
              createPortal(
                <div
                  onMouseEnter={cancelCloseCollapsedFlyout}
                  onMouseLeave={scheduleCloseCollapsedFlyout}
                  style={{ top: flyoutTop }}
                  className={`fixed left-[3.6rem] z-[70] hidden pl-3.5 py-1.5 -my-1.5 transition-all duration-150 lg:block ${
                    isFlyoutOpen
                      ? "pointer-events-auto translate-x-0 opacity-100"
                      : "pointer-events-none -translate-x-1.5 opacity-0"
                  }`}
                >
                  <div className="relative min-w-[215px] rounded-xl border border-[#C5A059]/35 bg-[#0d0f14]/98 p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-xl">
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/50 to-transparent" />
                    <Link
                      href={itemHref}
                      onClick={() => {
                        synestheticClick();
                        closeCollapsedFlyoutImmediate();
                      }}
                      className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:text-[#F3D88C]"
                    >
                      <span className="font-display text-[12px] font-bold uppercase tracking-[0.03em] text-[#E8C56A] whitespace-nowrap">
                        {t(item.labelKey)}
                      </span>
                      {selected && (
                        <span className="rounded bg-[#C5A059]/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#E8C56A] border border-[#C5A059]/40 whitespace-nowrap">
                          ATTIVO
                        </span>
                      )}
                    </Link>
                    <span className="mt-1 block px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      {item.id === "today"
                        ? "Protocollo Operativo del Varco"
                        : item.id === "journal"
                        ? "Libro della Verità & Disciplina"
                        : "Forgia del Passato & Arene"}
                    </span>
                  </div>
                </div>,
                document.body
              )}
          </div>
        );
      }

      return (
        <Link
          key={item.id}
          href={itemHref}
          onClick={() => synestheticClick()}
          aria-current={selected ? "page" : undefined}
          className={
            desktop
              ? `group relative flex min-h-[46px] items-center gap-3 rounded-lg px-2.5 py-1.5 transition-all ${
                  selected
                    ? "shadow-[0_0_16px_rgba(197,160,89,0.12)]"
                    : "hover:bg-secondary/60"
                }`
              : `relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-medium transition-colors ${
                  selected ? "text-primary font-semibold" : "text-muted-foreground"
                }`
          }
        >
          {selected && (
            <motion.span
              layoutId={desktop ? "limen-sidebar-active-pill" : "limen-mobile-active-pill"}
              className={
                desktop
                  ? "absolute inset-0 rounded-lg border border-[#C5A059]/40 bg-gradient-to-r from-[#C5A059]/16 via-[#C5A059]/08 to-transparent shadow-[0_0_14px_rgba(197,160,89,0.18)]"
                  : "absolute inset-0 rounded-md border border-primary/35 bg-primary/12"
              }
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
            />
          )}
          {desktop ? (
            <div className="relative z-10 shrink-0">
              <LimenPageEmblem
                variant={item.emblemVariant}
                size={32}
                className={`transition-[transform,opacity] duration-200 group-hover:scale-110 ${
                  selected
                    ? "drop-shadow-[0_0_8px_rgba(212,175,55,0.55)] scale-105"
                    : "opacity-85 group-hover:opacity-100"
                }`}
              />
            </div>
          ) : (
            <div className="relative z-10 shrink-0">
              <LimenPageEmblem
                variant={item.emblemVariant}
                size={22}
                className={selected ? "filter drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]" : "opacity-80"}
              />
            </div>
          )}
          <span className={`relative z-10 ${
            desktop
              ? "whitespace-nowrap font-display text-[12px] font-bold uppercase tracking-[0.03em] text-foreground/85 group-hover:text-[#F4F4F6] transition-colors"
              : "block max-w-full truncate text-center px-0.5 text-[10px]"
          } ${selected && desktop ? "!text-[#D4AF37] font-extrabold drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]" : ""}`}>
            {desktop ? t(item.labelKey) : MOBILE_ROOT_LABELS[language][index]}
          </span>
          {desktop && item.id === "today" && (
            <span className="ml-auto relative z-10 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </Link>
      );
    });

  const isTrainingItemSelected = (item: (typeof TRAINING_ORDER_ITEMS)[number]) => {
    if (location === "/settings" || location.startsWith("/support") || location === "/pro") return false;
    if (item.id === "patrimonio" || item.id === "academy" || item.id === "milestones") {
      return location === item.href || location.startsWith(`${item.href}/`);
    }
    if (item.id === "social") {
      return location === "/chat" || location.startsWith("/chat/") || location === "/tornei" || location.startsWith("/tornei/");
    }
    return (
      active === (item as { id: string }).id &&
      location !== "/academy" &&
      location !== "/milestones" &&
      location !== "/patrimonio"
    );
  };

  const renderTrainingDesktopItems = () =>
    visibleTrainingItems.map((item) => {
      const selected = isTrainingItemSelected(item);
      const isSocial = item.id === "social";
      const isAcademy = item.id === "academy";
      const hasSubItems = isSocial || isAcademy;
      const isExpanded = isSocial ? isFratellanzaExpanded : isAcademy ? isAcademyExpanded : false;

      if (isSidebarCollapsed) {
        const isFlyoutOpen = hoveredCollapsedId === `train:${item.id}`;
        return (
          <div
            key={item.id}
            className="relative group"
            onMouseEnter={(e) => openCollapsedFlyout(`train:${item.id}`, e.currentTarget)}
            onMouseLeave={scheduleCloseCollapsedFlyout}
          >
            <Link
              href={item.href}
              onClick={() => {
                synestheticClick();
                closeCollapsedFlyoutImmediate();
              }}
              aria-current={selected ? "page" : undefined}
              aria-label={t(item.labelKey)}
              className="relative flex min-h-[44px] w-full items-center justify-center rounded-lg p-1.5 transition-all hover:bg-secondary/60"
            >
              {selected && (
                <motion.span
                  layoutId="limen-sidebar-active-pill"
                  className="absolute inset-0 rounded-lg border border-[#C5A059]/40 bg-gradient-to-r from-[#C5A059]/20 via-[#C5A059]/10 to-transparent shadow-[0_0_14px_rgba(197,160,89,0.2)]"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <div className="relative z-10 shrink-0">
                <LimenPageEmblem
                  variant={item.emblemVariant}
                  size={28}
                  className={`transition-[transform,opacity] duration-200 group-hover:scale-110 ${
                    selected
                      ? "drop-shadow-[0_0_8px_rgba(212,175,55,0.55)] scale-105"
                      : "opacity-85 group-hover:opacity-100"
                  }`}
                />
              </div>
            </Link>

            {/* Flyout a tendina al passaggio del mouse con hover-bridge continuo e link completi */}
            {typeof document !== "undefined" &&
              createPortal(
                <div
                  onMouseEnter={cancelCloseCollapsedFlyout}
                  onMouseLeave={scheduleCloseCollapsedFlyout}
                  style={{ top: flyoutTop }}
                  className={`fixed left-[3.6rem] z-[70] hidden pl-3.5 py-2 -my-2 transition-all duration-150 lg:block ${
                    isFlyoutOpen
                      ? "pointer-events-auto translate-x-0 opacity-100"
                      : "pointer-events-none -translate-x-1.5 opacity-0"
                  }`}
                >
                  <div className="relative min-w-[235px] rounded-xl border border-[#C5A059]/35 bg-[#0d0f14]/98 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-xl">
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/50 to-transparent" />
                    <Link
                      href={item.href}
                      onClick={() => {
                        synestheticClick();
                        closeCollapsedFlyoutImmediate();
                      }}
                      className="flex items-center justify-between gap-2 mb-1.5 rounded-md px-1 py-0.5 transition-colors hover:text-[#F3D88C]"
                    >
                      <span className="font-display text-[12px] font-bold uppercase tracking-[0.03em] text-[#E8C56A] whitespace-nowrap">
                        {t(item.labelKey)}
                      </span>
                      {selected && (
                        <span className="rounded bg-[#C5A059]/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#E8C56A] border border-[#C5A059]/40 whitespace-nowrap">
                          ATTIVO
                        </span>
                      )}
                    </Link>

                    {isSocial && (
                      <div className="flex flex-col gap-1 border-t border-white/10 pt-2 mt-1">
                        {fratellanzaSubItems.map((sub) => (
                          <Link
                            key={sub.id}
                            href={sub.href}
                            onClick={() => {
                              synestheticClick();
                              closeCollapsedFlyoutImmediate();
                            }}
                            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 cursor-pointer border transition-all ${
                              sub.isActive
                                ? "border-[#C5A059]/45 bg-[#C5A059]/20 text-[#E8C56A] font-bold shadow-sm"
                                : "border-transparent text-slate-300 hover:border-[#C5A059]/30 hover:bg-[#C5A059]/12 hover:text-[#F4F4F6]"
                            }`}
                          >
                            <sub.icon className="h-3.5 w-3.5 shrink-0 text-[#C5A059]" />
                            <span className="font-mono text-[10.5px] uppercase tracking-wider whitespace-nowrap">
                              {sub.label}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {isAcademy && (
                      <div className="flex flex-col gap-1 border-t border-white/10 pt-2 mt-1">
                        {academySubItems.map((sub) => (
                          <Link
                            key={sub.id}
                            href={sub.href}
                            onClick={() => {
                              synestheticClick();
                              closeCollapsedFlyoutImmediate();
                            }}
                            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 cursor-pointer border transition-all ${
                              sub.isActive
                                ? "border-[#C5A059]/45 bg-[#C5A059]/20 text-[#E8C56A] font-bold shadow-sm"
                                : "border-transparent text-slate-300 hover:border-[#C5A059]/30 hover:bg-[#C5A059]/12 hover:text-[#F4F4F6]"
                            }`}
                          >
                            <sub.icon className="h-3.5 w-3.5 shrink-0 text-[#C5A059]" />
                            <span className="font-mono text-[10.5px] uppercase tracking-wider whitespace-nowrap">
                              {sub.label}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {!hasSubItems && (
                      <span className="block px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 whitespace-nowrap">
                        {item.id === "patrimonio"
                          ? "Architettura & Pilastri Patrimoniali"
                          : "Gerarchia & 5 Gradi di Ascesa"}
                      </span>
                    )}
                  </div>
                </div>,
                document.body
              )}
          </div>
        );
      }

      return (
        <div key={item.id} className="space-y-1">
          <Link
            href={item.href}
            onClick={() => {
              if (isSocial) setFratellanzaOpen(true);
              if (isAcademy) setAcademyOpen(true);
            }}
            aria-current={selected ? "page" : undefined}
            className={`group relative flex min-h-[46px] items-center gap-3 rounded-lg px-2.5 py-1.5 transition-all ${
              selected
                ? "shadow-[0_0_16px_rgba(197,160,89,0.12)]"
                : "hover:bg-secondary/60"
            }`}
          >
            {selected && (
              <motion.span
                layoutId="limen-sidebar-active-pill"
                className="absolute inset-0 rounded-lg border border-[#C5A059]/40 bg-gradient-to-r from-[#C5A059]/16 via-[#C5A059]/08 to-transparent shadow-[0_0_14px_rgba(197,160,89,0.18)]"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            <div className="relative z-10 shrink-0">
              <LimenPageEmblem
                variant={item.emblemVariant}
                size={32}
                className={`transition-[transform,opacity] duration-200 group-hover:scale-110 ${
                  selected
                    ? "drop-shadow-[0_0_8px_rgba(212,175,55,0.55)] scale-105"
                    : "opacity-85 group-hover:opacity-100"
                }`}
              />
            </div>
            <span className={`relative z-10 whitespace-nowrap font-display text-[12px] font-bold uppercase tracking-[0.03em] text-foreground/85 group-hover:text-[#F4F4F6] transition-colors ${
              selected ? "!text-[#D4AF37] font-extrabold drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]" : ""
            }`}>
              {t(item.labelKey)}
            </span>
            {hasSubItems && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSocial) setFratellanzaOpen(!isFratellanzaExpanded);
                  if (isAcademy) setAcademyOpen(!isAcademyExpanded);
                }}
                className="relative z-10 ml-auto flex h-6 w-6 items-center justify-center rounded p-0.5 text-muted-foreground/70 hover:text-[#E8C56A] hover:bg-white/10 transition-colors"
                aria-label={`Espandi/Comprimi Sezioni ${isSocial ? "Fratellanza" : "Dottrina del Tempo"}`}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[#C5A059]" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                )}
              </button>
            )}
          </Link>

          {isSocial && isFratellanzaExpanded && (
            <div className="ml-5 pl-2.5 border-l border-[#C5A059]/25 flex flex-col gap-1 py-1">
              {fratellanzaSubItems.map((sub) => (
                <Link
                  key={sub.id}
                  href={sub.href}
                  className={`group relative flex items-center gap-2 rounded-md px-2 py-1.5 transition-all ${
                    sub.isActive
                      ? "bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] font-bold shadow-sm"
                      : "text-slate-400 hover:text-[#F4F4F6] hover:bg-white/5"
                  }`}
                >
                  <sub.icon className={`h-3 w-3 shrink-0 transition-colors ${sub.isActive ? "text-[#E8C56A]" : "text-slate-500 group-hover:text-[#C5A059]"}`} />
                  <span className="truncate font-mono text-[10.5px] uppercase tracking-wider">
                    {sub.label}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {isAcademy && isAcademyExpanded && (
            <div className="ml-5 pl-2.5 border-l border-[#C5A059]/25 flex flex-col gap-1 py-1">
              {academySubItems.map((sub) => (
                <Link
                  key={sub.id}
                  href={sub.href}
                  className={`group relative flex items-center gap-2 rounded-md px-2 py-1.5 transition-all ${
                    sub.isActive
                      ? "bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] font-bold shadow-sm"
                      : "text-slate-400 hover:text-[#F4F4F6] hover:bg-white/5"
                  }`}
                >
                  <sub.icon className={`h-3 w-3 shrink-0 transition-colors ${sub.isActive ? "text-[#E8C56A]" : "text-slate-500 group-hover:text-[#C5A059]"}`} />
                  <span className="truncate font-mono text-[10.5px] uppercase tracking-wider">
                    {sub.label}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    });

  const moreMobile = () => {
    const limenSession = getLimenSessionInfo(now);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("process.nav.more")}
            data-active={!ROOT_ITEMS.some(item => item.id === active)}
            className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs text-muted-foreground data-[active=true]:bg-primary/12 data-[active=true]:text-primary"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="block max-w-full truncate text-center text-[10px]">{t("process.nav.more")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          className="mobile-more-menu w-[calc(100vw-24px)] max-w-sm max-h-[75dvh] overflow-y-auto rounded-xl border border-[#C5A059]/35 bg-[#0b0d13]/98 backdrop-blur-xl p-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.85)] scrollbar-thin scrollbar-thumb-[#C5A059]/30"
        >
          {/* Header Telemetrico compatto */}
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[#C5A059]/25 bg-[#07080b] px-2.5 py-2 font-mono">
            <div className="flex items-center gap-1.5 min-w-0">
              <SigilIcon variant="limen" size={12} className="text-[#C5A059] shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8C56A] truncate">
                {limenSession.shortName}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase whitespace-nowrap border ${
                  limenSession.isActive
                    ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-400"
                    : "border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A]"
                }`}
              >
                {limenSession.isActive ? "Aperto" : "Chiuso"}
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#E8C56A] tabular-nums whitespace-nowrap">
              {timeString} CET
            </span>
          </div>

          <div className="px-2 pb-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#C5A059]/85">
            {t("nav.training_order")}
          </div>

          {visibleTrainingItems.map((item) => {
            const isSocial = item.id === "social";
            const isAcad = item.id === "academy";
            return (
              <div key={item.id} className="space-y-1 mb-1">
                <DropdownMenuItem asChild>
                  <Link
                    href={item.href}
                    aria-current={isTrainingItemSelected(item) ? "page" : undefined}
                    className="min-h-11 gap-3 rounded-lg px-2.5 text-xs font-display font-bold uppercase tracking-wide"
                  >
                    <LimenPageEmblem variant={item.emblemVariant} size={22} className="rounded-sm shrink-0" />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                </DropdownMenuItem>

                {isSocial && (
                  <div className="mobile-compact-bar grid grid-cols-3 gap-1 px-2 pb-1">
                    {fratellanzaSubItems.map((sub) => (
                      <DropdownMenuItem key={sub.id} asChild>
                        <Link
                          href={sub.href}
                          data-touch-size="custom"
                          className={`flex min-h-[32px] items-center justify-center gap-1 rounded border px-1.5 py-1 font-mono text-[9.5px] uppercase tracking-wider whitespace-nowrap ${
                            sub.isActive
                              ? "border-[#C5A059]/50 bg-[#C5A059]/20 text-[#E8C56A] font-bold"
                              : "border-white/10 bg-white/[0.03] text-muted-foreground"
                          }`}
                        >
                          <sub.icon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}

                {isAcad && (
                  <div className="mobile-compact-bar grid grid-cols-3 gap-1 px-2 pb-1">
                    {academySubItems.map((sub) => (
                      <DropdownMenuItem key={sub.id} asChild>
                        <Link
                          href={sub.href}
                          data-touch-size="custom"
                          className={`flex min-h-[32px] items-center justify-center gap-1 rounded border px-1.5 py-1 font-mono text-[9.5px] uppercase tracking-wider whitespace-nowrap ${
                            sub.isActive
                              ? "border-[#C5A059]/50 bg-[#C5A059]/20 text-[#E8C56A] font-bold"
                              : "border-white/10 bg-white/[0.03] text-muted-foreground"
                          }`}
                        >
                          <sub.icon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{sub.label.replace(/^Il |^I /, "")}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="my-1.5 h-px bg-border/60" />

          <DropdownMenuItem asChild>
            <Link
              href="/routine"
              aria-current={location === "/routine" ? "page" : undefined}
              className="min-h-11 gap-3 rounded-lg px-2.5 text-xs font-display font-bold uppercase tracking-wide"
            >
              <Sunrise className="h-4 w-4 text-[#E8C56A] shrink-0" />
              <span className="truncate">{t("nav.routine")}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href="/decompressione"
              aria-current={location === "/decompressione" ? "page" : undefined}
              className="min-h-11 gap-3 rounded-lg px-2.5 text-xs font-display font-bold uppercase tracking-wide"
            >
              <Gamepad2 className="h-4 w-4 text-[#E8C56A] shrink-0" />
              <span className="truncate">{t("nav.decompressione")}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href="/settings"
              aria-current={location === "/settings" ? "page" : undefined}
              className="min-h-11 gap-3 rounded-lg px-2.5 text-xs font-display font-bold uppercase tracking-wide"
            >
              <LimenPageEmblem variant="dossier" size={22} className="rounded-sm shrink-0" />
              <span className="truncate">{t("nav.settings")}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/support"
              className="min-h-11 gap-3 rounded-lg px-2.5 text-xs font-mono uppercase tracking-wider text-muted-foreground"
              aria-current={location.startsWith("/support") ? "page" : undefined}
            >
              <LifeBuoy size={16} className="text-[#C5A059] shrink-0" />
              <span className="truncate">{t("landing.footer.support")}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <>
      <nav
        aria-label={t("workspace.navigation")}
        data-mobile-navigation=""
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] inset-x-3 z-50 rounded-xl border border-border bg-card shadow-lg lg:hidden"
      >
        <div className="mx-auto flex max-w-lg gap-1 p-1">
          {renderItems(false)}
          {moreMobile()}
        </div>
      </nav>
      <nav
        aria-label={t("workspace.navigation")}
        data-desktop-sidebar=""
        className="fixed inset-y-0 left-0 z-50 hidden w-[var(--app-inset-left)] flex-col border-r border-border bg-background lg:flex overflow-x-hidden select-none"
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-3 shrink-0">
          {!isSidebarCollapsed ? (
            <>
              <Link
                href="/"
                className="flex items-center text-sm min-w-0"
              >
                <BrandMark />
              </Link>
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 transition-colors cursor-pointer"
                title="Comprimi barra di navigazione ([ o ⌘B)"
                aria-label="Comprimi barra di navigazione ([ o ⌘B)"
              >
                <PanelLeftClose className="h-4 w-4 text-[#C5A059]" />
              </button>
            </>
          ) : (
            <div className="flex w-full items-center justify-center">
              <button
                type="button"
                onClick={toggleSidebar}
                className="group relative flex h-10 w-10 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] hover:bg-[#C5A059]/20 hover:border-[#C5A059]/60 transition-all cursor-pointer shadow-sm"
                title="Espandi barra di navigazione ([ o ⌘B)"
                aria-label="Espandi barra di navigazione ([ o ⌘B)"
              >
                <img
                  src="/app-icon-192.png?v=20261021g"
                  alt="AUREUS"
                  className="h-6 w-6 object-contain group-hover:scale-105 transition-transform"
                />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#11131c] border border-[#C5A059]/50 text-[#C5A059]">
                  <PanelLeftOpen className="h-2.5 w-2.5" />
                </span>
              </button>
            </div>
          )}
        </div>
        <div className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto ${isSidebarCollapsed ? "px-1.5 py-3" : "px-2.5 py-3"}`}>
          <div className="space-y-1.5">
            {!isSidebarCollapsed && (
              <div className="px-3 pb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                {t("nav.operating_protocol")}
              </div>
            )}
            {renderItems(true)}
          </div>
          <div className={`space-y-1.5 ${isSidebarCollapsed ? "border-t border-border/40 pt-2" : "border-t border-border/60 pt-3"}`}>
            {!isSidebarCollapsed && (
              <div className="px-3 pb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
                {t("nav.training_order")}
              </div>
            )}
            {renderTrainingDesktopItems()}
          </div>
        </div>

        {/* Box Telemetria Sessioni & Mercati (Senza vecchio titolo, ricco di dati) */}
        {(() => {
          const overview = getRichMarketSessions(now);
          if (isSidebarCollapsed) {
            return (
              <div className="mx-auto mb-2 flex flex-col items-center justify-center p-1 shrink-0">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="group relative flex h-10 w-10 flex-col items-center justify-center rounded-lg border border-[#C5A059]/25 bg-[#0e1118] text-[#C5A059] hover:border-[#C5A059]/60 hover:bg-[#C5A059]/15 transition-all cursor-pointer shadow-sm"
                  title={`Sessione ${overview.currentSession.shortName} · Ora CET ${timeString} Roma (Clicca per espandere)`}
                >
                  <SigilIcon variant="limen" size={14} className="text-[#C5A059]" />
                  <span className="relative flex h-1.5 w-1.5 mt-1">
                    {overview.currentSession.isActive && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                        overview.currentSession.isActive ? "bg-emerald-500" : "bg-[#C5A059]/70"
                      }`}
                    />
                  </span>
                </button>
              </div>
            );
          }
          return (
            <div
              title={`${overview.currentSession.name} (${overview.currentSession.hours}): ${overview.currentSession.description}`}
              className="group relative mx-2.5 mb-2 overflow-hidden rounded-lg border border-[#C5A059]/25 bg-gradient-to-b from-[#0e1118]/95 via-[#0b0d13]/90 to-[#07080b]/95 p-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md select-none transition-all duration-200 hover:border-[#C5A059]/45"
            >
              {/* Hairline dorato decorativo superiore */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent" />

              {/* Header: Stato Sessione Attiva + Status Beacon LIVE (senza vecchio titolo) */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    {overview.currentSession.isActive && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                        overview.currentSession.isActive ? "bg-emerald-400" : "bg-[#C5A059]/70"
                      }`}
                    />
                  </span>
                  <span className="font-mono text-[10.5px] font-bold text-[#F4F4F6] uppercase tracking-wider whitespace-nowrap truncate">
                    {overview.currentSession.shortName}
                  </span>
                  <span
                    className={`font-mono text-[8.5px] uppercase font-bold tracking-wider px-1 py-0.2 rounded border whitespace-nowrap ${
                      overview.currentSession.isActive
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                        : "bg-[#C5A059]/10 border-[#C5A059]/25 text-[#E8C56A]/80"
                    }`}
                  >
                    {overview.currentSession.isActive ? "Aperto" : "Chiuso"}
                  </span>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[8.5px] font-bold tracking-wider text-emerald-400 whitespace-nowrap">
                  LIVE
                </span>
              </div>

              {/* Banner Killzone Attiva o Prossima Apertura */}
              <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono rounded px-1.5 py-0.5 bg-black/40 border border-white/5">
                {overview.activeKillzone ? (
                  <span className="text-[#34d399] font-bold truncate flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    {overview.activeKillzone}
                  </span>
                ) : (
                  <span className="text-[#C5A059]/90 truncate">
                    {overview.nextSessionText}
                  </span>
                )}
                <span className="text-muted-foreground/60 shrink-0 ml-1 whitespace-nowrap">
                  {overview.currentSession.hours.split(" ")[0]}
                </span>
              </div>

              {/* Matrice 3 Sessioni Globali (Asia · Londra · New York) */}
              <div className="mt-2 grid grid-cols-3 gap-1 pt-1.5 border-t border-white/5">
                {overview.sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className={`flex flex-col items-center p-1 rounded border text-center transition-all ${
                      sess.isOpen
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : sess.isKillzone
                        ? "bg-[#C5A059]/10 border-[#C5A059]/30 text-[#E8C56A]"
                        : "bg-white/[0.02] border-white/5 text-muted-foreground/60"
                    }`}
                  >
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                      {sess.name}
                    </span>
                    <span className="font-mono text-[7.5px] whitespace-nowrap opacity-80 mt-0.5">
                      {sess.hours.replace(" CET", "")}
                    </span>
                    <span
                      className={`font-mono text-[7px] uppercase font-bold px-1 py-0.2 rounded mt-1 whitespace-nowrap ${
                        sess.isOpen
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {sess.isOpen ? "ON" : "OFF"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Separatore sottile aureo */}
              <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-[#C5A059]/20 to-transparent" />

              {/* Orologi Sincronizzati: Roma (CET) & Mercati (UTC) */}
              <div className="grid grid-cols-2 items-center gap-2 text-center">
                <div className="flex flex-col items-center rounded bg-black/30 p-1 border border-white/5">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/70">
                    Ora CET · Roma
                  </span>
                  <span className="font-mono text-[12px] font-bold text-[#E8C56A] tabular-nums tracking-tight whitespace-nowrap mt-0.5">
                    {timeString}
                  </span>
                </div>
                <div className="flex flex-col items-center rounded bg-black/30 p-1 border border-white/5">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/70">
                    Mercati · UTC
                  </span>
                  <span className="font-mono text-[12px] font-bold text-slate-300 tabular-nums tracking-tight whitespace-nowrap mt-0.5">
                    {overview.utcTime}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        <div className={`space-y-1 border-t border-border ${isSidebarCollapsed ? "px-1.5 py-2.5" : "px-2.5 py-2.5"}`}>
          {!isSidebarCollapsed ? (
            <Link
              href="/settings"
              onClick={() => synestheticClick()}
              aria-current={location === "/settings" ? "page" : undefined}
              className={`group relative flex min-h-[46px] items-center gap-3 rounded-lg px-2.5 py-1.5 transition-all ${
                location === "/settings"
                  ? "shadow-[0_0_16px_rgba(197,160,89,0.12)]"
                  : "hover:bg-secondary/60"
              }`}
            >
              {location === "/settings" && (
                <motion.span
                  layoutId="limen-sidebar-active-pill"
                  className="absolute inset-0 rounded-lg border border-[#C5A059]/40 bg-gradient-to-r from-[#C5A059]/16 via-[#C5A059]/08 to-transparent shadow-[0_0_14px_rgba(197,160,89,0.18)]"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <div className="relative z-10 shrink-0">
                <LimenPageEmblem
                  variant="dossier"
                  size={32}
                  className={`transition-all duration-300 group-hover:scale-110 ${
                    location === "/settings"
                      ? "filter drop-shadow-[0_0_12px_rgba(212,175,55,0.7)] scale-105"
                      : "opacity-85 group-hover:opacity-100 group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.45)]"
                  }`}
                />
              </div>
              <span className={`relative z-10 whitespace-nowrap font-display text-[12px] font-bold uppercase tracking-[0.03em] text-foreground/85 group-hover:text-[#F4F4F6] transition-colors ${
                location === "/settings" ? "!text-[#D4AF37] font-extrabold drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]" : ""
              }`}>
                {t("nav.settings")}
              </span>
            </Link>
          ) : (
            <div
              className="relative group"
              onMouseEnter={(e) => openCollapsedFlyout("settings", e.currentTarget)}
              onMouseLeave={scheduleCloseCollapsedFlyout}
            >
              <Link
                href="/settings"
                onClick={() => {
                  synestheticClick();
                  closeCollapsedFlyoutImmediate();
                }}
                aria-current={location === "/settings" ? "page" : undefined}
                aria-label={t("nav.settings")}
                className="relative flex min-h-[44px] w-full items-center justify-center rounded-lg p-1.5 transition-all hover:bg-secondary/60"
              >
                {location === "/settings" && (
                  <motion.span
                    layoutId="limen-sidebar-active-pill"
                    className="absolute inset-0 rounded-lg border border-[#C5A059]/40 bg-gradient-to-r from-[#C5A059]/20 via-[#C5A059]/10 to-transparent shadow-[0_0_14px_rgba(197,160,89,0.2)]"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <div className="relative z-10 shrink-0">
                  <LimenPageEmblem
                    variant="dossier"
                    size={28}
                    className={`transition-all duration-300 group-hover:scale-110 ${
                      location === "/settings"
                        ? "filter drop-shadow-[0_0_12px_rgba(212,175,55,0.7)] scale-105"
                        : "opacity-85 group-hover:opacity-100 group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.45)]"
                    }`}
                  />
                </div>
              </Link>
              {typeof document !== "undefined" &&
                createPortal(
                  <div
                    onMouseEnter={cancelCloseCollapsedFlyout}
                    onMouseLeave={scheduleCloseCollapsedFlyout}
                    style={{ top: flyoutTop }}
                    className={`fixed left-[3.6rem] z-[70] hidden pl-3.5 py-1.5 -my-1.5 transition-all duration-150 lg:block ${
                      hoveredCollapsedId === "settings"
                        ? "pointer-events-auto translate-x-0 opacity-100"
                        : "pointer-events-none -translate-x-1.5 opacity-0"
                    }`}
                  >
                    <div className="relative min-w-[215px] rounded-xl border border-[#C5A059]/35 bg-[#0d0f14]/98 p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-xl">
                      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/50 to-transparent" />
                      <Link
                        href="/settings"
                        onClick={() => {
                          synestheticClick();
                          closeCollapsedFlyoutImmediate();
                        }}
                        className="block rounded-md px-1 py-0.5 font-display text-[12px] font-bold uppercase tracking-[0.03em] text-[#E8C56A] whitespace-nowrap transition-colors hover:text-[#F3D88C]"
                      >
                        {t("nav.settings")}
                      </Link>
                      <span className="mt-1 block px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Dossier & Preferenze Operatore
                      </span>
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
