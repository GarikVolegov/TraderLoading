import { Check } from "lucide-react";
import { useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage, LANGUAGES, type Language } from "@/contexts/LanguageContext";

export function LanguageSettings() {
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  // The empty catch below is deliberate (local switch still works, next save
  // retries) — opt out of App.tsx's global mutation-error toast so a
  // best-effort background sync doesn't surface as a user-facing failure.
  const updateMutation = useUpdateUserSettings({ mutation: { meta: { suppressGlobalError: true } } });
  const qc = useQueryClient();

  const handleSelect = async (lang: Language) => {
    setLanguage(lang);
    try {
      await updateMutation.mutateAsync({ data: { language: lang } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
    } catch {
      // The local language switch still works; the next settings save can retry server sync.
    }
    toast({ title: `Lingua impostata: ${LANGUAGES[lang].name}` });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Seleziona la lingua dell'interfaccia
      </p>
      <div className="grid grid-cols-1 gap-2">
        {(
          Object.entries(LANGUAGES) as [
            Language,
            (typeof LANGUAGES)[Language],
          ][]
        ).map(([code, lang]) => (
          <button
            key={code}
            onClick={() => handleSelect(code)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
              language === code
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/40 hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{lang.flag}</span>
              <div>
                <p className="text-sm font-medium">{lang.name}</p>
                <p className="text-xs text-muted-foreground">{lang.label}</p>
              </div>
            </div>
            {language === code && <Check className="w-4 h-4 text-primary" />}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center pt-1">
        La traduzione completa è in fase di sviluppo
      </p>
    </div>
  );
}
