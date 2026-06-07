import { useState, useRef } from "react";
import { Image, Upload, X, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBackground, DEFAULT_BACKGROUND_PRESETS, type BackgroundPreset } from "@/contexts/BackgroundContext";
import { useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function BackgroundPresetsManager() {
  const { backgroundUrl, backgroundPresets, setBackgroundUrl, setBackgroundPresets } = useBackground();
  const { mutate: updateSettings } = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSelectPreset = (preset: BackgroundPreset) => {
    setBackgroundUrl(preset.url);
    updateSettings({ data: { backgroundType: "custom", backgroundUrl: preset.url } });
  };

  const handleUploadCustom = async (file: File) => {
    if (backgroundPresets.length >= 6) {
      toast({ description: "Limite di 6 sfondi raggiunto. Rimuovi uno prima di aggiungerne uno nuovo.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("api/settings/background", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { url: string };
      
      const newPreset: BackgroundPreset = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: data.url,
        isDefault: false,
      };
      const updated = [...backgroundPresets, newPreset];
      setBackgroundPresets(updated);
      setBackgroundUrl(data.url);
      updateSettings({ data: { backgroundPresets: updated, backgroundType: "custom", backgroundUrl: data.url } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Sfondo aggiunto con successo." });
    } catch {
      toast({ description: "Errore durante il caricamento.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePreset = (id: string) => {
    const updated = backgroundPresets.filter(p => p.id !== id);
    setBackgroundPresets(updated);
    if (backgroundUrl === backgroundPresets.find(p => p.id === id)?.url) {
      setBackgroundUrl(DEFAULT_BACKGROUND_PRESETS[0].url);
    }
    updateSettings({ data: { backgroundPresets: updated } });
    qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
    toast({ description: "Sfondo rimosso." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5 text-primary" />
          Sfondi Personalizzati
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {backgroundPresets.map(preset => (
            <div
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className={`relative rounded-lg overflow-hidden cursor-pointer aspect-video border-2 transition-all group ${
                backgroundUrl === preset.url
                  ? "border-primary/60 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex flex-col items-center justify-between p-2 opacity-0 group-hover:opacity-100">
                <span className="text-xs text-white font-medium">{preset.name}</span>
                {!preset.isDefault && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePreset(preset.id);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {backgroundUrl === preset.url && (
                <div className="absolute top-1 right-1 bg-primary/80 text-white text-xs px-2 py-1 rounded">Attivo</div>
              )}
            </div>
          ))}
          
          {backgroundPresets.length < 6 && (
            <div
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-border hover:border-primary/50 aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-6 h-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground text-center">Aggiungi sfondo</span>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUploadCustom(f);
            e.target.value = "";
          }}
          disabled={uploading}
        />

        <p className="text-xs text-muted-foreground">
          Massimo 6 sfondi. Clicca per selezionare, hover per rimuovere (non puoi rimuovere i predefiniti).
        </p>
      </CardContent>
    </Card>
  );
}
