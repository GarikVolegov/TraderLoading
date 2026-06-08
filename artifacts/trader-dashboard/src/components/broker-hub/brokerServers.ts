// Suggerimenti di server MT4/MT5 per i broker più diffusi. È un aiuto per la
// tendina del campo "server": il campo resta a testo libero (qualsiasi server è
// valido) e MetaApi valida comunque il nome al collegamento. Sono esempi comuni,
// non un elenco ufficiale esaustivo — verifica sempre col tuo broker.

export interface BrokerServerGroup {
  broker: string;
  aliases?: string[];
  servers: string[];
}

export const BROKER_SERVERS: BrokerServerGroup[] = [
  { broker: "IC Markets", aliases: ["icmarkets", "ic markets"], servers: [
    "ICMarketsSC-Demo", "ICMarketsSC-Live01", "ICMarketsSC-Live02", "ICMarketsSC-Live04",
    "ICMarketsSC-Live05", "ICMarketsEU-Live", "ICMarketsEU-Demo", "ICMarketsSC-MT5",
  ] },
  { broker: "Pepperstone", aliases: ["pepperstone"], servers: [
    "Pepperstone-Demo", "Pepperstone-Live01", "Pepperstone-Live02", "Pepperstone-Live03",
    "Pepperstone-Edge01", "PepperstoneUK-Live",
  ] },
  { broker: "XM", aliases: ["xm", "xm global", "trading point"], servers: [
    "XMGlobal-MT5", "XMGlobal-MT5 2", "XMGlobal-MT5 3", "XMGlobal-MT5 4", "XMGlobal-MT5 5",
    "XMGlobal-Demo", "XMGlobal-Real",
  ] },
  { broker: "Exness", aliases: ["exness"], servers: [
    "Exness-MT5Real", "Exness-MT5Real2", "Exness-MT5Real8", "Exness-MT5Real14",
    "Exness-MT5Trial", "Exness-MT5Trial7",
  ] },
  { broker: "FP Markets", aliases: ["fp markets", "fpmarkets"], servers: [
    "FPMarkets-Live", "FPMarkets-Demo", "FPMarketsLLC-Live", "FPMarketsLLC-Demo",
  ] },
  { broker: "RoboForex", aliases: ["roboforex"], servers: [
    "RoboForex-Pro", "RoboForex-ECN", "RoboForex-Demo", "RoboForex-MT5",
  ] },
  { broker: "Admirals", aliases: ["admirals", "admiral markets"], servers: [
    "Admirals-Live", "Admirals-Demo", "AdmiralMarkets-Live", "AdmiralMarkets-Demo",
  ] },
  { broker: "FXTM", aliases: ["fxtm", "forextime"], servers: [
    "ForexTimeFXTM-Live", "ForexTimeFXTM-Demo", "FXTM-ECN",
  ] },
  { broker: "HFM", aliases: ["hfm", "hotforex", "hf markets"], servers: [
    "HFMarketsGlobal-Live", "HFMarketsGlobal-Demo", "HFMarketsSV-Live", "HFMarketsSV-Demo",
  ] },
  { broker: "Vantage", aliases: ["vantage"], servers: [
    "VantageInternational-Live", "VantageInternational-Demo",
  ] },
  { broker: "Tickmill", aliases: ["tickmill"], servers: [
    "Tickmill-Live", "Tickmill-Demo", "TickmillEU-Live", "TickmillEU-Demo",
  ] },
  { broker: "Eightcap", aliases: ["eightcap"], servers: [
    "Eightcap-Live", "Eightcap-Demo",
  ] },
  { broker: "ThinkMarkets", aliases: ["thinkmarkets"], servers: [
    "ThinkMarkets-Live", "ThinkMarkets-Demo",
  ] },
  { broker: "FXCM", aliases: ["fxcm"], servers: [
    "FXCM-USDReal01", "FXCM-USDDemo01",
  ] },
  { broker: "OANDA", aliases: ["oanda"], servers: [
    "OANDA-Live-1", "OANDA-Demo-1",
  ] },
];

const ALL_SERVERS = Array.from(new Set(BROKER_SERVERS.flatMap((g) => g.servers)));

/**
 * suggestServers(brokerQuery)
 * Ritorna i server suggeriti: quelli del broker corrispondente al testo digitato
 * (match su nome/alias), altrimenti l'elenco completo come autocompletamento.
 */
export function suggestServers(brokerQuery: string): string[] {
  const q = brokerQuery.trim().toLowerCase();
  if (!q) return ALL_SERVERS;
  const matches = BROKER_SERVERS.filter(
    (g) => g.broker.toLowerCase().includes(q) || (g.aliases ?? []).some((a) => q.includes(a) || a.includes(q)),
  );
  return matches.length > 0 ? Array.from(new Set(matches.flatMap((g) => g.servers))) : ALL_SERVERS;
}
