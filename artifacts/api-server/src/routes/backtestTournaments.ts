import { Router, type IRouter, type Request, type Response } from "express";
import { getUserId } from "./profile.js";
import {
  listTournaments,
  getTournamentByIdOrSlug,
  getTournamentLeaderboard,
  joinTournament,
  completeTournamentRun,
  listTribePresets,
  saveTribePreset,
  deleteTribePreset,
  createCustomLobby,
  getCustomLobbyByCode,
  listCandidates,
} from "../services/backtestTournaments/store.js";

const router: IRouter = Router();

// ── GET /backtest-tournaments: Lista tutti i tornei / battaglie disponibili ──
router.get("/backtest-tournaments", async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await listTournaments();
    res.json({ tournaments: list });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /backtest-tournaments/:id/leaderboard: Podio, Classifica e Dettagli ───
router.get("/backtest-tournaments/:id/leaderboard", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const tournamentId = Number(paramId) || 1;
    const leaderboard = await getTournamentLeaderboard(tournamentId, userId || undefined);
    if (!leaderboard) {
      res.status(404).json({ error: "Torneo non trovato" });
      return;
    }
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /backtest-tournaments/:id: Dettagli singolo torneo ───────────────────
router.get("/backtest-tournaments/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const tournament = await getTournamentByIdOrSlug(paramId);
    if (!tournament) {
      res.status(404).json({ error: "Torneo non trovato" });
      return;
    }
    res.json({ tournament });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /backtest-tournaments/:id/join: Iscrizione & lancio sessione replay ─
router.post("/backtest-tournaments/:id/join", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req) || "guest_player";
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const tournamentId = Number(paramId) || 1;
    const displayName = (req.body?.displayName as string) || (req.body?.name as string) || "Trader";
    const avatarUrl = req.body?.avatarUrl as string | undefined;
    const pair = req.body?.pair as string | undefined;
    const timeframe = req.body?.timeframe as string | undefined;
    const title = req.body?.title as string | undefined;

    const result = await joinTournament({
      tournamentId,
      userId,
      displayName,
      avatarUrl,
      pair,
      timeframe,
      title,
    });

    res.json({
      success: true,
      tournament: result.tournament,
      entry: result.entry,
      sessionId: result.sessionId,
      session: result.session,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ── POST /backtest-tournaments/:id/complete: Conclusione battaglia e vittoria ─
router.post("/backtest-tournaments/:id/complete", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req) || "guest_player";
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const tournamentId = Number(paramId) || 1;

    const initialBalance = Number(req.body?.initialBalance) || 100000;
    const finalBalance = Number(req.body?.finalBalance) || initialBalance;
    const totalProfit = Number(req.body?.totalProfit) || (finalBalance - initialBalance);
    const profitPct = Number(req.body?.profitPct) || (initialBalance > 0 ? (totalProfit / initialBalance) * 100 : 0);
    const winTrades = Number(req.body?.winTrades) || 0;
    const loseTrades = Number(req.body?.loseTrades) || 0;
    const totalTrades = Number(req.body?.totalTrades) || (winTrades + loseTrades);
    const winRate = Number(req.body?.winRate) || (totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0);
    const maxDrawdown = Number(req.body?.maxDrawdown) || 0;
    const avgTradeProfit = Number(req.body?.avgTradeProfit) || (totalTrades > 0 ? totalProfit / totalTrades : 0);

    const result = await completeTournamentRun({
      tournamentId,
      userId,
      initialBalance,
      finalBalance,
      totalProfit,
      profitPct,
      winRate,
      winTrades,
      loseTrades,
      totalTrades,
      maxDrawdown,
      avgTradeProfit,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /backtest-tournaments/tribes: Lista preset tribù utente + Limen official ──
router.get("/backtest-tournaments/tribes", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req) || "guest_player";
    const presets = await listTribePresets(userId);
    res.json({ tribes: presets });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /backtest-tournaments/tribes: Salva o aggiorna preset tribù ──────────────
router.post("/backtest-tournaments/tribes", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req) || "guest_player";
    const {
      id,
      tribeName,
      sigil,
      pair,
      timeframe,
      initialBalance,
      maxDrawdownPct,
      targetProfitPct,
      maxTrades,
      timeLimitSeconds,
      randomDates,
      defaultMembers,
    } = req.body || {};

    if (!tribeName || typeof tribeName !== "string" || !tribeName.trim()) {
      res.status(400).json({ error: "Il nome della tribù è obbligatorio" });
      return;
    }

    const saved = await saveTribePreset({
      id: id ? Number(id) : undefined,
      userId,
      tribeName: tribeName.trim(),
      sigil: sigil || "fratellanza",
      pair: pair || "XAU/USD",
      timeframe: timeframe || "M5",
      initialBalance: initialBalance || 100000,
      maxDrawdownPct: maxDrawdownPct || 10.0,
      targetProfitPct: targetProfitPct || 15.0,
      maxTrades: maxTrades ? Number(maxTrades) : 50,
      timeLimitSeconds: timeLimitSeconds ? Number(timeLimitSeconds) : 900,
      randomDates: randomDates ?? true,
      defaultMembers: Array.isArray(defaultMembers) ? defaultMembers : [],
    });

    res.json({ success: true, tribe: saved });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── DELETE /backtest-tournaments/tribes/:id: Elimina preset tribù ──────────────────
router.delete("/backtest-tournaments/tribes/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req) || "guest_player";
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const tribeId = Number(paramId);
    if (!tribeId) {
      res.status(400).json({ error: "ID tribù non valido" });
      return;
    }

    const deleted = await deleteTribePreset(tribeId, userId);
    res.json({ success: deleted });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /backtest-tournaments/custom-lobbies: Crea nuova stanza personalizzata ───
router.post("/backtest-tournaments/custom-lobbies", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req) || "guest_player";
    const {
      name,
      hostDisplayName,
      pair,
      timeframe,
      initialBalance,
      maxDrawdownPct,
      targetProfitPct,
      maxTrades,
      timeLimitSeconds,
      randomDates,
      tribePresetId,
    } = req.body || {};

    const lobbyName = (name && typeof name === "string" && name.trim()) || "Forgia di Battaglia";
    const hostName = (hostDisplayName && typeof hostDisplayName === "string" && hostDisplayName.trim()) || "Comandante";

    const created = await createCustomLobby({
      name: lobbyName,
      hostUserId: userId,
      hostDisplayName: hostName,
      pair: pair || "XAU/USD",
      timeframe: timeframe || "M5",
      initialBalance: initialBalance || 100000,
      maxDrawdownPct: maxDrawdownPct || 10.0,
      targetProfitPct: targetProfitPct || 15.0,
      maxTrades: maxTrades ? Number(maxTrades) : 50,
      timeLimitSeconds: timeLimitSeconds ? Number(timeLimitSeconds) : 900,
      randomDates: randomDates ?? true,
      tribePresetId: tribePresetId ? Number(tribePresetId) : undefined,
    });

    res.json({ success: true, lobby: created });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /backtest-tournaments/custom-lobbies/:code: Trova stanza per codice ───────
router.get("/backtest-tournaments/custom-lobbies/:code", async (req: Request, res: Response): Promise<void> => {
  try {
    const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    const lobby = await getCustomLobbyByCode(code);
    if (!lobby) {
      res.status(404).json({ error: "Lobby non trovata per il codice indicato" });
      return;
    }
    res.json({ lobby });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /backtest-tournaments/candidates: Lista trader candidati da invitare ───
router.get("/backtest-tournaments/candidates", async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query.q as string | undefined;
    const candidates = await listCandidates(q);
    res.json({ candidates });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
