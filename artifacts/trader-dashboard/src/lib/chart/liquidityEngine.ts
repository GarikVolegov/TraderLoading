// ─── AUREUS Institutional Liquidity & Market Cycle Engine ────────────────────
// Implementa la dottrina AUREUS (Eclipse / Lezione 1 Liquidità + Ciclicità di Mercato Istituzionale):
// - BSL (Buy Side Liquidity): PMH, PWH, PDH, HOD, EQH (Equal Highs)
// - SSL (Sell Side Liquidity): PML, PWL, PDL, LOD, EQL (Equal Lows)
// - Tier Gerarchici: MAJOR (PMH/PML, PWH/PWL, PDH/PDL), MEDIUM (HOD/LOD, EQH/EQL), MINOR (IDM / Swing)
// - Analisi Corpi vs Spike & Ponte Wyckoff: SPRING (Grab SSL con chiusura corpo interna), UTAD (Grab BSL con chiusura corpo interna)
// - Liquidità Strutturale (50% Equilibrium) vs Algoritmica (0.786 OTE / Deep Retracement)
// - Box Asiatico (00:00 - 08:00 UTC) e Sbilanciamento Direzionale
// - 4 Fasi del Ciclo Istituzionale: ACCUMULO (Diluizione 90/10), ASCESA (Mark-Up), DISTRIBUZIONE, DECLINO (Mark-Down)

export interface LiquidityCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type LiquiditySide = "BSL" | "SSL" | "STRUCTURAL" | "ALGORITHMIC";
export type LiquidityTier = "MAJOR" | "MEDIUM" | "MINOR";
export type LiquidityCode =
  | "PMH"
  | "PML"
  | "PWH"
  | "PWL"
  | "PDH"
  | "PDL"
  | "HOD"
  | "LOD"
  | "EQH"
  | "EQL"
  | "ASIA_H"
  | "ASIA_L"
  | "FIB_50"
  | "FIB_786";

export interface LiquidityPoolLevel {
  id: string;
  code: LiquidityCode;
  label: string;
  side: LiquiditySide;
  tier: LiquidityTier;
  price: number;
  originTime: number;
  swept: boolean;
}

export interface WyckoffGrabEvent {
  id: string;
  kind: "SPRING" | "UTAD";
  label: string;
  side: "SSL" | "BSL";
  time: number;
  wickPrice: number;
  bodyClose: number;
  referenceLevel: number;
}

export interface AsianBoxAnalysis {
  high: number;
  low: number;
  startTime: number;
  endTime: number;
  status: "BSL_SWEPT_SHORT_BIAS" | "SSL_SWEPT_LONG_BIAS" | "BOTH_SWEPT" | "CONGESTION";
  biasLabel: string;
}

export type InstitutionalCyclePhase = "ACCUMULO" | "ASCESA" | "DISTRIBUZIONE" | "DECLINO";

export interface InstitutionalCycleTelemetry {
  phase: InstitutionalCyclePhase;
  title: string;
  subtitle: string;
  dilutionRatio: string; // es. "90% Accumulo / 10% Manipolazione"
  psychologyStage: string; // es. "Scetticismo / Avvilimento -> Ottimismo"
  cotSignal: string;
  volatilityRatio: number;
}

export interface LiquidityAnalysisResult {
  levels: LiquidityPoolLevel[];
  wyckoffGrabs: WyckoffGrabEvent[];
  asianBox: AsianBoxAnalysis | null;
  retracement: {
    swingHigh: number;
    swingLow: number;
    direction: "bullish" | "bearish";
    structural50: number;
    algorithmic786: number;
  } | null;
  cycle: InstitutionalCycleTelemetry;
}

const DAY_SEC = 86_400;
const WEEK_SEC = 86_400 * 7;

function dayBucket(ts: number): number {
  return Math.floor(ts / DAY_SEC);
}

function weekBucket(ts: number): number {
  return Math.floor(ts / WEEK_SEC);
}

function monthBucket(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function analyzeInstitutionalLiquidity(candles: LiquidityCandle[]): LiquidityAnalysisResult {
  if (!candles || candles.length === 0) {
    return {
      levels: [],
      wyckoffGrabs: [],
      asianBox: null,
      retracement: null,
      cycle: {
        phase: "ACCUMULO",
        title: "ACCUMULO (90/10)",
        subtitle: "Congestione Istituzionale & Diluizione Liquidità",
        dilutionRatio: "90% Posizionamento / 10% Controparte",
        psychologyStage: "Avvilimento / Speranza",
        cotSignal: "Commercial Long in aumento",
        volatilityRatio: 1,
      },
    };
  }

  const levels: LiquidityPoolLevel[] = [];
  const lastBar = candles[candles.length - 1];
  const currentDay = dayBucket(lastBar.time);
  const currentWeek = weekBucket(lastBar.time);
  const currentMonth = monthBucket(lastBar.time);

  // 1. Raggruppamento per Giorno, Settimana, Mese
  const todayBars: LiquidityCandle[] = [];
  const prevDayBars: LiquidityCandle[] = [];
  const prevWeekBars: LiquidityCandle[] = [];
  const prevMonthBars: LiquidityCandle[] = [];

  // Trova l'ultimo giorno precedente effettivamente presente nei dati (gestisce i weekend)
  let prevDayBucketId: number | null = null;
  for (let i = candles.length - 1; i >= 0; i--) {
    const bDay = dayBucket(candles[i].time);
    if (bDay < currentDay) {
      prevDayBucketId = bDay;
      break;
    }
  }

  let prevWeekBucketId: number | null = null;
  for (let i = candles.length - 1; i >= 0; i--) {
    const bWeek = weekBucket(candles[i].time);
    if (bWeek < currentWeek) {
      prevWeekBucketId = bWeek;
      break;
    }
  }

  let prevMonthBucketId: string | null = null;
  for (let i = candles.length - 1; i >= 0; i--) {
    const bMonth = monthBucket(candles[i].time);
    if (bMonth !== currentMonth) {
      prevMonthBucketId = bMonth;
      break;
    }
  }

  for (const bar of candles) {
    const d = dayBucket(bar.time);
    const w = weekBucket(bar.time);
    const m = monthBucket(bar.time);
    if (d === currentDay) todayBars.push(bar);
    if (prevDayBucketId != null && d === prevDayBucketId) prevDayBars.push(bar);
    if (prevWeekBucketId != null && w === prevWeekBucketId) prevWeekBars.push(bar);
    if (prevMonthBucketId != null && m === prevMonthBucketId) prevMonthBars.push(bar);
  }

  // Helper per estrarre High/Low con timestamp
  const getHighLow = (bars: LiquidityCandle[]) => {
    let high = -Infinity;
    let highTime = bars[0].time;
    let low = Infinity;
    let lowTime = bars[0].time;
    for (const b of bars) {
      if (b.high > high) {
        high = b.high;
        highTime = b.time;
      }
      if (b.low < low) {
        low = b.low;
        lowTime = b.time;
      }
    }
    return { high, highTime, low, lowTime };
  };

  // HOD / LOD (Oggi)
  if (todayBars.length > 0) {
    const { high, highTime, low, lowTime } = getHighLow(todayBars);
    levels.push({
      id: "liq-hod",
      code: "HOD",
      label: "BSL · HOD",
      side: "BSL",
      tier: "MEDIUM",
      price: high,
      originTime: highTime,
      swept: false,
    });
    levels.push({
      id: "liq-lod",
      code: "LOD",
      label: "SSL · LOD",
      side: "SSL",
      tier: "MEDIUM",
      price: low,
      originTime: lowTime,
      swept: false,
    });
  }

  // PDH / PDL (Giorno Precedente - MAJOR LIQUIDITY)
  if (prevDayBars.length > 0) {
    const { high, highTime, low, lowTime } = getHighLow(prevDayBars);
    const sweptHigh = todayBars.some((b) => b.high > high);
    const sweptLow = todayBars.some((b) => b.low < low);
    levels.push({
      id: "liq-pdh",
      code: "PDH",
      label: "BSL · PDH [MAJOR]",
      side: "BSL",
      tier: "MAJOR",
      price: high,
      originTime: highTime,
      swept: sweptHigh,
    });
    levels.push({
      id: "liq-pdl",
      code: "PDL",
      label: "SSL · PDL [MAJOR]",
      side: "SSL",
      tier: "MAJOR",
      price: low,
      originTime: lowTime,
      swept: sweptLow,
    });
  } else if (candles.length >= 24) {
    // Fallback su finestre intraday se tutte le candele appartengono alla stessa finestra o simulazione
    const slicePrev = candles.slice(Math.max(0, candles.length - 48), Math.max(1, candles.length - 16));
    if (slicePrev.length > 0) {
      const { high, highTime, low, lowTime } = getHighLow(slicePrev);
      levels.push({
        id: "liq-pdh-fallback",
        code: "PDH",
        label: "BSL · PDH [MAJOR]",
        side: "BSL",
        tier: "MAJOR",
        price: high,
        originTime: highTime,
        swept: lastBar.close > high,
      });
      levels.push({
        id: "liq-pdl-fallback",
        code: "PDL",
        label: "SSL · PDL [MAJOR]",
        side: "SSL",
        tier: "MAJOR",
        price: low,
        originTime: lowTime,
        swept: lastBar.close < low,
      });
    }
  }

  // PWH / PWL (Settimana Precedente - MAJOR LIQUIDITY)
  if (prevWeekBars.length > 0) {
    const { high, highTime, low, lowTime } = getHighLow(prevWeekBars);
    levels.push({
      id: "liq-pwh",
      code: "PWH",
      label: "BSL · PWH [MAJOR]",
      side: "BSL",
      tier: "MAJOR",
      price: high,
      originTime: highTime,
      swept: false,
    });
    levels.push({
      id: "liq-pwl",
      code: "PWL",
      label: "SSL · PWL [MAJOR]",
      side: "SSL",
      tier: "MAJOR",
      price: low,
      originTime: lowTime,
      swept: false,
    });
  }

  // PMH / PML (Mese Precedente - MAJOR LIQUIDITY)
  if (prevMonthBars.length > 0) {
    const { high, highTime, low, lowTime } = getHighLow(prevMonthBars);
    levels.push({
      id: "liq-pmh",
      code: "PMH",
      label: "BSL · PMH [MAJOR]",
      side: "BSL",
      tier: "MAJOR",
      price: high,
      originTime: highTime,
      swept: false,
    });
    levels.push({
      id: "liq-pml",
      code: "PML",
      label: "SSL · PML [MAJOR]",
      side: "SSL",
      tier: "MAJOR",
      price: low,
      originTime: lowTime,
      swept: false,
    });
  }

  // 2. Rilevamento EQH (Equal Highs -> BSL) & EQL (Equal Lows -> SSL) sulle ultime 60 candele
  const recent = candles.slice(-60);
  if (recent.length >= 10) {
    const avgRange =
      recent.reduce((acc, b) => acc + Math.max(0.00001, b.high - b.low), 0) / recent.length;
    const eqTolerance = avgRange * 0.18;

    const swingHighs: LiquidityCandle[] = [];
    const swingLows: LiquidityCandle[] = [];

    for (let i = 2; i < recent.length - 2; i++) {
      const c = recent[i];
      if (
        c.high >= recent[i - 1].high &&
        c.high >= recent[i - 2].high &&
        c.high >= recent[i + 1].high &&
        c.high >= recent[i + 2].high
      ) {
        swingHighs.push(c);
      }
      if (
        c.low <= recent[i - 1].low &&
        c.low <= recent[i - 2].low &&
        c.low <= recent[i + 1].low &&
        c.low <= recent[i + 2].low
      ) {
        swingLows.push(c);
      }
    }

    // Trova la coppia più recente di Equal Highs (EQH -> BSL)
    for (let i = swingHighs.length - 1; i >= 1; i--) {
      const a = swingHighs[i];
      const b = swingHighs[i - 1];
      if (Math.abs(a.high - b.high) <= eqTolerance) {
        const eqPrice = (a.high + b.high) / 2;
        levels.push({
          id: "liq-eqh",
          code: "EQH",
          label: "BSL · EQH",
          side: "BSL",
          tier: "MEDIUM",
          price: eqPrice,
          originTime: b.time,
          swept: lastBar.close > eqPrice,
        });
        break;
      }
    }

    // Trova la coppia più recente di Equal Lows (EQL -> SSL)
    for (let i = swingLows.length - 1; i >= 1; i--) {
      const a = swingLows[i];
      const b = swingLows[i - 1];
      if (Math.abs(a.low - b.low) <= eqTolerance) {
        const eqPrice = (a.low + b.low) / 2;
        levels.push({
          id: "liq-eql",
          code: "EQL",
          label: "SSL · EQL",
          side: "SSL",
          tier: "MEDIUM",
          price: eqPrice,
          originTime: b.time,
          swept: lastBar.close < eqPrice,
        });
        break;
      }
    }
  }

  // 3. Analisi Box Asiatico (00:00 - 08:00 UTC) e Sbilanciamento
  let asianBox: AsianBoxAnalysis | null = null;
  const asianBars = todayBars.filter((b) => {
    const hour = new Date(b.time * 1000).getUTCHours();
    return hour >= 0 && hour < 8;
  });
  const postAsianBars = todayBars.filter((b) => {
    const hour = new Date(b.time * 1000).getUTCHours();
    return hour >= 8;
  });

  if (asianBars.length >= 2) {
    const { high: asiaHigh, low: asiaLow } = getHighLow(asianBars);
    const sweptHigh = postAsianBars.some((b) => b.high > asiaHigh);
    const sweptLow = postAsianBars.some((b) => b.low < asiaLow);

    let status: AsianBoxAnalysis["status"] = "CONGESTION";
    let biasLabel = "BOX ASIATICO IN FORMAZIONE";
    if (sweptHigh && !sweptLow) {
      status = "BSL_SWEPT_SHORT_BIAS";
      biasLabel = "ASIA BSL PRESA → BIAS OPPOSTO SHORT";
    } else if (sweptLow && !sweptHigh) {
      status = "SSL_SWEPT_LONG_BIAS";
      biasLabel = "ASIA SSL PRESA → BIAS OPPOSTO LONG";
    } else if (sweptHigh && sweptLow) {
      status = "BOTH_SWEPT";
      biasLabel = "ASIA RANGE ESPANSO (ENTRAMBI I LATI)";
    }

    asianBox = {
      high: asiaHigh,
      low: asiaLow,
      startTime: asianBars[0].time,
      endTime: asianBars[asianBars.length - 1].time,
      status,
      biasLabel,
    };
  }

  // 4. Ritracciamento Strutturale (50%) vs Algoritmico (0.786) sullo Swing Dominante
  let retracement: LiquidityAnalysisResult["retracement"] = null;
  if (recent.length >= 12) {
    const { high: sHigh, highTime, low: sLow, lowTime } = getHighLow(recent);
    if (sHigh > sLow) {
      const isBullish = highTime >= lowTime;
      const range = sHigh - sLow;
      const structural50 = sLow + range * 0.5;
      const algorithmic786 = isBullish ? sHigh - range * 0.786 : sLow + range * 0.786;

      retracement = {
        swingHigh: sHigh,
        swingLow: sLow,
        direction: isBullish ? "bullish" : "bearish",
        structural50,
        algorithmic786,
      };
      // Nota: i livelli OTE/Fibonacci non vengono inseriti nell'array dei livelli di liquidità oggettiva
    }
  }

  // 5. Analisi Corpi vs Spike & Ponte Wyckoff: SPRING (Grab SSL) e UTAD (Grab BSL)
  // «Si guardano i corpi: le spike possono essere prese di liquidità; Spring = grab di SSL, UTAD = grab di BSL»
  const wyckoffGrabs: WyckoffGrabEvent[] = [];
  if (recent.length >= 15) {
    for (let i = 10; i < recent.length; i++) {
      const bar = recent[i];
      const priorWindow = recent.slice(Math.max(0, i - 10), i);
      const priorHigh = Math.max(...priorWindow.map((b) => Math.max(b.open, b.close, b.high)));
      const priorLow = Math.min(...priorWindow.map((b) => Math.min(b.open, b.close, b.low)));
      const bodyTop = Math.max(bar.open, bar.close);
      const bodyBottom = Math.min(bar.open, bar.close);

      // UTAD: La spike supera il massimo precedente (prende BSL), ma il corpo chiude sotto il massimo precedente
      if (bar.high > priorHigh && bodyTop < priorHigh) {
        wyckoffGrabs.push({
          id: `utad-${bar.time}`,
          kind: "UTAD",
          label: "UTAD · Grab BSL",
          side: "BSL",
          time: bar.time,
          wickPrice: bar.high,
          bodyClose: bar.close,
          referenceLevel: priorHigh,
        });
      }

      // SPRING: La spike buca il minimo precedente (prende SSL), ma il corpo chiude sopra il minimo precedente
      if (bar.low < priorLow && bodyBottom > priorLow) {
        wyckoffGrabs.push({
          id: `spring-${bar.time}`,
          kind: "SPRING",
          label: "SPRING · Grab SSL",
          side: "SSL",
          time: bar.time,
          wickPrice: bar.low,
          bodyClose: bar.close,
          referenceLevel: priorLow,
        });
      }
    }
  }

  // 6. Classificatore delle 4 Fasi del Ciclo di Mercato Istituzionale (Accumulo, Ascesa, Distribuzione, Declino)
  const cycle = classifyInstitutionalCycle(recent, wyckoffGrabs);

  return {
    levels,
    wyckoffGrabs: wyckoffGrabs.slice(-4), // mostra gli ultimi 4 eventi chiave più rilevanti
    asianBox,
    retracement,
    cycle,
  };
}

export function classifyInstitutionalCycle(
  bars: LiquidityCandle[],
  wyckoffGrabs: WyckoffGrabEvent[],
): InstitutionalCycleTelemetry {
  if (bars.length < 8) {
    return {
      phase: "ACCUMULO",
      title: "FASE 1 · ACCUMULO (90/10)",
      subtitle: "Congestione Istituzionale · Acquisto Graduale Silenzioso",
      dilutionRatio: "90% Accumulo / 10% Manipolazione Stop",
      psychologyStage: "Avvilimento / Speranza",
      cotSignal: "Commercial Long in aumento · Speculatori Short",
      volatilityRatio: 0.8,
    };
  }

  const firstHalf = bars.slice(0, Math.floor(bars.length / 2));
  const secondHalf = bars.slice(Math.floor(bars.length / 2));

  const firstAvg = firstHalf.reduce((s, b) => s + b.close, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, b) => s + b.close, 0) / secondHalf.length;

  const allHigh = Math.max(...bars.map((b) => b.high));
  const allLow = Math.min(...bars.map((b) => b.low));
  const totalRange = Math.max(0.00001, allHigh - allLow);

  const recentBars = bars.slice(-10);
  const recentHigh = Math.max(...recentBars.map((b) => b.high));
  const recentLow = Math.min(...recentBars.map((b) => b.low));
  const compressionRatio = (recentHigh - recentLow) / totalRange;

  const lastClose = bars[bars.length - 1].close;
  const positionInRange = (lastClose - allLow) / totalRange;
  const hasRecentUtad = wyckoffGrabs.slice(-2).some((g) => g.kind === "UTAD");
  const hasRecentSpring = wyckoffGrabs.slice(-2).some((g) => g.kind === "SPRING");

  // Fase 1: ACCUMULO (prezzi bassi o compressi dopo discesa, o Spring recente)
  if ((compressionRatio < 0.42 && positionInRange <= 0.5) || (hasRecentSpring && positionInRange < 0.55)) {
    return {
      phase: "ACCUMULO",
      title: "FASE 1 · ACCUMULO (90/10)",
      subtitle: "Congestione & Diluizione Istituzionale sui Minimi",
      dilutionRatio: "90% Accumulo DCA / 10% Controparte Stop Hunt",
      psychologyStage: "Avvilimento → Speranza",
      cotSignal: "Commercial Long ↑ · Retail Indeciso/Short",
      volatilityRatio: Number(compressionRatio.toFixed(2)),
    };
  }

  // Fase 3: DISTRIBUZIONE (prezzi in quota elevata con congestione o UTAD grab di BSL)
  if ((compressionRatio < 0.45 && positionInRange > 0.5) || (hasRecentUtad && positionInRange >= 0.55)) {
    return {
      phase: "DISTRIBUZIONE",
      title: "FASE 3 · DISTRIBUZIONE",
      subtitle: "Scarico Istituzionale in Blocchi sui Massimi",
      dilutionRatio: "90% Scarico Graduale / 10% Inducement BSL",
      psychologyStage: "Euforia Retail → Ansia",
      cotSignal: "Istituzionali cedono Long agli Speculatori",
      volatilityRatio: Number(compressionRatio.toFixed(2)),
    };
  }

  // Fase 2: ASCESA (Mark-up)
  if (secondAvg >= firstAvg) {
    return {
      phase: "ASCESA",
      title: "FASE 2 · ASCESA (MARK-UP)",
      subtitle: "Espansione Rialzista Sostenuta dagli Istituzionali",
      dilutionRatio: "Incremento Graduale su Ritracciamenti 50% / 0.786",
      psychologyStage: "Ottimismo → Esaltazione",
      cotSignal: "Riduzione Short Non-Commercial · Long Istituzionali ↑",
      volatilityRatio: Number(compressionRatio.toFixed(2)),
    };
  }

  // Fase 4: DECLINO (Mark-down)
  return {
    phase: "DECLINO",
    title: "FASE 4 · DECLINO (MARK-DOWN)",
    subtitle: "Impulso Ribassista & Parzializzazione Posizioni",
    dilutionRatio: "Scarico Completato · Attesa Nuovo Fondo Accumulo",
    psychologyStage: "Negazione → Paura → Panico",
    cotSignal: "Aumento Short Speculatori · Istituzionali in Attesa",
    volatilityRatio: Number(compressionRatio.toFixed(2)),
  };
}
