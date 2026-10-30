import { useEffect, useRef, useState } from "react";
import { useSession, useUser } from "@clerk/react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { createApiUrl } from "@/lib/apiFetch";
import { attributeSignupReferral, captureSignupReferral, claimSignupReferral } from "@/lib/referralAttribution";
import { captureSemAttribution } from "@/lib/semAttribution";

/** Persist the signup invitation until the authenticated server confirms its outcome. */
export function ReferralAttributionTracker() {
  const { user, isLoaded } = useUser();
  const { session } = useSession();
  const [path] = useLocation();
  const search = useSearch();
  const { t } = useLanguage();
  const [retry, setRetry] = useState(0);
  const [failedAccount, setFailedAccount] = useState<string | null>(null);
  const current = useRef({ userId: user?.id, sessionId: session?.id });
  current.current = { userId: user?.id, sessionId: session?.id };
  const userId = user?.id;
  const createdAt = user?.createdAt?.getTime();
  const sessionId = session?.id;

  useEffect(() => {
    if (!isLoaded || userId) return;
    try {
      captureSignupReferral(window.sessionStorage, path, search);
      captureSemAttribution();
    } catch { /* Storage disabled. */ }
  }, [isLoaded, userId, path, search]);

  useEffect(() => {
    if (!isLoaded || !userId || createdAt == null || !session || session?.user?.id !== userId) return;
    let storage: Storage;
    try { storage = window.sessionStorage; } catch { return; }
    const pending = claimSignupReferral(storage, userId, createdAt);
    if (!pending) return;
    let active = true;
    const isCurrent = () => current.current.userId === userId && current.current.sessionId === sessionId;
    void attributeSignupReferral({
      storage, userId, sessionId: session.id, pending,
      getToken: () => session.getToken(),
      isCurrent,
      post: async (token, code) => {
        // A captured session token prevents an account switch from attributing to the new account.
        const response = await fetch(createApiUrl("referral/attribute"), {
          method: "POST", credentials: "omit",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code }),
        });
        if (!response.ok) throw new Error(`Referral attribution HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      },
    }).then((result) => {
      if (active && isCurrent() && result === "confirmed") setFailedAccount(null);
    }).catch(() => {
      if (active && isCurrent()) setFailedAccount(userId);
    });
    return () => { active = false; };
  }, [isLoaded, userId, createdAt, sessionId, session, retry]);

  if (!userId || failedAccount !== userId) return null;
  return (
    <div role="alert" className="fixed bottom-24 left-4 right-4 z-[100] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card p-4 text-sm shadow-lg">
      <span>{t("referral.attribute_failed")}</span>
      <button type="button" className="shrink-0 rounded-lg bg-primary/15 px-3 py-2 font-medium text-primary hover:bg-primary/25" onClick={() => { setFailedAccount(null); setRetry((n) => n + 1); }}>
        {t("common.retry")}
      </button>
    </div>
  );
}
