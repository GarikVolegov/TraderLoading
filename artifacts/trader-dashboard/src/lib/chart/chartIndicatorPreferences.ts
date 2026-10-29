// ─── AUREUS Indicator Preferences Store & Sync ─────────────────────────────────
// Gestione persistente e sincronizzata live (localStorage + CustomEvents)
// delle preferenze di visualizzazione per Liquidità e Wyckoff.

export const INDICATOR_PREFERENCES_EVENT = "aureus:indicator-preferences-updated";
export const INDICATOR_PREFERENCES_STORAGE_KEY = "aureus_indicator_preferences_v1";

export interface LiquidityIndicatorPreferences {
  onlyUnswept: boolean; // Mostra solo livelli non ancora violati (Fresh / Unswept)
  onlyMajor: boolean; // Filtra solo livelli primari (PDH, PDL, PWH, PWL, PMH, PML)
  showPrice: boolean; // Mostra valore numerico del prezzo sul livello
  compactMode: boolean; // Badge compatti a bordo scala senza blocchi ingombranti
  maxLevels: number; // Massimo livelli visibili contemporaneamente per evitare affollamento
}

export interface WyckoffIndicatorPreferences {
  showTradingRange: boolean; // Mostra linee Creek (Resistenza) e Ice (Supporto)
  showEvents: boolean; // Mostra marker degli eventi sulle candele
  onlyKeyEvents: boolean; // Mostra solo eventi primari (Spring, UTAD, SOW 10%, SOS)
  compactBadges: boolean; // Badge compatti a 1 riga (UTAD, SPRING, 10% SOW)
  showRegimeCornerBadge: boolean; // Badge fluttuante in alto a destra sul canvas (default OFF)
}

export interface IndicatorPreferencesState {
  liquidity: LiquidityIndicatorPreferences;
  wyckoff: WyckoffIndicatorPreferences;
}

export const DEFAULT_INDICATOR_PREFERENCES: IndicatorPreferencesState = {
  liquidity: {
    onlyUnswept: true, // Default: massima pulizia, nessun livello vecchio già bucato
    onlyMajor: false,
    showPrice: true,
    compactMode: true,
    maxLevels: 6, // Massimo 6 livelli chiave attivi
  },
  wyckoff: {
    showTradingRange: true,
    showEvents: true,
    onlyKeyEvents: true, // Default: nasconde SC/BC/ST minori, mostra solo gli eventi d'oro
    compactBadges: true,
    showRegimeCornerBadge: false, // Default: zero badge fluttuanti sul canvas
  },
};

export function loadIndicatorPreferences(): IndicatorPreferencesState {
  if (typeof window === "undefined") return DEFAULT_INDICATOR_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(INDICATOR_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_INDICATOR_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<IndicatorPreferencesState>;
    return {
      liquidity: {
        ...DEFAULT_INDICATOR_PREFERENCES.liquidity,
        ...(parsed.liquidity || {}),
      },
      wyckoff: {
        ...DEFAULT_INDICATOR_PREFERENCES.wyckoff,
        ...(parsed.wyckoff || {}),
      },
    };
  } catch {
    return DEFAULT_INDICATOR_PREFERENCES;
  }
}

export function saveIndicatorPreferences(next: IndicatorPreferencesState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INDICATOR_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(INDICATOR_PREFERENCES_EVENT, { detail: next }));
  } catch {
    // ignore storage errors
  }
}
