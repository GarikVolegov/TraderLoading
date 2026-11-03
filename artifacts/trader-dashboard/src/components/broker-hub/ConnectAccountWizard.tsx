import { ShieldCheck, Lock, Award, CheckCircle2 } from "lucide-react";
import { SimpleBrokerConnectWizard } from "./SimpleBrokerConnectWizard";
import { type useBrokerHub } from "./useBrokerHub";

export interface ConnectAccountWizardProps {
  hub: ReturnType<typeof useBrokerHub>;
  onConnected: () => void;
  preselectedBroker?: string;
  preselectedServer?: string;
}

export function ConnectAccountWizard({
  hub,
  onConnected,
  preselectedBroker,
  preselectedServer,
}: ConnectAccountWizardProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <SimpleBrokerConnectWizard
        hub={hub}
        onConnected={onConnected}
        preselectedBroker={preselectedBroker}
        preselectedServer={preselectedServer}
      />

      <aside className="rounded-xl border border-[#C5A059]/30 bg-[#0d0f14]/90 p-4 font-mono text-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-[#E8C56A] uppercase tracking-wider">
          <ShieldCheck className="h-4 w-4 text-[#C5A059]" />
          <span>Sicurezza &amp; Presidio</span>
        </div>

        <div className="space-y-3 text-slate-300">
          <div className="flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-[11px]">
              <strong className="text-white">Credenziali Read-Only:</strong> La password investor garantisce la sola consultazione dello storico, impedendo qualsiasi ordine manuale o modifica.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <Award className="h-3.5 w-3.5 text-[#E8C56A] mt-0.5 shrink-0" />
            <p className="text-[11px]">
              <strong className="text-white">Regole Prop Firm Integrate:</strong> Supporto nativo per i limiti di Daily Drawdown del 5% di FTMO, The 5%ers, FundedNext e Alpha Capital.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-[11px]">
              <strong className="text-white">Zero Latenza nel Varco:</strong> I dati di bilancio ed equity vengono sincronizzati direttamente nel cockpit e nel Libro della Verità.
            </p>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-black/50 border border-white/10 text-[10.5px] text-slate-400">
          💡 <span className="text-slate-300">Non hai ancora le credenziali a portata di mano?</span> Clicca su <strong className="text-[#E8C56A]">"⚡ Prova Istantanea 100k Demo"</strong> per testare il sistema senza attendere.
        </div>
      </aside>
    </div>
  );
}
