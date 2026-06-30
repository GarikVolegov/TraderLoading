// Liquidazione di una stagione conclusa: dalle standings congelate assegna i
// premi (XP + estensione entitlement Pro interno + certificato) in modo
// idempotente. Sicura da rieseguire: i premi hanno chiave unica (season,user,tier)
// e l'inserimento usa ON CONFLICT DO NOTHING, quindi XP/Pro non vengono mai
// raddoppiati.

import {
  db,
  tournamentSeasonsTable,
  tournamentStandingsTable,
  tournamentPrizesTable,
  tournamentCertificatesTable,
  profileTable,
  adminUserSubscriptionsTable,
  adminAuditLogsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { qualifyPrizes } from "./prizes.js";
import type { ComputedStanding } from "./standings.js";
import type { CertTier } from "./constants.js";
import { extendProEntitlement } from "./proEntitlement.js";
import { getMintProvider } from "./mint/provider.js";
import { computeLevel } from "../../routes/profile.js";

const CERT_META: Record<CertTier, { title: string; rarity: string; edition: string }> = {
  champion: { title: "Champion", rarity: "Leggendario", edition: "Ed. 1 / 1" },
  podio: { title: "Podio", rarity: "Epico", edition: "Ed. 1 / 2" },
  finisher: { title: "Finisher", rarity: "Raro", edition: "Open Edition" },
};

export async function settleSeason(
  seasonId: number,
): Promise<{ awardsGranted: number; certificatesCreated: number }> {
  const [season] = await db
    .select()
    .from(tournamentSeasonsTable)
    .where(eq(tournamentSeasonsTable.id, seasonId))
    .limit(1);
  if (!season) return { awardsGranted: 0, certificatesCreated: 0 };

  const standings = await db
    .select()
    .from(tournamentStandingsTable)
    .where(eq(tournamentStandingsTable.seasonId, seasonId));

  const computed: ComputedStanding[] = standings.map((s) => ({
    userId: s.userId,
    displayName: s.displayName,
    avatarUrl: s.avatarUrl,
    rCum: s.rCum,
    discIndex: s.discIndex,
    score: s.score,
    division: s.division as ComputedStanding["division"],
    rank: s.rank,
    trades: s.trades,
    dq: s.dq,
    dqReason: s.dqReason,
  }));

  const awards = qualifyPrizes(computed);
  const provider = getMintProvider();
  const now = new Date();
  let awardsGranted = 0;
  let certificatesCreated = 0;

  for (const a of awards) {
    const inserted = await db
      .insert(tournamentPrizesTable)
      .values({
        seasonId,
        userId: a.userId,
        tier: a.tier,
        xpAwarded: a.xp,
        proMonths: a.proMonths,
        status: "granted",
      })
      .onConflictDoNothing({
        target: [tournamentPrizesTable.seasonId, tournamentPrizesTable.userId, tournamentPrizesTable.tier],
      })
      .returning({ id: tournamentPrizesTable.id });
    if (inserted.length === 0) continue; // già assegnato in una run precedente
    awardsGranted += 1;

    // XP (riusa il sistema esistente; ricalcola il livello).
    if (a.xp > 0) {
      const [p] = await db
        .select({ xp: profileTable.xp })
        .from(profileTable)
        .where(eq(profileTable.userId, a.userId))
        .limit(1);
      const newXp = (p?.xp ?? 0) + a.xp;
      const { level } = computeLevel(newXp);
      await db
        .update(profileTable)
        .set({ xp: newXp, level })
        .where(eq(profileTable.userId, a.userId));
    }

    // Pro: estende l'entitlement interno (nessun addebito Stripe).
    if (a.proMonths > 0) {
      const [sub] = await db
        .select({ currentPeriodEnd: adminUserSubscriptionsTable.currentPeriodEnd })
        .from(adminUserSubscriptionsTable)
        .where(eq(adminUserSubscriptionsTable.userId, a.userId))
        .limit(1);
      const end = extendProEntitlement(
        { currentPeriodEnd: sub?.currentPeriodEnd ?? null },
        a.proMonths,
        now,
      );
      const reason = `Torneo ${season.label} – ${a.tier}`;
      await db
        .insert(adminUserSubscriptionsTable)
        .values({
          userId: a.userId,
          plan: "pro",
          status: "active",
          source: "tornei",
          manualOverride: true,
          currentPeriodEnd: end,
          reason,
          updatedBy: "tornei",
        })
        .onConflictDoUpdate({
          target: adminUserSubscriptionsTable.userId,
          set: {
            plan: "pro",
            status: "active",
            source: "tornei",
            manualOverride: true,
            currentPeriodEnd: end,
            reason,
            updatedBy: "tornei",
            updatedAt: now,
          },
        });
    }

    // Certificato NFT: pending se wallet presente e provider configurato, altrimenti claimable.
    if (a.certTier) {
      const meta = CERT_META[a.certTier];
      const [profile] = await db
        .select({
          name: profileTable.name,
          avatarUrl: profileTable.avatarUrl,
          walletAddress: profileTable.walletAddress,
        })
        .from(profileTable)
        .where(eq(profileTable.userId, a.userId))
        .limit(1);
      const willMint = Boolean(profile?.walletAddress) && provider !== null;
      const certRows = await db
        .insert(tournamentCertificatesTable)
        .values({
          seasonId,
          seasonLabel: season.label,
          userId: a.userId,
          userName: profile?.name ?? "Trader",
          avatarUrl: profile?.avatarUrl ?? null,
          tier: a.certTier,
          edition: meta.edition,
          rarity: meta.rarity,
          mintStatus: willMint ? "pending" : "claimable",
          walletAddress: profile?.walletAddress ?? null,
        })
        .onConflictDoNothing({
          target: [
            tournamentCertificatesTable.seasonId,
            tournamentCertificatesTable.userId,
            tournamentCertificatesTable.tier,
          ],
        })
        .returning({ id: tournamentCertificatesTable.id });
      if (certRows.length > 0) {
        certificatesCreated += 1;
        await db
          .update(tournamentPrizesTable)
          .set({ certificateId: certRows[0].id })
          .where(
            and(
              eq(tournamentPrizesTable.seasonId, seasonId),
              eq(tournamentPrizesTable.userId, a.userId),
              eq(tournamentPrizesTable.tier, a.tier),
            ),
          );
      }
    }
  }

  await db
    .update(tournamentSeasonsTable)
    .set({ settledAt: now })
    .where(eq(tournamentSeasonsTable.id, seasonId));

  await db.insert(adminAuditLogsTable).values({
    actorUserId: "system",
    actorRole: "system",
    action: "tornei.settle",
    targetType: "tournament_season",
    targetId: String(seasonId),
    after: { awardsGranted, certificatesCreated },
  });

  return { awardsGranted, certificatesCreated };
}
