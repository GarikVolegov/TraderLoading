import { Button } from "@/components/ui/button";
import { FileText, Download, ShieldCheck, Database } from "lucide-react";

export function AccountExportSection() {
  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-6 space-y-4 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between gap-3 border-b border-[#C5A059]/15 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
              Esporta dati (Archivio Crittografato GDPR)
            </h3>
            <p className="text-xs font-mono text-muted-foreground/80">
              Copia portabile certificata del tuo intero tracciato operativo.
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex rounded border border-[#10b981]/30 bg-[#10b981]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#10b981]">
          <ShieldCheck className="w-3 h-3 mr-1 text-[#10b981]" />
          Conforme GDPR Art. 20
        </span>
      </div>

      <div className="rounded-xl border border-[#C5A059]/15 bg-[#11131c]/60 p-4 space-y-2">
        <p className="text-xs font-mono text-muted-foreground/90 leading-relaxed">
          Scarica un archivio JSON strutturato contenente l&apos;anagrafica del profilo, le preferenze operative, le registrazioni ne Il Libro della Verità (Journal), le sessioni di Forgia (Backtest), le routine e i dati di disciplina.
        </p>
        <p className="text-[11px] font-mono text-muted-foreground/60">
          Nota: Password, chiavi API broker e log interni di sicurezza sono crittografati e non vengono inclusi per integrità dell&apos;infrastruttura.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full justify-center gap-2 border-[#C5A059]/35 bg-[#07080b] hover:bg-[#C5A059]/15 hover:border-[#C5A059] text-[#E8C56A] font-mono text-xs py-5 rounded-xl transition-all shadow-md"
        onClick={() => {
          window.location.href = "/api/account/export";
        }}
      >
        <Download className="w-4 h-4 text-[#C5A059]" />
        <span>Esporta dati (JSON)</span>
      </Button>
    </div>
  );
}
