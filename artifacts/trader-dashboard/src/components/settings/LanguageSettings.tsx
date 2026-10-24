import { useRef } from "react";
import { Check, Globe } from "lucide-react";
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
    <div className="space-y-4" aria-busy={updateMutation.isPending}>
      <p className="text-sm text-muted-foreground">
        {t("settings.language.select")}
      </p>

      {/* Opzione 1: Rilevamento automatico dal browser */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void handleSelectAuto()}
          disabled={updateMutation.isPending}
          className={`flex w-full items-center justify-between px-4 py-3.5 rounded-xl border transition-all text-left ${
            isAutoDetected
              ? "border-primary bg-primary/10 text-primary shadow-sm"
              : "border-border hover:border-primary/40 hover:bg-secondary/50"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background/80 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{t("settings.language.auto")}</p>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  {detectedBrowserName}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("settings.language.auto_desc")}
              </p>
            </div>
          </div>
          {isAutoDetected && <Check className="w-4 h-4 text-primary shrink-0" />}
        </button>
      </div>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/60" />
        </div>
      </div>

      {/* Lingue fisse manuali */}
      <div className="grid grid-cols-1 gap-2">
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
              className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                isExplicitlyActive
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-secondary/50"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <span className="text-2xl">{lang.flag}</span>
                <div>
                  <p className="text-sm font-medium">{lang.name}</p>
                  <p className="text-xs text-muted-foreground">{lang.label}</p>
                </div>
              </div>
              {isExplicitlyActive && <Check className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        {t("settings.language.notice")}
      </p>
    </div>
  );
}
