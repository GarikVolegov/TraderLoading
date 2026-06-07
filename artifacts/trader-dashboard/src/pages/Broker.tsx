import { useState } from "react";
import { Wallet, Plug, Building2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalAccountConnect } from "@/components/account-bridge/LocalAccountConnect";
import { BrokerHubWorkspace } from "@/components/broker-hub/BrokerHubWorkspace";
import type { BrokerHubTab } from "@/components/broker-hub/types";

const BROKER_TABS: BrokerHubTab[] = ["connect", "accounts", "terminal", "order", "history"];

function getInitialBrokerTab(): BrokerHubTab {
  const requested = new URLSearchParams(window.location.search).get("tab");
  return BROKER_TABS.includes(requested as BrokerHubTab) ? (requested as BrokerHubTab) : "connect";
}

export default function Broker() {
  // Se l'URL ha ?tab=<broker-hub-tab>, parti dal pannello Broker Hub.
  const [topTab, setTopTab] = useState<"local" | "hub">(
    new URLSearchParams(window.location.search).has("tab") ? "hub" : "local",
  );

  return (
    <PageLayout fullWidth>
      <PageHeader
        icon={
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Wallet className="h-4.5 w-4.5" />
          </div>
        }
        title="Broker Hub"
        subtitle="Collega il tuo conto di trading e gestisci ordini e storico"
      />

      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as "local" | "hub")} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="local" className="gap-2">
            <Plug className="h-3.5 w-3.5" /> Conto (socket locale)
          </TabsTrigger>
          <TabsTrigger value="hub" className="gap-2">
            <Building2 className="h-3.5 w-3.5" /> Broker Hub
          </TabsTrigger>
        </TabsList>

        <TabsContent value="local">
          <LocalAccountConnect />
        </TabsContent>
        <TabsContent value="hub">
          <BrokerHubWorkspace initialTab={getInitialBrokerTab()} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
