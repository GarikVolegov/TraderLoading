import { apiJSON } from "./apiFetch";
import type {
  AcademyCatalog,
  AcademyLesson,
  AcademyLessonDetail,
  AcademyLessonInput,
  AcademyProgress,
  AcademyTeacherSubmission,
} from "../../../../contracts/academy";
export type {
  AcademyCatalog,
  AcademyLesson,
  AcademyLessonDetail,
  AcademyLessonInput,
  AcademyProgress,
  AcademyTeacherSubmission,
};

export interface AcademyBilling {
  active: boolean;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  salesEnabled: boolean;
  checkoutAvailable: boolean;
  price: { amountCents: number; currency: string; interval: string };
  affiliate: {
    enrolled: boolean;
    termsVersion: string;
    rateBps: number;
    holdDays: number;
    code: string | null;
    link: string | null;
    activeGuidedMembersCount?: number;
    totalGuidedMembersCount?: number;
    currentGradeNumber?: number;
    expansionMandateUnlocked?: boolean;
  };
  commissions: {
    pendingCents: number;
    availableCents: number;
    paidCents: number;
    currency: string;
  };
}
export interface AcademyCommission {
  id: string;
  amountCents: number;
  reversedCents: number;
  status: string;
  availableAt: string;
  createdAt: string;
}
export interface AcademyPayoutItem extends AcademyCommission {
  affiliateUserId: string;
}
const json = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
export const academyKeys = {
  all: ["academy"] as const,
  catalog: ["academy", "catalog"] as const,
  billing: ["academy", "billing"] as const,
  lesson: (id: string) => ["academy", "lesson", id] as const,
  teacher: ["academy", "teacher"] as const,
  submissions: ["academy", "submissions"] as const,
  commissions: ["academy", "commissions"] as const,
  payouts: ["academy", "payouts"] as const,
};
export const fetchAcademyCatalog = () => apiJSON<AcademyCatalog>("academy/catalog");
export const fetchAcademyBilling = () => apiJSON<AcademyBilling>("academy/billing");
export const fetchAcademyLesson = (id: string) =>
  apiJSON<AcademyLessonDetail>(`academy/lessons/${encodeURIComponent(id)}`);
export const saveAcademyProgress = (
  id: string,
  body: { completed?: boolean; exerciseResponse?: string; submit?: boolean },
) =>
  apiJSON<AcademyProgress>(`academy/lessons/${encodeURIComponent(id)}/progress`, json("PUT", body));
export const fetchAcademyTeacherLessons = () => apiJSON<AcademyLesson[]>("academy/teacher/lessons");
export const saveAcademyLesson = (id: string | null, body: AcademyLessonInput) =>
  apiJSON<AcademyLesson>(
    id ? `academy/teacher/lessons/${encodeURIComponent(id)}` : "academy/teacher/lessons",
    json(id ? "PATCH" : "POST", body),
  );
export const fetchAcademySubmissions = () =>
  apiJSON<AcademyTeacherSubmission[]>("academy/teacher/submissions");
export const reviewAcademySubmission = (id: string, feedback: string, submittedAt: string) =>
  apiJSON<AcademyProgress>(
    `academy/teacher/submissions/${encodeURIComponent(id)}`,
    json("PATCH", { feedback, submittedAt }),
  );
export const fetchAcademyCommissions = () =>
  apiJSON<{ items: AcademyCommission[]; currency: string }>("academy/affiliate/commissions");
export const fetchAcademyPayouts = () =>
  apiJSON<{ items: AcademyPayoutItem[]; currency: string }>("academy/affiliate/payouts");
export interface AcademyPayoutResult {
  commissionId: string;
  status: "processed" | "failed";
  error?: string;
}
export const payAcademyCommissions = (commissionIds: string[]) =>
  apiJSON<{ items: AcademyPayoutResult[] }>(
    "academy/affiliate/payouts",
    json("POST", { commissionIds }),
  );
export const enrollAcademyAffiliate = (termsVersion: string) =>
  apiJSON<unknown>("academy/affiliate/enroll", json("POST", { acceptedTerms: true, termsVersion }));
export const academyCheckout = (referralCode?: string) =>
  apiJSON<{ url: string }>(
    "academy/billing/checkout",
    json("POST", referralCode ? { referralCode } : {}),
  );
export const changeAcademyRenewal = (resume: boolean) =>
  apiJSON<unknown>(`academy/billing/${resume ? "resume" : "cancel"}`, json("POST"));

/** Redirects are restricted even when a remote/API response is malformed. */
export function stripeRedirectUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !["checkout.stripe.com", "connect.stripe.com", "billing.stripe.com"].includes(url.hostname)
  )
    throw new Error("Invalid payment destination");
  return url.href;
}
