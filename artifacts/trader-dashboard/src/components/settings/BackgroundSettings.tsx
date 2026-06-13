import { useState, useRef } from "react";
import { Image, Upload, X, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useBackground } from "@/contexts/BackgroundContext";
import { uiText } from "@/contexts/LanguageContext";
import { uploadBackgroundImage } from "@/lib/backgroundSettingsApi";
import {
  useGetUserSettings,
  useUpdateUserSettings,
  getGetUserSettingsQueryKey,
} from "@workspace/api-client-react";

export function BackgroundSettings() {
  const { backgroundUrl, setBackgroundUrl } = useBackground();
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: settings, refetch } = useGetUserSettings();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();

  const isCustom =
    settings?.backgroundType === "custom" &&
    settings?.backgroundUrl &&
    !imgError;
  const previewUrl = backgroundUrl || settings?.backgroundUrl;

  const handleFileChange = async (file: File) => {
    setUploading(true);
    setImgError(false);
    try {
      const data = await uploadBackgroundImage(file);
      setBackgroundUrl(data.url);
      await refetch();
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Sfondo aggiornato con successo." });
    } catch {
      toast({
        description: "Errore durante il caricamento.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    try {
      await updateMutation.mutateAsync({
        data: { backgroundType: "default", backgroundUrl: null },
      });
      setBackgroundUrl(null);
      setImgError(false);
      await refetch();
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Sfondo ripristinato." });
    } catch {
      toast({
        description: "Errore durante il ripristino.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5 text-primary" />
          Sfondo Personalizzato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCustom && previewUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-border aspect-video group">
            <img
              src={previewUrl}
              alt="Sfondo attuale"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1" />
                Cambia
              </Button>
              <Button size="sm" variant="destructive" onClick={handleReset}>
                <X className="w-4 h-4 mr-1" />
                Rimuovi
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center aspect-video text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Image className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">{uiText("settings.background.none_custom")}</p>
            <p className="text-xs opacity-60 mt-1">
              Clicca per selezionare un'immagine
            </p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileChange(f);
            e.target.value = "";
          }}
        />

        {!isCustom && (
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full"
            variant="outline"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Caricamento...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Scegli dalla libreria foto
              </>
            )}
          </Button>
        )}

        {(imgError ||
          (settings?.backgroundType === "custom" &&
            !settings?.backgroundUrl)) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Ripristina sfondo predefinito
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
