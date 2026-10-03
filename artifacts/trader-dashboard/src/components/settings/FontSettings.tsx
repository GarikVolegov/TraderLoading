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
  { value: "inter", label: "Inter", sample: "font-['Inter']" },
  {
    value: "jetbrains",
    label: "JetBrains Mono",
    sample: "font-['JetBrains_Mono']",
  },
  { value: "roboto", label: "Roboto", sample: "font-['Roboto']" },
  {
    value: "space-grotesk",
    label: "Space Grotesk",
    sample: "font-['Space_Grotesk']",
  },
  {
    value: "ibm-plex",
    label: "IBM Plex Sans",
    sample: "font-['IBM_Plex_Sans']",
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

  const handleFontChange = async (
    value: UpdateUserSettingsRequestFontChoice,
  ) => {
    setFontChoice(value);
    try {
      await updateMutation.mutateAsync({ data: { fontChoice: value } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Font aggiornato." });
    } catch {
      toast({
        description: "Errore nell'aggiornamento del font.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
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
            onClick={() => handleFontChange(opt.value)}
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
