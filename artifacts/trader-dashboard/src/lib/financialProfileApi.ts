import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJSON } from "./apiFetch";
import {
  DEFAULT_FINANCIAL_PROFILE,
  type FinancialProfile,
} from "../../../../contracts/financialArchitecture";

export type { FinancialProfile };

export const FINANCIAL_PROFILE_STORAGE_KEY = "limen.financial_profile.v1";
export const FINANCIAL_PROFILE_QUERY_KEY = ["financial-profile"] as const;

export function getStoredFinancialProfile(): FinancialProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FINANCIAL_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as FinancialProfile) : null;
  } catch {
    return null;
  }
}

export function setStoredFinancialProfile(profile: FinancialProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FINANCIAL_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // quota errors ignored
  }
}

export async function fetchFinancialProfile(): Promise<FinancialProfile> {
  try {
    const data = await apiJSON<FinancialProfile>("financial-profile");
    if (data && typeof data === "object") {
      setStoredFinancialProfile(data);
      return data;
    }
  } catch (err) {
    // Fallback to local storage if API call fails
    const stored = getStoredFinancialProfile();
    if (stored) return stored;
  }
  return getStoredFinancialProfile() ?? DEFAULT_FINANCIAL_PROFILE;
}

export async function saveFinancialProfile(
  profile: Partial<FinancialProfile>,
): Promise<FinancialProfile> {
  const payload = {
    totalNetWorth: Math.round(Number(profile.totalNetWorth) || 0),
    monthlyExpenses: Math.round(Number(profile.monthlyExpenses) || 0),
    monthlyPac: profile.monthlyPac != null ? Math.round(Number(profile.monthlyPac)) : undefined,
    targetNetWorth: profile.targetNetWorth != null ? Math.round(Number(profile.targetNetWorth)) : undefined,
    liquidityMonthsCovered: Math.round(Number(profile.liquidityMonthsCovered) || 6),
    externalStableIncome: Math.round(Number(profile.externalStableIncome) || 0),
    hasDependents: Boolean(profile.hasDependents),
    liquidityAllocation: Math.round(Number(profile.liquidityAllocation) || 0),
    reserveAllocation: Math.round(Number(profile.reserveAllocation) || 0),
    tradingAllocation: Math.round(Number(profile.tradingAllocation) || 0),
    investmentsAllocation: Math.round(Number(profile.investmentsAllocation) || 0),
    futureProjectsAllocation: Math.round(Number(profile.futureProjectsAllocation) || 0),
    wealthSubAllocations: profile.wealthSubAllocations,
    accountObjective: profile.accountObjective || "GROWTH",
    timeHorizonYears: Number(profile.timeHorizonYears) || 3,
    expectedMonthlyReturnPct: Number(profile.expectedMonthlyReturnPct) || 3,
    simulatedDrawdownPct: Number(profile.simulatedDrawdownPct) || 10,
    taxCountry: profile.taxCountry || "IT",
    taxRegime: profile.taxRegime || "DICHIARATIVO",
    showNetOfTax: profile.showNetOfTax !== undefined ? Boolean(profile.showNetOfTax) : true,
    isCompleted: Boolean(profile.isCompleted),
  };

  const localSaved: FinancialProfile = {
    ...DEFAULT_FINANCIAL_PROFILE,
    ...payload,
    id: profile.id || "local-financial-profile",
    userId: profile.userId || "guest",
    wealthSubAllocations: profile.wealthSubAllocations,
    validatedAt: payload.isCompleted ? (profile.validatedAt || new Date().toISOString()) : null,
    updatedAt: new Date().toISOString(),
  };

  // Immediate local cache
  setStoredFinancialProfile(localSaved);

  const updated = await apiJSON<FinancialProfile>("financial-profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  if (updated && typeof updated === "object") {
    setStoredFinancialProfile(updated);
    return updated;
  }

  return localSaved;
}

export function useFinancialProfile() {
  return useQuery({
    queryKey: FINANCIAL_PROFILE_QUERY_KEY,
    queryFn: fetchFinancialProfile,
    staleTime: 60_000,
    initialData: () => getStoredFinancialProfile() ?? DEFAULT_FINANCIAL_PROFILE,
  });
}

export function useUpdateFinancialProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveFinancialProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(FINANCIAL_PROFILE_QUERY_KEY, updated);
      queryClient.invalidateQueries({ queryKey: FINANCIAL_PROFILE_QUERY_KEY });
    },
  });
}

/**
 * Restituisce il Capitale di Riferimento (Account Balance iniziale) stabilito nell'Architettura Patrimoniale.
 */
export function getReferenceTradingCapital(profile?: FinancialProfile | null): number {
  if (!profile) {
    const stored = getStoredFinancialProfile();
    return stored?.tradingAllocation ?? DEFAULT_FINANCIAL_PROFILE.tradingAllocation;
  }
  return Number(profile.tradingAllocation) || DEFAULT_FINANCIAL_PROFILE.tradingAllocation;
}

/**
 * Restituisce true se l'utente ha validato e salvato il proprio protocollo patrimoniale.
 */
export function isFinancialFoundationCompleted(profile?: FinancialProfile | null): boolean {
  if (profile !== undefined) {
    return Boolean(profile?.isCompleted);
  }
  const stored = getStoredFinancialProfile();
  return Boolean(stored?.isCompleted);
}
