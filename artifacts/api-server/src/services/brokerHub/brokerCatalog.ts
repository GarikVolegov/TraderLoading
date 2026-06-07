export interface BrokerCatalogEntry {
  id: string;
  displayName: string;
  defaultAccountLabel: string;
  category: "metatrader" | "brokerage" | "demo";
  primaryProviderKind: "traderloading-mt5-smartlink" | "metatrader-local-companion" | "metaapi-metatrader" | "snaptrade-brokerage" | "ctrader-open-api" | "demo";
  recommendedRoute: "smartlink_mt5" | "official_oauth" | "local_companion" | "broker_portal" | "file_import" | "manual" | "optional_cloud" | "advanced_ea";
  availableRoutes: Array<"smartlink_mt5" | "official_oauth" | "local_companion" | "broker_portal" | "file_import" | "manual" | "optional_cloud" | "advanced_ea">;
  userFields: Array<"accountNumber" | "accountPassword" | "server">;
}

export const BROKER_CATALOG: BrokerCatalogEntry[] = [
  {
    id: "fp-trading",
    displayName: "FP Trading",
    defaultAccountLabel: "FP Trading",
    category: "metatrader",
    primaryProviderKind: "traderloading-mt5-smartlink",
    recommendedRoute: "smartlink_mt5",
    availableRoutes: ["smartlink_mt5", "official_oauth", "file_import", "manual", "optional_cloud", "advanced_ea"],
    userFields: [],
  },
  {
    id: "metatrader",
    displayName: "Qualsiasi broker MetaTrader",
    defaultAccountLabel: "MetaTrader",
    category: "metatrader",
    primaryProviderKind: "traderloading-mt5-smartlink",
    recommendedRoute: "smartlink_mt5",
    availableRoutes: ["smartlink_mt5", "file_import", "manual", "optional_cloud", "advanced_ea"],
    userFields: [],
  },
  {
    id: "brokerage",
    displayName: "Broker azioni/crypto supportati",
    defaultAccountLabel: "Broker",
    category: "brokerage",
    primaryProviderKind: "snaptrade-brokerage",
    recommendedRoute: "broker_portal",
    availableRoutes: ["broker_portal", "file_import", "manual"],
    userFields: [],
  },
  {
    id: "ctrader",
    displayName: "cTrader",
    defaultAccountLabel: "cTrader",
    category: "metatrader",
    primaryProviderKind: "ctrader-open-api",
    recommendedRoute: "official_oauth",
    availableRoutes: ["official_oauth", "file_import", "manual"],
    userFields: [],
  },
];

export function resolveBroker(name: string): BrokerCatalogEntry {
  const normalized = name.trim().toLowerCase();
  return (
    BROKER_CATALOG.find((entry) => entry.displayName.toLowerCase() === normalized || entry.id === normalized) ??
    BROKER_CATALOG[0]
  );
}
