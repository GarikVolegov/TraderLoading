import {
  Globe, MessageCircle, Radio, Trophy, Award,
  TrendingUp, BookOpen, Lightbulb, Target, BarChart3, Calendar,
  Wind, Clock, Eye, Heart, BrainCircuit,
} from "lucide-react";

export type HubItem = {
  href: string;
  /** Route path used for active matching (query stripped). Defaults to href. */
  path?: string;
  /** When set, active also requires the current ?t= to equal this value. */
  tab?: string;
  icon: React.ElementType;
  labelKey: string;
};

export type Hub = {
  id: string;
  /** Routes that put the bottom nav into this hub's contextual mode. */
  routes: string[];
  items: readonly HubItem[];
};

const COMMUNITY_HUB: Hub = {
  id: "community",
  routes: ["/chat", "/tornei"],
  items: [
    { href: "/chat?t=social",     path: "/chat", tab: "social",     icon: Globe,         labelKey: "chat.tab.social" },
    { href: "/chat?t=messaggi",   path: "/chat", tab: "messaggi",   icon: MessageCircle, labelKey: "chat.tab.messages" },
    { href: "/chat?t=comunita",   path: "/chat", tab: "comunita",   icon: Radio,         labelKey: "chat.tab.community" },
    { href: "/chat?t=classifica", path: "/chat", tab: "classifica", icon: Trophy,        labelKey: "chat.tab.leaderboard" },
    { href: "/tornei",            path: "/tornei",                  icon: Award,         labelKey: "tornei.nav" },
  ],
};

const JOURNAL_HUB: Hub = {
  id: "journal",
  routes: ["/journal"],
  items: [
    { href: "/journal?t=panoramica",         path: "/journal", tab: "panoramica",         icon: TrendingUp, labelKey: "journal.tab.overview" },
    { href: "/journal?t=trades",             path: "/journal", tab: "trades",             icon: BookOpen,   labelKey: "journal.tab.trades" },
    { href: "/journal?t=idee",               path: "/journal", tab: "idee",               icon: Lightbulb,  labelKey: "journal.tab.ideas" },
    { href: "/journal?t=obiettivi",          path: "/journal", tab: "obiettivi",          icon: Target,     labelKey: "journal.tab.goals" },
    { href: "/journal?t=recap-settimanale",  path: "/journal", tab: "recap-settimanale",  icon: BarChart3,  labelKey: "journal.tab.weekly" },
    { href: "/journal?t=recap-mensile",      path: "/journal", tab: "recap-mensile",      icon: Calendar,   labelKey: "journal.tab.four_week" },
  ],
};

const ZEN_HUB: Hub = {
  id: "zen",
  routes: ["/zen"],
  items: [
    { href: "/zen?t=breathing",     path: "/zen", tab: "breathing",     icon: Wind,         labelKey: "zen.tab.breathing" },
    { href: "/zen?t=meditation",    path: "/zen", tab: "meditation",    icon: Clock,        labelKey: "zen.tab.meditation" },
    { href: "/zen?t=visualization", path: "/zen", tab: "visualization", icon: Eye,          labelKey: "zen.tab.visualization" },
    { href: "/zen?t=gratitude",     path: "/zen", tab: "gratitude",     icon: Heart,        labelKey: "zen.tab.gratitude" },
    { href: "/zen?t=quotes",        path: "/zen", tab: "quotes",        icon: BookOpen,     labelKey: "zen.tab.quotes" },
    { href: "/zen?t=insight",       path: "/zen", tab: "insight",       icon: BrainCircuit, labelKey: "zen.tab.insight" },
  ],
};

export const HUBS: readonly Hub[] = [COMMUNITY_HUB, JOURNAL_HUB, ZEN_HUB];

/** Tornei, reused as a standalone shortcut on the desktop sidebar outside any hub. */
export const TORNEI_ITEM = COMMUNITY_HUB.items[4];

/** Resolves which hub (if any) a location's pathname puts the nav into. */
export function matchHub(location: string): Hub | undefined {
  return HUBS.find((hub) =>
    hub.routes.some((route) => location === route || location.startsWith(`${route}/`)),
  );
}

const MAX_DIRECT_ITEMS = 5;
const PRIMARY_COUNT_WHEN_OVERFLOWING = 4;

/**
 * Mobile bottom pill can only fit so many slots (arrow + items). Hubs with
 * up to 5 items render flat; beyond that the rest collapse into an
 * overflow sheet.
 */
export function splitHubItems(items: readonly HubItem[]): {
  primary: readonly HubItem[];
  overflow: readonly HubItem[];
} {
  if (items.length <= MAX_DIRECT_ITEMS) {
    return { primary: items, overflow: [] };
  }
  return {
    primary: items.slice(0, PRIMARY_COUNT_WHEN_OVERFLOWING),
    overflow: items.slice(PRIMARY_COUNT_WHEN_OVERFLOWING),
  };
}
