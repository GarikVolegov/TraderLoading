export type EmojiCategory = {
  label: string;
  icon: string;
  emojis: string[];
};

export const ZEN_EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    label: "Emozioni",
    icon: "😊",
    emojis: [
      "😤","😰","😨","😟","😐","😑","😊","🙂","😄","😁",
      "🤩","😌","🧘","😓","😶","😔","😢","😠","🥴","😴",
    ],
  },
  {
    label: "Mentale",
    icon: "🧠",
    emojis: [
      "🧠","💡","🔑","🎯","💪","⚡","🔥","🛡️","⚖️","🦅",
      "🤔","💭","🔮","🗝️","🧩","🔍","📌","🏹","🔬","🎲",
    ],
  },
  {
    label: "Zen",
    icon: "🌿",
    emojis: [
      "🌿","🌸","🌊","🏔️","🌅","☀️","🌙","⭐","✨","🌱",
      "🌺","🍃","🌻","🕊️","🌈","🍀","🌾","🐚","🌝","🫧",
    ],
  },
  {
    label: "Trading",
    icon: "📈",
    emojis: [
      "📈","📉","💹","💰","💎","🏆","📊","⏰","💼","🎲",
      "💵","🪙","📋","🖥️","📡","💸","🏦","🔔","📰","🗓️",
    ],
  },
  {
    label: "Gratitudine",
    icon: "🙏",
    emojis: [
      "🙏","💫","🌟","❤️","🤝","🎉","💝","🫶","💖","😇",
      "🥰","🫂","👏","🙌","💐","🎊","✌️","☮️","🕊️","🌠",
    ],
  },
];

export const ALL_ZEN_EMOJIS: string[] = ZEN_EMOJI_CATEGORIES.flatMap(c => c.emojis);

export const MOOD_EMOJIS: { emoji: string; label: string }[] = [
  { emoji: "😤", label: "Agitato" },
  { emoji: "😰", label: "Ansioso" },
  { emoji: "😐", label: "Neutro" },
  { emoji: "😊", label: "Positivo" },
  { emoji: "😄", label: "Eccellente" },
  { emoji: "🧘", label: "Zen" },
];
