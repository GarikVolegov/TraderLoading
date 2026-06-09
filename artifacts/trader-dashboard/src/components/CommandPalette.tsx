import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, BookOpen, FlaskConical, Brain, MessageCircle, Library,
  BrainCircuit, Sunrise, Settings, Newspaper, Landmark, CalendarDays, Trophy,
  Clock, Target, ClipboardCheck, Plus,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator,
} from "@/components/ui/command";

const PAGES = [
  { href: "/",           label: "Dashboard",            icon: LayoutDashboard, keywords: "home command center" },
  { href: "/journal",    label: "Diario di Trading",    icon: BookOpen,        keywords: "journal trade" },
  { href: "/backtest",   label: "Backtest",             icon: FlaskConical,    keywords: "replay strategia" },
  { href: "/zen",        label: "Zona Zen",             icon: Brain,           keywords: "respirazione meditazione umore insight" },
  { href: "/chat",       label: "Community",            icon: MessageCircle,   keywords: "chat social messaggi" },
  { href: "/news",       label: "Notizie Macro",        icon: Newspaper,       keywords: "news macro" },
  { href: "/brain",      label: "Brain AI",             icon: BrainCircuit,    keywords: "analisi grafico strategia ai" },
  { href: "/routine",    label: "Routine",              icon: Sunrise,         keywords: "programma mattutino serale" },
  { href: "/broker",     label: "Broker Hub",           icon: Landmark,        keywords: "conto fx blue account" },
  { href: "/calendar",   label: "Calendario Avanzato",  icon: CalendarDays,    keywords: "agenda eventi planner" },
  { href: "/milestones", label: "Traguardi",            icon: Trophy,          keywords: "livelli xp certificati" },
  { href: "/clock",      label: "Orologio & Sessioni",  icon: Clock,           keywords: "sessioni mercato orari" },
  { href: "/missions",   label: "Missioni Giornaliere", icon: Target,          keywords: "missioni xp" },
  { href: "/checklist",  label: "Checklist Pre-Trade",  icon: ClipboardCheck,  keywords: "conferme criteri" },
  { href: "/library",    label: "Biblioteca",           icon: Library,         keywords: "contenuti formativi" },
  { href: "/settings",   label: "Impostazioni",         icon: Settings,        keywords: "profilo aspetto audio pair" },
] as const;

/**
 * Palette comandi globale (Ctrl+K / Cmd+K): navigazione rapida e azioni.
 * "Nuovo trade" naviga al diario con ?new=1 (gestito da Journal).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

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
      <CommandInput placeholder="Vai a... (digita per cercare)" />
      <CommandList>
        <CommandEmpty>Nessun risultato.</CommandEmpty>
        <CommandGroup heading="Azioni">
          <CommandItem keywords={["nuovo", "trade", "diario"]} onSelect={() => go("/journal?new=1")}>
            <Plus className="mr-2" />
            Nuovo trade
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pagine">
          {PAGES.map(({ href, label, icon: Icon, keywords }) => (
            <CommandItem key={href} keywords={keywords.split(" ")} onSelect={() => go(href)}>
              <Icon className="mr-2" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
