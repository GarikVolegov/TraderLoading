import { Wallet } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
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
        subtitle="Collega il conto solo tramite FX Blue Account Sync"
      />

      <BrokerHubWorkspace initialTab={getInitialBrokerTab()} />
    </PageLayout>
  );
}
