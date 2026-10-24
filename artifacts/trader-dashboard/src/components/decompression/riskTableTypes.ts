/**
 * LIMEN PROTOCOL — Il Banco del Rischio (Trans-Limen Roguelite Poker 3D)
 * Type definitions, data models, and poker hand scoring for the 3D Decompression Chamber.
 */

export type MarketSuit = "liquidity" | "structure" | "volume" | "volatility";

export interface MarketCard {
  id: string;
  rank: number; // 2..14 (11=M15, 12=H1, 13=H4, 14=D1)
  suit: MarketSuit;
  baseChips: number;
  foil?: "none" | "holo" | "polychrome";
}

export type MarketHandType =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush"
  | "royal_flush";

export interface HandEvaluation {
  handType: MarketHandType;
  handName: string;
  baseChips: number;
  baseMult: number;
  scoredCards: MarketCard[];
  bonusChips: number;
  bonusMult: number;
  totalScore: number;
}

export type SigilRarity = "comune" | "rara" | "sovrana";

export interface SigilCard {
  id: string;
  name: string;
  title: string;
  description: string;
  lore: string;
  costAurei: number;
  rarity: SigilRarity;
  iconName: string;
  // Trigger effects:
  effectType:
    | "mult_on_suit"
    | "chips_on_suit"
    | "mult_on_hand_type"
    | "chips_on_pair"
    | "fold_capital_refund"
    | "hft_pair_grower"
    | "squeeze_enhancer"
    | "unused_discard_aurei"
    | "three_suits_mult"
    | "ace_solo_nuke"
    | "wealth_interest"
    | "black_swan_crit"
    | "fibonacci_mult"
    | "integrity_aura"
    | "fvg_straight_bridge"
    | "stop_loss_cushion";
}

export interface MarketVoucher {
  id: string;
  name: string;
  description: string;
  costAurei: number;
  type: "extra_hand" | "extra_discard" | "transmute_emerald" | "integrity_restore" | "aurei_grant";
}

export interface StartingDeck {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  unlocked: boolean;
  costAureiToUnlock: number;
  startingAurei: number;
  bonusHands: number;
  bonusDiscards: number;
  bonusMaxIntegrity: number;
  innateSigilId?: string;
}

export interface RoundRequirement {
  ante: number; // 1..8+
  targetScore: number;
  rewardAurei: number;
  name: string;
  subtitle: string;
  specialModifier?: "no_discards" | "volatility_storm" | "boss_bear_blind";
}

export interface RiskTablePersistence {
  totalAurei: number;
  highestAnteWon: number;
  totalHandsPlayed: number;
  totalDisciplinedFolds: number;
  unlockedDecks: string[];
  unlockedSigilIds: string[];
  selectedDeckId: string;
}
