import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, BookOpen, FlaskConical, MessageCircle, Library,
  Sunrise, Settings, Newspaper, Landmark, CalendarDays, Trophy,
  Clock, Target, ClipboardCheck, Plus, Archive,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useLanguage } from "@/contexts/LanguageContext";

const PAGES = [
  { href: "/",           labelKey: "dashboard.title",   icon: LayoutDashboard, keywords: "home command center" },
  { href: "/journal",    labelKey: "journal.title",     icon: BookOpen,        keywords: "journal trade" },
  { href: "/backtest",   labelKey: "nav.backtest",      icon: FlaskConical,    keywords: "replay strategia" },
  { href: "/chat",       labelKey: "nav.chat",          icon: MessageCircle,   keywords: "chat social messaggi" },
  { href: "/news",       labelKey: "news.title",        icon: Newspaper,       keywords: "news macro" },
  { href: "/routine",    labelKey: "nav.routine",       icon: Sunrise,         keywords: "programma mattutino serale respirazione meditazione umore" },
  { href: "/broker",     labelKey: "page.broker.title", icon: Landmark,        keywords: "conto fx blue account" },
  { href: "/calendar",   labelKey: "page.calendar.title", icon: CalendarDays,  keywords: "agenda eventi planner" },
  { href: "/milestones", labelKey: "nav.milestones",    icon: Trophy,          keywords: "livelli xp certificati" },
  { href: "/clock",      labelKey: "nav.clock",         icon: Clock,           keywords: "sessioni mercato orari" },
  { href: "/missions",   labelKey: "missions.title",    icon: Target,          keywords: "missioni xp" },
  { href: "/tornei",     labelKey: "tornei.nav",        icon: Trophy,          keywords: "tornei classifica gara competizione leaderboard nft" },
  { href: "/checklist",  labelKey: "checklist.title",   icon: ClipboardCheck,  keywords: "conferme criteri" },
  { href: "/library",    labelKey: "nav.library",       icon: Library,         keywords: "contenuti formativi" },
  { href: "/wiki",       labelKey: "nav.wiki",          icon: Archive,         keywords: "archivio appunti note documenti wiki" },
  { href: "/settings",   labelKey: "settings.title",    icon: Settings,        keywords: "profilo aspetto audio pair" },
] as const;

/**
 * Palette comandi globale (Ctrl+K / Cmd+K): navigazione rapida e azioni.
 * "Nuovo trade" naviga al diario con ?new=1 (gestito da Journal).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("command.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("command.no_results")}</CommandEmpty>
        <CommandGroup heading={t("command.actions")}>
          <CommandItem keywords={["nuovo", "trade", "diario"]} onSelect={() => go("/journal?new=1")}>
            <Plus className="mr-2" />
            {t("command.new_trade")}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("command.pages")}>
          {PAGES.map(({ href, labelKey, icon: Icon, keywords }) => (
            <CommandItem key={href} keywords={keywords.split(" ")} onSelect={() => go(href)}>
              <Icon className="mr-2" />
              {t(labelKey)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
