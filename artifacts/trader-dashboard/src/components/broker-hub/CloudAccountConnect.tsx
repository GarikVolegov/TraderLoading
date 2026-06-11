import { uiText } from "@/contexts/LanguageContext";
import { ShieldCheck } from "lucide-react";
import { FxBlueAccountSyncWizard } from "./FxBlueAccountSyncWizard";
import { useBrokerHub } from "./useBrokerHub";

export function CloudAccountConnect() {
  const hub = useBrokerHub();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <FxBlueAccountSyncWizard hub={hub} onConnected={() => { void hub.refreshProfiles(); }} onBack={() => {}} />
      <aside className="rounded-lg border border-border/40 bg-secondary/20 p-4 text-sm">
        <div className="flex items-center gap-2 font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Collegamento unico
        </div>
        <div className="mt-3 grid gap-2 text-muted-foreground">
          <p>{uiText("auto.ui.3c4819ed3b")}</p>
          <p>{uiText("auto.ui.3c0a279be4")}</p>
          <p>{uiText("auto.ui.37acde5cd0")}</p>
        </div>
      </aside>
    </div>
  );
}
