import { Link } from "wouter";
import {
  Compass,
  Coins,
  BookOpen,
  FlaskConical,
  Calendar,
  Calculator,
  Newspaper,
  HeartPulse,
  GraduationCap,
  Shield,
  ArrowUpRight,
} from "lucide-react";
import { SigilIcon } from "@/components/ui/SigilIcon";

interface QuickDockItem {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  icon: typeof Compass;
  sigil?: "threshold" | "keeper" | "forge" | "book-of-truth" | "arsenal" | "doctrine" | "hierarchy";
  badge?: string;
  badgeColor?: string;
}

const QUICK_DOCK_ITEMS: readonly QuickDockItem[] = [
  {
    id: "varco",
    label: "Il Varco",
    sublabel: "Cockpit Live",
    href: "/",
    icon: Compass,
    sigil: "threshold",
    badge: "LIVE",
    badgeColor: "bg-[#C5A059]/15 text-[#C5A059] border-[#C5A059]/30",
  },
  {
    id: "patrimonio",
    label: "Architettura Patrimoniale",
    sublabel: "Capitale & Riserva",
    href: "/patrimonio",
    icon: Coins,
    badge: "LIMITI",
    badgeColor: "bg-[#8B1E1E]/20 text-[#E05252] border-[#8B1E1E]/40",
  },
  {
    id: "journal",
    label: "Il Libro della Verità",
    sublabel: "Diario & Fatti",
    href: "/journal",
    icon: BookOpen,
    sigil: "book-of-truth",
    badge: "VERITÀ",
    badgeColor: "bg-[#C5A059]/15 text-[#C5A059] border-[#C5A059]/30",
  },
  {
    id: "backtest",
    label: "La Forgia del Passato",
    sublabel: "Replay & Backtest",
    href: "/backtest",
    icon: FlaskConical,
    sigil: "forge",
    badge: "TEST",
    badgeColor: "bg-white/10 text-zinc-300 border-white/20",
  },
  {
    id: "calendar",
    label: "Calendario Macro",
    sublabel: "Eventi ad Alto Impatto",
    href: "/?vista=strumenti&widget=calendar",
    icon: Calendar,
    sigil: "arsenal",
  },
  {
    id: "calculator",
    label: "Calcolatore Lotti",
    sublabel: "Dimensionamento Rischio",
    href: "/?vista=strumenti&strumento=calcolatore",
    icon: Calculator,
  },
  {
    id: "news",
    label: "Notizie & Intelligence",
    sublabel: "Analisi di Mercato",
    href: "/?vista=notizie",
    icon: Newspaper,
  },
  {
    id: "routine",
    label: "Routine & Mente",
    sublabel: "Centratura & Zen",
    href: "/routine",
    icon: HeartPulse,
  },
  {
    id: "academy",
    label: "La Dottrina del Tempo",
    sublabel: "Academy & Studio",
    href: "/academy",
    icon: GraduationCap,
    sigil: "doctrine",
  },
  {
    id: "milestones",
    label: "I 5 Gradi di Ascesa",
    sublabel: "Rango & Integrità",
    href: "/milestones",
    icon: Shield,
    sigil: "hierarchy",
  },
];

export function DailyOrderQuickDock() {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <SigilIcon variant="arsenal" size={16} className="text-primary" />
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Dock Rapido dell&apos;Arsenale AUREUS
          </h2>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Accesso immediato a tutte le sezioni
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {QUICK_DOCK_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group relative flex flex-col justify-between rounded-xl border border-[#26262E] bg-[#141418]/80 p-3 hover:border-[#C5A059]/50 hover:bg-[#1A1A22] transition-all hover:scale-[1.01]"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#26262E] bg-[#0A0A0C] text-[#C5A059] group-hover:border-[#C5A059]/60 transition-colors">
                  {item.sigil ? (
                    <SigilIcon variant={item.sigil} size={15} />
                  ) : (
                    <item.icon size={15} />
                  )}
                </div>

                {item.badge ? (
                  <span
                    className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                ) : (
                  <ArrowUpRight
                    size={13}
                    className="text-muted-foreground/40 group-hover:text-primary transition-colors"
                  />
                )}
              </div>

              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                  {item.label}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {item.sublabel}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
