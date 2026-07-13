// Tornei: REST router (off-contract, come i journal-recaps — accesso diretto via
// apiJSON lato client). Tutte le letture lavorano sulle standings materializzate.
// L'iscrizione richiede conto reale sincronizzato + consenso; il claim concia il
// certificato on-chain quando wallet + provider sono presenti.

import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  tournamentStandingsTable,
  tournamentPrizesTable,
  tournamentCertificatesTable,
  profileTable,
  type TournamentSeason,
  type TournamentStanding,
  type TournamentCertificate,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getUserId } from "./profile.js";
import {
  getActiveSeason,
  isEnrolled,
  enrollUser,
  resolveSyncedAccount,
  countEnrollments,
  readBoard,
  readHall,
  nextDivisionFor,
} from "../services/tornei/store.js";
import { checkEligibility } from "../services/tornei/eligibility.js";
import { getMintProvider } from "../services/tornei/mint/provider.js";

const router: IRouter = Router();

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
}

function seasonDto(s: TournamentSeason) {
  return {
    id: s.id,
    slug: s.slug,
    label: s.label,
    status: s.status,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    settledAt: s.settledAt ? s.settledAt.toISOString() : null,
  };
}

function seasonProgress(s: TournamentSeason): number {
  if (s.status === "upcoming") return 0;
  if (s.status === "ended") return 1;
  const now = Date.now();
  const start = s.startsAt.getTime();
  const end = s.endsAt.getTime();
  if (now <= start) return 0;
  if (now >= end) return 1;
  return (now - start) / (end - start);
}

// Board pseudonima: niente userId grezzo, solo un flag `me` per la riga propria.
function standingDto(s: TournamentStanding, viewerUserId: string) {
  return {
    id: s.id,
    displayName: s.displayName,
    avatarUrl: s.avatarUrl,
    rCum: s.rCum,
    discIndex: s.discIndex,
    score: s.score,
    division: s.division,
    rank: s.rank,
    prevRank: s.prevRank,
    trades: s.trades,
    dq: s.dq,
    dqReason: s.dqReason,
    me: s.userId === viewerUserId,
  };
}

function certDto(c: TournamentCertificate) {
  return {
    id: c.id,
    seasonLabel: c.seasonLabel,
    tier: c.tier,
    edition: c.edition,
    rarity: c.rarity,
    mintStatus: c.mintStatus,
    walletAddress: c.walletAddress,
    chain: c.chain,
    contractAddress: c.contractAddress,
    tokenId: c.tokenId,
    txHash: c.txHash,
  };
}

// ── GET /tornei/current ──────────────────────────────────────────────────────
router.get("/tornei/current", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const season = await getActiveSeason();
  if (!season) {
    res.json({ season: null, enrolled: false, totalPlayers: 0, progress: 0 });
    return;
  }
  res.json({
    season: seasonDto(season),
    enrolled: await isEnrolled(season.id, userId),
    totalPlayers: await countEnrollments(season.id),
    progress: seasonProgress(season),
  });
});

// ── GET /tornei/standings?metric=r|ts ────────────────────────────────────────
router.get("/tornei/standings", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const metric = req.query.metric === "ts" ? "ts" : "r";
  const season = await getActiveSeason();
  if (!season) {
    res.json({ board: [], dq: [], me: null, total: 0 });
    return;
  }
  const { board, dq, me, total } = await readBoard(season.id, metric, userId);
  res.json({
    board: board.map((s) => standingDto(s, userId)),
    dq: dq.map((s) => standingDto(s, userId)),
    me: me ? standingDto(me, userId) : null,
    total,
  });
});

// ── GET /tornei/me (vista Percorso) ──────────────────────────────────────────
router.get("/tornei/me", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const season = await getActiveSeason();
  const certificates = await db
    .select()
    .from(tournamentCertificatesTable)
    .where(eq(tournamentCertificatesTable.userId, userId))
    .orderBy(sql`${tournamentCertificatesTable.createdAt} desc`);

  if (!season) {
    res.json({ standing: null, nextDivision: null, prizes: [], certificates: certificates.map(certDto) });
    return;
  }

  const [standing] = await db
    .select()
    .from(tournamentStandingsTable)
    .where(
      and(eq(tournamentStandingsTable.seasonId, season.id), eq(tournamentStandingsTable.userId, userId)),
    )
    .limit(1);

  const prizes = await db
    .select()
    .from(tournamentPrizesTable)
    .where(
      and(eq(tournamentPrizesTable.seasonId, season.id), eq(tournamentPrizesTable.userId, userId)),
    );

  res.json({
    standing: standing ? standingDto(standing, userId) : null,
    nextDivision: standing ? nextDivisionFor(standing.score) : null,
    prizes: prizes.map((p) => ({
      tier: p.tier,
      xpAwarded: p.xpAwarded,
      proMonths: p.proMonths,
      status: p.status,
      certificateId: p.certificateId,
    })),
    certificates: certificates.map(certDto),
  });
});

// ── GET /tornei/hall (Albo d'oro) ────────────────────────────────────────────
router.get("/tornei/hall", async (_req: Request, res: Response) => {
  const entries = await readHall();
  res.json({
    entries: entries.map((e) => ({
      seasonLabel: e.seasonLabel,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      champion: e.champion,
      rCum: e.rCum,
      discIndex: e.discIndex,
    })),
  });
});

// ── GET /tornei/certificates ─────────────────────────────────────────────────
router.get("/tornei/certificates", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const certificates = await db
    .select()
    .from(tournamentCertificatesTable)
    .where(eq(tournamentCertificatesTable.userId, userId))
    .orderBy(sql`${tournamentCertificatesTable.createdAt} desc`);
  res.json({ certificates: certificates.map(certDto) });
});

// ── GET/PUT /tornei/wallet (indirizzo per il conio NFT) ──────────────────────
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

router.get("/tornei/wallet", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const [profile] = await db
    .select({ walletAddress: profileTable.walletAddress })
    .from(profileTable)
    .where(eq(profileTable.userId, userId))
    .limit(1);
  // mintEnabled: whether the on-chain mint is configured (TORNEI_MINT_*). The FE
  // hides the claim CTA and shows an honest "mint in arrivo" label when false,
  // instead of promising an NFT that POST /certificates/:id/claim will 503 on.
  res.json({ walletAddress: profile?.walletAddress ?? null, mintEnabled: getMintProvider() !== null });
});

router.put("/tornei/wallet", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const raw = typeof req.body?.walletAddress === "string" ? req.body.walletAddress.trim() : "";
  const walletAddress = raw === "" ? null : raw;
  if (walletAddress !== null && !EVM_ADDRESS_RE.test(walletAddress)) {
    res.status(400).json({ error: "invalid_address" });
    return;
  }
  await db.update(profileTable).set({ walletAddress }).where(eq(profileTable.userId, userId));
  res.json({ walletAddress });
});

// ── POST /tornei/enroll ──────────────────────────────────────────────────────
router.post("/tornei/enroll", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const season = await getActiveSeason();
  if (!season) {
    res.status(409).json({ error: "no_season", reason: "season_closed" });
    return;
  }
  const synced = await resolveSyncedAccount(userId);
  const result = checkEligibility({
    hasSyncedRealAccount: synced !== null,
    consent: req.body?.consent === true,
    seasonStatus: season.status as "upcoming" | "live" | "ended",
  });
  if (!result.ok) {
    const status = result.reason === "no_real_account" ? 402 : 409;
    res.status(status).json({ error: "not_eligible", reason: result.reason });
    return;
  }
  await enrollUser({ seasonId: season.id, userId, accountId: synced!.accountId });
  res.status(201).json({ ok: true });
});

// ── POST /tornei/certificates/:id/claim (conio on-chain) ─────────────────────
router.post("/tornei/certificates/:id/claim", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "bad_id" });
    return;
  }
  const [cert] = await db
    .select()
    .from(tournamentCertificatesTable)
    .where(and(eq(tournamentCertificatesTable.id, id), eq(tournamentCertificatesTable.userId, userId)))
    .limit(1);
  if (!cert) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (cert.mintStatus === "minted") {
    res.json({ certificate: certDto(cert) });
    return;
  }
  const [profile] = await db
    .select({ walletAddress: profileTable.walletAddress })
    .from(profileTable)
    .where(eq(profileTable.userId, userId))
    .limit(1);
  if (!profile?.walletAddress) {
    res.status(400).json({ error: "no_wallet" });
    return;
  }
  const provider = getMintProvider();
  if (!provider) {
    res.status(503).json({ error: "minting_unavailable" });
    return;
  }

  // Atomically claim the certificate for minting: only the request that flips
  // claimable/failed -> pending proceeds. Without this compare-and-set two
  // concurrent claims (double click, retry, multiple tabs) would both call
  // provider.mint() and emit two on-chain NFTs at real gas cost.
  const claimed = await db
    .update(tournamentCertificatesTable)
    .set({ mintStatus: "pending", walletAddress: profile.walletAddress })
    .where(
      and(
        eq(tournamentCertificatesTable.id, id),
        inArray(tournamentCertificatesTable.mintStatus, ["claimable", "failed"]),
      ),
    )
    .returning({ id: tournamentCertificatesTable.id });
  if (claimed.length === 0) {
    // Another request already claimed it (mint in progress or completed).
    res.status(409).json({ error: "mint_in_progress" });
    return;
  }

  try {
    const tokenUri = `${appBaseUrl()}/api/tornei/certificates/${id}/metadata`;
    const minted = await provider.mint({
      certificateId: id,
      tier: cert.tier,
      seasonLabel: cert.seasonLabel,
      toAddress: profile.walletAddress,
      tokenUri,
    });
    await db
      .update(tournamentCertificatesTable)
      .set({
        mintStatus: "minted",
        tokenId: minted.tokenId,
        txHash: minted.txHash,
        contractAddress: minted.contractAddress,
        chain: minted.chain,
        mintedAt: new Date(),
        lastError: null,
      })
      .where(eq(tournamentCertificatesTable.id, id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(tournamentCertificatesTable)
      .set({ mintStatus: "failed", lastError: message })
      .where(eq(tournamentCertificatesTable.id, id));
    res.status(502).json({ error: "mint_failed", message });
    return;
  }

  const [updated] = await db
    .select()
    .from(tournamentCertificatesTable)
    .where(eq(tournamentCertificatesTable.id, id))
    .limit(1);
  res.json({ certificate: updated ? certDto(updated) : null });
});

// ── GET /tornei/certificates/:id/metadata (ERC-721, pubblico per i wallet) ───
router.get("/tornei/certificates/:id/metadata", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "bad_id" });
    return;
  }
  const [cert] = await db
    .select()
    .from(tournamentCertificatesTable)
    .where(eq(tournamentCertificatesTable.id, id))
    .limit(1);
  if (!cert) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({
    name: `TraderLoading ${cert.tier} · ${cert.seasonLabel}`,
    description: `Certificato ${cert.rarity} del torneo TraderLoading — stagione ${cert.seasonLabel}.`,
    image: `${appBaseUrl()}/api/tornei/certificates/${id}/image.svg`,
    attributes: [
      { trait_type: "Tier", value: cert.tier },
      { trait_type: "Edition", value: cert.edition },
      { trait_type: "Rarity", value: cert.rarity },
      { trait_type: "Season", value: cert.seasonLabel },
    ],
  });
});

export default router;
