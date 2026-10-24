import { useRef } from "react";
import { Sun, Moon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useBackground } from "@/contexts/BackgroundContext";
import { uiText } from "@/contexts/LanguageContext";
import { reportClientError } from "@/lib/clientErrorReporter";
import {
  useUpdateUserSettings,
  getGetUserSettingsQueryKey,
} from "@workspace/api-client-react";

export function DarknessSettings() {
  const { darkness, setDarkness } = useBackground();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const handleChange = (value: number) => {
    setDarkness(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await updateMutation.mutateAsync({
          data: { backgroundDarkness: value },
        });
        qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      } catch (error) {
        reportClientError(error, {
          context: "background darkness autosave",
          notify: false,
        });
      }
    }, 500);
  };

  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-6 space-y-4 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between gap-3 border-b border-[#C5A059]/15 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
            <Moon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
              Oscuramento Ossidiana Sfondo
            </h3>
            <p className="text-xs font-mono text-muted-foreground/80">
              Calibrazione della profondità visiva e contrasto del cockpit.
            </p>
          </div>
        </div>

        <span className="font-mono text-xs font-bold text-[#E8C56A] bg-[#C5A059]/15 border border-[#C5A059]/35 px-2.5 py-1 rounded-lg">
          {darkness}%
        </span>
      </div>

      <div className="space-y-3 pt-1">
        <div className="flex justify-between font-mono text-xs text-muted-foreground">
          <span>{uiText("auto.ui.0e54e61cc2")} (Luminoso)</span>
          <span>{uiText("auto.ui.396cdde350")} (Ossidiana Pura)</span>
        </div>

        <input
          type="range"
          min="0"
          max="90"
          value={darkness}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="w-full h-2 bg-[#11131c] border border-[#26262E] rounded-lg appearance-none cursor-pointer accent-[#C5A059]"
        />

        <div className="rounded-xl overflow-hidden border border-[#C5A059]/20 aspect-[4/1] relative bg-[#07080b]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#997736]/30 to-[#C5A059]/20" />
          <div
            className="absolute inset-0 bg-[#07080b]"
            style={{ opacity: darkness / 100 }}
          />
          <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-[#E8C56A]/80 tracking-wider uppercase font-semibold">
            Anteprima Contrasto Cockpit ({darkness}%)
          </div>
        </div>
      </div>
    </div>
  );
}
