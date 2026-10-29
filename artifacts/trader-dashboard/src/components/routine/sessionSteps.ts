import { Moon, Wind, Heart, Eye, Zap, BookOpen, ShieldCheck, Activity } from "lucide-react";
import type { SessionStep } from "./types";

export const MORNING_STEPS: SessionStep[] = [
  { type: "emotion-quiz",   title: "Stato Bio-Emotivo",               subtitle: "Valutazione stoica dello stato di presenza pre-sessione", icon: Activity },
  { type: "breathing",      title: "Centratura Neurale",              subtitle: "Box breathing 4-4-4-4 · 4 cicli di stabilità",           icon: Wind },
  { type: "gratitude",      title: "Regola & Gratitudine",            subtitle: "I tre vincoli inviolabili e fondamenti della sessione",   icon: Heart },
  { type: "visualization",  title: "Contemplazione dello Scenario",  subtitle: "Visualizzazione chirurgica dell'esecuzione disciplinata", icon: Eye, skippable: true },
  { type: "complete",       title: "Sigillo d'Allineamento",          subtitle: "La preparazione operativa continua ne Il Varco",          icon: Zap },
];

export const EVENING_STEPS: SessionStep[] = [
  { type: "emotion-quiz",   title: "Verifica della Deriva",           subtitle: "Check-out stoico sulla disciplina della seduta",         icon: ShieldCheck },
  { type: "breathing",      title: "Decompressione Neurale",          subtitle: "Respirazione cadenzata 4-7-8 per il distacco conscio",   icon: Wind },
  { type: "gratitude",      title: "Insegnamenti della Seduta",       subtitle: "Tre lezioni o conferme oggettive emerse oggi",            icon: Heart },
  { type: "reflection",     title: "Il Libro della Verità",           subtitle: "Rendicontazione onesta e analisi analitica",              icon: BookOpen },
  { type: "complete",       title: "Sigillo di Chiusura",             subtitle: "Sessione sigillata. Distacco conscio e riposo disciplinato", icon: Moon },
];
