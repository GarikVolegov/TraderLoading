/**
 * LIMEN PROTOCOL (TL: Trans-Limen) — Official Services, Tiers & Candidacy Catalog
 *
 * Defines:
 * 1. Soglia Iniziale Base (0 €): Il Varco, Libro della Verità, Fratellanza (senza Tornei Trimestrali), 5 Gradi di Ascesa.
 * 2. Offerta Esclusiva Prime Persone (10 €/mese · 100 €/anno): Pacchetto Base + La Forgia del Passato + Architettura Patrimoniale.
 * 3. Progetto Completo (150 €/mese · 1.500 €/anno): Tutto il pacchetto + La Dottrina del Tempo (Formazione completa) + Finestra Operativa + Prove del Fuoco.
 */

export type LimenServiceId =
  | "base_protocol"
  | "forge_of_the_past"
  | "financial_architecture"
  | "doctrine_of_time";

export type LimenBillingCycle = "monthly" | "yearly";

export type LimenTierId = "base_free" | "founders_10" | "complete_150";

export type LimenPriceType = "included" | "founders_bundle" | "complete_bundle";

export interface LimenServiceItem {
  readonly id: LimenServiceId;
  readonly category: "base" | "addon";
  readonly title: string;
  readonly shortTitle: string;
  readonly subtitle: string;
  readonly priceType: LimenPriceType;
  readonly priceAmountEur: number;
  readonly priceAmountCents: number;
  readonly priceYearlyAmountEur: number;
  readonly priceYearlyAmountCents: number;
  readonly priceDisplay: string;
  readonly priceYearlyDisplay: string;
  readonly isIncludedInBase: boolean;
  readonly routePath: string;
  readonly badgeLabel: string;
  readonly features: readonly string[];
}

export const DOTAZIONE_PROMO_EXPIRES_AT = "2026-11-10T23:59:59.999Z";

export function isDotazionePromoActive(now: Date = new Date()): boolean {
  try {
    const expiresMs = new Date(DOTAZIONE_PROMO_EXPIRES_AT).getTime();
    return now.getTime() <= expiresMs;
  } catch {
    return true;
  }
}

export interface LimenTierPromo {
  readonly badge: string;
  readonly promoMonthlyEur: number;
  readonly promoMonthlyCents: number;
  readonly promoDisplay: string;
  readonly validityDays: number;
  readonly originalMonthlyEur: number;
  readonly discountPercent: number;
  readonly expiresAt: string;
  readonly description: string;
}

export interface LimenTierDefinition {
  readonly id: LimenTierId;
  readonly title: string;
  readonly badge: string;
  readonly subtitle: string;
  readonly monthlyEur: number;
  readonly monthlyCents: number;
  readonly yearlyEur: number;
  readonly yearlyCents: number;
  readonly monthlyDisplay: string;
  readonly yearlyDisplay: string;
  readonly yearlyMonthlyEquivalentDisplay: string;
  readonly yearlySavingsEur: number;
  readonly includedServices: readonly LimenServiceId[];
  readonly features: readonly string[];
  readonly promo?: LimenTierPromo;
}

export const LIMEN_TIERS: readonly LimenTierDefinition[] = [
  {
    id: "base_free",
    title: "Soglia Iniziale di Base",
    badge: "ACCESSO BASE INCLUSO",
    subtitle: "Accesso immediato ai pilastri operativi fondamentali alla presentazione della candidatura.",
    monthlyEur: 0,
    monthlyCents: 0,
    yearlyEur: 0,
    yearlyCents: 0,
    monthlyDisplay: "0 € / mese",
    yearlyDisplay: "0 € / anno",
    yearlyMonthlyEquivalentDisplay: "Incluso nel Varco",
    yearlySavingsEur: 0,
    includedServices: ["base_protocol"],
    features: [
      "Il Varco (Centro di Comando decisionale)",
      "Il Libro della Verità (Registro cronologico scelte)",
      "La Fratellanza (Agorà dell'Ordine, esclusi Tornei Trimestrali)",
      "I 5 Gradi di Ascesa (Indice di Integrità e progressione)",
    ],
  },
  {
    id: "founders_10",
    title: "Dotazione Operativa · Esclusiva Prime Persone",
    badge: "ESCLUSIVA PRIME PERSONE",
    subtitle: "Tariffa riservata ai primi operatori ammessi: sblocca il pacchetto base unito a La Forgia del Passato e all'Architettura Patrimoniale.",
    monthlyEur: 10,
    monthlyCents: 1000,
    yearlyEur: 100,
    yearlyCents: 10000,
    monthlyDisplay: "10 € / mese",
    yearlyDisplay: "100 € / anno",
    yearlyMonthlyEquivalentDisplay: "~8,33 €/mese · 2 Mesi in Omaggio",
    yearlySavingsEur: 20,
    promo: {
      badge: "PROMO 14 GIORNI",
      promoMonthlyEur: 2.6,
      promoMonthlyCents: 260,
      promoDisplay: "2,60 € / 14 giorni",
      validityDays: 14,
      originalMonthlyEur: 10,
      discountPercent: 74,
      expiresAt: DOTAZIONE_PROMO_EXPIRES_AT,
      description: "Dotazione Operativa in promozione a 2,60 € valida per 14 giorni.",
    },
    includedServices: [
      "base_protocol",
      "forge_of_the_past",
      "financial_architecture",
    ],
    features: [
      "Tutta la Soglia Iniziale Base (Varco, Libro Verità, Fratellanza, 5 Gradi)",
      "La Forgia del Passato: Simulatore storico candela per candela senza limiti",
      "Architettura Patrimoniale: Gestione rischio, drawdown e allocazione",
      "Accesso operativo promozionale a 2,60 € valido per 14 giorni (poi 10 €/m)",
    ],
  },
  {
    id: "complete_150",
    title: "Progetto Completo · Formazione & Finestra Operativa",
    badge: "ACCESSO COMPLETO AL PROTOCOLLO",
    subtitle: "L'intero ecosistema d'Ordine: strumenti di forgiatura, gestione patrimoniale, La Dottrina del Tempo (Formazione completa) e la Finestra Operativa.",
    monthlyEur: 150,
    monthlyCents: 15000,
    yearlyEur: 1500,
    yearlyCents: 150000,
    monthlyDisplay: "150 € / mese",
    yearlyDisplay: "1.500 € / anno",
    yearlyMonthlyEquivalentDisplay: "125 €/mese · Risparmi 300 € (2 Mesi Omaggio)",
    yearlySavingsEur: 300,
    includedServices: [
      "base_protocol",
      "forge_of_the_past",
      "financial_architecture",
      "doctrine_of_time",
    ],
    features: [
      "Dotazione Operativa Completa (Varco, Libro Verità, Forgia, Patrimonio)",
      "La Dottrina del Tempo: Percorso completo di formazione Assedio & Duello",
      "La Finestra Operativa: Sincronizzazione oraria liquidità istituzionale",
      "Il Concilio della Domenica: Rito live settimanale a mercati chiusi",
      "Diritto alle Prove del Fuoco (Tornei Trimestrali) e Mandato 20%",
    ],
  },
] as const;

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
    priceYearlyAmountEur: 0,
    priceYearlyAmountCents: 0,
    priceDisplay: "Incluso (0 €)",
    priceYearlyDisplay: "Incluso (0 €)",
    isIncludedInBase: true,
    routePath: "/",
    badgeLabel: "INCLUSO DI DIRITTO",
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
    subtitle: "Simulatore candela per candela e archivio storico per affilare l'esecuzione. In promo speciale a 2,60€ (valida 14 giorni).",
    priceType: "founders_bundle",
    priceAmountEur: 10,
    priceAmountCents: 1000,
    priceYearlyAmountEur: 100,
    priceYearlyAmountCents: 10000,
    priceDisplay: "Promo 2,60 € / 1° m (poi 10 €/m)",
    priceYearlyDisplay: "Incluso nel Piano 100 €/a",
    isIncludedInBase: false,
    routePath: "/backtest",
    badgeLabel: "PROMO 14 GIORNI · 2,60 €",
    features: [
      "Replay storico candela per candela tick-by-tick",
      "Banco di Forgiatura con statistiche R:R avanzate",
      "Incluso insieme all'Architettura Patrimoniale a 2,60 € promo (poi 10 €/m)",
    ],
  },
  {
    id: "financial_architecture",
    category: "addon",
    title: "Architettura Patrimoniale",
    shortTitle: "Architettura Patrimoniale",
    subtitle: "Le Fondamenta di Rischio: drawdown sostenibile e barriere di protezione. In promo speciale a 2,60€ (valida 14 giorni).",
    priceType: "founders_bundle",
    priceAmountEur: 10,
    priceAmountCents: 1000,
    priceYearlyAmountEur: 100,
    priceYearlyAmountCents: 10000,
    priceDisplay: "Promo 2,60 € / 1° m (poi 10 €/m)",
    priceYearlyDisplay: "Inclusa nel Piano 100 €/a",
    isIncludedInBase: false,
    routePath: "/patrimonio",
    badgeLabel: "PROMO 14 GIORNI · 2,60 €",
    features: [
      "Calcolo matematico della tolleranza di perdita",
      "Separazione tra capitale operativo e riserva d'assedio",
      "Inclusa insieme a La Forgia del Passato a 2,60 € promo (poi 10 €/m)",
    ],
  },
  {
    id: "doctrine_of_time",
    category: "addon",
    title: "La Dottrina del Tempo & Finestra Operativa",
    shortTitle: "Formazione & Finestra Operativa",
    subtitle: "Il progetto completo di formazione (Assedio & Duello), Finestra Operativa bancaria e Concilio settimanale.",
    priceType: "complete_bundle",
    priceAmountEur: 150,
    priceAmountCents: 15000,
    priceYearlyAmountEur: 1500,
    priceYearlyAmountCents: 150000,
    priceDisplay: "Progetto Completo 150 €/m",
    priceYearlyDisplay: "Progetto Completo 1.500 €/a",
    isIncludedInBase: false,
    routePath: "/academy",
    badgeLabel: "PROGETTO COMPLETO · 150€",
    features: [
      "Accesso completo a La Dottrina del Tempo (Formazione video)",
      "Finestra Operativa sincronizzata sulle sessioni bancarie",
      "Include Forgia del Passato, Architettura Patrimoniale e Prove del Fuoco",
    ],
  },
] as const;

export interface LimenPricingBreakdown {
  readonly tierId: LimenTierId;
  readonly tierTitle: string;
  readonly billingCycle: LimenBillingCycle;
  readonly selectedIds: readonly LimenServiceId[];
  readonly monthlyFeeCents: number;
  readonly yearlyFeeCents: number;
  readonly oneTimeFeeCents: number;
  readonly activeFeeCents: number;
  readonly monthlyDisplay: string;
  readonly yearlyDisplay: string;
  readonly oneTimeDisplay: string;
  readonly activeDisplay: string;
  readonly formattedSummary: string;
  readonly yearlySavingsEur: number;
  readonly promoActive?: boolean;
  readonly promoDisplay?: string;
  readonly promoBadge?: string;
  readonly promoMonthlyFeeCents?: number;
}

/**
 * Computes pricing according to the official LIMEN tier structure:
 * - Only `base_protocol` -> 0 €
 * - `forge_of_the_past` and/or `financial_architecture` (without `doctrine_of_time`) ->
 *   Exclusive First Members rate: 10 €/month (in promo a 2,60 € per il 1° mese per 14 giorni) or 100 €/year.
 * - `doctrine_of_time` selected -> Complete Project (Formazione + Finestra Operativa + Forge + Financial Architecture):
 *   150 €/month or 1.500 €/year.
 */
export function calculateLimenServicesPricing(
  selectedIds: readonly string[],
  billingCycle: LimenBillingCycle = "monthly",
  now: Date = new Date(),
): LimenPricingBreakdown {
  const set = new Set(selectedIds);
  set.add("base_protocol");

  const hasDoctrine = set.has("doctrine_of_time");
  const hasFoundersAddon =
    set.has("forge_of_the_past") || set.has("financial_architecture");

  let tier: LimenTierDefinition;
  if (hasDoctrine) {
    tier = LIMEN_TIERS[2]; // complete_150
  } else if (hasFoundersAddon) {
    tier = LIMEN_TIERS[1]; // founders_10
  } else {
    tier = LIMEN_TIERS[0]; // base_free
  }

  const monthlyFeeCents = tier.monthlyCents;
  const yearlyFeeCents = tier.yearlyCents;
  const oneTimeFeeCents = 0;

  const isYearly = billingCycle === "yearly";
  const hasPromo =
    tier.id === "founders_10" &&
    !isYearly &&
    !!tier.promo &&
    isDotazionePromoActive(now);

  const activeFeeCents = isYearly
    ? yearlyFeeCents
    : hasPromo
      ? tier.promo!.promoMonthlyCents
      : monthlyFeeCents;
  const activeDisplay = isYearly
    ? tier.yearlyDisplay
    : hasPromo
      ? tier.promo!.promoDisplay
      : tier.monthlyDisplay;

  let formattedSummary: string;
  if (tier.id === "base_free") {
    formattedSummary = "0 € (Soglia Base Inclusa)";
  } else if (isYearly) {
    formattedSummary = `${tier.yearlyDisplay} (${tier.title})`;
  } else if (hasPromo) {
    formattedSummary = "2,60 € / 14 giorni (Dotazione Operativa)";
  } else {
    formattedSummary = `${tier.monthlyDisplay} (${tier.title})`;
  }

  return {
    tierId: tier.id,
    tierTitle: tier.title,
    billingCycle,
    selectedIds: tier.includedServices,
    monthlyFeeCents,
    yearlyFeeCents,
    oneTimeFeeCents,
    activeFeeCents,
    monthlyDisplay: tier.monthlyDisplay,
    yearlyDisplay: tier.yearlyDisplay,
    oneTimeDisplay: "0 €",
    activeDisplay,
    formattedSummary,
    yearlySavingsEur: tier.yearlySavingsEur,
    promoActive: hasPromo,
    promoDisplay: hasPromo ? tier.promo!.promoDisplay : undefined,
    promoBadge: hasPromo ? tier.promo!.badge : undefined,
    promoMonthlyFeeCents: hasPromo ? tier.promo!.promoMonthlyCents : undefined,
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
 * and approved services.
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
  };

  const isAdmitted = params.status === "ammesso" || params.status === "attivo";
  const approved = new Set(params.approvedServices ?? []);

  const hasDoctrine = isAdmitted && approved.has("doctrine_of_time");
  const hasForge =
    isAdmitted && (approved.has("forge_of_the_past") || hasDoctrine);
  const hasFinancialArch =
    isAdmitted && (approved.has("financial_architecture") || hasDoctrine);

  return {
    ...baseEntitlements,
    quarterlyTournaments: hasDoctrine,
    forgeOfThePast: hasForge,
    financialArchitecture: hasFinancialArch,
    doctrineOfTime: hasDoctrine,
  };
}
