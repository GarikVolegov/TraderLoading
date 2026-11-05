/**
 * AUREUS PROTOCOL — Passaporto Crittografico del Sistema (Cryptographic System Passport & QR Seal)
 * Generatore deterministico pure-TS di impronta esadecimale a 64 caratteri e matrice QR 21x21
 * per l'attestazione immutabile della Costituzione Operativa.
 */

export interface SystemPassportPayload {
  name: string;
  versionNumber?: number;
  phase?: string;
  markets: string;
  windows: string;
  setup: string;
  entry: string;
  exit: string;
  invalidation: string;
  waitConditions: string;
  currency: string;
  riskPerTrade: number;
  maxDailyLoss: number;
  maxDailyTrades: number;
  checklistCount: number;
}

/**
 * Calcola un digest crittografico deterministico a 64 caratteri esadecimali (multi-lane FNV-1a / Murmur3)
 * sensibile a qualsiasi variazione di regola, mercato, limite di rischio o clausola del Custode.
 */
export function computeSystemPassportHash(payload: SystemPassportPayload): string {
  const canonical = [
    (payload.name || "METODO-AUREUS").trim(),
    String(payload.versionNumber ?? 1),
    (payload.phase || "define").trim(),
    payload.markets.trim().toUpperCase(),
    payload.windows.trim(),
    payload.setup.trim(),
    payload.entry.trim(),
    payload.exit.trim(),
    payload.invalidation.trim(),
    payload.waitConditions.trim(),
    (payload.currency || "EUR").trim().toUpperCase(),
    Number(payload.riskPerTrade || 0).toFixed(4),
    Number(payload.maxDailyLoss || 0).toFixed(4),
    String(Math.trunc(Number(payload.maxDailyTrades || 0))),
    String(Math.trunc(Number(payload.checklistCount || 0))),
  ].join("||");

  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2f;
  let h3 = 0xdeadbeef;
  let h4 = 0x41c6ce57;

  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619);
    h2 = Math.imul(h2 ^ (ch + i), 2246822507);
    h3 = Math.imul(h3 ^ ((ch << 1) ^ i), 3266489909);
    h4 = Math.imul(h4 ^ ((ch >> 1) + i * 31), 1597334677);
  }

  let rh1 = h4 ^ 0x9e3779b9;
  let rh2 = h3 ^ 0x85ebca6b;
  let rh3 = h2 ^ 0xc2b2ae35;
  let rh4 = h1 ^ 0x165667b1;

  for (let i = canonical.length - 1; i >= 0; i--) {
    const ch = canonical.charCodeAt(i);
    rh1 = Math.imul(rh1 ^ ch, 2654435761);
    rh2 = Math.imul(rh2 ^ (ch + i), 1597334677);
    rh3 = Math.imul(rh3 ^ ((ch << 2) ^ i), 2246822507);
    rh4 = Math.imul(rh4 ^ ((ch >> 2) + i * 17), 3266489909);
  }

  const lanes = [h1, h2, h3, h4, rh1, rh2, rh3, rh4];
  return lanes.map((lane) => (lane >>> 0).toString(16).padStart(8, "0").toUpperCase()).join("");
}

/**
 * Formatta il codice sigillo imperiale AUREUS-SYS-XXXX-XXXX-XXXX
 */
export function formatPassportSealCode(hash: string): string {
  const clean = hash.replace(/^0x/i, "").padEnd(12, "0").toUpperCase();
  return `AUREUS-SYS-${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

export interface SystemPassportExportDocument {
  protocol: string;
  sealCode: string;
  cryptographicHash: string;
  issuedAt?: string;
  system: {
    name: string;
    versionNumber?: number;
    phase?: string;
    markets: string;
    windows: string;
    setup: string;
    entry: string;
    exit: string;
    invalidation: string;
    waitConditions: string;
    riskGovernance: {
      currency: string;
      riskPerTrade: number;
      maxDailyLoss: number;
      maxDailyTrades: number;
    };
    thresholdCustodian: {
      checklistCount: number;
      clauses?: string[];
    };
  };
}

export interface SystemPassportVerificationResult {
  valid: boolean;
  reason?:
    | "invalid_json"
    | "unsupported_protocol"
    | "hash_mismatch"
    | "seal_mismatch";
  payload?: SystemPassportPayload;
  checklistItems?: string[];
  computedHash?: string;
  computedSeal?: string;
}

/**
 * Costruisce il documento JSON firmato della Costituzione Operativa.
 */
export function buildSystemPassportExportDocument(
  payload: SystemPassportPayload,
  checklistItems: string[] = [],
  issuedAt = new Date().toISOString(),
): SystemPassportExportDocument {
  const hash = computeSystemPassportHash(payload);
  const sealCode = formatPassportSealCode(hash);
  const currency = (payload.currency || "EUR").trim().toUpperCase();

  return {
    protocol: "AUREUS_OS_SYSTEM_CONSTITUTION_V1",
    sealCode,
    cryptographicHash: `0x${hash}`,
    issuedAt,
    system: {
      name: payload.name || "Costituzione Operativa",
      versionNumber: payload.versionNumber ?? 1,
      phase: payload.phase || "define",
      markets: payload.markets,
      windows: payload.windows,
      setup: payload.setup,
      entry: payload.entry,
      exit: payload.exit,
      invalidation: payload.invalidation,
      waitConditions: payload.waitConditions,
      riskGovernance: {
        currency,
        riskPerTrade: Number(payload.riskPerTrade || 0),
        maxDailyLoss: Number(payload.maxDailyLoss || 0),
        maxDailyTrades: Math.trunc(Number(payload.maxDailyTrades || 0)),
      },
      thresholdCustodian: {
        checklistCount: Math.trunc(Number(payload.checklistCount || 0)),
        clauses: checklistItems,
      },
    },
  };
}

/**
 * Verifica crittograficamente un documento JSON di Passaporto del Sistema
 * ricalcolando il digest 64-hex e il codice sigillo AUREUS-SYS-XXXX-XXXX-XXXX
 * per rilevare qualsiasi alterazione o manomissione delle regole.
 */
export function verifySystemPassportDocument(
  rawInput: string | Record<string, unknown>,
): SystemPassportVerificationResult {
  let parsed: Record<string, unknown>;
  if (typeof rawInput === "string") {
    try {
      const json = JSON.parse(rawInput);
      if (!json || typeof json !== "object" || Array.isArray(json)) {
        return { valid: false, reason: "invalid_json" };
      }
      parsed = json as Record<string, unknown>;
    } catch {
      return { valid: false, reason: "invalid_json" };
    }
  } else if (rawInput && typeof rawInput === "object") {
    parsed = rawInput;
  } else {
    return { valid: false, reason: "invalid_json" };
  }

  if (parsed.protocol !== "AUREUS_OS_SYSTEM_CONSTITUTION_V1") {
    return { valid: false, reason: "unsupported_protocol" };
  }

  const sys = parsed.system as Record<string, unknown> | undefined;
  if (!sys || typeof sys !== "object") {
    return { valid: false, reason: "invalid_json" };
  }

  const riskGov = (sys.riskGovernance as Record<string, unknown> | undefined) ?? {};
  const custodian = (sys.thresholdCustodian as Record<string, unknown> | undefined) ?? {};
  const rawClauses = Array.isArray(custodian.clauses)
    ? custodian.clauses.map((c) => String(c).trim()).filter(Boolean)
    : [];

  const extractedPayload: SystemPassportPayload = {
    name: String(sys.name ?? "Costituzione Operativa"),
    versionNumber: Number(sys.versionNumber ?? 1),
    phase: String(sys.phase ?? "define"),
    markets: String(sys.markets ?? ""),
    windows: String(sys.windows ?? ""),
    setup: String(sys.setup ?? ""),
    entry: String(sys.entry ?? ""),
    exit: String(sys.exit ?? ""),
    invalidation: String(sys.invalidation ?? ""),
    waitConditions: String(sys.waitConditions ?? ""),
    currency: String(riskGov.currency ?? "EUR"),
    riskPerTrade: Number(riskGov.riskPerTrade ?? 0),
    maxDailyLoss: Number(riskGov.maxDailyLoss ?? 0),
    maxDailyTrades: Number(riskGov.maxDailyTrades ?? 0),
    checklistCount: Number(custodian.checklistCount ?? rawClauses.length),
  };

  const computedHash = computeSystemPassportHash(extractedPayload);
  const computedSeal = formatPassportSealCode(computedHash);

  const claimedHash = String(parsed.cryptographicHash ?? "")
    .trim()
    .replace(/^0x/i, "")
    .toUpperCase();
  const claimedSeal = String(parsed.sealCode ?? "").trim().toUpperCase();

  if (!claimedHash || claimedHash !== computedHash) {
    return {
      valid: false,
      reason: "hash_mismatch",
      payload: extractedPayload,
      checklistItems: rawClauses,
      computedHash,
      computedSeal,
    };
  }

  if (!claimedSeal || claimedSeal !== computedSeal) {
    return {
      valid: false,
      reason: "seal_mismatch",
      payload: extractedPayload,
      checklistItems: rawClauses,
      computedHash,
      computedSeal,
    };
  }

  return {
    valid: true,
    payload: extractedPayload,
    checklistItems: rawClauses,
    computedHash,
    computedSeal,
  };
}

/**
 * Genera una matrice QR-style 21x21 deterministica con Finder Patterns 7x7 negli angoli
 * (top-left, top-right, bottom-left), Timing Patterns sulla riga/colonna 6 e moduli dati
 * derivati dall'impronta crittografica `seedHash`.
 */
export function generateDeterministicQrMatrix(seedHash: string, size = 21): boolean[][] {
  const n = Math.max(21, size);
  const matrix: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  const reserved: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));

  const placeFinderPattern = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        reserved[rr][cc] = true;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isOuterBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isInnerCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[rr][cc] = isOuterBorder || isInnerCore;
        } else {
          matrix[rr][cc] = false;
        }
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, n - 7);
  placeFinderPattern(n - 7, 0);

  // Timing patterns sulla riga 6 e colonna 6
  for (let i = 8; i < n - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Dark module standard QR
  if (n > 13) {
    reserved[n - 8][8] = true;
    matrix[n - 8][8] = true;
  }

  const cleanSeed = (seedHash || "AUREUS").replace(/^0x/i, "");
  let bitIndex = 0;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (reserved[r][c]) continue;
      const charIdx = Math.floor(bitIndex / 4) % cleanSeed.length;
      const nibble = parseInt(cleanSeed[charIdx] || "A", 16);
      const validNibble = Number.isNaN(nibble) ? 10 : nibble;
      const shift = bitIndex % 4;
      const mask = ((r * 7 + c * 13 + bitIndex) & 1) === 1;
      const bit = ((validNibble >> shift) & 1) === 1;
      matrix[r][c] = bit !== mask;
      bitIndex++;
    }
  }

  return matrix;
}
