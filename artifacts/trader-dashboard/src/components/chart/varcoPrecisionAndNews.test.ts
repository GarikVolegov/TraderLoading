import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCurrenciesForSymbol } from "./RedNewsOverlay.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chartDir = __dirname;
const dashboardRoot = path.resolve(__dirname, "../../..");

describe("AUREUS Il Varco: Precisione Dati Live, News Rosse, Asse Futuro & De-Cluttering Trade", () => {
  // ── 1. Verifica Valute & News Rosse per Simbolo ─────────────────────────────
  it("1. getCurrenciesForSymbol estrae correttamente le valute rilevanti per ogni asset (Multi-Asset)", () => {
    assert.deepEqual(getCurrenciesForSymbol("EURUSD"), ["EUR", "USD"]);
    assert.deepEqual(getCurrenciesForSymbol("GBPUSD"), ["GBP", "USD"]);
    assert.deepEqual(getCurrenciesForSymbol("USDJPY"), ["USD", "JPY"]);
    assert.deepEqual(getCurrenciesForSymbol("XAUUSD"), ["USD"]);
    assert.deepEqual(getCurrenciesForSymbol("BTCUSD"), ["USD"]);
    assert.deepEqual(getCurrenciesForSymbol("US30"), ["USD"]);
    assert.deepEqual(getCurrenciesForSymbol("GBPJPY"), ["GBP", "JPY"]);

    // Test Multi-Asset estesi (Indici europei, UK, Asia, Metalli e Crypto)
    assert.deepEqual(getCurrenciesForSymbol("GER40"), ["EUR"]);
    assert.deepEqual(getCurrenciesForSymbol("DAX"), ["EUR"]);
    assert.deepEqual(getCurrenciesForSymbol("UK100"), ["GBP"]);
    assert.deepEqual(getCurrenciesForSymbol("JPN225"), ["JPY"]);
    assert.deepEqual(getCurrenciesForSymbol("XAGUSD"), ["USD"]);
    assert.deepEqual(getCurrenciesForSymbol("SOLUSD"), ["USD"]);
  });

  // ── 2. Verifica Logica Proiezione WhitespaceData Futuro ──────────────────────
  it("2. Proiezione date future con WhitespaceData garantisce monotonicità e passo temporale esatto", () => {
    const lastBarTime = 1793293200; // 17:00:00
    const stepH1 = 3600;

    // Simula getFutureWhitespaceBars per H1
    const futureBars = [];
    for (let i = 1; i <= 48; i++) {
      futureBars.push({ time: lastBarTime + i * stepH1 });
    }

    assert.equal(futureBars.length, 48, "Devono essere generate 48 barre future per H1 (2 giorni)");
    assert.equal(futureBars[0].time, lastBarTime + stepH1, "La prima barra futura deve essere esattamente al passo successivo");
    assert.equal(futureBars[47].time, lastBarTime + 48 * stepH1, "L'ultima barra deve essere a 48 ore nel futuro");

    // Verifica che tutti i timestamp futuri siano strettamente crescenti
    for (let i = 1; i < futureBars.length; i++) {
      assert.ok(
        futureBars[i].time > futureBars[i - 1].time,
        `Il timestamp futuro all'indice ${i} deve essere maggiore del precedente`,
      );
      assert.equal(
        futureBars[i].time - futureBars[i - 1].time,
        stepH1,
        "La distanza tra barre future deve coincidere con intervalSeconds",
      );
    }
  });

  // ── 3. Verifica Integrazione LimenProprietaryChart ───────────────────────────
  it("3. LimenProprietaryChart integra WhitespaceData, RedNewsOverlay e SSE tick update sicuro", () => {
    const chartSrc = fs.readFileSync(path.join(chartDir, "LimenProprietaryChart.tsx"), "utf8");

    assert.ok(
      chartSrc.includes("getFutureWhitespaceBars"),
      "LimenProprietaryChart deve definire getFutureWhitespaceBars per estendere l'asse temporale in avanti",
    );
    assert.ok(
      chartSrc.includes("RedNewsOverlay"),
      "LimenProprietaryChart deve importare e renderizzare RedNewsOverlay",
    );
    assert.ok(
      chartSrc.includes("showRedNews"),
      "LimenProprietaryChart deve gestire lo stato showRedNews per abilitare/disabilitare i marker news",
    );
    assert.ok(
      chartSrc.includes("rightOffset: 24"),
      "LimenProprietaryChart deve impostare un rightOffset generoso (24) per visualizzare lo spazio futuro",
    );
    assert.ok(
      chartSrc.includes("last.time >= bar.time"),
      "LimenProprietaryChart SSE listener deve verificare last.time >= bar.time per aggiornare in-place senza duplicare o invertire l'ordine",
    );
  });

  // ── 4. Verifica LimenChartHeader (Pillola e Sentinella News Rossa) ────────────
  it("4. LimenChartHeader integra il pulsante toggle News Rosse e la sentinella radar per eventi imminenti", () => {
    const headerSrc = fs.readFileSync(path.join(chartDir, "LimenChartHeader.tsx"), "utf8");

    assert.ok(
      headerSrc.includes("showRedNews"),
      "LimenChartHeader deve supportare la prop showRedNews",
    );
    assert.ok(
      headerSrc.includes("onToggleRedNews"),
      "LimenChartHeader deve supportare la prop onToggleRedNews",
    );
    assert.ok(
      headerSrc.includes("imminentRedNews"),
      "LimenChartHeader deve supportare la prop imminentRedNews",
    );
    assert.ok(
      headerSrc.includes("NEWS ROSSA"),
      "LimenChartHeader deve renderizzare la sentinella radar con chip NEWS ROSSA quando un evento è imminente",
    );
  });

  // ── 5. Verifica De-Cluttering Strumento Posizione Trade ───────────────────────
  it("5. DrawingsOverlay semplifica la posizione Long/Short eliminando i muri di testo e mostrando le azioni solo su selezione", () => {
    const overlaySrc = fs.readFileSync(
      path.join(dashboardRoot, "src/components/backtest-terminal/DrawingsOverlay.tsx"),
      "utf8",
    );

    // Verifica etichette snelle TP e SL
    assert.ok(
      overlaySrc.includes("TP +{tpPips.toFixed(1)}p ({tpPct}%)"),
      "DrawingsOverlay deve mostrare etichetta TP snella e minimalista",
    );
    assert.ok(
      overlaySrc.includes("SL -{slPips.toFixed(1)}p ({slPct}%)"),
      "DrawingsOverlay deve mostrare etichetta SL snella e minimalista",
    );

    // Verifica che il badge non-selezionato sia compatto (R:R {rrVal}) senza bottoni ingombranti
    assert.ok(
      overlaySrc.includes("pillW = 74"),
      "DrawingsOverlay a riposo (non selezionato) deve renderizzare un badge R:R compatto da 74px",
    );

    // Verifica che i bottoni operativi (FORGIA, SIGILLA) appaiano solo se selected
    assert.ok(
      overlaySrc.includes("if (!selected)"),
      "DrawingsOverlay deve separare la modalità non-selezionata da quella selezionata per non sporcare il grafico",
    );

    // Verifica che quando selezionata la toolbar fluttui sopra la linea d'ingresso
    assert.ok(
      overlaySrc.includes("ey - pillH - 4"),
      "La toolbar operativa estesa deve fluttuare sopra la linea di ingresso per non coprire il prezzo/candela",
    );
  });

  // ── 6. Verifica Backend Bucket Alignment & Cache TTL ────────────────────────
  it("6. Il backend candles.ts applica l'allineamento bucket alle candele e riduce la cache live a 15s", () => {
    const candlesSrc = fs.readFileSync(
      path.join(dashboardRoot, "../api-server/src/services/candles.ts"),
      "utf8",
    );

    assert.ok(
      candlesSrc.includes("Math.floor(ts[i] / intervalSecs) * intervalSecs"),
      "candles.ts deve allineare il timestamp di ogni candela Yahoo al bucket del timeframe",
    );
    assert.ok(
      candlesSrc.includes("liveMemoryTtl = startDate != null || isPaged ? CACHE_TTL : 15_000"),
      "candles.ts deve impostare la cache live a 15 secondi anziché 1 ora",
    );
  });

  // ── 7. Verifica Backend TradingViewBridge ─────────────────────────────────────
  it("7. TradingViewBridge estende la mappatura simboli e normalizza i tick al bucket del timeframe", () => {
    const bridgeSrc = fs.readFileSync(
      path.join(dashboardRoot, "../api-server/src/services/tradingViewBridge.ts"),
      "utf8",
    );

    assert.ok(
      bridgeSrc.includes("AUDUSD: \"OANDA:AUDUSD\""),
      "TradingViewBridge deve mappare le coppie forex come AUDUSD su OANDA",
    );
    assert.ok(
      bridgeSrc.includes("Math.floor(Number(t) / intervalSecs) * intervalSecs"),
      "TradingViewBridge deve calcolare il bucketTime per ogni tick in arrivo",
    );
  });

  // ── 8. Verifica Integrazione Coprifuoco Volatilità & Trascrizione Diario ───────
  it("8. TradingCockpit integra il banner Coprifuoco Volatilità e la sincronizzazione automatica del trade a grafico", () => {
    const cockpitSrc = fs.readFileSync(
      path.join(dashboardRoot, "src/pages/TradingCockpit.tsx"),
      "utf8",
    );

    assert.ok(
      cockpitSrc.includes("Custode della Soglia · Coprifuoco Volatilità"),
      "TradingCockpit deve renderizzare il banner solenne di Coprifuoco Volatilità per eventi imminenti",
    );
    assert.ok(
      cockpitSrc.includes("tl_cockpit_operative_plan_"),
      "TradingCockpit deve salvare automaticamente l'ordine pianificato a grafico nel piano operativo locale",
    );
    assert.ok(
      cockpitSrc.includes("Trascrivi nel Diario"),
      "TradingCockpit deve fornire azione istantanea per trascrivere il trade nel Libro della Verità",
    );
    assert.ok(
      cockpitSrc.includes("onImminentNewsChange={setImminentRedNews}"),
      "TradingCockpit deve ricevere la telemetria delle news imminenti dal grafico LimenProprietaryChart",
    );
  });
});
