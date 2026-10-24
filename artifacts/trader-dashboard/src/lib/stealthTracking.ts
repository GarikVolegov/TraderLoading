/**
 * Stealth Attribution & Gatekeeping Tracking Kit
 * Implements 60-day attribution window for partner referrals (?ref=USER_ID)
 * and persistence of Candidate Applications for the Operational Protocol.
 */

export const STEALTH_REF_STORAGE_KEY = "tl_stealth_referral_v1";
export const STEALTH_APPLICATIONS_STORAGE_KEY = "tl_candidate_applications_v1";
export const STEALTH_TIER_OVERRIDE_KEY = "tl_stealth_user_tier_override";

// 60 days persistence window
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

export interface StoredStealthReferral {
  code: string;
  capturedAt: number;
  expiresAt: number;
}

export type UserTier = "sandbox" | "member";

export interface CandidateApplication {
  id: string; // e.g. "TL-84291"
  timestamp: number;
  createdAtIso: string;
  situation: string;
  horizon: string;
  obstacle: string;
  commitment: string;
  name: string;
  email: string;
  contactHandle: string;
  contactType: "telegram" | "whatsapp";
  referredBy: string | null;
  status: "in_valutazione" | "ammesso" | "contattato";
  planChosen?: "trial_1_day" | "direct_150";
}

/**
 * Capture referral parameter from URL search string and persist for 60 days.
 */
export function captureStealthReferral(search?: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    const query = search !== undefined ? search : window.location.search;
    const params = new URLSearchParams(query);
    const rawRef = params.get("ref");

    if (rawRef) {
      const sanitized = rawRef.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      if (sanitized.length >= 2 && sanitized.length <= 40) {
        const now = Date.now();
        const payload: StoredStealthReferral = {
          code: sanitized,
          capturedAt: now,
          expiresAt: now + SIXTY_DAYS_MS,
        };
        window.localStorage.setItem(STEALTH_REF_STORAGE_KEY, JSON.stringify(payload));
        return sanitized;
      }
    }
  } catch {
    // Storage access resilience
  }

  return getStoredStealthReferral();
}

/**
 * Retrieve active referral code from localStorage if not expired.
 */
export function getStoredStealthReferral(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const item = window.localStorage.getItem(STEALTH_REF_STORAGE_KEY);
    if (!item) return null;

    const parsed: unknown = JSON.parse(item);
    if (
      parsed &&
      typeof parsed === "object" &&
      "code" in parsed &&
      "expiresAt" in parsed &&
      typeof (parsed as StoredStealthReferral).code === "string" &&
      typeof (parsed as StoredStealthReferral).expiresAt === "number"
    ) {
      const stored = parsed as StoredStealthReferral;
      if (Date.now() < stored.expiresAt) {
        return stored.code;
      }
      // Expired after 60 days
      window.localStorage.removeItem(STEALTH_REF_STORAGE_KEY);
    }
  } catch {
    // Storage read failure fallback
  }

  return null;
}

/**
 * Generate a random institutional candidate code, e.g. "TL-49812"
 */
export function generateCandidateId(): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `TL-${randomNum}`;
}

/**
 * Save candidate application into localStorage and associate any active referral.
 */
export function saveCandidateApplication(
  data: Omit<CandidateApplication, "id" | "timestamp" | "createdAtIso" | "status" | "referredBy">,
): CandidateApplication {
  const id = generateCandidateId();
  const now = Date.now();
  const referredBy = getStoredStealthReferral();

  const record: CandidateApplication = {
    ...data,
    id,
    timestamp: now,
    createdAtIso: new Date(now).toISOString(),
    status: "in_valutazione",
    referredBy,
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getSavedApplications();
      existing.unshift(record);
      window.localStorage.setItem(STEALTH_APPLICATIONS_STORAGE_KEY, JSON.stringify(existing.slice(0, 50)));
    } catch {
      // LocalStorage write error fallback
    }
  }

  return record;
}

/**
 * Retrieve stored applications from localStorage.
 */
export function getSavedApplications(): CandidateApplication[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STEALTH_APPLICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get / set user tier override for testing ("sandbox" vs "member").
 */
export function getStoredUserTier(): UserTier {
  if (typeof window === "undefined") return "sandbox";
  try {
    const stored = window.localStorage.getItem(STEALTH_TIER_OVERRIDE_KEY);
    if (stored === "member" || stored === "sandbox") {
      return stored;
    }
  } catch {
    // Fallback
  }
  return "sandbox";
}

export function setStoredUserTier(tier: UserTier): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STEALTH_TIER_OVERRIDE_KEY, tier);
  } catch {
    // Fallback
  }
}

/**
 * Partner Royalty calculation helper
 * Royalty is 20% recurring of €150/month = €30/month per active member.
 */
export function calculateRoyalty(activeMembers: number) {
  const quotaMensile = 150;
  const royaltyPerMember = 30; // 20% di €150
  const monthlyRoyalty = activeMembers * royaltyPerMember;
  const netCost = quotaMensile - monthlyRoyalty;
  const isSelfFunded = activeMembers >= 5;
  const netProfit = monthlyRoyalty > quotaMensile ? monthlyRoyalty - quotaMensile : 0;
  const coveragePercent = Math.min(100, Math.round((monthlyRoyalty / quotaMensile) * 100));

  return {
    quotaMensile,
    royaltyPerMember,
    activeMembers,
    monthlyRoyalty,
    netCost: netCost > 0 ? netCost : 0,
    isSelfFunded,
    netProfit,
    coveragePercent,
  };
}
