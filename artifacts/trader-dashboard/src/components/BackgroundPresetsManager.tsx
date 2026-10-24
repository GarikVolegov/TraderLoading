import { useState, useRef } from "react";
import { Image, X, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBackground } from "@/contexts/BackgroundContext";
import type { BackgroundPreset } from "@/lib/backgroundCatalog";
import { useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { uploadBackgroundImage } from "@/lib/backgroundSettingsApi";

export function BackgroundPresetsManager() {
  const { activeBackgroundUrl, device, backgroundPresets, customBackgrounds, canAddCustomBackground, setActiveBackgroundForDevice, setCustomBackgrounds } = useBackground();
  const { mutate: updateSettings } = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isPresetActive = (preset: BackgroundPreset) => {
    if (preset.id === "nero-ossidiana") {
      return (
        !activeBackgroundUrl ||
        activeBackgroundUrl === preset.url ||
        activeBackgroundUrl === "/images/backgrounds/desktop/nero-ossidiana.webp" ||
        activeBackgroundUrl === "/images/backgrounds/mobile/nero-ossidiana.webp"
      );
    }
    return activeBackgroundUrl === preset.url;
  };

  const handleSelectPreset = (preset: BackgroundPreset) => {
    // Il preset 'nero-ossidiana' azzera l'immagine a null: l'app visualizza il suo nero puro originale
    const nextUrl = preset.id === "nero-ossidiana" ? null : preset.url;
    setActiveBackgroundForDevice(nextUrl);
    updateSettings({
      data:
        device === "mobile"
          ? { backgroundUrlMobile: nextUrl }
          : { backgroundUrlDesktop: nextUrl },
    });
  };

  const handleUploadCustom = async (file: File) => {
    if (!canAddCustomBackground) {
      toast({ description: t("background.presets.limit"), variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const data = await uploadBackgroundImage(file);
      const newPreset: BackgroundPreset = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: data.url,
        isDefault: false,
        device,
      };
      const updated = [...customBackgrounds, newPreset];
      setCustomBackgrounds(updated);
      setActiveBackgroundForDevice(data.url);
      updateSettings({ data: device === "mobile" ? { backgroundUrlMobile: data.url } : { backgroundUrlDesktop: data.url } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: t("background.presets.added") });
    } catch {
      toast({ description: t("background.presets.upload_error"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePreset = (id: string) => {
    const removed = customBackgrounds.find((p) => p.id === id);
    const updated = customBackgrounds.filter((p) => p.id !== id);
    setCustomBackgrounds(updated);
    if (removed && activeBackgroundUrl === removed.url) {
      // Fallback al nero puro predefinito
      const fallback = null;
      setActiveBackgroundForDevice(fallback);
      updateSettings({
        data:
          device === "mobile"
            ? { backgroundUrlMobile: fallback }
            : { backgroundUrlDesktop: fallback },
      });
    }
    qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
    toast({ description: t("background.presets.removed") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5 text-primary" />
          {t("background.presets.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {backgroundPresets.map((preset) => {
            const isActive = isPresetActive(preset);
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`relative rounded-lg overflow-hidden cursor-pointer ${
                  device === "mobile" ? "aspect-9/16" : "aspect-video"
                } border-2 transition-all group ${
                  isActive
                    ? "border-primary ring-2 ring-primary/25 shadow-lg shadow-black/40"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <img
                  src={preset.url}
                  alt={preset.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-between p-2 pointer-events-none">
                  <div className="flex justify-between items-start w-full">
                    {isActive ? (
                      <span className="bg-primary text-primary-foreground font-semibold text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded shadow-sm">
                        {t("background.presets.active")}
                      </span>
                    ) : (
                      <span />
                    )}
                    {!preset.isDefault && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-6 w-6 p-0 pointer-events-auto shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePreset(preset.id);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <span className="text-xs text-white/95 font-medium truncate drop-shadow-sm">
                    {preset.name}
                  </span>
                </div>
              </div>
            );
          })}

          {canAddCustomBackground && (
            <div
              onClick={() => fileRef.current?.click()}
              className={`rounded-lg border-2 border-dashed border-border hover:border-primary/50 ${device === "mobile" ? "aspect-9/16" : "aspect-video"} flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors`}
            >
              <Plus className="w-6 h-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground text-center">{t("background.presets.add")}</span>
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
          {t("background.presets.hint")}
        </p>
        <p className="text-xs text-muted-foreground">{t("background.presets.device_hint")}</p>
      </CardContent>
    </Card>
  );
}
