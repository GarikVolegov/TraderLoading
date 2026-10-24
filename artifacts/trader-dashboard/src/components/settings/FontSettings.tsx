import { useRef } from "react";
import { uiText } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Type } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useBackground } from "@/contexts/BackgroundContext";
import {
  useUpdateUserSettings,
  getGetUserSettingsQueryKey,
  type UpdateUserSettingsRequestFontChoice,
} from "@workspace/api-client-react";

const FONT_OPTIONS = [
  {
    value: "space-grotesk",
    label: "Space Grotesk (Predefinito LIMEN)",
    sample: "font-['Space_Grotesk']",
  },
  {
    value: "jetbrains",
    label: "JetBrains Mono (Dati & Terminale)",
    sample: "font-['JetBrains_Mono']",
  },
  {
    value: "inter",
    label: "Architettura Tecnica (Standard)",
    sample: "font-['Space_Grotesk']",
  },
] as const satisfies readonly {
  value: UpdateUserSettingsRequestFontChoice;
  label: string;
  sample: string;
}[];

export function FontSettings() {
  const { fontChoice, setFontChoice } = useBackground();
  // handleSelect's own catch already shows its own toast below — opt out of
  // App.tsx's global mutation-error toast to avoid a double toast.
  const updateMutation = useUpdateUserSettings({ mutation: { meta: { suppressGlobalError: true } } });
  const qc = useQueryClient();
  const { toast } = useToast();

  const sending = useRef(false);
  const handleFontChange = async (
    value: UpdateUserSettingsRequestFontChoice,
  ) => {
    if (sending.current || value === fontChoice) return;
    sending.current = true;
    try {
      const saved = await updateMutation.mutateAsync({ data: { fontChoice: value } });
      qc.setQueryData(getGetUserSettingsQueryKey(), saved);
      setFontChoice(value);
      toast({ description: "Font aggiornato." });
    } catch {
      toast({
        description: uiText("settings.preference_failed"),
        variant: "destructive",
      });
    } finally { sending.current = false; }
  };

  return (
    <Card aria-busy={updateMutation.isPending}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="w-5 h-5 text-primary" />
          Font
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {FONT_OPTIONS.map((opt) => (
          <motion.button
            key={opt.value}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => void handleFontChange(opt.value)}
            disabled={updateMutation.isPending}
            className={`w-full px-4 py-3 rounded-lg text-left transition-all flex items-center justify-between ${
              fontChoice === opt.value
                ? "bg-primary/15 border border-primary/40 text-primary"
                : "bg-card border border-border hover:border-primary/30 text-foreground"
            }`}
          >
            <span style={{ fontFamily: opt.label }}>{opt.label}</span>
            {fontChoice === opt.value && (
              <span className="text-xs bg-primary/20 px-2 py-0.5 rounded-full">
                Attivo
              </span>
            )}
          </motion.button>
        ))}
      </CardContent>
    </Card>
  );
}
