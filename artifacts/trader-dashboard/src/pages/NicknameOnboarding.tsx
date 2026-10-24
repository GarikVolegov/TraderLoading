import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
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
  const { data: profile } = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });

  const [name, setName] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const debounced = useDebounce(name.trim(), 300);

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

      <div className="relative z-10 w-full max-w-[440px] rounded-xl border border-[#C5A059]/30 bg-[#121216]/95 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border border-[#C5A059]/40 bg-[#141418] text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.2)]">
            <SigilIcon variant="threshold" size={22} className="text-[#C5A059]" />
          </div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">
            {t("auth.nickname.eyebrow")}
          </span>
        </div>

        <h1 className="font-display text-2xl font-bold tracking-wide text-[#F4F4F6]">
          {t("auth.nickname.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#8E8E98]">{t("auth.nickname.subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block">
            <span className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#8E8E98]">
              {t("auth.nickname.label")}
            </span>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.nickname.placeholder")}
                autoFocus
                className="w-full rounded-md border border-[#2A2A34] bg-[#0A0A0C] px-3.5 py-2.5 pr-10 text-sm text-[#F4F4F6] outline-none transition-colors focus:border-[#C5A059]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="h-4 w-4 animate-spin text-[#8E8E98]" aria-hidden="true" />}
                {!checking && available === true && <Check className="h-4 w-4 text-[#C5A059]" aria-hidden="true" />}
                {!checking && available === false && <X className="h-4 w-4 text-[#ef4444]" aria-hidden="true" />}
              </span>
            </div>
            <span className="mt-1.5 block h-4 text-xs font-mono">
              {checking && <span className="text-[#8E8E98]">{t("auth.nickname.checking")}</span>}
              {!checking && available === true && <span className="text-[#C5A059]">{t("auth.nickname.available")}</span>}
              {!checking && available === false && <span className="text-[#ef4444]">{t("auth.nickname.taken")}</span>}
            </span>
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#C5A059] py-3 text-xs font-mono font-bold uppercase tracking-[0.16em] text-[#0A0A0C] shadow-[0_10px_22px_rgba(197,160,89,0.2)] transition-all hover:bg-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateProfile.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <>
                {t("auth.nickname.continue")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={goHome}
            className="mt-3 block w-full text-center font-mono text-xs uppercase tracking-wider text-[#8E8E98] transition-colors hover:text-[#F4F4F6]"
          >
            {t("auth.nickname.skip")}
          </button>
        </form>
      </div>
    </main>
  );
}
