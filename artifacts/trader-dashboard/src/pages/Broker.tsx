import { Wallet, Settings2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { CloudAccountConnect } from "@/components/broker-hub/CloudAccountConnect";
import { BrokerHubWorkspace } from "@/components/broker-hub/BrokerHubWorkspace";
import type { BrokerHubTab } from "@/components/broker-hub/types";

const BROKER_TABS: BrokerHubTab[] = ["connect", "accounts", "terminal", "order", "history"];

function getInitialBrokerTab(): BrokerHubTab {
  const requested = new URLSearchParams(window.location.search).get("tab");
  return BROKER_TABS.includes(requested as BrokerHubTab) ? (requested as BrokerHubTab) : "connect";
}

export default function Broker() {
  return (
    <PageLayout fullWidth>
      <PageHeader
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Wallet className="h-4 w-4" />
          </div>
        }
        title="Broker Hub"
        subtitle="Collega il tuo conto MetaTrader senza installare nulla"
      />

      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(22rem,0.42fr)]">
        <div className="min-w-0">
          <CloudAccountConnect />
        </div>

        <details className="tl-panel overflow-hidden">
          <summary className="flex min-h-11 cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
            <Settings2 className="h-4 w-4" /> Opzioni avanzate
          </summary>
          <div className="border-t border-border/40 p-4">
            <BrokerHubWorkspace initialTab={getInitialBrokerTab()} />
          </div>
        </details>
      </section>
    </PageLayout>
  );
}
