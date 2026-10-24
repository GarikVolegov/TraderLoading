import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, X, ZoomIn, ShieldCheck } from "lucide-react";
import type { CockpitSchematic } from "@/lib/cockpitSchematics";

interface CockpitSchematicLightboxProps {
  schematic: CockpitSchematic | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CockpitSchematicLightbox({
  schematic,
  isOpen,
  onClose,
}: CockpitSchematicLightboxProps) {
  if (!schematic) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[780px] w-[95vw] bg-[#0c0d12]/98 border border-white/10 text-foreground backdrop-blur-2xl p-0 overflow-hidden shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold">
                  Step 0{schematic.step} · {schematic.category.toUpperCase()}
                </span>
                <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/10 px-1.5 py-0">
                  Schematica Istituzionale
                </Badge>
              </div>
              <DialogTitle className="text-sm sm:text-base font-bold text-foreground mt-0.5">
                {schematic.title}
              </DialogTitle>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Immagine Grafico in Alta Definizione */}
        <div className="p-4 bg-black/60 flex items-center justify-center min-h-[260px] max-h-[55vh] overflow-hidden relative group">
          <img
            src={schematic.imageSrc}
            alt={schematic.title}
            className="max-h-[50vh] w-auto max-w-full object-contain rounded-lg border border-white/10 shadow-lg"
            onError={(e) => {
              // Fallback se l'immagine è in fase di caricamento
              (e.currentTarget as HTMLImageElement).src = "/images/journal-empty.webp";
            }}
          />
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 border border-white/10 text-[9px] font-mono text-muted-foreground flex items-center gap-1 backdrop-blur-sm">
            <ZoomIn size={10} className="text-primary" />
            <span>Schema Grafico Limen</span>
          </div>
        </div>

        {/* Descrizione & Punti Chiave Operativi */}
        <div className="p-4 space-y-3 bg-[#0e1017]">
          <div>
            <span className="text-[10px] font-mono uppercase text-muted-foreground block">
              Regola Operativa & Descrizione
            </span>
            <p className="text-xs text-foreground/90 mt-0.5 leading-relaxed">
              {schematic.description}
            </p>
          </div>

          {schematic.keyPoints.length > 0 && (
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
                <ShieldCheck size={12} />
                Checklist di Validazione
              </span>
              <ul className="space-y-1.5">
                {schematic.keyPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 size={13} className="text-primary shrink-0 mt-0.5" />
                    <span className="leading-snug">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
