import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, Rocket, X } from "lucide-react";
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
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 py-6 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_15%,hsl(var(--primary)/0.10),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(224_55%_5%)_72%,hsl(var(--background))_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-border/60 bg-card/90 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/35 bg-primary/10 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.12)]">
            <Rocket className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            {t("auth.nickname.eyebrow")}
          </span>
        </div>

        <h1 className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
          {t("auth.nickname.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("auth.nickname.subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">
              {t("auth.nickname.label")}
            </span>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.nickname.placeholder")}
                autoFocus
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2.5 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary/55"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                {!checking && available === true && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                {!checking && available === false && <X className="h-4 w-4 text-red-400" aria-hidden="true" />}
              </span>
            </div>
            <span className="mt-1.5 block h-4 text-xs">
              {checking && <span className="text-muted-foreground">{t("auth.nickname.checking")}</span>}
              {!checking && available === true && <span className="text-primary">{t("auth.nickname.available")}</span>}
              {!checking && available === false && <span className="text-red-400">{t("auth.nickname.taken")}</span>}
            </span>
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-[0_10px_22px_hsl(var(--primary)/0.14)] transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="mt-3 block w-full text-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("auth.nickname.skip")}
          </button>
        </form>
      </div>
    </main>
  );
}
