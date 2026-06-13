import { useRef } from "react";
import { Sun } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          Oscuramento Sfondo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{uiText("auto.ui.0e54e61cc2")}</span>
          <span className="font-mono text-foreground">{darkness}%</span>
          <span>{uiText("auto.ui.396cdde350")}</span>
        </div>
        <input
          type="range"
          min="0"
          max="90"
          value={darkness}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="rounded-lg overflow-hidden border border-border aspect-[3/1] relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/30" />
          <div
            className="absolute inset-0 bg-background"
            style={{ opacity: darkness / 100 }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs text-foreground/70">
            Anteprima oscuramento
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
