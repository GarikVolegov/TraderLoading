import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { ArrowRight, Check, Loader2, X, ShieldCheck } from "lucide-react";
import { SigilIcon } from "@/components/ui/SigilIcon";
import {
  useGetProfile,
  useUpdateProfile,
  getGetProfileQueryKey,
  checkProfileName,
} from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function NicknameOnboarding() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { data: profile } = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });

  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      return window.sessionStorage.getItem("limen_pending_candidacy_name") || "";
    }
    return "";
  });
  const [experience, setExperience] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const debounced = useDebounce(name.trim(), 300);

  const pendingTier =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("limen_pending_candidacy_tier")
      : null;
  const pendingCycle =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("limen_pending_candidacy_cycle")
      : null;
  const pendingContactChannel =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("limen_pending_candidacy_contact_channel")
      : null;
  const pendingContactHandle =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("limen_pending_candidacy_contact_handle")
      : null;
  const pendingMotivation =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("limen_pending_candidacy_motivation")
      : null;
  const pendingCommitment =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("limen_pending_candidacy_commitment")
      : null;

  const goHome = useCallback(() => setLocation("/"), [setLocation]);

  const updateProfile = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        goHome();
      },
      onError: (err: unknown) => {
        if (
          err &&
          typeof err === "object" &&
          "status" in err &&
          (err as Record<string, unknown>).status === 409
        ) {
          setAvailable(false);
        }
      },
    },
  });

  const check = useCallback(async (value: string) => {
    if (!value) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    try {
      const res = await checkProfileName({ name: value });
      setAvailable(res.available);
    } catch {
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check(debounced);
  }, [debounced, check]);

  const canSubmit = name.trim().length > 0 && available !== false && !updateProfile.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Convalida e salvataggio candidatura se presente nel ciclo di registrazione
    const email = user?.primaryEmailAddress?.emailAddress;
    if (email) {
      const tier =
        pendingTier === "complete_150" || pendingTier === "base_free" || pendingTier === "founders_10"
          ? pendingTier
          : "founders_10";
      const cycle = pendingCycle === "yearly" ? "yearly" : "monthly";
      const contactChannel = pendingContactChannel || "whatsapp";
      const contactHandle = pendingContactHandle || email;

      const selectedServices =
        tier === "complete_150"
          ? ["base_protocol", "forge_of_the_past", "financial_architecture", "doctrine_of_time"]
          : tier === "base_free"
            ? ["base_protocol"]
            : ["base_protocol", "forge_of_the_past", "financial_architecture"];

      fetch("/api/candidate-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: crypto.randomUUID(),
          name: name.trim() || user?.fullName || "Iniziato",
          email,
          contactType: contactChannel === "telegram" ? "telegram" : "whatsapp",
          contactHandle: contactHandle.trim() || email,
          situation: pendingMotivation || experience.trim() || undefined,
          commitment: pendingCommitment === "accepted" ? "Dichiaro di essere disposto a sottomettermi alle regole del Protocollo, eliminare ogni deriva emotiva e rispettare con rigore L'Ordine Giornaliero." : undefined,
          planChosen: tier,
          billingCycle: cycle,
          selectedServices,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.candidate?.candidateCode && typeof window !== "undefined") {
            window.localStorage.setItem("limen_candidate_code", data.candidate.candidateCode);
          }
        })
        .catch(() => {
          // Safe non-blocking sync
        });

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("limen_pending_candidacy_tier");
        window.sessionStorage.removeItem("limen_pending_candidacy_cycle");
        window.sessionStorage.removeItem("limen_pending_candidacy_contact_channel");
        window.sessionStorage.removeItem("limen_pending_candidacy_contact_handle");
        window.sessionStorage.removeItem("limen_pending_candidacy_motivation");
        window.sessionStorage.removeItem("limen_pending_candidacy_commitment");
      }
    }

    updateProfile.mutate({
      data: {
        name: name.trim(),
        avatarUrl: profile?.avatarUrl ?? null,
        yearsExperience: profile?.yearsExperience ?? null,
      },
    });
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#0A0A0C] px-4 py-6 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_15%,rgba(197,160,89,0.12),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0A0A0C_0%,#141418_72%,#0A0A0C_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-[460px] rounded-2xl border border-[#C5A059]/35 bg-[#0d0f14]/95 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#C5A059]/40 bg-[#141418] text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.2)]">
              <SigilIcon variant="threshold" size={22} className="text-[#C5A059]" />
            </div>
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">
                {t("auth.nickname.eyebrow")}
              </span>
              <p className="font-mono text-[9px] text-[#8E8E98] uppercase">
                Grado I · Novizio Consapevole
              </p>
            </div>
          </div>
          <span className="rounded border border-[#10b981]/40 bg-[#10b981]/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#10b981] whitespace-nowrap">
            Account Attivo
          </span>
        </div>

        <h1 className="font-display text-2xl font-bold tracking-wide text-[#F4F4F6]">
          {t("auth.nickname.title")}
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#8E8E98]">{t("auth.nickname.subtitle")}</p>

        {/* Riepilogo Dati di Registrazione & Dotazione (Senza duplicazioni) */}
        <div className="mt-4 rounded-xl border border-[#C5A059]/25 bg-[#07080b]/90 p-3.5 space-y-2 text-left text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[#8E8E98]">Email Operativa:</span>
            <span className="font-bold text-[#E8C56A] truncate max-w-[240px]">
              {user?.primaryEmailAddress?.emailAddress || "Confermata"}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-[#25252E] pt-2">
            <span className="text-[#8E8E98]">Dotazione Scelta:</span>
            <span className="font-bold text-[#F4F4F6] whitespace-nowrap">
              {pendingTier === "complete_150"
                ? `Progetto Completo (${pendingCycle === "yearly" ? "1.500 €/a" : "150 €/m"})`
                : pendingTier === "base_free"
                  ? "Soglia Base (0 €)"
                  : `Prime Persone (${pendingCycle === "yearly" ? "100 €/a" : "10 €/m"})`}
            </span>
          </div>

          {pendingContactHandle && (
            <div className="flex items-center justify-between border-t border-[#25252E] pt-2">
              <span className="text-[#8E8E98]">Recapito Custode:</span>
              <span className="font-bold text-[#10b981] truncate max-w-[240px]">
                {pendingContactChannel === "telegram" ? "Telegram: " : "WhatsApp: "}
                {pendingContactHandle}
              </span>
            </div>
          )}

          {pendingMotivation && (
            <div className="border-t border-[#25252E] pt-2">
              <span className="text-[#8E8E98] block mb-0.5">Motivazione per il Custode:</span>
              <p className="text-[#F4F4F6] italic text-[11px] line-clamp-2">"{pendingMotivation}"</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-[#C5A059] font-bold">
              {t("auth.nickname.label")}
            </span>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.nickname.placeholder")}
                autoFocus
                className="w-full rounded-lg border border-[#2A2A34] bg-[#07080b] px-3.5 py-2.5 pr-10 text-sm font-mono text-[#F4F4F6] outline-none transition-colors focus:border-[#C5A059]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="h-4 w-4 animate-spin text-[#8E8E98]" aria-hidden="true" />}
                {!checking && available === true && <Check className="h-4 w-4 text-[#10b981]" aria-hidden="true" />}
                {!checking && available === false && <X className="h-4 w-4 text-[#ef4444]" aria-hidden="true" />}
              </span>
            </div>
            <span className="mt-1 block h-4 text-[11px] font-mono">
              {checking && <span className="text-[#8E8E98]">{t("auth.nickname.checking")}</span>}
              {!checking && available === true && <span className="text-[#10b981]">{t("auth.nickname.available")}</span>}
              {!checking && available === false && <span className="text-[#ef4444]">{t("auth.nickname.taken")}</span>}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-[#8E8E98]">
              Esperienza Operativa o Note per il Custode (Opzionale)
            </span>
            <input
              type="text"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="Es. 2 anni Forex / Indici, prop trader, scalping..."
              className="w-full rounded-lg border border-[#2A2A34] bg-[#07080b] px-3.5 py-2 text-xs font-mono text-[#F4F4F6] outline-none transition-colors focus:border-[#C5A059]"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#E8C56A] via-[#C5A059] to-[#B38D45] py-3 text-xs font-mono font-bold uppercase tracking-[0.16em] text-[#07080b] shadow-[0_0_20px_rgba(197,160,89,0.3)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {updateProfile.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <>
                <span>Consacra il Profilo & Accedi al Varco</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={goHome}
            className="mt-2 block w-full text-center font-mono text-[11px] uppercase tracking-wider text-[#8E8E98] transition-colors hover:text-[#F4F4F6]"
          >
            {t("auth.nickname.skip")}
          </button>
        </form>
      </div>
    </main>
  );
}
