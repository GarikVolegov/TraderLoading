import { useQuery } from "@tanstack/react-query";
import { apiJSON } from "@/lib/apiFetch";
import type { LimenBillingCycle, LimenEntitlementsMap } from "../../../../contracts/limenServices";

export interface LimenEntitlementsResponse {
  ok: boolean;
  hasApplication: boolean;
  candidateCode: string | null;
  status: "in_valutazione" | "ammesso" | "respinto" | "contattato" | "nessuna";
  billingCycle?: LimenBillingCycle;
  selectedServices: string[];
  approvedServices: string[];
  monthlyFeeCents: number;
  yearlyFeeCents?: number;
  oneTimeFeeCents: number;
  entitlements: LimenEntitlementsMap;
}

const DEFAULT_ENTITLEMENTS: LimenEntitlementsMap = {
  varco: true,
  bookOfTruth: true,
  brotherhood: true,
  fiveGrades: true,
  quarterlyTournaments: false,
  forgeOfThePast: false,
  financialArchitecture: false,
  doctrineOfTime: false,
};

const ALL_UNLOCKED_ENTITLEMENTS: LimenEntitlementsMap = {
  varco: true,
  bookOfTruth: true,
  brotherhood: true,
  fiveGrades: true,
  quarterlyTournaments: true,
  forgeOfThePast: true,
  financialArchitecture: true,
  doctrineOfTime: true,
};

export function useLimenEntitlements() {
  const { data: adminStatus } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["milestones", "admin"],
    queryFn: () => apiJSON<{ isAdmin: boolean }>("milestones/admin/status"),
    staleTime: 60_000,
  });

  const isAdmin = adminStatus?.isAdmin ?? false;

  const query = useQuery<LimenEntitlementsResponse>({
    queryKey: ["limen-entitlements"],
    queryFn: () => apiJSON<LimenEntitlementsResponse>("candidate-applications/my-entitlements"),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const data = query.data;

  if (isAdmin) {
    return {
      ...query,
      isAdmin: true,
      entitlements: ALL_UNLOCKED_ENTITLEMENTS,
      status: "ammesso" as const,
      billingCycle: "monthly" as LimenBillingCycle,
      candidateCode: data?.candidateCode ?? "ADMIN",
      selectedServices: [
        "base_protocol",
        "forge_of_the_past",
        "financial_architecture",
        "doctrine_of_time",
      ],
      approvedServices: [
        "base_protocol",
        "forge_of_the_past",
        "financial_architecture",
        "doctrine_of_time",
      ],
      monthlyFeeCents: 0,
      yearlyFeeCents: 0,
      oneTimeFeeCents: 0,
      isAdmitted: true,
      isPending: false,
      hasApplication: true,
    };
  }

  const entitlements = data?.entitlements ?? DEFAULT_ENTITLEMENTS;
  const status = data?.status ?? "nessuna";
  const isAdmitted = status === "ammesso";
  const isPending = status === "in_valutazione";
  const hasApplication = data?.hasApplication ?? false;

  return {
    ...query,
    isAdmin: false,
    entitlements,
    status,
    billingCycle: (data?.billingCycle ?? "monthly") as LimenBillingCycle,
    candidateCode: data?.candidateCode ?? null,
    selectedServices: data?.selectedServices ?? ["base_protocol"],
    approvedServices: data?.approvedServices ?? ["base_protocol"],
    monthlyFeeCents: data?.monthlyFeeCents ?? 0,
    yearlyFeeCents: data?.yearlyFeeCents ?? 0,
    oneTimeFeeCents: data?.oneTimeFeeCents ?? 0,
    isAdmitted,
    isPending,
    hasApplication,
  };
}
