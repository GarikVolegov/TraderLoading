export type RewardType = "video" | "pdf" | "presentazione";

export interface Reward {
  id: string;
  milestone: number;
  type: RewardType;
  title: string;
  description: string;
  thumbnailUrl: string;
  url: string;
  duration?: string;
  author?: string;
}

const UNSPLASH_CHART = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80";
const UNSPLASH_MIND  = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80";
const UNSPLASH_DATA  = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80";
const UNSPLASH_BOOK  = "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80";
const UNSPLASH_ZEN   = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80";
const UNSPLASH_MONEY = "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80";

export const REWARDS: Reward[] = [
  {
    id: "r05-1",
    milestone: 5,
    type: "video",
    title: "Psicologia del Trading — Le Fondamenta",
    description: "Come le emozioni sabotano i trader e le tecniche pratiche per sviluppare la disciplina mentale necessaria a operare con consistenza.",
    thumbnailUrl: UNSPLASH_MIND,
    url: "https://www.youtube.com/results?search_query=trading+psychology+discipline+mindset",
    duration: "20–30 min",
    author: "Curation TraderLOADING",
  },
  {
    id: "r05-2",
    milestone: 5,
    type: "pdf",
    title: "Introduzione alla Lettura dei Mercati",
    description: "Guida gratuita di BabyPips sul funzionamento del mercato Forex: sessioni, partecipanti, leva finanziaria e terminologia di base.",
    thumbnailUrl: UNSPLASH_CHART,
    url: "https://www.babypips.com/learn/forex/what-is-forex",
    author: "BabyPips",
  },
  {
    id: "r10-1",
    milestone: 10,
    type: "video",
    title: "Risk Management Professionale",
    description: "I principi fondamentali per sopravvivere ai mercati: position sizing, stop loss intelligenti, rapporto rischio/rendimento e drawdown control.",
    thumbnailUrl: UNSPLASH_MONEY,
    url: "https://www.youtube.com/results?search_query=professional+risk+management+trading+tutorial",
    duration: "25–40 min",
    author: "Curation TraderLOADING",
  },
  {
    id: "r10-2",
    milestone: 10,
    type: "pdf",
    title: "Guida al Risk Management — CME Group",
    description: "Documento ufficiale del Chicago Mercantile Exchange sul risk management nei mercati finanziari. Gratis, diretto dalla fonte.",
    thumbnailUrl: UNSPLASH_DATA,
    url: "https://www.cmegroup.com/education/courses/introduction-to-futures/understanding-risk.html",
    author: "CME Group",
  },
  {
    id: "r15-1",
    milestone: 15,
    type: "video",
    title: "Smart Money Concepts — ICT & Order Blocks",
    description: "Come leggere il mercato come le istituzioni finanziarie: struttura, liquidity sweep, order blocks, fair value gap e imbalances.",
    thumbnailUrl: UNSPLASH_CHART,
    url: "https://www.youtube.com/results?search_query=smart+money+concepts+ICT+order+blocks+explained",
    duration: "30–60 min",
    author: "Curation TraderLOADING",
  },
  {
    id: "r15-2",
    milestone: 15,
    type: "presentazione",
    title: "Trading Plan — Template Professionale",
    description: "Modello completo di piano di trading: obiettivi, regole d'ingresso/uscita, gestione del rischio, journal e revisione periodica.",
    thumbnailUrl: UNSPLASH_BOOK,
    url: "https://docs.google.com/presentation/d/1_KXbDPEbcexampleTradingPlan/edit?usp=sharing",
    author: "TraderLOADING",
  },
  {
    id: "r20-1",
    milestone: 20,
    type: "video",
    title: "Analisi Tecnica Avanzata",
    description: "Wyckoff Method, Market Profile, Volume Spread Analysis (VSA) e Price Action istituzionale per trader intermedio-avanzato.",
    thumbnailUrl: UNSPLASH_DATA,
    url: "https://www.youtube.com/results?search_query=advanced+technical+analysis+wyckoff+market+profile",
    duration: "40–60 min",
    author: "Curation TraderLOADING",
  },
  {
    id: "r20-2",
    milestone: 20,
    type: "pdf",
    title: "Economia e Banche Centrali — Guida Macro",
    description: "Come leggere le decisioni delle banche centrali (Fed, BCE, BOJ) e utilizzarle per orientare le tue view direzionali sui mercati.",
    thumbnailUrl: UNSPLASH_MONEY,
    url: "https://www.investopedia.com/terms/c/centralbank.asp",
    author: "Investopedia",
  },
  {
    id: "r25-1",
    milestone: 25,
    type: "video",
    title: "Order Flow & Footprint Charts",
    description: "Analisi del flusso degli ordini, footprint charts, delta e imbalances di volume per capire dove i market maker posizionano i trade.",
    thumbnailUrl: UNSPLASH_CHART,
    url: "https://www.youtube.com/results?search_query=order+flow+footprint+chart+trading+tutorial",
    duration: "45–90 min",
    author: "Curation TraderLOADING",
  },
  {
    id: "r25-2",
    milestone: 25,
    type: "presentazione",
    title: "Mindset del Trader Professionista",
    description: "Slide deck ispirate a Mark Douglas e Van K. Tharp: come costruire un sistema di credenze che supporti la tua crescita come trader.",
    thumbnailUrl: UNSPLASH_ZEN,
    url: "https://www.youtube.com/results?search_query=mark+douglas+trading+in+the+zone+presentation",
    author: "Curation TraderLOADING",
  },
  {
    id: "r30-1",
    milestone: 30,
    type: "video",
    title: "Strategie Istituzionali — Smart Money Avanzato",
    description: "IPDA (Interbank Price Delivery Algorithm), sessioni istituzionali, manipulation patterns e come anticipare i movimenti del mercato.",
    thumbnailUrl: UNSPLASH_DATA,
    url: "https://www.youtube.com/results?search_query=institutional+trading+strategies+IPDA+advanced",
    duration: "60–120 min",
    author: "Curation TraderLOADING",
  },
  {
    id: "r30-2",
    milestone: 30,
    type: "pdf",
    title: "Costruire un Edge Statistico",
    description: "Come testare e validare la propria strategia con dati storici, calcolare il win rate atteso, Kelly criterion e simulazioni Monte Carlo.",
    thumbnailUrl: UNSPLASH_BOOK,
    url: "https://www.investopedia.com/articles/trading/09/statistically-test-trading-strategies.asp",
    author: "Investopedia",
  },
];

export const MILESTONES = [5, 10, 15, 20, 25, 30];

export function getRewardsForMilestone(milestone: number): Reward[] {
  return REWARDS.filter((r) => r.milestone === milestone);
}

export function getUnlockedRewards(level: number): Reward[] {
  return REWARDS.filter((r) => level >= r.milestone);
}

export function getLockedMilestones(level: number): number[] {
  return MILESTONES.filter((m) => level < m);
}

export function getNextMilestone(level: number): number | null {
  return MILESTONES.find((m) => m > level) ?? null;
}

export function getMilestoneProgress(level: number): number {
  const next = getNextMilestone(level);
  if (!next) return 100;
  const prev = MILESTONES.filter((m) => m <= level).at(-1) ?? 0;
  return Math.round(((level - prev) / (next - prev)) * 100);
}
