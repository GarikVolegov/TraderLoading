export const LEVEL_NAMES: Record<number, string> = {
  1: "Novizio Consapevole",
  2: "Apprendista Disciplinato",
  3: "Osservatore Silenzioso",
  4: "Analista in Formazione",
  5: "Samurai della Pazienza",
  6: "Cacciatore di Pattern",
  7: "Guardiano del Risk",
  8: "Maestro del Timeframe",
  9: "Sentinella dei Mercati",
  10: "Stratega dell'Incertezza",
  11: "Architetto del Piano",
  12: "Mente Antifrágile",
  13: "Ombra del Mercato",
  14: "Custode della Disciplina",
  15: "Ninja della Liquidità",
  16: "Alchimista delle Probabilità",
  17: "Falco dello Smart Money",
  18: "Sensei dell'Order Flow",
  19: "Leggenda del Trading",
  20: "Maestro Supremo",
};

export function getLevelName(level: number): string {
  if (level <= 0) return "Novizio Consapevole";
  if (level in LEVEL_NAMES) return LEVEL_NAMES[level];
  if (level > 20) return "Maestro Supremo";
  return `Trader Livello ${level}`;
}

export interface LevelBadge {
  emoji: string;
  color: string;
}

export const LEVEL_BADGES: Record<number, LevelBadge> = {
  1: { emoji: "🌱", color: "text-green-400" },
  2: { emoji: "📖", color: "text-blue-400" },
  3: { emoji: "👁️", color: "text-slate-400" },
  4: { emoji: "🔍", color: "text-cyan-400" },
  5: { emoji: "⚔️", color: "text-amber-400" },
  6: { emoji: "🎯", color: "text-orange-400" },
  7: { emoji: "🛡️", color: "text-red-400" },
  8: { emoji: "🗺️", color: "text-purple-400" },
  9: { emoji: "🦅", color: "text-sky-400" },
  10: { emoji: "♟️", color: "text-yellow-400" },
  11: { emoji: "🏛️", color: "text-teal-400" },
  12: { emoji: "⚗️", color: "text-lime-400" },
  13: { emoji: "🌑", color: "text-zinc-400" },
  14: { emoji: "🏯", color: "text-rose-400" },
  15: { emoji: "🥷", color: "text-indigo-400" },
  16: { emoji: "🔮", color: "text-violet-400" },
  17: { emoji: "🦅", color: "text-amber-500" },
  18: { emoji: "🌊", color: "text-blue-500" },
  19: { emoji: "🐉", color: "text-primary" },
  20: { emoji: "👑", color: "text-yellow-300" },
};

export function getLevelBadge(level: number): LevelBadge {
  if (level in LEVEL_BADGES) return LEVEL_BADGES[level];
  if (level > 20) return { emoji: "👑", color: "text-yellow-300" };
  return { emoji: "⭐", color: "text-primary" };
}
