import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Smartphone, Download, Share, PlusSquare, CheckCircle2, Monitor } from "lucide-react";
import { usePwaStandalone } from "@/lib/usePwaStandalone";
import { synestheticClick, synestheticConfirm } from "@/lib/soundFx";

export function PwaInstallCard() {
  const { isStandalone, isInstallable, isIos, hasInstalled, promptInstall } = usePwaStandalone();
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  const handleInstallClick = async () => {
    synestheticClick();
    setIsInstalling(true);
    try {
      const success = await promptInstall();
      if (success) {
        synestheticConfirm();
      }
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Card className="border border-[#C5A059]/25 bg-[#0d0f14] shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <CardHeader className="pb-3 border-b border-[#C5A059]/15">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-sm font-display uppercase tracking-wider text-[#E8C56A]">
              <Smartphone className="w-4 h-4 text-[#C5A059] shrink-0" />
              <span>Esperienza Nativa PWA Standalone</span>
            </CardTitle>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Configurazione a schermo intero reale per dispositivi mobili e desktop. Rimuove le barre di navigazione del browser per massimizzare la visibilità dei grafici.
            </p>
          </div>
          {isStandalone || hasInstalled ? (
            <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3 h-3" />
              <span>Nativo Standalone</span>
            </span>
          ) : (
            <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] shrink-0">
              Browser Web
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {isStandalone || hasInstalled ? (
          <div className="rounded-lg border border-emerald-500/25 bg-[#07080b]/90 p-3.5 flex items-start gap-3">
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <Monitor className="w-4 h-4" />
            </div>
            <div className="space-y-1 text-xs text-slate-300">
              <strong className="text-white font-semibold block">
                Visualizzazione a Tutto Schermo Attiva
              </strong>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                AUREUS OS è in esecuzione in finestra isolata e protetta da overflow. Le scorciatoie rapide per Il Varco, La Forgia del Passato, Il Libro della Verità e L'Ordine Giornaliero sono integrate nel sistema operativo.
              </p>
            </div>
          </div>
        ) : isInstallable ? (
          <div className="rounded-lg border border-[#C5A059]/20 bg-[#07080b]/90 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="font-display text-xs uppercase font-bold tracking-wider text-[#E8C56A] block">
                Installazione Rapida su Schermo Home
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Aggiungi AUREUS al tuo dispositivo come applicazione autonoma con avvio istantaneo.
              </p>
            </div>
            <button
              type="button"
              disabled={isInstalling}
              onClick={handleInstallClick}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#C5A059] bg-[#C5A059] px-4 py-2 font-mono text-xs font-bold text-[#07080b] uppercase tracking-wider shadow-[0_0_15px_rgba(197,160,89,0.25)] hover:bg-[#E8C56A] transition-all cursor-pointer shrink-0 disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Installa AUREUS OS</span>
            </button>
          </div>
        ) : isIos ? (
          <div className="rounded-lg border border-[#C5A059]/25 bg-[#07080b]/90 p-3.5 space-y-2">
            <span className="font-display text-xs uppercase font-bold tracking-wider text-[#E8C56A] block">
              Istruzioni Installazione Standalone per iPhone / iPad
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg font-mono text-[11px]">
                <Share className="w-3.5 h-3.5 text-[#E8C56A]" />
                <span>1. Tocca il pulsante Condividi in Safari</span>
              </div>
              <span className="text-slate-500 hidden sm:inline">→</span>
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg font-mono text-[11px]">
                <PlusSquare className="w-3.5 h-3.5 text-[#E8C56A]" />
                <span>2. Seleziona &ldquo;Aggiungi alla schermata Home&rdquo;</span>
              </div>
            </div>
            <p className="text-[10.5px] text-slate-400 font-sans leading-relaxed pt-1">
              Una volta avviata dalla schermata Home, l&apos;applicazione opererà a tutto schermo senza la barra di ricerca Safari o i controlli inferiori.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-[#07080b]/90 p-3.5 space-y-1">
            <span className="font-display text-xs uppercase font-bold tracking-wider text-[#E8C56A] block">
              PWA Standalone &amp; Scorciatoie di Sistema
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Il manifest di sistema è configurato per supportare display standalone e controlli sovrapposti su ogni browser compatibile. Per installare, utilizza l&apos;icona di installazione nella barra degli indirizzi del tuo browser.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
