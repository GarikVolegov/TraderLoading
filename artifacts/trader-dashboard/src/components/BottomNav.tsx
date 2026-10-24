import { useState, useEffect } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Link, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { ROOT_ITEMS, rootDestination, SECONDARY_ITEMS } from "@/lib/navHubs";
import { MoreHorizontal, GraduationCap, Shield, Coins, LifeBuoy, ChevronDown, ChevronRight, MessageSquare, ScrollText, Trophy, Layers, BookOpen, Award } from "lucide-react";
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

import { getLimenSessionInfo } from "@/lib/limenSession";
import { useFreeTrial } from "@/lib/useFreeTrial";

const MOBILE_ROOT_LABELS = {
  it: ["Oggi", "Diario", "Forgia"],
  en: ["Today", "Journal", "Forge"],
  es: ["Hoy", "Diario", "Forja"],
  fr: ["Aujourd’hui", "Journal", "Forge"],
  de: ["Heute", "Journal", "Schmiede"],
} as const;

/** Unified LIMEN PROTOCOL navigation shell across all workspaces. */
export function BottomNav() {
  const { t, language } = useLanguage();
  const { isFreeTrial } = useFreeTrial();
  const [location] = useLocation();
  const search = useSearch();
  const active = rootDestination(location, search);
  const activePair = new URLSearchParams(search).get("pair");

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

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const timeString = now.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });

  const renderItems = (desktop: boolean) =>
    ROOT_ITEMS.map((item, index) => {
      const selected = active === item.id;
      const itemHref =
        item.id === "today" && activePair
          ? `/?pair=${encodeURIComponent(activePair)}`
          : item.href;
      return (
        <Link
          key={item.id}
          href={itemHref}
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
                className={`transition-all duration-300 group-hover:scale-110 ${
                  selected
                    ? "filter drop-shadow-[0_0_12px_rgba(212,175,55,0.7)] scale-105"
                    : "opacity-85 group-hover:opacity-100 group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.45)]"
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
                className={`transition-all duration-300 group-hover:scale-110 ${
                  selected
                    ? "filter drop-shadow-[0_0_12px_rgba(212,175,55,0.7)] scale-105"
                    : "opacity-85 group-hover:opacity-100 group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.45)]"
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

  const moreMobile = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("process.nav.more")}
          data-active={!ROOT_ITEMS.some(item => item.id === active)}
          className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs text-muted-foreground data-[active=true]:bg-primary/12 data-[active=true]:text-primary"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="block max-w-full truncate text-center">{t("process.nav.more")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="mobile-more-menu w-72 border-border bg-card">
        {visibleTrainingItems.map((item) => (
          <DropdownMenuItem key={item.id} asChild>
            <Link
              href={item.href}
              aria-current={isTrainingItemSelected(item) ? "page" : undefined}
              className="min-h-11 gap-3 text-sm"
            >
              <LimenPageEmblem variant={item.emblemVariant} size={20} className="rounded-sm" />
              {t(item.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/settings" aria-current={location === "/settings" ? "page" : undefined} className="min-h-11 gap-3 text-sm">
            <LimenPageEmblem variant="dossier" size={20} className="rounded-sm" />
            {t("nav.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/support" className="min-h-11 gap-3 text-sm" aria-current={location.startsWith("/support") ? "page" : undefined}>
            <LifeBuoy size={16} />
            {t("landing.footer.support")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
        className="fixed inset-y-0 left-0 z-50 hidden w-[var(--app-inset-left)] flex-col border-r border-border bg-background lg:flex"
      >
        <Link
          href="/"
          className="flex h-14 items-center border-b border-border px-4 text-sm"
        >
          <BrandMark />
        </Link>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-3">
          <div className="space-y-1.5">
            <div className="px-3 pb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-primary/80">
              {t("nav.operating_protocol")}
            </div>
            {renderItems(true)}
          </div>
          <div className="space-y-1.5 border-t border-border/60 pt-3">
            <div className="px-3 pb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
              {t("nav.training_order")}
            </div>
            {renderTrainingDesktopItems()}
          </div>
        </div>

        {/* Box Telemetria Tattica — Protocollo LIMEN */}
        {(() => {
          const limenSession = getLimenSessionInfo(now);
          return (
            <div
              title={limenSession.description}
              className="group relative mx-3 mb-2 overflow-hidden rounded-lg border border-[#C5A059]/20 bg-gradient-to-b from-[#0e1118]/95 via-[#0b0d13]/90 to-[#07080b]/95 p-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md select-none transition-all duration-200 hover:border-[#C5A059]/40"
            >
              {/* Hairline dorato decorativo superiore */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent" />

              {/* Header: Sigillo LIMEN + Titolo + Status Beacon LIVE */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <SigilIcon variant="limen" size={13} className="text-[#C5A059] shrink-0" />
                  <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-[#E8C56A] uppercase whitespace-nowrap">
                    PROTOCOLLO LIMEN
                  </span>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-emerald-400 whitespace-nowrap">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  LIVE
                </span>
              </div>

              {/* Separatore sottile aureo */}
              <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-[#C5A059]/20 to-transparent" />

              {/* Griglia Telemetrica: Sessione a sinistra, Orologio CET a destra */}
              <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                    Sessione
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <span className="font-mono text-[11px] font-bold tracking-tight text-[#F4F4F6] uppercase whitespace-nowrap truncate">
                      {limenSession.shortName}
                    </span>
                    <span
                      className={`font-mono text-[8.5px] uppercase font-bold tracking-wider px-1 py-0.5 rounded border whitespace-nowrap ${
                        limenSession.isActive
                          ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                          : "bg-[#C5A059]/10 border-[#C5A059]/25 text-[#E8C56A]/80"
                      }`}
                    >
                      {limenSession.isActive ? "Aperto" : "Chiuso"}
                    </span>
                  </div>
                  <span className="mt-0.5 font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap truncate">
                    {limenSession.hours}
                  </span>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70 block">
                    Ora CET
                  </span>
                  <span className="block font-mono text-[13px] font-bold text-[#E8C56A] tabular-nums tracking-tight whitespace-nowrap mt-0.5">
                    {timeString}
                  </span>
                  <span className="block font-mono text-[8.5px] uppercase tracking-wider text-[#C5A059]/70 whitespace-nowrap">
                    Roma
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="space-y-1 border-t border-border px-2.5 py-2.5">
          <Link
            href="/settings"
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
        </div>
      </nav>
    </>
  );
}
