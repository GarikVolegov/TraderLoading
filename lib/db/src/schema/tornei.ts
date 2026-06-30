import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ── Stagioni: globali e trimestrali, ciclo del 7 ─────────────────────────────
export const tournamentSeasonsTable = pgTable(
  "tournament_seasons",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(), // "2025-q3"
    label: text("label").notNull(), // "Q3 2025"
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    status: text("status").notNull().default("upcoming"), // upcoming | live | ended
    settledAt: timestamp("settled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tournament_seasons_slug_unique").on(t.slug),
    index("tournament_seasons_status_idx").on(t.status),
  ],
);

// ── Iscrizioni: opt-in, conto reale sincronizzato, il conteggio parte da qui ──
export const tournamentEnrollmentsTable = pgTable(
  "tournament_enrollments",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id").notNull(),
    userId: text("user_id").notNull(),
    accountId: text("account_id").notNull(),
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
    consentAt: timestamp("consent_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tournament_enrollments_season_user_unique").on(t.seasonId, t.userId),
    index("tournament_enrollments_user_idx").on(t.userId),
  ],
);

// ── Classifica materializzata: letture senza aggregazioni a runtime ──────────
export const tournamentStandingsTable = pgTable(
  "tournament_standings",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id").notNull(),
    userId: text("user_id").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    rCum: doublePrecision("r_cum").notNull().default(0),
    discIndex: integer("disc_index").notNull().default(0), // 0-100
    score: doublePrecision("score").notNull().default(0),
    division: text("division").notNull().default("bronzo"),
    rank: integer("rank").notNull().default(0),
    prevRank: integer("prev_rank").notNull().default(0),
    trades: integer("trades").notNull().default(0),
    streak: integer("streak").notNull().default(0),
    dq: boolean("dq").notNull().default(false),
    dqReason: text("dq_reason"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tournament_standings_season_user_unique").on(t.seasonId, t.userId),
    index("tournament_standings_season_score_idx").on(t.seasonId, t.score),
  ],
);

// ── Premi assegnati a fine stagione (idempotente per season/user/tier) ───────
export const tournamentPrizesTable = pgTable(
  "tournament_prizes",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id").notNull(),
    userId: text("user_id").notNull(),
    tier: text("tier").notNull(), // champ | podium | top10 | disc | finish
    xpAwarded: integer("xp_awarded").notNull().default(0),
    proMonths: integer("pro_months").notNull().default(0),
    certificateId: integer("certificate_id"),
    status: text("status").notNull().default("granted"), // granted | partial | failed
    grantedAt: timestamp("granted_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tournament_prizes_season_user_tier_unique").on(t.seasonId, t.userId, t.tier),
  ],
);

// ── Certificati NFT: claimable → pending → minted (on-chain) | failed ────────
export const tournamentCertificatesTable = pgTable(
  "tournament_certificates",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id").notNull(),
    seasonLabel: text("season_label").notNull(),
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),
    avatarUrl: text("avatar_url"),
    tier: text("tier").notNull(), // champion | podio | finisher
    edition: text("edition").notNull().default("Open Edition"),
    rarity: text("rarity").notNull().default("Raro"),
    mintStatus: text("mint_status").notNull().default("claimable"), // claimable | pending | minted | failed
    walletAddress: text("wallet_address"),
    chain: text("chain"),
    contractAddress: text("contract_address"),
    tokenId: text("token_id"),
    txHash: text("tx_hash"),
    mintedAt: timestamp("minted_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("tournament_certificates_user_idx").on(t.userId),
    uniqueIndex("tournament_certificates_season_user_tier_unique").on(t.seasonId, t.userId, t.tier),
  ],
);

export type TournamentSeason = typeof tournamentSeasonsTable.$inferSelect;
export type TournamentEnrollment = typeof tournamentEnrollmentsTable.$inferSelect;
export type TournamentStanding = typeof tournamentStandingsTable.$inferSelect;
export type TournamentPrize = typeof tournamentPrizesTable.$inferSelect;
export type TournamentCertificate = typeof tournamentCertificatesTable.$inferSelect;
