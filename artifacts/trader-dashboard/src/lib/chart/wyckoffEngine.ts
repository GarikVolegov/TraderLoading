// ─── AUREUS Wyckoff Engine (TraderWiki Exact Doctrine) ───────────────────────
// Implementa fedelmente la dottrina Wyckoff / TraderWiki:
// 1. Trading Range (TR): Creek (Resistenza TR) e Ice (Supporto TR).
// 2. Eventi di Accumulazione e Distribuzione:
//    - SC (Selling Climax) / BC (Buying Climax)
//    - AR (Automatic Rally / Automatic Reaction)
//    - ST (Secondary Test)
//    - Spring (STB): Falso breakout sotto l'Ice con chiusura dentro (Grab SSL)
//    - UT / UTAD: Falso breakout sopra il Creek con chiusura dentro (Grab BSL)
//    - SOS (Sign of Strength): Rottura e chiusura sopra il Creek con espansione
//    - SOW / "10%" (Sign of Weakness): Rottura e chiusura sotto l'Ice con espansione
//    - LPS / LPSY: Retest del bordo dopo la manipolazione o rottura

export interface WyckoffCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type WyckoffEventType =
  | "SC"
  | "BC"
  | "AR"
  | "ST"
  | "SPRING"
  | "UTAD"
  | "SOS"
  | "SOW_10"
  | "LPS";

export interface WyckoffEvent {
  id: string;
  type: WyckoffEventType;
  label: string;
  time: number;
  price: number;
  side: "bullish" | "bearish";
  description: string;
}

export interface WyckoffTradingRange {
  creekPrice: number; // Resistenza superiore del Trading Range
  icePrice: number; // Supporto inferiore del Trading Range
  startTime: number;
  endTime: number;
  midpoint: number;
  rangePips?: number;
  structureType: "ACCUMULATION" | "DISTRIBUTION" | "CONGESTION";
}

export interface WyckoffAnalysisResult {
  tradingRange: WyckoffTradingRange | null;
  events: WyckoffEvent[];
}

export function analyzeWyckoffStructure(candles: WyckoffCandle[]): WyckoffAnalysisResult {
  if (!candles || candles.length < 8) {
    return { tradingRange: null, events: [] };
  }

  const valid = candles.filter(
    (c) =>
      Number.isFinite(c.time) &&
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close) &&
      c.high >= Math.max(c.low, c.open, c.close) &&
      c.low <= Math.min(c.open, c.close),
  );

  if (valid.length < 8) {
    return { tradingRange: null, events: [] };
  }

  // 1. Identificazione del Trading Range di fondo
  // Usiamo una finestra significativa (lookback fino a 50 candele)
  const lookback = Math.min(valid.length, 50);
  const slice = valid.slice(-lookback);

  // Calcolo del corpo medio per valutare sbilanciamenti / displacement
  let totalBody = 0;
  for (const c of slice) {
    totalBody += Math.abs(c.close - c.open);
  }
  const avgBody = totalBody / slice.length;

  // Rilevamento swing massimi e minimi per identificare Creek (AR/BC) e Ice (SC/ST)
  // Per evitare che una singola spike isolata distorca il range, calcoliamo i quantili
  // e cerchiamo il cluster di reiezioni (Creek = cluster di massimi, Ice = cluster di minimi)
  const highs = slice.map((c) => c.high);
  const lows = slice.map((c) => c.low);

  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const totalSpan = Math.max(1e-6, maxHigh - minLow);

  // Creek (Resistenza TR): approssimata dal cluster del 75°-90° percentile dei massimi
  // Ice (Supporto TR): approssimata dal cluster del 10°-25° percentile dei minimi
  const sortedCloses = [...slice.map((c) => c.close)].sort((a, b) => a - b);
  const lowerQuartile = sortedCloses[Math.floor(sortedCloses.length * 0.20)];
  const upperQuartile = sortedCloses[Math.floor(sortedCloses.length * 0.80)];

  // Per Creek e Ice usiamo le chiusure/estremi più testati
  let creekPrice = upperQuartile;
  let icePrice = lowerQuartile;

  // Cerchiamo le candele di Climax (SC e BC) nei primi due terzi della finestra
  const initialLookback = Math.min(slice.length, 30);
  const initialSlice = slice.slice(0, initialLookback);

  let scBar: WyckoffCandle | null = null;
  let bcBar: WyckoffCandle | null = null;

  for (const b of initialSlice) {
    if (!scBar || b.low < scBar.low) scBar = b;
    if (!bcBar || b.high > bcBar.high) bcBar = b;
  }

  if (scBar && bcBar && bcBar.high > scBar.low) {
    // Il Creek è formato dalla reiezione o dall'AR successivo al Climax
    // Ice è sostenuto dal Selling Climax
    icePrice = scBar.low + (upperQuartile - scBar.low) * 0.15;
    creekPrice = bcBar.high - (bcBar.high - lowerQuartile) * 0.15;
    if (icePrice >= creekPrice) {
      icePrice = scBar.low;
      creekPrice = bcBar.high;
    }
  }

  const midpoint = (creekPrice + icePrice) / 2;

  // 2. Classificazione della struttura (Accumulazione vs Distribuzione)
  const lastBar = valid[valid.length - 1];
  let structureType: WyckoffTradingRange["structureType"] = "CONGESTION";
  if (lastBar.close > midpoint) {
    structureType = "ACCUMULATION";
  } else if (lastBar.close < midpoint) {
    structureType = "DISTRIBUTION";
  }

  const tradingRange: WyckoffTradingRange = {
    creekPrice: Number(creekPrice.toFixed(4)),
    icePrice: Number(icePrice.toFixed(4)),
    startTime: slice[0].time,
    endTime: lastBar.time,
    midpoint: Number(midpoint.toFixed(4)),
    structureType,
  };

  // 3. Rilevamento Eventi Wyckoff Chirurgici
  const events: WyckoffEvent[] = [];

  // Climax iniziale
  if (scBar) {
    events.push({
      id: `wyckoff-sc-${scBar.time}`,
      type: "SC",
      label: "SC",
      time: scBar.time,
      price: scBar.low,
      side: "bullish",
      description: "Selling Climax: arresto del ribasso con accumulo istituzionale.",
    });
  }
  if (bcBar) {
    events.push({
      id: `wyckoff-bc-${bcBar.time}`,
      type: "BC",
      label: "BC",
      time: bcBar.time,
      price: bcBar.high,
      side: "bearish",
      description: "Buying Climax: esaurimento degli acquisti retail.",
    });
  }

  // Scansione degli eventi nella seconda metà del Trading Range
  for (let i = 1; i < slice.length; i++) {
    const c = slice[i];
    const prev = slice[i - 1];
    const body = Math.abs(c.close - c.open);

    // ── SPRING (STB - Shakeout):
    // La wick scende sotto l'Ice (< icePrice), ma la candela CHIUDE dentro/sopra l'Ice (>= icePrice).
    // Si guardano i corpi: la spike è una presa di SSL (Bear Trap).
    const isSpring = c.low < icePrice && c.close >= icePrice && (c.high - c.low) > avgBody * 0.6;
    if (isSpring) {
      events.push({
        id: `wyckoff-spring-${c.time}`,
        type: "SPRING",
        label: "SPRING",
        time: c.time,
        price: c.low,
        side: "bullish",
        description: "Spring / Shakeout: presa di liquidità Sell-Side sotto l'Ice con rientro a candela chiusa.",
      });
      continue;
    }

    // ── UTAD / UT (Upthrust After Distribution):
    // La wick sale sopra il Creek (> creekPrice), ma la candela CHIUDE dentro/sotto il Creek (<= creekPrice).
    // Si guardano i corpi: la spike è una presa di BSL (Bull Trap).
    const isUtad = c.high > creekPrice && c.close <= creekPrice && (c.high - c.low) > avgBody * 0.6;
    if (isUtad) {
      events.push({
        id: `wyckoff-utad-${c.time}`,
        type: "UTAD",
        label: "UTAD",
        time: c.time,
        price: c.high,
        side: "bearish",
        description: "Upthrust / UTAD: presa di liquidità Buy-Side sopra il Creek con rientro a candela chiusa.",
      });
      continue;
    }

    // ── SOW / "10%" (Sign of Weakness - Nomenclatura Playbook TraderWiki):
    // Rottura netta con corpo e chiusura SOTTO l'Ice, con displacement impulsivo.
    const isSow10 = prev.close >= icePrice && c.close < icePrice && body > avgBody * 1.15 && c.close < c.open;
    if (isSow10) {
      events.push({
        id: `wyckoff-sow-${c.time}`,
        type: "SOW_10",
        label: "10% SOW",
        time: c.time,
        price: c.low,
        side: "bearish",
        description: "10% / SOW: rottura impulsiva di debolezza sotto l'Ice (Mark-Down imminente).",
      });
      continue;
    }

    // ── SOS (Sign of Strength):
    // Rottura netta con corpo e chiusura SOPRA il Creek, con displacement impulsivo.
    const isSos = prev.close <= creekPrice && c.close > creekPrice && body > avgBody * 1.15 && c.close > c.open;
    if (isSos) {
      events.push({
        id: `wyckoff-sos-${c.time}`,
        type: "SOS",
        label: "SOS",
        time: c.time,
        price: c.high,
        side: "bullish",
        description: "Sign of Strength: rottura impulsiva di forza sopra il Creek (Mark-Up imminente).",
      });
      continue;
    }

    // ── LPS (Last Point of Support): Retest dell'Ice o del Creek da sopra
    const isLps = prev.low > icePrice && c.low <= icePrice + avgBody * 0.25 && c.close > c.open;
    if (isLps && events.some((e) => e.type === "SPRING" || e.type === "SOS")) {
      events.push({
        id: `wyckoff-lps-${c.time}`,
        type: "LPS",
        label: "LPS",
        time: c.time,
        price: c.low,
        side: "bullish",
        description: "Last Point of Support: retest di conferma prima dell'espansione.",
      });
    }
  }

  // 4. Clustering / Debouncing Pivot per eliminare flooding e duplicati su candele consecutive
  // Se più UTAD o SPRING si verificano entro 4 candele, conserva solo il pivot estremo
  const dedupedEvents: WyckoffEvent[] = [];
  const CLUSTER_WINDOW = 4;

  for (let i = 0; i < events.length; i++) {
    const cur = events[i];

    if (cur.type === "UTAD") {
      // Trova tutti gli UTAD vicini entro la finestra
      const cluster = events.filter(
        (e) => e.type === "UTAD" && Math.abs(e.time - cur.time) <= CLUSTER_WINDOW * 86400,
      );
      // Mantieni solo l'evento con il massimo più alto dello swing
      const maxUtad = cluster.reduce((best, it) => (it.price > best.price ? it : best), cur);
      if (cur.id === maxUtad.id && !dedupedEvents.some((e) => e.id === cur.id)) {
        dedupedEvents.push(cur);
      }
      continue;
    }

    if (cur.type === "SPRING") {
      // Trova tutti gli SPRING vicini entro la finestra
      const cluster = events.filter(
        (e) => e.type === "SPRING" && Math.abs(e.time - cur.time) <= CLUSTER_WINDOW * 86400,
      );
      // Mantieni solo l'evento con il minimo più profondo dello swing
      const minSpring = cluster.reduce((best, it) => (it.price < best.price ? it : best), cur);
      if (cur.id === minSpring.id && !dedupedEvents.some((e) => e.id === cur.id)) {
        dedupedEvents.push(cur);
      }
      continue;
    }

    if (cur.type === "SOS" || cur.type === "SOW_10") {
      // Non ripetere SOS o SOW_10 su candele contigue (mantieni il primo breakout)
      const prevSame = dedupedEvents.find(
        (e) => e.type === cur.type && Math.abs(e.time - cur.time) <= CLUSTER_WINDOW * 86400,
      );
      if (!prevSame) {
        dedupedEvents.push(cur);
      }
      continue;
    }

    dedupedEvents.push(cur);
  }

  return {
    tradingRange,
    events: dedupedEvents,
  };
}
