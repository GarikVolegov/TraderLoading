import { Moon, Wind, Smile, Heart, Target, Check, TrendingUp, Eye, ClipboardCheck, CalendarDays, Zap, BookOpen } from "lucide-react";
import type { SessionStep } from "./types";

export const MORNING_STEPS: SessionStep[] = [
  { type: "emotion-quiz",   title: "Come ti senti?",          subtitle: "Check-in emotivo pre-sessione",           icon: Smile },
  { type: "breathing",      title: "Respirazione",             subtitle: "Box breathing 4-4-4-4 · 4 cicli",         icon: Wind },
  { type: "gratitude",      title: "Gratitudine",              subtitle: "Tre cose per cui sei grato stamattina",   icon: Heart },
  { type: "visualization",  title: "Visualizzazione",          subtitle: "Immagina la tua sessione perfetta",       icon: Eye,  skippable: true },
  { type: "checklist",      title: "Checklist pre-trade",      subtitle: "Conferma i tuoi criteri d'ingresso",      icon: ClipboardCheck },
  { type: "goals",          title: "Obiettivi del giorno",     subtitle: "Target pip e limite di drawdown",          icon: Target },
  { type: "complete",       title: "Sei pronto!",              subtitle: "La sessione è configurata. Buon trading", icon: Zap },
];

export const EVENING_STEPS: SessionStep[] = [
  { type: "emotion-quiz",   title: "Come è andata?",           subtitle: "Check-out emotivo di fine sessione",      icon: Smile },
  { type: "trade-review",   title: "Bilancio trade",           subtitle: "Riepilogo delle operazioni di oggi",      icon: TrendingUp },
  { type: "breathing",      title: "Decompressione",           subtitle: "Respirazione 4-7-8 per rilassarsi",       icon: Wind },
  { type: "gratitude",      title: "Gratitudine serale",       subtitle: "Tre lezioni o cose positive di oggi",     icon: Heart },
  { type: "reflection",     title: "Riflessione",              subtitle: "Analisi onesta della giornata",           icon: BookOpen },
  { type: "tomorrow",       title: "Piano di domani",          subtitle: "Prepara il focus per la prossima sessione",icon: CalendarDays },
  { type: "complete",       title: "Buona notte!",             subtitle: "Riposa bene. Domani torni più forte",     icon: Moon },
];
