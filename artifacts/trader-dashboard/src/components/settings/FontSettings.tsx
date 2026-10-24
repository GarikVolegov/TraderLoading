import { useRef } from "react";
import { uiText } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Type, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
    description: "Proporzioni geometriche, alta leggibilità su metriche e telemetrie.",
  },
  {
    value: "jetbrains",
    label: "JetBrains Mono (Dati & Terminale)",
    description: "Monospace rigido ad altissima precisione per trading algoritmico.",
  },
  {
    value: "inter",
    label: "Inter (Architettura Neutra)",
    description: "Tratto tipografico austero e pulito per interfaccia operativa densa.",
  },
] as const satisfies readonly {
  value: UpdateUserSettingsRequestFontChoice;
  label: string;
  description: string;
}[];

export function FontSettings() {
  const { fontChoice, setFontChoice } = useBackground();
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
      toast({ description: "Carattere tipografico aggiornato." });
    } catch {
      toast({
        description: uiText("settings.preference_failed"),
        variant: "destructive",
      });
    } finally {
      sending.current = false;
    }
  };

  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-6 space-y-4 shadow-xl shadow-black/40" aria-busy={updateMutation.isPending}>
      <div className="flex items-center justify-between gap-3 border-b border-[#C5A059]/15 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
              Architettura Tipografica
            </h3>
            <p className="text-xs font-mono text-muted-foreground/80">
              Seleziona la famiglia tipografica del terminale di comando.
            </p>
          </div>
        </div>

        <span className="font-mono text-xs font-bold text-[#E8C56A] bg-[#C5A059]/15 border border-[#C5A059]/35 px-2.5 py-1 rounded-lg">
          {fontChoice}
        </span>
      </div>

      <div className="space-y-2.5 pt-1">
        {FONT_OPTIONS.map((opt) => {
          const isActive = fontChoice === opt.value;
          return (
            <motion.button
              key={opt.value}
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              onClick={() => void handleFontChange(opt.value)}
              disabled={updateMutation.isPending}
              className={`w-full p-4 rounded-xl text-left transition-all flex items-center justify-between border ${
                isActive
                  ? "bg-[#C5A059]/15 border-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.12)] text-[#E8C56A]"
                  : "bg-[#07080b] border-[#26262E] hover:border-[#C5A059]/35 hover:bg-[#11131c] text-[#F4F4F6]"
              }`}
            >
              <div>
                <span className="font-display text-xs font-bold block">
                  {opt.label}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground/75 block mt-0.5">
                  {opt.description}
                </span>
              </div>
              {isActive && (
                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  <span className="inline-flex items-center rounded border border-[#C5A059]/40 bg-[#C5A059]/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#E8C56A]">
                    Attivo
                  </span>
                  <Check className="w-4 h-4 text-[#E8C56A]" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
