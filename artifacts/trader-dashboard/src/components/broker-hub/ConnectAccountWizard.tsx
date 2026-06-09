import { ShieldCheck } from "lucide-react";
import { FxBlueAccountSyncWizard } from "./FxBlueAccountSyncWizard";
import { type useBrokerHub } from "./useBrokerHub";

export function ConnectAccountWizard({ hub, onConnected }: { hub: ReturnType<typeof useBrokerHub>; onConnected: () => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <FxBlueAccountSyncWizard hub={hub} onConnected={onConnected} onBack={() => {}} />
      <aside className="rounded-lg border border-border/40 bg-secondary/20 p-4 text-sm">
        <div className="flex items-center gap-2 font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Sicurezza e compatibilità
        </div>
        <div className="mt-3 grid gap-2 text-muted-foreground">
          <p>FX Blue Account Sync è l'unico metodo di collegamento disponibile nel Broker Hub.</p>
          <p>La connessione resta in Sola lettura: saldo, equity, posizioni e storico vengono sincronizzati senza abilitare ordini live.</p>
          <p>Usa su FX Blue solo la password investor/read-only, mai la password master del conto.</p>
          <p>La frequenza di aggiornamento dipende da FX Blue, piattaforma e broker.</p>
        </div>
      </aside>
    </div>
  );
}
