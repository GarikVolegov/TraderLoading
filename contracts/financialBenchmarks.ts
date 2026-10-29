// ─── LIMEN PROTOCOL: PANIERI ISTITUZIONALI DI BENCHMARK & DATI REALI ─────────
// Dataset istituzionale di riferimento per l'Architettura Patrimoniale:
// - Top 50 Azioni ed ETF Globali (Core Compounding)
// - Top 50 Titoli ed ETF da Dividendo Aristocratici (Rendita / Cashflow)
// - Top 50 Criptovalute & Asset PoS Liquid Staking (Alpha Asimmetrico)
// - Copertura Oro Fisico / Spot XAUUSD (Preservazione del Capitale)
// - Modello Quantitativo Trading Half-Kelly (Posizionamento Chirurgico)

export interface BenchmarkAsset {
  ticker: string;
  name: string;
  sector?: string;
  weightPct: number; // Peso normalizzato nel basket
}

export interface EquityBenchmarkItem extends BenchmarkAsset {
  cagr5Y: number; // CAGR 5 anni (%)
  peRatio: number; // Rapporto Prezzo/Utili corrente
  historicalMedianPe: number; // P/E mediano decennale
  dividendYield: number; // Yield da dividendo (%)
  drawdownAthPct: number; // Distanza dal massimo storico (%)
}

export interface DividendBenchmarkItem extends BenchmarkAsset {
  dividendYield: number; // Rendimento da dividendo annuo netto/lordo (%)
  dividendGrowth5Y: number; // Crescita media annua del dividendo a 5 anni (%)
  payoutRatio: number; // Payout ratio sugli utili (%)
  consecutiveYearsHike: number; // Anni consecutivi di incremento dividendo
  frequency: "TRIMESTRALE" | "MENSILE" | "SEMESTRALE" | "ANNUALE";
}

export interface CryptoBenchmarkItem extends BenchmarkAsset {
  category: "STORE_OF_VALUE" | "POS_L1" | "DEFI" | "INFRASTRUCTURE" | "AI_DATA";
  stakingApyPct: number; // Rendimento reale annuo da staking (0 se PoW/DeFi non-staking)
  isStakingSupported: boolean;
  drawdownAthPct: number; // Distanza dal massimo storico (%)
  mvrvRatio: number; // Rapporto MVRV on-chain
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TOP 50 AZIONI ED ETF GLOBALI (CORE COMPOUNDING)
// ─────────────────────────────────────────────────────────────────────────────
export const TOP_50_EQUITIES_AND_ETFS: EquityBenchmarkItem[] = [
  // 7 ETF Istituzionali di Base
  { ticker: "VWCE", name: "Vanguard FTSE All-World UCITS", sector: "ETF Globale", weightPct: 10.0, cagr5Y: 10.8, peRatio: 19.5, historicalMedianPe: 18.2, dividendYield: 1.6, drawdownAthPct: -1.8 },
  { ticker: "SWDA", name: "iShares Core MSCI World UCITS", sector: "ETF Globale Sviluppati", weightPct: 9.0, cagr5Y: 11.4, peRatio: 20.2, historicalMedianPe: 18.8, dividendYield: 1.4, drawdownAthPct: -1.5 },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", sector: "ETF USA Large Cap", weightPct: 8.0, cagr5Y: 13.2, peRatio: 22.8, historicalMedianPe: 20.5, dividendYield: 1.3, drawdownAthPct: -2.1 },
  { ticker: "QQQ", name: "Invesco QQQ Trust (Nasdaq 100)", sector: "ETF Tech USA", weightPct: 6.0, cagr5Y: 17.5, peRatio: 28.5, historicalMedianPe: 25.2, dividendYield: 0.6, drawdownAthPct: -3.4 },
  { ticker: "SMH", name: "VanEck Semiconductor ETF", sector: "ETF Semiconduttori", weightPct: 4.0, cagr5Y: 28.4, peRatio: 31.2, historicalMedianPe: 24.0, dividendYield: 0.5, drawdownAthPct: -8.5 },
  { ticker: "MEUD", name: "Lyxor Core STOXX Europe 600", sector: "ETF Europa", weightPct: 3.0, cagr5Y: 7.8, peRatio: 14.8, historicalMedianPe: 14.5, dividendYield: 3.1, drawdownAthPct: -4.2 },
  { ticker: "EIMI", name: "iShares Core MSCI EM IMI", sector: "ETF Mercati Emergenti", weightPct: 2.0, cagr5Y: 3.5, peRatio: 12.4, historicalMedianPe: 13.0, dividendYield: 2.8, drawdownAthPct: -18.2 },

  // 43 Mega-Cap e Compounder Globali
  { ticker: "MSFT", name: "Microsoft Corporation", sector: "Tecnologia", weightPct: 4.5, cagr5Y: 19.2, peRatio: 32.5, historicalMedianPe: 29.0, dividendYield: 0.8, drawdownAthPct: -4.5 },
  { ticker: "AAPL", name: "Apple Inc.", sector: "Consumer Tech", weightPct: 4.5, cagr5Y: 22.1, peRatio: 31.8, historicalMedianPe: 26.5, dividendYield: 0.5, drawdownAthPct: -3.8 },
  { ticker: "NVDA", name: "NVIDIA Corporation", sector: "AI & Semiconduttori", weightPct: 4.0, cagr5Y: 65.4, peRatio: 42.0, historicalMedianPe: 38.0, dividendYield: 0.1, drawdownAthPct: -7.2 },
  { ticker: "GOOGL", name: "Alphabet Inc. (Google)", sector: "Servizi di Comunicazione", weightPct: 3.5, cagr5Y: 16.8, peRatio: 21.5, historicalMedianPe: 24.2, dividendYield: 0.4, drawdownAthPct: -9.5 },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "E-Commerce & Cloud", weightPct: 3.5, cagr5Y: 8.5, peRatio: 38.0, historicalMedianPe: 55.0, dividendYield: 0.0, drawdownAthPct: -6.0 },
  { ticker: "BRK.B", name: "Berkshire Hathaway", sector: "Finanziario / Holding", weightPct: 3.0, cagr5Y: 14.2, peRatio: 19.0, historicalMedianPe: 18.5, dividendYield: 0.0, drawdownAthPct: -2.0 },
  { ticker: "META", name: "Meta Platforms", sector: "Social & AI", weightPct: 3.0, cagr5Y: 21.0, peRatio: 24.5, historicalMedianPe: 23.0, dividendYield: 0.4, drawdownAthPct: -5.0 },
  { ticker: "TSM", name: "Taiwan Semiconductor (TSMC)", sector: "Fonderia Semiconduttori", weightPct: 2.5, cagr5Y: 24.8, peRatio: 23.0, historicalMedianPe: 20.0, dividendYield: 1.2, drawdownAthPct: -6.5 },
  { ticker: "AVGO", name: "Broadcom Inc.", sector: "Chip & Infrastrutture", weightPct: 2.5, cagr5Y: 34.0, peRatio: 32.0, historicalMedianPe: 22.0, dividendYield: 1.4, drawdownAthPct: -8.0 },
  { ticker: "LLY", name: "Eli Lilly and Company", sector: "Farmaceutico / Biotech", weightPct: 2.0, cagr5Y: 42.0, peRatio: 52.0, historicalMedianPe: 35.0, dividendYield: 0.6, drawdownAthPct: -9.0 },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", sector: "Bancario Globale", weightPct: 2.0, cagr5Y: 14.5, peRatio: 12.5, historicalMedianPe: 12.0, dividendYield: 2.2, drawdownAthPct: -1.5 },
  { ticker: "V", name: "Visa Inc.", sector: "Pagamenti Digitali", weightPct: 1.8, cagr5Y: 10.2, peRatio: 28.0, historicalMedianPe: 30.0, dividendYield: 0.8, drawdownAthPct: -3.5 },
  { ticker: "MA", name: "Mastercard Inc.", sector: "Pagamenti Digitali", weightPct: 1.8, cagr5Y: 11.5, peRatio: 31.0, historicalMedianPe: 33.0, dividendYield: 0.6, drawdownAthPct: -3.0 },
  { ticker: "ASML", name: "ASML Holding NV", sector: "Litografia EUV", weightPct: 1.8, cagr5Y: 21.5, peRatio: 35.0, historicalMedianPe: 34.0, dividendYield: 1.0, drawdownAthPct: -24.0 },
  { ticker: "UNH", name: "UnitedHealth Group", sector: "Sanità Assicurativa", weightPct: 1.5, cagr5Y: 14.0, peRatio: 22.0, historicalMedianPe: 21.0, dividendYield: 1.4, drawdownAthPct: -5.0 },
  { ticker: "XOM", name: "Exxon Mobil Corporation", sector: "Energia Tradizionale", weightPct: 1.5, cagr5Y: 16.5, peRatio: 14.0, historicalMedianPe: 15.0, dividendYield: 3.2, drawdownAthPct: -4.0 },
  { ticker: "COST", name: "Costco Wholesale", sector: "Retail & Abbonamenti", weightPct: 1.5, cagr5Y: 23.5, peRatio: 48.0, historicalMedianPe: 36.0, dividendYield: 0.5, drawdownAthPct: -3.0 },
  { ticker: "HD", name: "The Home Depot", sector: "Retail Miglioramento Casa", weightPct: 1.2, cagr5Y: 12.0, peRatio: 25.0, historicalMedianPe: 22.0, dividendYield: 2.3, drawdownAthPct: -6.0 },
  { ticker: "PG", name: "Procter & Gamble", sector: "Beni di Consumo Primari", weightPct: 1.2, cagr5Y: 8.5, peRatio: 25.5, historicalMedianPe: 24.0, dividendYield: 2.4, drawdownAthPct: -4.0 },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Sanità & Pharma", weightPct: 1.2, cagr5Y: 4.2, peRatio: 16.5, historicalMedianPe: 17.0, dividendYield: 3.1, drawdownAthPct: -12.0 },
  { ticker: "ABBV", name: "AbbVie Inc.", sector: "Farmaceutico", weightPct: 1.0, cagr5Y: 18.0, peRatio: 15.5, historicalMedianPe: 14.0, dividendYield: 3.3, drawdownAthPct: -5.0 },
  { ticker: "CRM", name: "Salesforce Inc.", sector: "Software Cloud CRM", weightPct: 1.0, cagr5Y: 10.5, peRatio: 29.0, historicalMedianPe: 45.0, dividendYield: 0.5, drawdownAthPct: -15.0 },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Grande Distribuzione", weightPct: 1.0, cagr5Y: 14.5, peRatio: 30.0, historicalMedianPe: 24.0, dividendYield: 1.0, drawdownAthPct: -2.0 },
  { ticker: "NFLX", name: "Netflix Inc.", sector: "Streaming & Media", weightPct: 1.0, cagr5Y: 15.0, peRatio: 38.0, historicalMedianPe: 40.0, dividendYield: 0.0, drawdownAthPct: -4.0 },
  { ticker: "BAC", name: "Bank of America", sector: "Bancario USA", weightPct: 0.8, cagr5Y: 8.0, peRatio: 13.0, historicalMedianPe: 12.5, dividendYield: 2.5, drawdownAthPct: -8.0 },
  { ticker: "ORCL", name: "Oracle Corporation", sector: "Database & Cloud AI", weightPct: 0.8, cagr5Y: 22.0, peRatio: 26.0, historicalMedianPe: 18.0, dividendYield: 1.1, drawdownAthPct: -5.0 },
  { ticker: "SAP", name: "SAP SE", sector: "Software Enterprise EU", weightPct: 0.8, cagr5Y: 15.5, peRatio: 32.0, historicalMedianPe: 24.0, dividendYield: 1.1, drawdownAthPct: -3.0 },
  { ticker: "NVO", name: "Novo Nordisk A/S", sector: "Diabete & Obesità", weightPct: 0.8, cagr5Y: 31.0, peRatio: 33.0, historicalMedianPe: 28.0, dividendYield: 1.3, drawdownAthPct: -21.0 },
  { ticker: "MC.PA", name: "LVMH Moët Hennessy", sector: "Lusso Globale", weightPct: 0.8, cagr5Y: 9.5, peRatio: 21.0, historicalMedianPe: 25.0, dividendYield: 2.2, drawdownAthPct: -28.0 },
  { ticker: "SIE.DE", name: "Siemens AG", sector: "Industriale & Tech EU", weightPct: 0.7, cagr5Y: 12.0, peRatio: 15.0, historicalMedianPe: 16.0, dividendYield: 2.8, drawdownAthPct: -4.0 },
  { ticker: "AIR.PA", name: "Airbus SE", sector: "Aerospazio & Difesa EU", weightPct: 0.7, cagr5Y: 8.5, peRatio: 26.0, historicalMedianPe: 20.0, dividendYield: 1.5, drawdownAthPct: -14.0 },
  { ticker: "AZN", name: "AstraZeneca PLC", sector: "Biofarmaceutico UK", weightPct: 0.7, cagr5Y: 14.0, peRatio: 17.5, historicalMedianPe: 19.0, dividendYield: 2.4, drawdownAthPct: -11.0 },
  { ticker: "SHEL", name: "Shell PLC", sector: "Energia Integrata", weightPct: 0.6, cagr5Y: 11.0, peRatio: 11.5, historicalMedianPe: 12.0, dividendYield: 3.9, drawdownAthPct: -8.0 },
  { ticker: "TMO", name: "Thermo Fisher Scientific", sector: "Strumentazione Scientifica", weightPct: 0.6, cagr5Y: 11.5, peRatio: 25.0, historicalMedianPe: 27.0, dividendYield: 0.3, drawdownAthPct: -14.0 },
  { ticker: "LIN", name: "Linde plc", sector: "Gas Industriali", weightPct: 0.6, cagr5Y: 15.5, peRatio: 31.0, historicalMedianPe: 29.0, dividendYield: 1.2, drawdownAthPct: -3.0 },
  { ticker: "ADBE", name: "Adobe Inc.", sector: "Software Creativo", weightPct: 0.5, cagr5Y: 9.0, peRatio: 26.0, historicalMedianPe: 38.0, dividendYield: 0.0, drawdownAthPct: -26.0 },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Processori & GPU", weightPct: 0.5, cagr5Y: 27.0, peRatio: 44.0, historicalMedianPe: 35.0, dividendYield: 0.0, drawdownAthPct: -32.0 },
  { ticker: "TXN", name: "Texas Instruments", sector: "Semiconduttori Analogici", weightPct: 0.5, cagr5Y: 10.5, peRatio: 31.0, historicalMedianPe: 23.0, dividendYield: 2.6, drawdownAthPct: -7.0 },
  { ticker: "PM", name: "Philip Morris International", sector: "Beni di Consumo", weightPct: 0.5, cagr5Y: 11.0, peRatio: 19.0, historicalMedianPe: 16.0, dividendYield: 4.3, drawdownAthPct: -3.0 },
  { ticker: "DIS", name: "The Walt Disney Company", sector: "Intrattenimento & Parchi", weightPct: 0.4, cagr5Y: -2.0, peRatio: 18.0, historicalMedianPe: 25.0, dividendYield: 0.9, drawdownAthPct: -48.0 },
  { ticker: "CAT", name: "Caterpillar Inc.", sector: "Macchinari Pesanti", weightPct: 0.4, cagr5Y: 23.0, peRatio: 18.0, historicalMedianPe: 17.0, dividendYield: 1.4, drawdownAthPct: -3.0 },
  { ticker: "GE", name: "GE Aerospace", sector: "Propulsione Aerospaziale", weightPct: 0.4, cagr5Y: 28.0, peRatio: 35.0, historicalMedianPe: 24.0, dividendYield: 0.6, drawdownAthPct: -4.0 },
  { ticker: "INTU", name: "Intuit Inc.", sector: "Software Fiscale & PMI", weightPct: 0.4, cagr5Y: 18.5, peRatio: 34.0, historicalMedianPe: 36.0, dividendYield: 0.6, drawdownAthPct: -11.0 },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. TOP 50 DIVIDENDI ARISTOCRATICI & RENDITA CASH FLOW
// ─────────────────────────────────────────────────────────────────────────────
export const TOP_50_DIVIDENDS_BASKET: DividendBenchmarkItem[] = [
  // 5 ETF ad Alto Dividendo
  { ticker: "SCHD", name: "Schwab U.S. Dividend Equity ETF", sector: "ETF Dividendo Qualità", weightPct: 9.0, dividendYield: 3.5, dividendGrowth5Y: 11.8, payoutRatio: 52, consecutiveYearsHike: 12, frequency: "TRIMESTRALE" },
  { ticker: "VHYL", name: "Vanguard FTSE All-World High Div", sector: "ETF Dividendo Globale", weightPct: 8.0, dividendYield: 3.7, dividendGrowth5Y: 6.2, payoutRatio: 58, consecutiveYearsHike: 10, frequency: "TRIMESTRALE" },
  { ticker: "NOBL", name: "ProShares S&P 500 Dividend Aristocrats", sector: "ETF Aristocratici USA", weightPct: 7.0, dividendYield: 2.1, dividendGrowth5Y: 7.5, payoutRatio: 48, consecutiveYearsHike: 25, frequency: "TRIMESTRALE" },
  { ticker: "DVY", name: "iShares Select Dividend ETF", sector: "ETF Dividendi Alti USA", weightPct: 5.0, dividendYield: 3.6, dividendGrowth5Y: 6.8, payoutRatio: 55, consecutiveYearsHike: 15, frequency: "TRIMESTRALE" },
  { ticker: "IDV", name: "iShares International Select Dividend", sector: "ETF Dividendi Internazionali", weightPct: 4.0, dividendYield: 5.8, dividendGrowth5Y: 4.5, payoutRatio: 62, consecutiveYearsHike: 8, frequency: "TRIMESTRALE" },

  // 45 Titoli Aristocratici e Macchine da Cash Flow
  { ticker: "O", name: "Realty Income (The Monthly Dividend Co)", sector: "REIT Commerciale", weightPct: 4.0, dividendYield: 5.3, dividendGrowth5Y: 3.8, payoutRatio: 78, consecutiveYearsHike: 30, frequency: "MENSILE" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Sanità & Pharma", weightPct: 3.5, dividendYield: 3.1, dividendGrowth5Y: 5.5, payoutRatio: 54, consecutiveYearsHike: 62, frequency: "TRIMESTRALE" },
  { ticker: "PG", name: "Procter & Gamble", sector: "Beni di Consumo Primari", weightPct: 3.5, dividendYield: 2.4, dividendGrowth5Y: 6.2, payoutRatio: 61, consecutiveYearsHike: 68, frequency: "TRIMESTRALE" },
  { ticker: "KO", name: "The Coca-Cola Company", sector: "Bevande", weightPct: 3.0, dividendYield: 2.9, dividendGrowth5Y: 4.8, payoutRatio: 68, consecutiveYearsHike: 62, frequency: "TRIMESTRALE" },
  { ticker: "PEP", name: "PepsiCo, Inc.", sector: "Bevande & Snack", weightPct: 3.0, dividendYield: 3.2, dividendGrowth5Y: 7.1, payoutRatio: 65, consecutiveYearsHike: 52, frequency: "TRIMESTRALE" },
  { ticker: "ABBV", name: "AbbVie Inc.", sector: "Farmaceutico", weightPct: 2.5, dividendYield: 3.3, dividendGrowth5Y: 8.2, payoutRatio: 58, consecutiveYearsHike: 52, frequency: "TRIMESTRALE" },
  { ticker: "CVX", name: "Chevron Corporation", sector: "Energia & Petrolio", weightPct: 2.5, dividendYield: 4.3, dividendGrowth5Y: 6.0, payoutRatio: 55, consecutiveYearsHike: 37, frequency: "TRIMESTRALE" },
  { ticker: "XOM", name: "Exxon Mobil Corporation", sector: "Energia & Petrolio", weightPct: 2.5, dividendYield: 3.2, dividendGrowth5Y: 3.5, payoutRatio: 42, consecutiveYearsHike: 41, frequency: "TRIMESTRALE" },
  { ticker: "MO", name: "Altria Group", sector: "Tabacco", weightPct: 2.0, dividendYield: 7.8, dividendGrowth5Y: 4.2, payoutRatio: 79, consecutiveYearsHike: 55, frequency: "TRIMESTRALE" },
  { ticker: "MCD", name: "McDonald's Corporation", sector: "Ristorazione Globale", weightPct: 2.0, dividendYield: 2.3, dividendGrowth5Y: 7.8, payoutRatio: 56, consecutiveYearsHike: 48, frequency: "TRIMESTRALE" },
  { ticker: "ENEL.MI", name: "Enel S.p.A.", sector: "Utility & Rinnovabili EU", weightPct: 2.0, dividendYield: 6.2, dividendGrowth5Y: 8.5, payoutRatio: 68, consecutiveYearsHike: 9, frequency: "SEMESTRALE" },
  { ticker: "SAN.PA", name: "Sanofi SA", sector: "Farmaceutico EU", weightPct: 1.8, dividendYield: 4.2, dividendGrowth5Y: 4.8, payoutRatio: 52, consecutiveYearsHike: 30, frequency: "ANNUALE" },
  { ticker: "ALV.DE", name: "Allianz SE", sector: "Assicurativo EU", weightPct: 1.8, dividendYield: 4.8, dividendGrowth5Y: 8.0, payoutRatio: 55, consecutiveYearsHike: 15, frequency: "ANNUALE" },
  { ticker: "NESN.SW", name: "Nestlé S.A.", sector: "Alimentare Globale", weightPct: 1.8, dividendYield: 3.6, dividendGrowth5Y: 4.0, payoutRatio: 65, consecutiveYearsHike: 29, frequency: "ANNUALE" },
  { ticker: "ULVR.L", name: "Unilever PLC", sector: "Beni di Consumo", weightPct: 1.8, dividendYield: 3.3, dividendGrowth5Y: 3.2, payoutRatio: 62, consecutiveYearsHike: 24, frequency: "TRIMESTRALE" },
  { ticker: "MUV2.DE", name: "Munich Re", sector: "Riassicurazione EU", weightPct: 1.5, dividendYield: 3.2, dividendGrowth5Y: 9.5, payoutRatio: 45, consecutiveYearsHike: 22, frequency: "ANNUALE" },
  { ticker: "TTE", name: "TotalEnergies SE", sector: "Energia Integrata EU", weightPct: 1.5, dividendYield: 5.2, dividendGrowth5Y: 5.5, payoutRatio: 38, consecutiveYearsHike: 18, frequency: "TRIMESTRALE" },
  { ticker: "IBE.MC", name: "Iberdrola S.A.", sector: "Utility & Rinnovabili", weightPct: 1.5, dividendYield: 4.4, dividendGrowth5Y: 7.2, payoutRatio: 66, consecutiveYearsHike: 12, frequency: "SEMESTRALE" },
  { ticker: "ISP.MI", name: "Intesa Sanpaolo", sector: "Bancario Retail EU", weightPct: 1.5, dividendYield: 8.5, dividendGrowth5Y: 12.0, payoutRatio: 70, consecutiveYearsHike: 8, frequency: "SEMESTRALE" },
  { ticker: "BNP.PA", name: "BNP Paribas", sector: "Bancario EU", weightPct: 1.4, dividendYield: 7.2, dividendGrowth5Y: 10.5, payoutRatio: 50, consecutiveYearsHike: 9, frequency: "ANNUALE" },
  { ticker: "BATS.L", name: "British American Tobacco", sector: "Tabacco & Nicotina", weightPct: 1.4, dividendYield: 8.6, dividendGrowth5Y: 3.5, payoutRatio: 64, consecutiveYearsHike: 26, frequency: "TRIMESTRALE" },
  { ticker: "RIO.L", name: "Rio Tinto Group", sector: "Minerario & Metalli", weightPct: 1.4, dividendYield: 6.8, dividendGrowth5Y: 4.0, payoutRatio: 60, consecutiveYearsHike: 7, frequency: "SEMESTRALE" },
  { ticker: "TD", name: "Toronto-Dominion Bank", sector: "Bancario Canada", weightPct: 1.2, dividendYield: 5.2, dividendGrowth5Y: 7.5, payoutRatio: 58, consecutiveYearsHike: 14, frequency: "TRIMESTRALE" },
  { ticker: "ENB", name: "Enbridge Inc.", sector: "Oleodotti & Midstream", weightPct: 1.2, dividendYield: 6.5, dividendGrowth5Y: 5.0, payoutRatio: 72, consecutiveYearsHike: 29, frequency: "TRIMESTRALE" },
  { ticker: "MAIN", name: "Main Street Capital", sector: "BDC Credito Privato", weightPct: 1.2, dividendYield: 6.8, dividendGrowth5Y: 5.2, payoutRatio: 75, consecutiveYearsHike: 16, frequency: "MENSILE" },
  { ticker: "ARCC", name: "Ares Capital Corporation", sector: "BDC Finanza PMI", weightPct: 1.0, dividendYield: 9.1, dividendGrowth5Y: 4.0, payoutRatio: 82, consecutiveYearsHike: 14, frequency: "TRIMESTRALE" },
  { ticker: "TXN", name: "Texas Instruments", sector: "Semiconduttori", weightPct: 1.0, dividendYield: 2.6, dividendGrowth5Y: 9.5, payoutRatio: 68, consecutiveYearsHike: 21, frequency: "TRIMESTRALE" },
  { ticker: "CSCO", name: "Cisco Systems", sector: "Networking & Security", weightPct: 1.0, dividendYield: 2.8, dividendGrowth5Y: 3.8, payoutRatio: 52, consecutiveYearsHike: 13, frequency: "TRIMESTRALE" },
  { ticker: "IBM", name: "International Business Machines", sector: "Cloud Ibrido & AI", weightPct: 1.0, dividendYield: 3.1, dividendGrowth5Y: 2.2, payoutRatio: 66, consecutiveYearsHike: 29, frequency: "TRIMESTRALE" },
  { ticker: "MDT", name: "Medtronic plc", sector: "Dispositivi Medici", weightPct: 1.0, dividendYield: 3.2, dividendGrowth5Y: 6.0, payoutRatio: 55, consecutiveYearsHike: 47, frequency: "TRIMESTRALE" },
  { ticker: "MMM", name: "3M Company", sector: "Industriale Diversificato", weightPct: 0.8, dividendYield: 2.2, dividendGrowth5Y: 2.0, payoutRatio: 45, consecutiveYearsHike: 66, frequency: "TRIMESTRALE" },
  { ticker: "CL", name: "Colgate-Palmolive", sector: "Igiene Personale", weightPct: 0.8, dividendYield: 2.1, dividendGrowth5Y: 3.5, payoutRatio: 58, consecutiveYearsHike: 62, frequency: "TRIMESTRALE" },
  { ticker: "TGT", name: "Target Corporation", sector: "Retail USA", weightPct: 0.8, dividendYield: 3.0, dividendGrowth5Y: 10.2, payoutRatio: 50, consecutiveYearsHike: 53, frequency: "TRIMESTRALE" },
  { ticker: "EMR", name: "Emerson Electric", sector: "Automazione Industriale", weightPct: 0.8, dividendYield: 1.9, dividendGrowth5Y: 2.5, payoutRatio: 48, consecutiveYearsHike: 67, frequency: "TRIMESTRALE" },
  { ticker: "SWK", name: "Stanley Black & Decker", sector: "Utensili Industriali", weightPct: 0.6, dividendYield: 3.5, dividendGrowth5Y: 4.0, payoutRatio: 65, consecutiveYearsHike: 57, frequency: "TRIMESTRALE" },
  { ticker: "KMB", name: "Kimberly-Clark", sector: "Carta & Cura Personale", weightPct: 0.6, dividendYield: 3.6, dividendGrowth5Y: 3.8, payoutRatio: 68, consecutiveYearsHike: 52, frequency: "TRIMESTRALE" },
  { ticker: "GD", name: "General Dynamics", sector: "Difesa & Marina USA", weightPct: 0.6, dividendYield: 1.9, dividendGrowth5Y: 6.8, payoutRatio: 44, consecutiveYearsHike: 33, frequency: "TRIMESTRALE" },
  { ticker: "ADM", name: "Archer-Daniels-Midland", sector: "Agroalimentare & Grain", weightPct: 0.6, dividendYield: 3.6, dividendGrowth5Y: 8.5, payoutRatio: 42, consecutiveYearsHike: 51, frequency: "TRIMESTRALE" },
  { ticker: "FRT", name: "Federal Realty Investment Trust", sector: "REIT Centri Commerciali", weightPct: 0.6, dividendYield: 3.9, dividendGrowth5Y: 2.0, payoutRatio: 72, consecutiveYearsHike: 57, frequency: "TRIMESTRALE" },
  { ticker: "ESS", name: "Essex Property Trust", sector: "REIT Residenziale", weightPct: 0.6, dividendYield: 3.3, dividendGrowth5Y: 5.5, payoutRatio: 68, consecutiveYearsHike: 30, frequency: "TRIMESTRALE" },
  { ticker: "CNI", name: "Canadian National Railway", sector: "Ferrovie Nord America", weightPct: 0.6, dividendYield: 2.1, dividendGrowth5Y: 10.5, payoutRatio: 42, consecutiveYearsHike: 28, frequency: "TRIMESTRALE" },
  { ticker: "NOVN.SW", name: "Novartis AG", sector: "Farmaceutico Svizzero", weightPct: 0.6, dividendYield: 3.4, dividendGrowth5Y: 4.2, payoutRatio: 56, consecutiveYearsHike: 27, frequency: "ANNUALE" },
  { ticker: "ZURN.SW", name: "Zurich Insurance Group", sector: "Assicurativo Globale", weightPct: 0.5, dividendYield: 5.1, dividendGrowth5Y: 7.0, payoutRatio: 65, consecutiveYearsHike: 18, frequency: "ANNUALE" },
  { ticker: "NG.L", name: "National Grid plc", sector: "Reti Elettriche & Gas UK", weightPct: 0.5, dividendYield: 5.5, dividendGrowth5Y: 4.5, payoutRatio: 70, consecutiveYearsHike: 25, frequency: "SEMESTRALE" },
  { ticker: "DG.PA", name: "Vinci SA", sector: "Concessioni & Autostrade EU", weightPct: 0.5, dividendYield: 4.1, dividendGrowth5Y: 8.0, payoutRatio: 52, consecutiveYearsHike: 14, frequency: "SEMESTRALE" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. TOP 50 CRIPTOVALUTE & LIQUID STAKING POS (ALPHA ASIMMETRICO)
// ─────────────────────────────────────────────────────────────────────────────
export const TOP_50_CRYPTO_BASKET: CryptoBenchmarkItem[] = [
  // Core Store of Value
  { ticker: "BTC", name: "Bitcoin", category: "STORE_OF_VALUE", weightPct: 40.0, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -7.5, mvrvRatio: 2.1 },

  // Top PoS Staking Leader
  { ticker: "ETH", name: "Ethereum (stETH / Native)", category: "POS_L1", weightPct: 22.0, stakingApyPct: 3.4, isStakingSupported: true, drawdownAthPct: -28.0, mvrvRatio: 1.6 },
  { ticker: "SOL", name: "Solana (JitoSOL / Marinade)", category: "POS_L1", weightPct: 12.0, stakingApyPct: 6.8, isStakingSupported: true, drawdownAthPct: -22.0, mvrvRatio: 2.4 },
  { ticker: "ADA", name: "Cardano", category: "POS_L1", weightPct: 2.0, stakingApyPct: 3.2, isStakingSupported: true, drawdownAthPct: -65.0, mvrvRatio: 1.1 },
  { ticker: "DOT", name: "Polkadot", category: "POS_L1", weightPct: 1.8, stakingApyPct: 11.5, isStakingSupported: true, drawdownAthPct: -82.0, mvrvRatio: 0.8 },
  { ticker: "AVAX", name: "Avalanche", category: "POS_L1", weightPct: 1.8, stakingApyPct: 5.4, isStakingSupported: true, drawdownAthPct: -68.0, mvrvRatio: 1.2 },
  { ticker: "NEAR", name: "NEAR Protocol", category: "POS_L1", weightPct: 1.5, stakingApyPct: 7.2, isStakingSupported: true, drawdownAthPct: -55.0, mvrvRatio: 1.3 },
  { ticker: "SUI", name: "Sui Network", category: "POS_L1", weightPct: 1.5, stakingApyPct: 4.1, isStakingSupported: true, drawdownAthPct: -18.0, mvrvRatio: 2.2 },
  { ticker: "APT", name: "Aptos", category: "POS_L1", weightPct: 1.2, stakingApyPct: 7.0, isStakingSupported: true, drawdownAthPct: -48.0, mvrvRatio: 1.4 },
  { ticker: "ATOM", name: "Cosmos Hub", category: "POS_L1", weightPct: 1.0, stakingApyPct: 13.8, isStakingSupported: true, drawdownAthPct: -78.0, mvrvRatio: 0.9 },
  { ticker: "INJ", name: "Injective Protocol", category: "POS_L1", weightPct: 1.0, stakingApyPct: 14.2, isStakingSupported: true, drawdownAthPct: -45.0, mvrvRatio: 1.5 },
  { ticker: "POL", name: "Polygon (ex-MATIC)", category: "POS_L1", weightPct: 0.8, stakingApyPct: 4.5, isStakingSupported: true, drawdownAthPct: -72.0, mvrvRatio: 0.9 },
  { ticker: "TIA", name: "Celestia", category: "INFRASTRUCTURE", weightPct: 0.8, stakingApyPct: 10.2, isStakingSupported: true, drawdownAthPct: -68.0, mvrvRatio: 1.1 },
  { ticker: "SEI", name: "Sei Network", category: "POS_L1", weightPct: 0.6, stakingApyPct: 4.8, isStakingSupported: true, drawdownAthPct: -52.0, mvrvRatio: 1.3 },
  { ticker: "S", name: "Sonic (ex-Fantom)", category: "POS_L1", weightPct: 0.6, stakingApyPct: 5.5, isStakingSupported: true, drawdownAthPct: -62.0, mvrvRatio: 1.0 },
  { ticker: "XTZ", name: "Tezos", category: "POS_L1", weightPct: 0.5, stakingApyPct: 5.8, isStakingSupported: true, drawdownAthPct: -85.0, mvrvRatio: 0.8 },
  { ticker: "MINA", name: "Mina Protocol", category: "POS_L1", weightPct: 0.5, stakingApyPct: 12.0, isStakingSupported: true, drawdownAthPct: -78.0, mvrvRatio: 0.8 },
  { ticker: "KAVA", name: "Kava Network", category: "POS_L1", weightPct: 0.4, stakingApyPct: 7.5, isStakingSupported: true, drawdownAthPct: -82.0, mvrvRatio: 0.8 },
  { ticker: "OSMO", name: "Osmosis", category: "DEFI", weightPct: 0.4, stakingApyPct: 8.5, isStakingSupported: true, drawdownAthPct: -88.0, mvrvRatio: 0.7 },

  // Infrastrutture, Oracoli, DeFi & AI Decentrata
  { ticker: "LINK", name: "Chainlink", category: "INFRASTRUCTURE", weightPct: 2.0, stakingApyPct: 4.2, isStakingSupported: true, drawdownAthPct: -65.0, mvrvRatio: 1.3 },
  { ticker: "TAO", name: "Bittensor", category: "AI_DATA", weightPct: 1.2, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -25.0, mvrvRatio: 2.1 },
  { ticker: "RENDER", name: "Render Network", category: "AI_DATA", weightPct: 0.8, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -42.0, mvrvRatio: 1.6 },
  { ticker: "UNI", name: "Uniswap", category: "DEFI", weightPct: 0.8, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -75.0, mvrvRatio: 1.1 },
  { ticker: "AAVE", name: "Aave", category: "DEFI", weightPct: 0.7, stakingApyPct: 6.5, isStakingSupported: true, drawdownAthPct: -55.0, mvrvRatio: 1.4 },
  { ticker: "MKR", name: "Maker / Sky", category: "DEFI", weightPct: 0.6, stakingApyPct: 5.0, isStakingSupported: true, drawdownAthPct: -48.0, mvrvRatio: 1.3 },
  { ticker: "FET", name: "Artificial Superintelligence Alliance", category: "AI_DATA", weightPct: 0.5, stakingApyPct: 6.0, isStakingSupported: true, drawdownAthPct: -58.0, mvrvRatio: 1.4 },
  { ticker: "AKT", name: "Akash Network", category: "AI_DATA", weightPct: 0.4, stakingApyPct: 11.0, isStakingSupported: true, drawdownAthPct: -45.0, mvrvRatio: 1.5 },
  { ticker: "GRT", name: "The Graph", category: "INFRASTRUCTURE", weightPct: 0.4, stakingApyPct: 7.8, isStakingSupported: true, drawdownAthPct: -85.0, mvrvRatio: 0.9 },
  { ticker: "AR", name: "Arweave", category: "INFRASTRUCTURE", weightPct: 0.4, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -65.0, mvrvRatio: 1.2 },
  { ticker: "RUNE", name: "THORChain", category: "DEFI", weightPct: 0.4, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -68.0, mvrvRatio: 1.1 },
  { ticker: "STX", name: "Stacks", category: "INFRASTRUCTURE", weightPct: 0.4, stakingApyPct: 8.0, isStakingSupported: true, drawdownAthPct: -42.0, mvrvRatio: 1.6 },
  { ticker: "IMX", name: "Immutable X", category: "INFRASTRUCTURE", weightPct: 0.3, stakingApyPct: 3.5, isStakingSupported: true, drawdownAthPct: -68.0, mvrvRatio: 1.2 },
  { ticker: "OP", name: "Optimism", category: "INFRASTRUCTURE", weightPct: 0.3, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -65.0, mvrvRatio: 1.0 },
  { ticker: "ARB", name: "Arbitrum", category: "INFRASTRUCTURE", weightPct: 0.3, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -72.0, mvrvRatio: 0.9 },
  { ticker: "PENDLE", name: "Pendle Finance", category: "DEFI", weightPct: 0.3, stakingApyPct: 8.5, isStakingSupported: true, drawdownAthPct: -38.0, mvrvRatio: 1.8 },
  { ticker: "LDO", name: "Lido DAO", category: "DEFI", weightPct: 0.3, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -74.0, mvrvRatio: 0.9 },
  { ticker: "ENA", name: "Ethena Labs", category: "DEFI", weightPct: 0.2, stakingApyPct: 15.0, isStakingSupported: true, drawdownAthPct: -60.0, mvrvRatio: 1.3 },
  { ticker: "JUP", name: "Jupiter", category: "DEFI", weightPct: 0.2, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -45.0, mvrvRatio: 1.4 },
  { ticker: "PYTH", name: "Pyth Network", category: "INFRASTRUCTURE", weightPct: 0.2, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -58.0, mvrvRatio: 1.1 },
  { ticker: "ONDO", name: "Ondo Finance (RWA)", category: "DEFI", weightPct: 0.2, stakingApyPct: 5.0, isStakingSupported: true, drawdownAthPct: -35.0, mvrvRatio: 1.8 },
  { ticker: "FIL", name: "Filecoin", category: "INFRASTRUCTURE", weightPct: 0.2, stakingApyPct: 6.5, isStakingSupported: true, drawdownAthPct: -94.0, mvrvRatio: 0.7 },
  { ticker: "XMR", name: "Monero", category: "STORE_OF_VALUE", weightPct: 0.2, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -65.0, mvrvRatio: 1.0 },
  { ticker: "KAS", name: "Kaspa", category: "STORE_OF_VALUE", weightPct: 0.2, stakingApyPct: 0.0, isStakingSupported: false, drawdownAthPct: -35.0, mvrvRatio: 1.8 },
  { ticker: "TON", name: "Toncoin", category: "POS_L1", weightPct: 0.2, stakingApyPct: 4.0, isStakingSupported: true, drawdownAthPct: -40.0, mvrvRatio: 1.5 },
  { ticker: "HNT", name: "Helium", category: "INFRASTRUCTURE", weightPct: 0.1, stakingApyPct: 5.5, isStakingSupported: true, drawdownAthPct: -82.0, mvrvRatio: 0.8 },
  { ticker: "GNO", name: "Gnosis", category: "INFRASTRUCTURE", weightPct: 0.1, stakingApyPct: 12.0, isStakingSupported: true, drawdownAthPct: -55.0, mvrvRatio: 1.2 },
  { ticker: "DYDX", name: "dYdX Chain", category: "DEFI", weightPct: 0.1, stakingApyPct: 9.5, isStakingSupported: true, drawdownAthPct: -82.0, mvrvRatio: 0.8 },
  { ticker: "RAY", name: "Raydium", category: "DEFI", weightPct: 0.1, stakingApyPct: 7.0, isStakingSupported: true, drawdownAthPct: -70.0, mvrvRatio: 1.3 },
  { ticker: "ICP", name: "Internet Computer", category: "INFRASTRUCTURE", weightPct: 0.1, stakingApyPct: 8.5, isStakingSupported: true, drawdownAthPct: -92.0, mvrvRatio: 0.8 },
  { ticker: "HBAR", name: "Hedera Hashgraph", category: "INFRASTRUCTURE", weightPct: 0.1, stakingApyPct: 3.0, isStakingSupported: true, drawdownAthPct: -80.0, mvrvRatio: 0.9 },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. DATI REALI ORO (XAU/USD & PHYSICAL GOLD HEDGING)
// ─────────────────────────────────────────────────────────────────────────────
export interface GoldMarketBenchmark {
  symbol: "XAUUSD";
  spotPriceUsd: number;
  spotPriceEur: number;
  sma200Usd: number;
  sma50Usd: number;
  distanceFromSma200Pct: number;
  athUsd: number;
  distanceFromAthPct: number;
  realInterestRate10YPct: number; // US 10Y TIPS real rate (%)
  historicalPreservationCagrPct: number; // Tasso secolare reale di conservazione (%)
  lastUpdated: string;
}

export const CURRENT_GOLD_BENCHMARK: GoldMarketBenchmark = {
  symbol: "XAUUSD",
  spotPriceUsd: 2728.5,
  spotPriceEur: 2515.0,
  sma200Usd: 2420.0,
  sma50Usd: 2650.0,
  distanceFromSma200Pct: 12.75, // +12.75% sopra SMA200 (trend secolare sano)
  athUsd: 2790.0,
  distanceFromAthPct: -2.2,
  realInterestRate10YPct: 1.82,
  historicalPreservationCagrPct: 9.2, // 9.2% annuo atteso nel superciclo di de-dollarizzazione e debasement
  lastUpdated: new Date().toISOString(),
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. TRADING (AUREUS PROTOCOL) — PARAMETRI QUANTITATIVI HALF-KELLY
// ─────────────────────────────────────────────────────────────────────────────
export interface TradingKellyModel {
  winRatePct: number; // Win rate storico verificato (%)
  riskRewardRatio: number; // Rapporto R:R medio realizzato
  fullKellyFractionPct: number; // Quota ottimale teorica di Kelly
  halfKellyFractionPct: number; // Quota conservativa AUREUS (Half-Kelly)
  maxRiskPerTradePctOfAccount: number; // Rischio massimo per operazione (% del conto trading)
  expectedMonthlyCagrPct: number; // Tasso mensile atteso sul conto trading (%)
}

export const LIMEN_TRADING_KELLY_MODEL: TradingKellyModel = {
  winRatePct: 54.0, // 54% win rate procedurale
  riskRewardRatio: 1.85, // 1.85 R payoff medio
  fullKellyFractionPct: 1.62,
  halfKellyFractionPct: 0.81, // ~0.8% del conto trading per singolo trade
  maxRiskPerTradePctOfAccount: 0.8,
  expectedMonthlyCagrPct: 3.0,
};

export const AUREUS_TRADING_KELLY_MODEL = LIMEN_TRADING_KELLY_MODEL;
