/**
 * LIMEN PROTOCOL — Chronicles of Detachment (Le Cronache del Distacco)
 * Types and models for the 3D Campaign, Tactical Expedition Roguelite, and Persistent Arsenal.
 */

// -------------------------------------------------------------
// 1. CAMPAIGN CHAPTERS (3D ACTION RUNNER)
// -------------------------------------------------------------

export interface CampaignChapter {
  id: number;
  title: string;
  subtitle: string;
  lorePreamble: string;
  doctrineQuote: string;
  targetMeters: number;
  targetAurei?: number;
  targetSpikesAvoided?: number;
  isBossChapter?: boolean;
  bossName?: string;
  bossMaxHp?: number;
  rewardAurei: number;
  accentColor: string;
}

export interface BullRunnerSkills {
  magnetismLevel: number; // 0, 1, 2, 3
  shieldCharges: number; // 1 (base) or 2 (titanium)
  bulletTimeEnabled: boolean;
  activeSkin: "gold" | "obsidian" | "emerald";
}

// -------------------------------------------------------------
// 2. TACTICAL EXPEDITION (ROGUELITE DECKBUILDER)
// -------------------------------------------------------------

export type CardRarity = "common" | "uncommon" | "legendary";
export type CardType = "defense" | "attack" | "utility" | "zen";

export interface DisciplineCard {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  costMana: number;
  description: string;
  shieldGain?: number;
  damageValue?: number;
  sanityHeal?: number;
  specialEffect?: "draw_cards" | "reflect" | "convert_coins" | "cleanse_anxiety";
  effectValue?: number;
}

export interface Relic {
  id: string;
  name: string;
  description: string;
  iconName: string;
}

export interface MarketEnemy {
  id: string;
  name: string;
  title: string;
  maxHp: number;
  currentHp: number;
  nextIntent: {
    type: "attack" | "debuff" | "squeeze" | "defend";
    value: number;
    description: string;
  };
  spriteType: "hft_bot" | "stop_hunter" | "breakout_trap" | "fomo_wraith" | "drift_shadow_boss";
}

export interface OracleDilemmaChoice {
  text: string;
  outcomeText: string;
  effect: {
    sanityDelta?: number;
    coinsDelta?: number;
    relicReward?: Relic;
    cardReward?: DisciplineCard;
  };
}

export interface OracleDilemma {
  id: string;
  title: string;
  scenarioText: string;
  choices: [OracleDilemmaChoice, OracleDilemmaChoice];
}

export type ExpeditionNodeType = "battle" | "oracle" | "bazaar" | "oasis" | "boss";

export interface ExpeditionNode {
  id: string;
  sectorIndex: number;
  stepIndex: number; // 0, 1, 2, 3, 4
  laneIndex: number; // 0, 1, 2
  type: ExpeditionNodeType;
  title: string;
  completed: boolean;
  available: boolean;
}

export interface ExpeditionRunState {
  isActive: boolean;
  sector: number; // 1 to 4
  currentStep: number;
  currentNodeId: string | null;
  sanity: number;
  maxSanity: number;
  mana: number;
  maxMana: number;
  capitalAurei: number;
  deck: DisciplineCard[];
  hand: DisciplineCard[];
  discardPile: DisciplineCard[];
  drawPile: DisciplineCard[];
  relics: Relic[];
  activeShield: number;
  currentEnemy: MarketEnemy | null;
  currentDilemma: OracleDilemma | null;
}

// -------------------------------------------------------------
// 3. PERSISTENT RECORDS & PROFILE
// -------------------------------------------------------------

export interface ChroniclesPersistence {
  unlockedChapter: number; // 1 to 5
  completedChapters: number[];
  bullSkills: BullRunnerSkills;
  totalAureiWallet: number;
  bestExpeditionSector: number;
  totalExpeditionsWon: number;
  totalDetachmentSeconds: number;
}
