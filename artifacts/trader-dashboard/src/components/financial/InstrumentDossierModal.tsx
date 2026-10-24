import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Sparkles,
  Binary,
  Scale,
  Compass,
  CheckCircle2,
  Clock,
  Search,
  Table,
  Coins,
  TrendingUp,
  BarChart2,
  Layers,
  Zap,
} from "lucide-react";
import {
  TOP_50_EQUITIES_AND_ETFS,
  TOP_50_DIVIDENDS_BASKET,
  TOP_50_CRYPTO_BASKET,
  CURRENT_GOLD_BENCHMARK,
  LIMEN_TRADING_KELLY_MODEL,
  calculateEquityBasketTiming,
  calculateDividendBasketTiming,
  calculateCryptoBasketTiming,
  calculateGoldMarketTiming,
  calculateTradingKellyPositioning,
  calculateCrossAssetAllocationMatrix,
  type FactorComponent,
} from "../../../../../contracts/financialArchitecture";

export interface TimingMatrix {
  whenToPrioritize: string;
  triggerIndicators: string[];
  comparisonWithOthers: string;
}

export interface InstrumentDossier {
  id: string;
  code: string;
  title: string;
  category: string;
  scope: string;
  formula: string;
  formulaDescription: string;
  limenRule: string;
  guardrails: string[];
  impactDescription: string;
  timingMatrix?: TimingMatrix;
  tone: "gold" | "emerald" | "crimson" | "slate";
}

export const INSTRUMENT_DOSSIERS: Record<string, InstrumentDossier> = {
  totalNetWorth: {
    id: "totalNetWorth",
    code: "PATR-01 // BASE SOVRANA",
    title: "Patrimonio Totale Complessivo",
    category: "Fondamenta di Rischio",
    scope:
      "Rappresenta l'intera base patrimoniale reale dell'operatore: liquidità bancaria, investimenti, asset tangibili e riserve accumulate.",
    formula: "NetWorth = Liquidità + Riserva + Trading + Azioni/ETF + Dividendi + Crypto + Copertura",
    formulaDescription:
      "La somma esatta di tutti i pilastri deve corrispondere al 100% del patrimonio dichiarato, senza ammanchi o duplicazioni.",
    limenRule:
      "Nessun trade può essere aperto prima di aver dichiarato e quantificato con trasparenza chirurgica la propria consistenza patrimoniale.",
    guardrails: [
      "Aggiornare ogni trimestre la base reale per ricalibrare le size",
      "Escludere beni non liquidabili d'emergenza o debiti non coperti",
      "Il capitale a mercato non deve mai eccedere il 20% della base complessiva",
    ],
    impactDescription:
      "Costituisce l'ancora psicologica: maggiore è la consapevolezza del Net Worth, minore è l'impatto emotivo di una singola perdita operativa.",
    tone: "gold",
  },
  liquidityAllocation: {
    id: "liquidityAllocation",
    code: "LIQ-VITALE // SCUDO SPESE CORRENTI",
    title: "Liquidità Vitale Coperta",
    category: "Sopravvivenza & Difesa",
    scope:
      "Cuscinetto intoccabile destinato a sostenere le spese di vita reali (casa, cibo, carichi familiari, utenze) per un orizzonte da 3 a 12 mesi.",
    formula: "Liquidità Vitale = Spese Mensili Medie × Mesi di Copertura (3 - 12)",
    formulaDescription:
      "Il capitale vitale viene sottratto a monte dal patrimonio prima di calcolare qualsiasi quota investibile o speculativa.",
    limenRule:
      "Divieto assoluto di impiegare la liquidità vitale per trading o investimenti volatili. Questo capitale vive segregato in conto corrente o deposito a vista.",
    guardrails: [
      "Minimo 3 mesi di spese per chi ha entrate stabili e zero dipendenti",
      "Consigliati 6 mesi per la maggioranza degli operatori LIMEN",
      "12 mesi obbligatori in presenza di figli o persone a carico",
    ],
    impactDescription:
      "Elimina radicalmente il bisogno di 'fare soldi oggi col trading per pagare le bollette', estirpando l'ansia da prestazione alla radice.",
    tone: "slate",
  },
  reserveAllocation: {
    id: "reserveAllocation",
    code: "RIS-1X1 // REGOLA AUREA DEL FONDO DI RISERVA",
    title: "Fondo di Riserva & Vincolo 1:1",
    category: "Integrità Psicologica",
    scope:
      "Pilastro primario di recupero istituzionale: un capitale protetto dedicato ad assorbire eventuali serie negative del trading attivo.",
    formula: "Fondo di Riserva >= Capitale Conto Trading (Rapporto Riserva/Trading >= 1.0)",
    formulaDescription:
      "La riserva deve essere quantomeno pari (1:1) al capitale allocato nel conto di trading attivo.",
    limenRule:
      "Se il conto trading supera il fondo di riserva, il sistema scatta in allerta critica (CRITICAL_ERROR) e vieta l'aumento delle size.",
    guardrails: [
      "Allineamento 1:1 immediato prima di avviare sessioni live",
      "In caso di drawdown severo, la riserva alimenta il piano di recupero graduale",
      "Nessun trasferimento verso il trading senza ricalcolo del vincolo",
    ],
    impactDescription:
      "Assicura che anche nell'ipotesi remota di bruciare il conto trading, l'operatore possiede un secondo conto identico pronto senza alterare il proprio tenore di vita.",
    tone: "gold",
  },
  tradingAllocation: {
    id: "tradingAllocation",
    code: "TRA-ACT // MOTORE TRADING TRANS-LIMEN",
    title: "Conto Trading Attivo",
    category: "Generazione Surplus",
    scope:
      "La quota di capitale allocata all'esecuzione del Metodo LIMEN a mercato per estrarre rendimento asimmetrico e surplus operativo.",
    formula: "Rischio Operativo per Trade = Conto Trading × 0.5% - 1.0% (Max Stop Loss)",
    formulaDescription:
      "Tutte le metriche di size, loss limit giornaliero e drawdown dell'intera piattaforma derivano direttamente da questa allocazione.",
    limenRule:
      "Operare solo ed esclusivamente con il capitale validato. Vietato iniettare fondi ad hoc dopo giornate di stop loss (anti-revenge trading).",
    guardrails: [
      "Peso ideale sul patrimonio totale: tra il 10% e il 20%",
      "Non deve mai superare il Fondo di Riserva",
      "I profitti estratti devono essere periodicamente travasati nei pilastri a lungo termine",
    ],
    impactDescription:
      "Funge da convertitore ad alta frequenza: trasforma la disciplina tecnica in liquidità da canalizzare nei motori di compounding patrimoniale.",
    tone: "emerald",
  },
  equityAllocation: {
    id: "equityAllocation",
    code: "EQ-CORE // CORE COMPOUNDING AZIONI ED ETF",
    title: "Motore Azioni & ETF (Crescita Composta)",
    category: "Investimenti a Lungo Termine",
    scope:
      "Il motore principale di espansione patrimoniale: accumulo disciplinato su indici azionari mondiali a replica passiva (es. MSCI World, S&P 500) e società ad alta solidità.",
    formula: "A(t) = Capitale Iniziale × (1 + r)^t [r atteso: ~8.0% a.a.]",
    formulaDescription:
      "Sfrutta l'interesse composto reinvestendo automaticamente plusvalenze e crescita aziendale su archi temporali pluriennali.",
    limenRule:
      "Divieto categorico di liquidare quote azionarie durante i mercati orso. Il ribasso rappresenta una finestra di acquisto a sconto.",
    guardrails: [
      "Orizzonte temporale minimo consigliato: 5 - 10 anni",
      "Diversificazione su centinaia di aziende leader globali a basso costo di gestione",
      "Allocazione raccomandata: 40% - 60% del capitale investibile a lungo termine",
    ],
    timingMatrix: {
      whenToPrioritize:
        "Mantenere sempre attivo l'accumulo base (PAC continuo). Sovrappesare l'allocazione azionaria durante correzioni severe di mercato (cali >10-15% dai massimi storici) quando i multipli valutativi tornano a sconto.",
      triggerIndicators: [
        "Indici azionari globali in drawdown >10% rispetto ai massimi a 52 settimane",
        "Shiller CAPE Ratio o P/E forward dell'indice inferiore alla media storica decennale",
        "Orizzonte temporale residuo dell'operatore superiore a 7-10 anni",
      ],
      comparisonWithOthers:
        "Rispetto ai Dividendi: massimizza l'espansione del capitale poiché le aziende reinvestono gli utili senza attrito fiscale. Rispetto all'Oro: l'azione è un asset produttivo legato all'innovazione e alla crescita economica umana.",
    },
    impactDescription:
      "Garantisce che la ricchezza dell'operatore cresca di pari passo con l'economia reale globale, svincolata dal tempo speso davanti ai grafici.",
    tone: "emerald",
  },
  dividendsAllocation: {
    id: "dividendsAllocation",
    code: "DIV-FLOW // MACCHINA DEI DIVIDENDI & CASH FLOW",
    title: "Flusso Dividendi & Rendita Passiva",
    category: "Investimenti a Lungo Termine",
    scope:
      "Generazione sistematica di cash flow periodico (trimestrale/annuale) tramite società aristocratiche del dividendo, fondi ad alto rendimento e REITs.",
    formula: "Cash Flow Mensile = (Capitale Dividendi × Yield Netto Medio) ÷ 12",
    formulaDescription:
      "Calcola il flusso monetario reale generato indipendentemente dalle oscillazioni di prezzo di borsa (Yield on Cost tipico: 3.5% - 5.5%).",
    limenRule:
      "Nella fase di accumulo i dividendi vengono reinvestiti al 100% per accelerare l'effetto volano; nella fase di rendita possono integrare le spese correnti.",
    guardrails: [
      "Privilegiare la sostenibilità del payout ratio rispetto allo yield nominale eccessivo",
      "Monitorare il cash flow netto mensile calcolato per traguardare l'indipendenza finanziaria",
      "Allocazione raccomandata: 20% - 35% del capitale investibile a lungo termine",
    ],
    timingMatrix: {
      whenToPrioritize:
        "Privilegiare i Dividendi rispetto a Crypto e Azioni Growth durante fasi di tassi reali elevati, mercati azionari laterali/distributivi o quando l'obiettivo prioritario dell'operatore è avvicinare rapidamente il Crossover Point (copertura spese di vita).",
      triggerIndicators: [
        "Yield da dividendo netto superiore al rendimento dei titoli governativi decennali (+1.5% spread)",
        "Mercati azionari compressi o in fase orizzontale privi di trend direzionale marcato",
        "Rapporto Spese/Rendita: necessità di coprire una quota crescente delle uscite mensili reali",
      ],
      comparisonWithOthers:
        "Rispetto alle Criptovalute: offre certezza di flusso monetario con volatilità drasticamente inferiore. Rispetto all'Oro: genera cash flow periodico reinvestibile ogni trimestre, mentre l'oro non stacca alcuna cedola.",
    },
    impactDescription:
      "Produce un flusso di cassa costante che riduce psicologicamente la necessità di prelievi forzati dal conto di trading attivo.",
    tone: "gold",
  },
  cryptoAllocation: {
    id: "cryptoAllocation",
    code: "CRY-ASYM // RISERVA CRITTOGRAFICA & ALPHA ASIMMETRICO",
    title: "Riserva Crittografica Sovrana & Staking",
    category: "Asset Asimmetrici",
    scope:
      "Allocazione strategica in Bitcoin (riserva dura) ed Ethereum/Solana con opzione di Staking decentralizzato PoS per generare rendita passiva periodica non correlata ai mercati tradizionali.",
    formula: "Rendita Staking Mensile = (Capitale Crypto in Staking × Yield APY ~4.5%) ÷ 12",
    formulaDescription:
      "Combina la rivalutazione asimmetrica a lungo termine del sottostante con un flusso cedolare continuo generato dalla convalida dei blocchi sul protocollo.",
    limenRule:
      "Mantenere la custodia privata su hardware wallet. Limitare lo staking a protocolli nativi o liquid staking di grado sovrano senza delegare le chiavi a exchange centralizzati.",
    guardrails: [
      "Tetto massimo consigliato LIMEN: non oltre il 10% - 15% del Net Worth complessivo",
      "Staking consigliato su massimo il 50% della quota crypto (il restante 50% in Bitcoin cold storage)",
      "Reinvestimento del flusso di staking per accelerare il compounding o diversificazione verso Oro",
    ],
    timingMatrix: {
      whenToPrioritize:
        "Privilegiare l'accumulo Crypto rispetto a Dividendi e Oro durante le finestre di compressione di volatilità post-halving o durante bear market profondi con panico generalizzato sui media.",
      triggerIndicators: [
        "Crypto Fear & Greed Index in 'Extreme Fear' (<25)",
        "MVRV Z-Score in zona verde/sconto storico (<0.5)",
        "Quota crypto nel portafoglio scesa sotto il guardrail del 5% del Net Worth a seguito di correzione",
      ],
      comparisonWithOthers:
        "Rispetto ai Dividendi: potenziale di rivalutazione asimmetrico 5-10x superiore nei cicli quadriennali, ma con drawdown del 50-70%. Regola LIMEN: quando la quota eccede il 15%, scatta la rotazione obbligatoria verso Oro e Dividendi.",
    },
    impactDescription:
      "Trasforma un asset volatile in un generatore ibrido di crescita esponenziale e flusso di cassa costante a supporto della sovranità finanziaria.",
    tone: "gold",
  },
  hedgingAllocation: {
    id: "hedgingAllocation",
    code: "HED-SHIELD // COPERTURA CAPITALE & ORO RIFUGIO",
    title: "Copertura del Capitale & Metalli Rifugio",
    category: "Preservazione & Copertura",
    scope:
      "Strumenti di copertura del capitale (Oro fisico allocato / ETC garantiti, titoli governativi ultra-brevi, liquidità monetaria protetta) per azzerare la correlazione.",
    formula: "Ammortizzatore di Crisi: Rally stimato +10% / +20% in scenari di panic selling azionario",
    formulaDescription:
      "L'oro e i beni rifugio mostrano correlazione negativa o nulla con i mercati azionari durante le recessioni sistemiche e l'inflazione sostenuta.",
    limenRule:
      "La copertura non ha l'obiettivo di generare grandi plusvalenze speculative, ma di assicurare l'acquisto di beni reali e la protezione del potere d'acquisto.",
    guardrails: [
      "Allocazione consigliata: 10% - 20% del capitale investibile",
      "Oro fisico o ETC a replica fisica senza rischio di controparte bancaria",
      "Mantenere intatto come ancora di stabilità durante le crisi di liquidità",
    ],
    timingMatrix: {
      whenToPrioritize:
        "Privilegiare l'incremento della Copertura (Oro) quando i mercati azionari e crypto toccano massimi euforici prolungati, quando i tassi reali diventano negativi o durante l'escalation di rischi geopolitici e monetari.",
      triggerIndicators: [
        "Rapporto Azioni/Oro su percentili storicamente elevati (valutazioni azionarie tirate)",
        "Accelerazione dell'inflazione core o espansione marcata della massa monetaria globale (M2)",
        "Quota totale di asset rischiosi (Azioni + Crypto + Trading) superiore al 75% del Net Worth",
      ],
      comparisonWithOthers:
        "Rispetto alle Crypto: l'oro non ha rischio tecnologico, di smart contract o di regolamentazione, fungendo da ancora millenaria. Rispetto ai Dividendi: azzera il rischio fallimento societario nei momenti di shock bancario sistemico.",
    },
    impactDescription:
      "Funge da 'airbag' del portafoglio: quando i mercati azionari o crypto correggono, l'oro si rivaluta e riduce la volatilità complessiva del Net Worth.",
    tone: "slate",
  },
  timeHorizon: {
    id: "timeHorizon",
    code: "AXIS-TIME // SIMULATORE MULTI-ASSE TEMPORALE",
    title: "Simulatore Multi-Asse Temporale",
    category: "Proiezione Quantitativa",
    scope:
      "Strumento di calcolo dinamico che proietta la traiettoria patrimoniale a 1 Anno, 3 Anni, 5 Anni, 10 Anni e 20 Anni incrociando i tassi composti di tutte le asset class.",
    formula: "NW(t) = Liquidità + Riserva + EQ(t) + DIV(t) + CRY(t) + HED(t) + TRA(t)",
    formulaDescription:
      "Modella l'evoluzione dell'interesse composto ponderato anno per anno, calcolando montante futuro e flusso dividendi netto alla scadenza selezionata.",
    limenRule:
      "L'operatore sovrano pianifica su orizzonti pluriennali e non misura il proprio valore sulla volatilità di una singola settimana.",
    guardrails: [
      "1 - 3 Anni: Messa in sicurezza e costruzione della riserva",
      "5 Anni: Accelerazione del compounding azionario ed espansione cashflow",
      "10 - 20 Anni: Sovranità e libertà patrimoniale completa",
    ],
    impactDescription:
      "Visualizza concretamente l'impatto cumulativo della costanza operativa, trasformando decisioni astratte in numeri chiari e verificabili.",
    tone: "gold",
  },
  portfolioStressTest: {
    id: "portfolioStressTest",
    code: "STRESS-QUANT // STRESS TEST DI CROLLO GLOBALE",
    title: "Stress Test di Resilienza Sistemica",
    category: "Analisi Quantitativa di Rischio",
    scope:
      "Simulazione algoritmica di uno shock economico violento e simultaneo su tutti i mercati: Azionario (-30%), Cripto (-50%), Trading (-10%), Oro (+15%).",
    formula: "ΔNetWorth = (-0.30 × Azioni) + (-0.50 × Crypto) + (-0.10 × Trading) + (+0.15 × Oro)",
    formulaDescription:
      "Misura l'esatto calo in euro e percentuale sul patrimonio complessivo, dimostrando la protezione garantita da liquidità vitale, riserva e oro intatti.",
    limenRule:
      "Un portafoglio è conforme all'Ordine LIMEN solo se in grado di sopportare un crollo sistemico senza superare un drawdown complessivo del 10% - 15% sul Net Worth.",
    guardrails: [
      "Indice di Scudo (Survival Shield Score) calcolato in tempo reale da 0 a 100",
      "Le spese vitali e il fondo di riserva rimangono intatti e sigillati (0% impatto)",
      "Nessuna vendita forzata o tilt psicologico durante il panico di mercato",
    ],
    impactDescription:
      "Fornisce la prova matematica dell'inespugnabilità della struttura patrimoniale, donando all'operatore una calma stoica e incrollabile a mercato.",
    tone: "crimson",
  },
  monthlyPAC: {
    id: "monthlyPAC",
    code: "PAC-DCA // PIANO DI ACCUMULO & RISPARMIO MENSILE",
    title: "Capacità di Risparmio & PAC Mensile",
    category: "Motore di Accumulazione",
    scope:
      "La quota di reddito mensile che l'operatore destina costantemente ad alimentare i motori a lungo termine (Azioni, Dividendi, Crypto, Oro) prima di qualsiasi spesa discrezionale.",
    formula: "Tasso di Risparmio (%) = (Risparmio Mensile / Entrate Totali) × 100",
    formulaDescription:
      "Il capitale versato ogni mese sfrutta la mediazione del prezzo di acquisto (Dollar Cost Averaging) e amplifica l'effetto volano dell'interesse composto.",
    limenRule:
      "Paga prima te stesso: il PAC mensile deve essere addebitato il giorno stesso dell'accredito delle entrate stabili, senza aspettare la fine del mese.",
    guardrails: [
      "Tasso di risparmio minimo consigliato: >= 20% delle entrate",
      "Ripartizione automatica proporzionale tra le 4 asset class a lungo termine",
      "Mantenere costante il versamento anche e soprattutto durante i ribassi di mercato",
    ],
    impactDescription:
      "Costituisce il vero motore di accelerazione patrimoniale: con un PAC costante, il capitale accumulato supera rapidamente la sola rivalutazione del capitale iniziale.",
    tone: "emerald",
  },
  targetNetWorth: {
    id: "targetNetWorth",
    code: "FIRE-NUM // TARGET DI INDIPENDENZA FINANZIARIA",
    title: "Obiettivo Sovranità Finanziaria (Freedom Number)",
    category: "Traguardo Strategico",
    scope:
      "La dimensione patrimoniale target che consente all'operatore di vivere integralmente delle rendite generate dal proprio capitale, rendendo il lavoro un'opzione e non una necessità.",
    formula: "Freedom Number = Spese Annuali × 25 (Regola del 4% / 25x Annual Expenses)",
    formulaDescription:
      "Rappresenta il capitale necessario affinché un prelievo prudente del 4% annuo o i dividendi generati coprano al 100% le spese di vita senza intaccare il patrimonio.",
    limenRule:
      "Raggiunto il Freedom Number, l'operatore accede al rango di Architetto Sovrano: il trading diventa una pura disciplina filosofica ed artistica senza vincoli di necessità.",
    guardrails: [
      "Benchmark standard: 25 volte il fabbisogno annuo (es. 2.000 €/m = 600.000 €)",
      "Monitorare il Crossover Point (quando i dividendi mensili superano le spese)",
      "Adeguare il target in caso di variazione strutturale delle spese familiari",
    ],
    impactDescription:
      "Fissa la stella polare di lungo termine: trasforma la pianificazione da un generico 'fare soldi' in una marcia matematica verso la libertà assoluta.",
    tone: "gold",
  },
  taxRegime: {
    id: "taxRegime",
    code: "ERAR-01 // REGIME FISCALE ITALIANO (RT/RW/RM)",
    title: "Regime Fiscale & Dichiarazione Redditi (Italia)",
    category: "Dottrina Erariale",
    scope:
      "Definisce il quadro normativo tributario per l'Operatore residente in Italia: distinzione tra Regime Amministrato (sostituto d'imposta bancario) e Regime Dichiarativo (broker esteri e prop firm con Quadri RT, RW, RM nel Modello Redditi Persone Fisiche).",
    formula: "Plusvalenza Netta = (Prezzo Vendita - Prezzo Acquisto - Spese) × 26% (con scomputo minusvalenze T+4)",
    formulaDescription:
      "Le imposte si calcolano al 26% sulle plusvalenze finanziarie nette. L'imposta di bollo patrimoniale (IVAFE) preleva lo 0.20% annuo sul valore dei prodotti finanziari esteri o dossier titoli.",
    limenRule:
      "Nessun profitto è reale finché non è stata accantonata la quota erariale. L'operatore disciplinato segrega il 26% dei profitti di trading per non farsi mai cogliere impreparato alle scadenze F24 di Giugno e Novembre.",
    guardrails: [
      "In regime dichiarativo, compilare sempre il Quadro RW per il monitoraggio fiscale (nessuna soglia minima di esenzione)",
      "Compensare le minusvalenze pregresse entro e non oltre il quarto anno d'imposta successivo (zainetto fiscale)",
      "Conservare tutti i report broker analitici e gli estratti conto per almeno 10 anni contro verifiche documentali",
    ],
    impactDescription:
      "Garantisce serenità e legalità assoluta: protegge l'operatore dal rischio di accertamenti fiscali, sanzioni (dal 90% al 180%) o blocchi bancari sui trasferimenti di liquidità.",
    tone: "gold",
  },
  taxPropFirm: {
    id: "taxPropFirm",
    code: "PROP-TAX // INQUADRAMENTO FISCALE PROP FIRM",
    title: "Disciplina Tributaria Payouts Prop Firm (Italia)",
    category: "Dottrina Erariale",
    scope:
      "Chiarisce l'inquadramento tributario dei proventi generati da contratti di simulazione / prop firm (es. FTMO, FundedNext, ecc.) per l'Agenzia delle Entrate italiana.",
    formula: "Regime Forfettario: Tassa Sostitutiva = Fatturato × Coeff. Redditività (67% o 78%) × 5% (o 15%)",
    formulaDescription:
      "I contratti prop vertono su conti demo/simulati: la remunerazione è considerata fornitura di servizi informatici/data feed o prestazione occasionale, NON plusvalenza finanziaria da compravendita di titoli propri.",
    limenRule:
      "DIVIETO ASSOLUTO DI COMPENSAZIONE: I compensi da prop firm non possono in alcun caso essere compensati con le minusvalenze accumulate su conti di trading personali CFD/Forex in Quadro RT.",
    guardrails: [
      "Per payout saltuari (< 5.000 €/anno): inquadrabili come Redditi Diversi da obbligazioni di fare/permettere (art. 67 TUIR)",
      "Per payout continuativi: obbligatoria apertura di Partita IVA (consigliato Regime Forfettario, codice ATECO 62.02.00 / 74.90.99)",
      "Emettere regolare fattura elettronica o autofattura verso la società estera e conservare i log di challenge",
    ],
    impactDescription:
      "Elimina l'illusione pericolosa di trattare i payout prop come plusvalenze esenti o compensabili, blindando la posizione fiscale del trader professionista.",
    tone: "crimson",
  },
  taxCompoundingDrag: {
    id: "taxCompoundingDrag",
    code: "DRAG-TAX // IMPATTO DELL'EFFETTO DRAG FISCALE",
    title: "Drag Fiscale & Efficienza di Compounding",
    category: "Matematica Patrimoniale",
    scope:
      "Misura la decurtazione subita dal montante composto a 1, 3, 5, 10 e 20 anni per effetto combinato dell'imposta sostitutiva sulle plusvalenze (26%), ritenute dividendi e dell'imposta di bollo patrimoniale (0.20% annuo).",
    formula: "Drag Fiscale (€) = Montante Lordo Nominale - Montante Netto Post-Tax",
    formulaDescription:
      "Ogni anno lo 0.20% di imposta di bollo sul dossier e il prelievo sui dividendi riducono la base del compounding esponenziale. Su 10-20 anni, il drag fiscale può erodere dal 20% al 35% del rendimento nominale totale.",
    limenRule:
      "Preferire categoricamente strumenti ad accumulo (ETF UCITS) rispetto alla distribuzione per differire l'imposta al riscatto ed evitare la dispersione precoce del compounding.",
    guardrails: [
      "Usare il toggle 'NETTO' nelle proiezioni per calibrare il Freedom Number sulla ricchezza reale e non nominale",
      "Diversificare la quota difensiva su Titoli di Stato White List (12.50%) per dimezzare l'impatto fiscale rispetto al 26%",
      "Ribilanciare il portafoglio riducendo al minimo le vendite premature che scatenano l'evento impositivo",
    ],
    impactDescription:
      "Protegge l'operatore dall'illusione dei calcoli lordi dei simulatori retail, consentendo di pianificare l'uscita dalla ruota del topo con assoluto rigore matematico.",
    tone: "gold",
  },
};

const FactorGrid: React.FC<{ factors?: FactorComponent[] }> = ({ factors }) => {
  if (!factors || factors.length === 0) return null;
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-[#C5A059] px-0.5">
        <span className="flex items-center gap-1.5">
          <Binary className="h-3.5 w-3.5 text-[#C5A059]" />
          <span>Scomposizione nei 4 Fattori Quantitativi</span>
        </span>
        <span className="text-muted-foreground text-[9px]">Pesi Ponderati: 100%</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
        {factors.map((factor) => {
          const statusTone =
            factor.status === "OTTIMALE"
              ? "border-emerald-500/40 text-emerald-300 bg-emerald-950/20"
              : factor.status === "FAVOREVOLE"
              ? "border-[#C5A059]/40 text-[#E8C56A] bg-[#C5A059]/10"
              : factor.status === "PRUDENZA"
              ? "border-red-500/40 text-red-300 bg-red-950/20"
              : "border-slate-600 text-slate-300 bg-slate-900/30";

          const barColor =
            factor.score >= 80 ? "bg-emerald-400" : factor.score >= 60 ? "bg-[#C5A059]" : "bg-red-400";

          return (
            <div
              key={factor.id}
              className="rounded-lg border border-border/70 bg-[#07080b] p-2 space-y-1 hover:border-[#C5A059]/40 transition-all"
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-[#E8C56A] flex items-center gap-1.5 truncate">
                  <span className="text-[8.5px] px-1 py-0.2 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A] font-mono shrink-0">
                    {factor.weightPct}%
                  </span>
                  <span className="truncate">{factor.name}</span>
                </span>
                <span
                  className={`text-[8.5px] uppercase font-bold px-1.5 py-0.2 rounded border whitespace-nowrap shrink-0 ${statusTone}`}
                >
                  {factor.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                <strong className="text-foreground font-bold">{factor.rawMetric}</strong>
                <span className="text-[8.5px]">{factor.benchmarkNeutral}</span>
              </div>

              <div className="w-full bg-[#11131c] rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.max(5, factor.score)}%` }}
                />
              </div>

              <p className="text-[9px] text-muted-foreground leading-tight pt-0.5 line-clamp-2">
                {factor.impactDescription}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface InstrumentDossierModalProps {
  toolId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InstrumentDossierModal: React.FC<InstrumentDossierModalProps> = ({
  toolId,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"dossier" | "benchmark" | "crossAsset">("dossier");
  const [searchQuery, setSearchQuery] = useState("");

  const dossier = toolId ? INSTRUMENT_DOSSIERS[toolId] : null;

  const toneBadge =
    dossier?.tone === "emerald"
      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
      : dossier?.tone === "crimson"
        ? "bg-red-500/15 border-red-500/40 text-red-400"
        : dossier?.tone === "slate"
          ? "bg-slate-700/30 border-slate-600/50 text-slate-300"
          : "bg-[#C5A059]/15 border-[#C5A059]/40 text-[#E8C56A]";

  const hasBenchmarkTab = [
    "equityAllocation",
    "dividendsAllocation",
    "cryptoAllocation",
    "hedgingAllocation",
    "tradingAllocation",
  ].includes(toolId || "");

  // Calcoli Benchmark Istituzionali
  const equityTiming = calculateEquityBasketTiming(TOP_50_EQUITIES_AND_ETFS);
  const dividendTiming = calculateDividendBasketTiming(TOP_50_DIVIDENDS_BASKET);
  const cryptoTiming = calculateCryptoBasketTiming(TOP_50_CRYPTO_BASKET);
  const goldTiming = calculateGoldMarketTiming(CURRENT_GOLD_BENCHMARK);
  const tradingPositioning = calculateTradingKellyPositioning(8000, 50000);

  // Matrice Cross-Asset di Rotazione e Confronti a Coppie
  const crossAssetMatrix = useMemo(() => {
    return calculateCrossAssetAllocationMatrix(
      equityTiming,
      dividendTiming,
      cryptoTiming,
      goldTiming,
      tradingPositioning
    );
  }, [equityTiming, dividendTiming, cryptoTiming, goldTiming, tradingPositioning]);

  // Filtro ricerca paniere azionario
  const filteredEquities = TOP_50_EQUITIES_AND_ETFS.filter(
    (item) =>
      item.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sector && item.sector.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filtro ricerca dividendi
  const filteredDividends = TOP_50_DIVIDENDS_BASKET.filter(
    (item) =>
      item.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sector && item.sector.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filtro ricerca crypto
  const filteredCrypto = TOP_50_CRYPTO_BASKET.filter(
    (item) =>
      item.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!dossier) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl sm:max-w-4xl bg-[#0d0f14] border border-[#C5A059]/35 text-foreground shadow-[0_0_50px_rgba(0,0,0,0.9)] p-0 overflow-hidden">
        {/* Header con codice, categoria e selettore Tab */}
        <div className="bg-[#11131c] border-b border-[#C5A059]/25 p-4 sm:p-5 pb-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <Badge
              variant="outline"
              className={`font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${toneBadge}`}
            >
              {dossier.code}
            </Badge>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {dossier.category}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="font-display text-xl sm:text-2xl font-bold uppercase tracking-tight text-foreground flex items-center gap-2">
                <Compass className="h-5 w-5 text-[#C5A059] shrink-0" />
                <span>{dossier.title}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {dossier.scope}
              </DialogDescription>
            </div>

            {/* Toggle Tabs (se disponibile benchmark per l'asset) */}
            {hasBenchmarkTab && (
              <div className="flex items-center gap-1 bg-[#07080b] p-1 rounded-lg border border-border/70 shrink-0 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("dossier")}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    activeTab === "dossier"
                      ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_8px_rgba(197,160,89,0.5)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Binary className="h-3 w-3 inline mr-1" />
                  Dossier & Regole
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("benchmark")}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    activeTab === "benchmark"
                      ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_8px_rgba(197,160,89,0.5)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers className="h-3 w-3 inline mr-1" />
                  {toolId === "hedgingAllocation"
                    ? "Dati Reali Oro (XAU/USD)"
                    : toolId === "tradingAllocation"
                      ? "Matrice Half-Kelly"
                      : "Paniere & Fattori"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("crossAsset")}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    activeTab === "crossAsset"
                      ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_8px_rgba(197,160,89,0.5)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Scale className="h-3 w-3 inline mr-1" />
                  Rotazione Cross-Asset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Corpo del dossier */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[72vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#C5A059]/30">
          {activeTab === "dossier" && (
            <>
              {/* Sezione Formula Matematica */}
              <div className="rounded-lg border border-[#C5A059]/25 bg-[#07080b] p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#E8C56A]">
                  <Binary className="h-4 w-4 text-[#C5A059]" />
                  <span>Formula Matematica & Logica Quantitativa</span>
                </div>
                <div className="rounded bg-[#11131c] border border-border/50 p-2 font-mono text-xs text-foreground font-semibold overflow-x-auto whitespace-nowrap">
                  <code>{dossier.formula}</code>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {dossier.formulaDescription}
                </p>
              </div>

              {/* Sezione Matrice di Timing & Momento Migliore per Investire */}
              {dossier.timingMatrix && (
                <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#F3D88C]">
                    <Clock className="h-4 w-4 text-[#C5A059]" />
                    <span>Calcolo del Timing: Quando Privilegiare Questo Asset</span>
                  </div>
                  <p className="text-xs text-foreground/95 font-medium leading-relaxed">
                    {dossier.timingMatrix.whenToPrioritize}
                  </p>
                  <div className="space-y-1 pt-1">
                    <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground block">
                      Trigger Quantitativi di Ingresso:
                    </span>
                    <ul className="space-y-1 text-[11px] text-muted-foreground">
                      {dossier.timingMatrix.triggerIndicators.map((t, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[#C5A059] font-bold">›</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-1.5 border-t border-[#C5A059]/20 text-[11px] text-muted-foreground">
                    <strong className="text-[#E8C56A] font-semibold">Confronto con gli altri motori: </strong>
                    {dossier.timingMatrix.comparisonWithOthers}
                  </div>
                </div>
              )}

              {/* Sezione Regola Inviolabile LIMEN */}
              <div className="rounded-lg border border-[#C5A059]/35 bg-[#C5A059]/5 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#F3D88C]">
                  <Scale className="h-4 w-4 text-[#C5A059]" />
                  <span>Regola d'Onore & Disciplina LIMEN</span>
                </div>
                <p className="text-xs text-foreground/90 font-medium leading-relaxed italic">
                  « {dossier.limenRule} »
                </p>
              </div>

              {/* Sezione Guardrails Operativi */}
              <div className="rounded-lg border border-border/60 bg-[#11131c]/60 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                  <Shield className="h-4 w-4 text-[#C5A059]" />
                  <span>Guardrails Istituzionali</span>
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground font-sans">
                  {dossier.guardrails.map((g, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                      <span className="leading-snug">{g}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Sezione Impatto sulla Solidità Globale */}
              <div className="rounded-lg border border-border/60 bg-[#11131c]/40 p-3 space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-[#C5A059]" />
                  <span>Impatto sulla Solidità Patrimoniale</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {dossier.impactDescription}
                </p>
              </div>
            </>
          )}

          {activeTab === "benchmark" && (
            /* TAB BENCHMARK ISTITUZIONALE & DATI REALI */
            <div className="space-y-3">
              {/* 1. AZIONI & ETF (TOP 50) */}
              {toolId === "equityAllocation" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[9.5px] uppercase">Score Timing Paniere:</span>
                      <strong className="text-foreground text-sm font-bold">{equityTiming.timingHeadline}</strong>
                    </div>
                    <div className="flex items-center gap-4 text-[10.5px]">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">CAGR 5Y Ponderato:</span>
                        <strong className="text-emerald-400 font-bold">~{equityTiming.expectedAnnualReturnPct}% a.a.</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">P/E Ponderato:</span>
                        <strong className="text-foreground font-bold">{equityTiming.keyMetrics["P/E Ponderato"]}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Scostamento Storico:</span>
                        <strong className="text-[#E8C56A] font-bold">{equityTiming.keyMetrics["Scostamento Multipli"]}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Scomposizione nei 4 Fattori Istituzionali */}
                  <FactorGrid factors={equityTiming.factors} />

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Cerca tra le 50 azioni ed ETF (es. VWCE, MSFT, ASML, ETF...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs font-mono bg-[#07080b] border-border/70"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {filteredEquities.length} / 50 Titoli
                    </span>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-[#07080b] overflow-hidden">
                    <div className="max-h-[46vh] overflow-y-auto font-mono text-[10px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#11131c] text-muted-foreground uppercase text-[9px] sticky top-0 border-b border-border/60">
                          <tr>
                            <th className="p-2">Ticker</th>
                            <th className="p-2">Nome</th>
                            <th className="p-2">Settore</th>
                            <th className="p-2 text-right">CAGR 5Y</th>
                            <th className="p-2 text-right">P/E</th>
                            <th className="p-2 text-right">Yield</th>
                            <th className="p-2 text-right">ATH Drawdown</th>
                            <th className="p-2 text-right">Peso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {filteredEquities.map((item) => (
                            <tr key={item.ticker} className="hover:bg-white/[0.02]">
                              <td className="p-2 font-bold text-[#E8C56A]">{item.ticker}</td>
                              <td className="p-2 text-foreground truncate max-w-[150px]">{item.name}</td>
                              <td className="p-2 text-muted-foreground">{item.sector}</td>
                              <td className="p-2 text-right text-emerald-400 font-bold">+{item.cagr5Y}%</td>
                              <td className="p-2 text-right text-foreground">{item.peRatio}x</td>
                              <td className="p-2 text-right text-slate-300">{item.dividendYield}%</td>
                              <td className="p-2 text-right text-muted-foreground">{item.drawdownAthPct}%</td>
                              <td className="p-2 text-right text-foreground font-semibold">{item.weightPct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. DIVIDENDI (TOP 50) */}
              {toolId === "dividendsAllocation" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[9.5px] uppercase">Score Timing Dividendi:</span>
                      <strong className="text-foreground text-sm font-bold">{dividendTiming.timingHeadline}</strong>
                    </div>
                    <div className="flex items-center gap-4 text-[10.5px]">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Yield Ponderato:</span>
                        <strong className="text-emerald-400 font-bold">+{dividendTiming.expectedAnnualReturnPct}% a.a.</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Spread vs Bond 10Y:</span>
                        <strong className="text-[#E8C56A] font-bold">{dividendTiming.keyMetrics["Spread vs Bond 10Y"]}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Crescita Media 5Y:</span>
                        <strong className="text-foreground font-bold">{dividendTiming.keyMetrics["Crescita Dividendi 5Y"]}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Scomposizione nei 4 Fattori Istituzionali */}
                  <FactorGrid factors={dividendTiming.factors} />

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Cerca tra i 50 aristocratici (es. SCHD, O, JNJ, ENEL, ALV...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs font-mono bg-[#07080b] border-border/70"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {filteredDividends.length} / 50 Titoli
                    </span>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-[#07080b] overflow-hidden">
                    <div className="max-h-[46vh] overflow-y-auto font-mono text-[10px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#11131c] text-muted-foreground uppercase text-[9px] sticky top-0 border-b border-border/60">
                          <tr>
                            <th className="p-2">Ticker</th>
                            <th className="p-2">Nome</th>
                            <th className="p-2">Settore</th>
                            <th className="p-2 text-right">Yield</th>
                            <th className="p-2 text-right">Crescita 5Y</th>
                            <th className="p-2 text-right">Payout</th>
                            <th className="p-2 text-right">Anni Hike</th>
                            <th className="p-2 text-right">Freq</th>
                            <th className="p-2 text-right">Peso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {filteredDividends.map((item) => (
                            <tr key={item.ticker} className="hover:bg-white/[0.02]">
                              <td className="p-2 font-bold text-[#E8C56A]">{item.ticker}</td>
                              <td className="p-2 text-foreground truncate max-w-[140px]">{item.name}</td>
                              <td className="p-2 text-muted-foreground">{item.sector}</td>
                              <td className="p-2 text-right text-emerald-400 font-bold">+{item.dividendYield}%</td>
                              <td className="p-2 text-right text-foreground">+{item.dividendGrowth5Y}%</td>
                              <td className="p-2 text-right text-muted-foreground">{item.payoutRatio}%</td>
                              <td className="p-2 text-right text-foreground font-semibold">{item.consecutiveYearsHike}a</td>
                              <td className="p-2 text-right text-[8.5px] text-muted-foreground">{item.frequency}</td>
                              <td className="p-2 text-right text-foreground font-bold">{item.weightPct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. CRIPTOVALUTE & STAKING (TOP 50) */}
              {toolId === "cryptoAllocation" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[9.5px] uppercase">Score Timing Ciclo Crypto:</span>
                      <strong className="text-foreground text-sm font-bold">{cryptoTiming.timingHeadline}</strong>
                    </div>
                    <div className="flex items-center gap-4 text-[10.5px]">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">APY Staking PoS:</span>
                        <strong className="text-emerald-400 font-bold">~{cryptoTiming.weightedStakingApyPct}% a.a.</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">CAGR Stimato:</span>
                        <strong className="text-foreground font-bold">~{cryptoTiming.expectedAnnualReturnPct}% a.a.</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase">Ciclo Halving:</span>
                        <strong className="text-[#E8C56A] font-bold">{cryptoTiming.keyMetrics["Finestra Halving"]}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Scomposizione nei 4 Fattori Istituzionali */}
                  <FactorGrid factors={cryptoTiming.factors} />

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Cerca tra le 50 crypto (es. BTC, ETH, SOL, LINK, SUI...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs font-mono bg-[#07080b] border-border/70"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {filteredCrypto.length} / 50 Token
                    </span>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-[#07080b] overflow-hidden">
                    <div className="max-h-[46vh] overflow-y-auto font-mono text-[10px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#11131c] text-muted-foreground uppercase text-[9px] sticky top-0 border-b border-border/60">
                          <tr>
                            <th className="p-2">Ticker</th>
                            <th className="p-2">Nome</th>
                            <th className="p-2">Categoria</th>
                            <th className="p-2 text-right">Staking APY</th>
                            <th className="p-2 text-right">ATH Drawdown</th>
                            <th className="p-2 text-right">MVRV</th>
                            <th className="p-2 text-right">Peso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {filteredCrypto.map((item) => (
                            <tr key={item.ticker} className="hover:bg-white/[0.02]">
                              <td className="p-2 font-bold text-[#E8C56A]">{item.ticker}</td>
                              <td className="p-2 text-foreground truncate max-w-[150px]">{item.name}</td>
                              <td className="p-2 text-muted-foreground">{item.category}</td>
                              <td className="p-2 text-right">
                                {item.isStakingSupported ? (
                                  <span className="text-emerald-400 font-bold">+{item.stakingApyPct}% a.a.</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-2 text-right text-muted-foreground">{item.drawdownAthPct}%</td>
                              <td className="p-2 text-right text-foreground">{item.mvrvRatio}x</td>
                              <td className="p-2 text-right text-foreground font-semibold">{item.weightPct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. ORO & CAPITAL HEDGING (DATI REALI XAU/USD) */}
              {toolId === "hedgingAllocation" && (
                <div className="space-y-3 font-mono">
                  <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-muted-foreground">Stato Scudo Antifragile:</span>
                      <strong className="text-emerald-400 font-bold text-xs">{goldTiming.regimeLabel}</strong>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                      <div className="rounded bg-[#07080b] p-2 border border-border/60">
                        <span className="text-[8.5px] uppercase text-muted-foreground block">Spot XAU/USD</span>
                        <strong className="text-xs text-[#E8C56A] block mt-0.5">{goldTiming.keyMetrics["Prezzo Spot XAU/USD"]}</strong>
                      </div>
                      <div className="rounded bg-[#07080b] p-2 border border-border/60">
                        <span className="text-[8.5px] uppercase text-muted-foreground block">Spot XAU/EUR</span>
                        <strong className="text-xs text-foreground block mt-0.5">{goldTiming.keyMetrics["Prezzo Spot XAU/EUR"]}</strong>
                      </div>
                      <div className="rounded bg-[#07080b] p-2 border border-border/60">
                        <span className="text-[8.5px] uppercase text-muted-foreground block">vs Media 200gg</span>
                        <strong className="text-xs text-emerald-400 block mt-0.5">{goldTiming.keyMetrics["Distanza SMA200"]}</strong>
                      </div>
                      <div className="rounded bg-[#07080b] p-2 border border-border/60">
                        <span className="text-[8.5px] uppercase text-muted-foreground block">Preservazione</span>
                        <strong className="text-xs text-[#E8C56A] block mt-0.5">{goldTiming.keyMetrics["Preservazione Storica"]}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Scomposizione nei 4 Fattori Istituzionali */}
                  <FactorGrid factors={goldTiming.factors} />

                  <div className="rounded-lg border border-border/70 bg-[#07080b] p-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-[#E8C56A] font-bold uppercase text-[11px]">
                      <Shield className="h-4 w-4 text-[#C5A059]" />
                      <span>Logica di Timing Reale dell'Oro Fisico</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {goldTiming.triggerSummary}
                    </p>
                    <div className="pt-2 border-t border-border/50 text-[10.5px] text-muted-foreground space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Prezzo Spot Attuale:</span>
                        <strong className="text-foreground">$2.728,50 / oz</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Media Mobile a 200 Giorni (SMA200):</span>
                        <strong className="text-foreground">$2.420,00</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tasso Reale USA (TIPS 10Y):</span>
                        <strong className="text-emerald-400">1.82%</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Funzione Strategica:</span>
                        <strong className="text-[#E8C56A] uppercase">Decorrelazione da Crisi di Liquidità & Debasement</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. TRADING (TRANS-LIMEN) — MODELLO HALF-KELLY */}
              {toolId === "tradingAllocation" && (
                <div className="space-y-3 font-mono">
                  <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-muted-foreground">Posizionamento Quantitativo:</span>
                      <strong className="text-[#E8C56A] font-bold text-xs">{tradingPositioning.regimeLabel}</strong>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                      <div className="rounded bg-[#07080b] p-2 border border-border/60">
                        <span className="text-[8.5px] uppercase text-muted-foreground block">Quota Kelly</span>
                        <strong className="text-xs text-[#E8C56A] block mt-0.5">{tradingPositioning.halfKellyRiskPct}% Conto</strong>
                      </div>
                      <div className="rounded bg-[#07080b] p-2 border border-border/60">
                        <span className="text-[8.5px] uppercase text-muted-foreground block">Rischio / Trade</span>
                        <strong className="text-xs text-foreground block mt-0.5">€{tradingPositioning.riskPerTradeEuro}</strong>
                      </div>
                      <div className="rounded bg-[#07080b] p-2 border border-border/60">
                        <span className="text-[8.5px] uppercase text-muted-foreground block">Rischio su Net Worth</span>
                        <strong className="text-xs text-emerald-400 block mt-0.5">{tradingPositioning.netWorthRiskPct}% NW</strong>
                      </div>
                      <div className="rounded bg-[#07080b] p-2 border border-border/60">
                        <span className="text-[8.5px] uppercase text-muted-foreground block">Stop Assorbibili</span>
                        <strong className="text-xs text-[#E8C56A] block mt-0.5">{tradingPositioning.consecutiveLossTolerance} SL</strong>
                      </div>
                    </div>
                  </div>

                  {/* Scomposizione nei 4 Fattori Istituzionali */}
                  <FactorGrid factors={tradingPositioning.factors} />

                  <div className="rounded-lg border border-border/70 bg-[#07080b] p-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-[#E8C56A] font-bold uppercase text-[11px]">
                      <Zap className="h-4 w-4 text-[#C5A059]" />
                      <span>Formula Half-Kelly & Garanzia di Serenità Mentale</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {tradingPositioning.positioningSummary}
                    </p>
                    <div className="pt-2 border-t border-border/50 text-[10.5px] text-muted-foreground space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Win Rate Procedurale Atteso:</span>
                        <strong className="text-foreground">54.0%</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Payoff Medio (R:R):</span>
                        <strong className="text-foreground">1.85 R</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Valore Atteso per Trade (EV):</span>
                        <strong className="text-emerald-400 font-bold">+{tradingPositioning.expectedValuePerTradeEuro} €</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Formula di Kelly Piena:</span>
                        <strong className="text-muted-foreground">1.62% del conto</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Frazione Half-Kelly Applicata LIMEN:</span>
                        <strong className="text-emerald-400 font-bold">{tradingPositioning.halfKellyRiskPct}% del conto</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Probabilità di Rovina Matematica:</span>
                        <strong className="text-emerald-400 font-bold">&lt; 0.0001% (Zero Rischio Rovina)</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Vincolo Fondo di Riserva 1:1:</span>
                        <strong className="text-[#E8C56A]">Obbligatorio (Riserva &ge; Conto Trading)</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "crossAsset" && (
            <div className="space-y-3 font-mono">
              {/* Banner Top Opportunity */}
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5 uppercase">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span>Verdetto di Rotazione Quantitativa LIMEN</span>
                  </span>
                  <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-300 uppercase font-bold">
                    Top Opportunity: {crossAssetMatrix.topOpportunity.title}
                  </Badge>
                </div>
                <p className="text-xs text-foreground font-semibold">
                  {crossAssetMatrix.rotationHeadline}
                </p>
              </div>

              {/* Classifica dei 5 Motori da 1 a 5 */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Gerarchia di Convenienza Attuale (Ranking 1 - 5):
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {crossAssetMatrix.rankings.map((item) => {
                    const badgeStyle =
                      item.flowRecommendation === "SOVRAPPESO_ATTIVO"
                        ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-300"
                        : item.flowRecommendation === "PRUDENZA_GUARDRAIL"
                        ? "bg-red-950/40 border-red-500/40 text-red-300"
                        : item.flowRecommendation === "ACCUMULO_COSTANTE"
                        ? "bg-[#C5A059]/15 border-[#C5A059]/40 text-[#E8C56A]"
                        : "bg-slate-900/60 border-slate-700 text-slate-300";

                    return (
                      <div
                        key={item.assetId}
                        className={`rounded-lg border p-2 flex items-center justify-between gap-3 text-xs transition-all ${
                          item.rank === 1
                            ? "border-[#C5A059]/60 bg-[#C5A059]/10"
                            : "border-border/60 bg-[#07080b]"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                            item.rank === 1 ? "bg-[#C5A059] text-[#07080b]" : "bg-slate-800 text-muted-foreground"
                          }`}>
                            #{item.rank}
                          </span>
                          <div className="min-w-0 truncate">
                            <span className="font-bold text-foreground block truncate">{item.title}</span>
                            <span className="text-[9.5px] text-muted-foreground block truncate">{item.coreReason}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-sm text-[#E8C56A]">{item.score}/100</span>
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border whitespace-nowrap ${badgeStyle}`}>
                            {item.actionBadge}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sezione Confronti a Coppie Diretti */}
              <div className="rounded-lg border border-border/70 bg-[#07080b] p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#E8C56A]">
                  <Scale className="h-4 w-4 text-[#C5A059]" />
                  <span>Confronti a Coppie: Quando Privilegiare uno Strumento sull'Altro</span>
                </div>
                <div className="space-y-2 text-[10.5px] text-muted-foreground">
                  <div className="rounded bg-[#11131c] p-2 border border-border/50 space-y-0.5">
                    <strong className="text-foreground block">⚖️ Azioni Growth vs Dividendi Cash Flow:</strong>
                    <p className="leading-relaxed">{crossAssetMatrix.pairwiseInsights.equityVsDividends}</p>
                  </div>
                  <div className="rounded bg-[#11131c] p-2 border border-border/50 space-y-0.5">
                    <strong className="text-foreground block">🛡️ Crypto Asimmetriche vs Copertura Oro:</strong>
                    <p className="leading-relaxed">{crossAssetMatrix.pairwiseInsights.cryptoVsGold}</p>
                  </div>
                  <div className="rounded bg-[#11131c] p-2 border border-border/50 space-y-0.5">
                    <strong className="text-foreground block">⚡ Trading Attivo Trans-Limen vs Investimenti Passivi:</strong>
                    <p className="leading-relaxed">{crossAssetMatrix.pairwiseInsights.tradingVsPassive}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#11131c] border-t border-[#C5A059]/20 p-3 px-5 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span>ORDINE LIMEN // ARCHITETTURA PATRIMONIALE</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded border border-[#C5A059]/40 bg-[#0d0f14] text-[#E8C56A] hover:bg-[#C5A059]/20 font-bold uppercase tracking-wider text-[10px] transition-colors"
          >
            Chiudi Dossier
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
