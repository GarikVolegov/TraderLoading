import { uiText } from "@/contexts/LanguageContext";
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
          <p>{uiText("auto.ui.5ce1c6b130")}</p>
          <p>{uiText("auto.ui.7dec2397a6")}</p>
          <p>{uiText("auto.ui.548d5b8f70")}</p>
          <p>{uiText("auto.ui.9f3e2c591e")}</p>
        </div>
      </aside>
    </div>
  );
}
