import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  listTournaments,
  getTournamentLeaderboard,
  joinTournament,
  completeTournamentRun,
  listTribePresets,
  saveTribePreset,
  deleteTribePreset,
  createCustomLobby,
  getCustomLobbyByCode,
} = await import("../services/backtestTournaments/store.js");

async function runTests() {
  // 1. List tournaments
  const tournaments = await listTournaments();
  assert.ok(tournaments.length >= 3, "Dovrebbero esserci almeno 3 tornei seed");
  const t1 = tournaments.find((t) => t.slug === "time-trial-34t");
  assert.ok(t1, "Time trial 34T deve esistere");
  assert.equal(t1.pair, "XAU/USD");
  assert.equal(t1.maxDrawdownPct, "10.00");

  // 2. Leaderboard with podium and standings
  const lb = await getTournamentLeaderboard(t1.id, "test_user_a");
  assert.ok(lb, "Leaderboard deve essere definita");
  assert.equal(lb.podium.length, 3, "Il podio deve avere esattamente 3 competitori");
  assert.equal(lb.podium[0].rank, 1, "Primo posto rank 1");
  assert.ok(lb.standings.length >= 1, "Devono esserci competitori dal 4° posto in su");

  // 3. Join tournament
  const joinResult = await joinTournament({
    tournamentId: t1.id,
    userId: "test_challenger_99",
    displayName: "Challenger 99",
  });
  assert.ok(joinResult.entry, "Entry deve essere creata");
  assert.equal(joinResult.entry.status, "in_progress");

  // 4. Complete tournament run (Victory scenario: profit > 0, DD <= 10%)
  const victoryRun = await completeTournamentRun({
    tournamentId: t1.id,
    userId: "test_challenger_99",
    initialBalance: 100000,
    finalBalance: 1216420,
    totalProfit: 1116420,
    profitPct: 1116.42,
    winRate: 57.89,
    winTrades: 11,
    loseTrades: 8,
    totalTrades: 19,
    maxDrawdown: 0.0,
    avgTradeProfit: 58759,
  });
  assert.equal(victoryRun.won, true, "Deve risultare vittoria con profitto positivo e zero DD breach");
  assert.equal(victoryRun.status, "completed");
  assert.equal(victoryRun.summary.asset, "XAU/USD");

  // 5. Complete tournament run with Drawdown breach (Disqualification)
  const breachRun = await completeTournamentRun({
    tournamentId: t1.id,
    userId: "test_breaker_00",
    initialBalance: 100000,
    finalBalance: 85000,
    totalProfit: -15000,
    profitPct: -15.0,
    winRate: 20.0,
    winTrades: 2,
    loseTrades: 8,
    totalTrades: 10,
    maxDrawdown: 15.0, // > 10% allowed
    avgTradeProfit: -1500,
  });
  assert.equal(breachRun.won, false, "Deve risultare sconfitta/squalifica con drawdown > 10%");
  assert.equal(breachRun.status, "disqualified");

  // 6. List initial seed tribes
  const initialTribes = await listTribePresets("test_trader_alpha");
  assert.ok(initialTribes.length >= 3, "Devono essere presenti almeno 3 tribù seed di Limen");
  const goldTribe = initialTribes.find((t) => t.pair === "XAU/USD");
  assert.ok(goldTribe, "La tribù dell'Oro deve essere presente");
  assert.equal(goldTribe.randomDates, true, "Blind Mode con date casuali deve essere abilitata");

  // 7. Save custom tribe preset
  const savedTribe = await saveTribePreset({
    userId: "test_trader_alpha",
    tribeName: "Falange di Sparta",
    sigil: "scudo",
    pair: "US30",
    timeframe: "M5",
    initialBalance: "50000.00",
    maxDrawdownPct: "5.00",
    targetProfitPct: "10.00",
    maxTrades: 25,
    timeLimitSeconds: 600,
    randomDates: true,
    defaultMembers: ["Spartan1", "Spartan2"],
  });
  assert.ok(savedTribe.id, "Preset tribù deve avere un ID generato");
  assert.equal(savedTribe.tribeName, "Falange di Sparta");

  const userTribes = await listTribePresets("test_trader_alpha");
  assert.ok(userTribes.some((t) => t.tribeName === "Falange di Sparta"), "La nuova tribù deve comparire nella lista");

  // Delete custom tribe preset
  const deleted = await deleteTribePreset(savedTribe.id, "test_trader_alpha");
  assert.equal(deleted, true, "Cancellazione tribù deve avere successo");

  // 8. Create custom multiplayer lobby
  const lobby = await createCustomLobby({
    name: "Forgia Duello Titani",
    hostUserId: "test_trader_alpha",
    hostDisplayName: "Gazz Master",
    pair: "XAU/USD",
    timeframe: "M5",
    initialBalance: 100000,
    maxDrawdownPct: 10.0,
    targetProfitPct: 15.0,
    maxTrades: 50,
    timeLimitSeconds: 900,
    randomDates: true,
  });
  assert.ok(lobby.code.startsWith("FORGIA-"), "Il codice stanza deve iniziare con FORGIA-");
  assert.equal(lobby.pair, "XAU/USD");
  assert.equal(lobby.randomDates, true);

  const foundLobby = await getCustomLobbyByCode(lobby.code);
  assert.ok(foundLobby, "Lobby deve essere recuperabile per codice univoco");
  assert.equal(foundLobby.name, "Forgia Duello Titani");

  console.log("backtest tournaments service & store checks passed");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
