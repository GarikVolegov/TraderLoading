import { Wallet } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { BrokerHubWorkspace } from "@/components/broker-hub/BrokerHubWorkspace";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BrokerHubTab } from "@/components/broker-hub/types";
import { updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import { useSearch, useLocation } from "wouter";

const BROKER_TABS: BrokerHubTab[] = ["connect", "accounts", "history"];

function getInitialBrokerTab(search: string): BrokerHubTab {
  const requested = new URLSearchParams(search).get("tab");
  return BROKER_TABS.includes(requested as BrokerHubTab) ? (requested as BrokerHubTab) : "connect";
}

export function BrokerWorkspace() {
  const search = useSearch();
  const [, navigate] = useLocation();
  return <ProUpgradeGate feature="broker" fillViewport>
    <BrokerHubWorkspace initialTab={getInitialBrokerTab(search)} onTabChange={tab => navigate(`/journal${updateWorkspaceQuery(search, { t: "trades", panel: "conti", tab })}`)} />
  </ProUpgradeGate>;
}

export default function Broker() {
  const { t } = useLanguage();

  return (
    <PageLayout fullWidth>
      <PageHeader
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Wallet className="h-4 w-4" />
          </div>
        }
        title={t("page.broker.title")}
        subtitle={t("page.broker.subtitle")}
      />

      <BrokerWorkspace />
    </PageLayout>
  );
}
