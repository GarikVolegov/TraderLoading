import { useRef } from "react";
import { Check, Globe, Sparkles } from "lucide-react";
import { useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage, LANGUAGES, getBrowserLanguage, type Language } from "@/contexts/LanguageContext";

export function LanguageSettings() {
  const { language, isAutoDetected, setLanguage, resetToBrowserLanguage, t } = useLanguage();
  const { toast } = useToast();
  const updateMutation = useUpdateUserSettings({ mutation: { meta: { suppressGlobalError: true } } });
  const qc = useQueryClient();

  const sending = useRef(false);

  const handleSelectAuto = async () => {
    if (sending.current || isAutoDetected) return;
    sending.current = true;
    try {
      resetToBrowserLanguage();
      const detected = getBrowserLanguage();
      await updateMutation.mutateAsync({ data: { language: detected } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ title: t("settings.language.auto") });
    } catch {
      toast({ title: t("settings.preference_failed"), variant: "destructive" });
    } finally {
      sending.current = false;
    }
  };

  const handleSelect = async (lang: Language) => {
    if (sending.current || (!isAutoDetected && lang === language)) return;
    sending.current = true;
    try {
      const saved = await updateMutation.mutateAsync({ data: { language: lang } });
      qc.setQueryData(getGetUserSettingsQueryKey(), saved);
      setLanguage(lang, true);
      toast({ title: LANGUAGES[lang].name });
    } catch {
      toast({ title: t("settings.preference_failed"), variant: "destructive" });
    } finally {
      sending.current = false;
    }
  };

  const currentBrowserCode = getBrowserLanguage();
  const detectedBrowserName = LANGUAGES[currentBrowserCode]?.name ?? currentBrowserCode;

  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-6 space-y-5 shadow-xl shadow-black/40" aria-busy={updateMutation.isPending}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C5A059]/15 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
              Lingua del Protocollo
            </h3>
            <p className="text-xs font-mono text-muted-foreground/80">
              {t("settings.language.select")}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 px-2.5 py-1 font-mono text-[10px] uppercase font-bold tracking-wider text-[#E8C56A] self-start sm:self-center">
          <span>{LANGUAGES[language].flag} {LANGUAGES[language].name}</span>
        </span>
      </div>

      {/* Auto browser detection button */}
      <button
        type="button"
        onClick={() => void handleSelectAuto()}
        disabled={updateMutation.isPending}
        className={`flex w-full items-center justify-between p-4 rounded-xl border transition-all text-left ${
          isAutoDetected
            ? "border-[#C5A059]/60 bg-[#C5A059]/15 text-[#E8C56A] shadow-[0_0_15px_rgba(197,160,89,0.1)]"
            : "border-[#26262E] bg-[#07080b] hover:border-[#C5A059]/35 hover:bg-[#11131c]"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#11131c] text-[#C5A059]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-[#F4F4F6]">
                {t("settings.language.auto")}
              </span>
              <span className="rounded border border-[#C5A059]/30 bg-[#07080b] px-2 py-0.5 font-mono text-[10px] font-bold text-[#E8C56A]">
                {detectedBrowserName}
              </span>
            </div>
            <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">
              {t("settings.language.auto_desc")}
            </p>
          </div>
        </div>
        {isAutoDetected && <Check className="w-4 h-4 text-[#E8C56A] shrink-0" />}
      </button>

      <div className="border-t border-[#C5A059]/15 pt-2">
        <label className="text-[10px] font-mono uppercase tracking-widest text-[#C5A059]/75 block mb-2 px-1">
          Seleziona Idioma Manualmente
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(
            Object.entries(LANGUAGES) as [
              Language,
              (typeof LANGUAGES)[Language],
            ][]
          ).map(([code, lang]) => {
            const isExplicitlyActive = !isAutoDetected && language === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => void handleSelect(code)}
                disabled={updateMutation.isPending}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                  isExplicitlyActive
                    ? "border-[#C5A059] bg-[#C5A059]/15 text-[#E8C56A] shadow-[0_0_15px_rgba(197,160,89,0.12)]"
                    : "border-[#26262E] bg-[#07080b] hover:border-[#C5A059]/35 hover:bg-[#11131c]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <span className="font-display text-xs font-bold text-[#F4F4F6] block">
                      {lang.name}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground/75 block">
                      {lang.label}
                    </span>
                  </div>
                </div>
                {isExplicitlyActive && <Check className="w-4 h-4 text-[#E8C56A] shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] font-mono text-muted-foreground/50 text-center pt-2">
        {t("settings.language.notice")}
      </p>
    </div>
  );
}
