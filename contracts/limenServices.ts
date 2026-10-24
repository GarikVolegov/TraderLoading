/**
 * LIMEN PROTOCOL (TL: Trans-Limen) — Official Services & Candidacy Catalog
 *
 * Defines the initial base entitlement and modular add-on services with their
 * official prices, descriptions, and feature lists.
 */

export type LimenServiceId =
  | "base_protocol"
  | "forge_of_the_past"
  | "financial_architecture"
  | "doctrine_of_time";

export type LimenPriceType = "included" | "monthly" | "one_time";

export interface LimenServiceItem {
  readonly id: LimenServiceId;
  readonly category: "base" | "addon";
  readonly title: string;
  readonly shortTitle: string;
  readonly subtitle: string;
  readonly priceType: LimenPriceType;
  readonly priceAmountEur: number;
  readonly priceAmountCents: number;
  readonly priceDisplay: string;
  readonly isIncludedInBase: boolean;
  readonly routePath: string;
  readonly features: readonly string[];
}

export const LIMEN_SERVICES: readonly LimenServiceItem[] = [
  {
    id: "base_protocol",
    category: "base",
    title: "Dotazione Iniziale di Base",
    shortTitle: "Pacchetto Base",
    subtitle: "La Soglia di Ingresso nel Varco. Accesso operativo ai pilastri fondamentali della disciplina.",
    priceType: "included",
    priceAmountEur: 0,
    priceAmountCents: 0,
    priceDisplay: "Incluso",
    isIncludedInBase: true,
    routePath: "/",
    features: [
      "Il Varco (Centro di Comando decisionale)",
      "Il Libro della Verità (Trading Journal & Registro scelte)",
      "La Fratellanza (Agorà dell'Ordine, senza Tornei Trimestrali)",
      "I 5 Gradi di Ascesa (Indice di Integrità e rango)",
    ],
  },
  {
    id: "forge_of_the_past",
    category: "addon",
    title: "La Forgia del Passato (Banco di Forgiatura)",
    shortTitle: "Banco di Forgiatura",
    subtitle: "Simulatore candela per candela e archivio storico per affilare l'esecuzione.",
    priceType: "monthly",
    priceAmountEur: 10,
    priceAmountCents: 1000,
    priceDisplay: "+10 €/mese",
    isIncludedInBase: false,
    routePath: "/backtest",
    features: [
      "Replay storico candela per candela tick-by-tick",
      "Banco di Forgiatura con statistiche R:R avanzate",
      "Nessun vincolo sul numero di simulazioni storiche",
    ],
  },
  {
    id: "financial_architecture",
    category: "addon",
    title: "Architettura Patrimoniale",
    shortTitle: "Architettura Patrimoniale",
    subtitle: "Le Fondamenta di Rischio: drawdown sostenibile e barriere di protezione.",
    priceType: "monthly",
    priceAmountEur: 10,
    priceAmountCents: 1000,
    priceDisplay: "+10 €/mese",
    isIncludedInBase: false,
    routePath: "/patrimonio",
    features: [
      "Calcolo matematico della tolleranza di perdita",
      "Separazione tra capitale operativo e riserva d'assedio",
      "Radar di rischio patrimoniale e metriche di conservazione",
    ],
  },
  {
    id: "doctrine_of_time",
    category: "addon",
    title: "La Dottrina del Tempo & Finestra Operativa",
    shortTitle: "La Dottrina del Tempo",
    subtitle: "L'Arte dell'Assedio (Swing) e del Duello (Scalp). Video accademia e timing di liquidità.",
    priceType: "one_time",
    priceAmountEur: 170,
    priceAmountCents: 17000,
    priceDisplay: "+170 €",
    isIncludedInBase: false,
    routePath: "/academy",
    features: [
      "Accesso completo all'Accademia video LIMEN",
      "Canoni dell'Assedio e del Duello",
      "Sincronizzazione oraria sulle finestre di liquidità bancaria",
    ],
  },
] as const;

export interface LimenPricingBreakdown {
  readonly monthlyFeeCents: number;
  readonly oneTimeFeeCents: number;
  readonly monthlyDisplay: string;
  readonly oneTimeDisplay: string;
  readonly formattedSummary: string;
}

export function calculateLimenServicesPricing(
  selectedIds: readonly string[],
): LimenPricingBreakdown {
  const set = new Set(selectedIds);
  // Base protocol is always implicitly included
  set.add("base_protocol");

  let monthlyFeeCents = 0;
  let oneTimeFeeCents = 0;

  for (const service of LIMEN_SERVICES) {
    if (set.has(service.id)) {
      if (service.priceType === "monthly") {
        monthlyFeeCents += service.priceAmountCents;
      } else if (service.priceType === "one_time") {
        oneTimeFeeCents += service.priceAmountCents;
      }
    }
  }

  const monthlyEur = monthlyFeeCents / 100;
  const oneTimeEur = oneTimeFeeCents / 100;

  const monthlyDisplay = `${monthlyEur} €/mese`;
  const oneTimeDisplay = `${oneTimeEur} €`;

  const parts: string[] = [];
  if (monthlyFeeCents > 0) {
    parts.push(monthlyDisplay);
  } else {
    parts.push("0 €/mese (Base)");
  }
  if (oneTimeFeeCents > 0) {
    parts.push(`+ ${oneTimeDisplay} una tantum`);
  }

  return {
    monthlyFeeCents,
    oneTimeFeeCents,
    monthlyDisplay,
    oneTimeDisplay,
    formattedSummary: parts.join(" "),
  };
}

export interface LimenEntitlementsMap {
  readonly varco: boolean;
  readonly bookOfTruth: boolean;
  readonly brotherhood: boolean;
  readonly fiveGrades: boolean;
  readonly quarterlyTournaments: boolean;
  readonly forgeOfThePast: boolean;
  readonly financialArchitecture: boolean;
  readonly doctrineOfTime: boolean;
}

/**
 * Derives operational module entitlements based on candidate application status
 * and approved services. The initial base package (Varco, Libro della Verità,
 * Fratellanza, 5 Gradi) is granted immediately to all applicants, while Quarterly
 * Tournaments are strictly excluded from the initial base tier.
 */
export function resolveLimenEntitlements(params: {
  isAdmin?: boolean;
  status?: string | null;
  approvedServices?: readonly string[] | null;
}): LimenEntitlementsMap {
  if (params.isAdmin) {
    return {
      varco: true,
      bookOfTruth: true,
      brotherhood: true,
      fiveGrades: true,
      quarterlyTournaments: true,
      forgeOfThePast: true,
      financialArchitecture: true,
      doctrineOfTime: true,
    };
  }

  // Base package is always accessible upon application
  const baseEntitlements = {
    varco: true,
    bookOfTruth: true,
    brotherhood: true,
    fiveGrades: true,
    quarterlyTournaments: false, // Explicitly locked in the initial base package
  };

  const isAdmitted = params.status === "ammesso" || params.status === "attivo";
  const approved = new Set(params.approvedServices ?? []);

  return {
    ...baseEntitlements,
    forgeOfThePast: isAdmitted && approved.has("forge_of_the_past"),
    financialArchitecture: isAdmitted && approved.has("financial_architecture"),
    doctrineOfTime: isAdmitted && approved.has("doctrine_of_time"),
  };
}
