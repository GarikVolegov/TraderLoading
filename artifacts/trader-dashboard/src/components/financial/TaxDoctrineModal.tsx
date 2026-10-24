import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Scale,
  Landmark,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  FileText,
  Copy,
  CheckCircle,
  AlertTriangle,
  Building,
  Coins,
  Percent,
  TrendingDown,
  Layers,
  HelpCircle,
  ExternalLink,
  Zap,
} from "lucide-react";
import {
  ITALY_TAX_DOCTRINE,
  type TaxCountry,
  type TaxRegimeMode,
} from "../../../../../contracts/financialArchitecture";

interface TaxDoctrineModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxCountry?: TaxCountry;
  taxRegime?: TaxRegimeMode;
  onSelectRegime?: (regime: TaxRegimeMode) => void;
}

export const TaxDoctrineModal: React.FC<TaxDoctrineModalProps> = ({
  isOpen,
  onClose,
  taxCountry = "IT",
  taxRegime = "DICHIARATIVO",
  onSelectRegime,
}) => {
  const [activeTab, setActiveTab] = useState<"regimes" | "assets" | "prop" | "deadlines">("regimes");
  const [copiedChecklist, setCopiedChecklist] = useState<boolean>(false);

  const doctrine = ITALY_TAX_DOCTRINE;

  const handleCopyChecklist = () => {
    const text = `CHECKLIST ADEMPIMENTI FISCALI TRADING & WEALTH (ITALIA - LIMEN PROTOCOL)
----------------------------------------------------------------------
DOCUMENTI PER IL COMMERCIALISTA (MODELLO REDDITI PERSONE FISICHE):

1. BROKER ESTERI (REGIME DICHIARATIVO - es. Interactive Brokers):
   [ ] Estratto conto annuale e report fiscale (1 Gennaio - 31 Dicembre)
   [ ] Report di compravendita per Quadro RT (Plusvalenze / Minusvalenze)
   [ ] Giacenze medie e saldi al 31/12 per Quadro RW (Monitoraggio Fiscale & IVAFE 0.20%)
   [ ] Certificazione dividendi esteri per Quadro RM (con evidenza ritenuta USA W-8BEN)

2. PROP FIRM & PAYOUTS SIMULATI (FTMO, FUNDEDNEXT, ETC.):
   [ ] Contratti di challenge / fornitura dati / demo agreement
   [ ] Invoice / Ricevute di pagamento di ciascun payout incassato
   [ ] Estratti conto bancari con causali accredito prop firm
   [ ] Inquadramento: P.IVA Regime Forfettario (codice ATECO 62.02.00 / 74.90.99) o Prestazione Occasionale
   * NOTA: Non compensabili con minusvalenze CFD su broker personali

3. WALLET & CRIPTO-ATTIVITÀ:
   [ ] Saldo complessivo al 31/12 (valore in Euro) di tutti i wallet (Exchange + Hardware wallet) per Quadro RW
   [ ] Calcolo plusvalenze nette realizzate nell'anno per Quadro RT (Aliquota 26%)
   [ ] Ricevute di staking PoS per proventi periodici

4. ZAINETTO FISCALE (RECUPERO MINUSVALENZE):
   [ ] Certificazione minusvalenze maturate nei 4 anni solari precedenti
   [ ] Verifica scadenze: le minusvalenze decadono al 31 Dicembre del quarto anno successivo

SCADENZE CHIAVE F24:
- 30 Giugno: Saldo anno precedente + Primo Acconto imposte (Codice 1100 / 4043)
- 30 Novembre: Secondo Acconto imposte
----------------------------------------------------------------------
Generato dal Banco dell'Architettura Patrimoniale LIMEN`;

    navigator.clipboard.writeText(text);
    setCopiedChecklist(true);
    toast({
      title: "Checklist Fiscale Copiata",
      description: "Dati pronti da inoltrare al commercialista o consulente tributario.",
    });
    setTimeout(() => setCopiedChecklist(false), 3000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-[#0d0f14] border border-[#C5A059]/30 text-foreground p-0 flex flex-col overflow-hidden shadow-2xl">
        {/* Header Istituzionale */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/60 bg-[#07080b]/90 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center shrink-0">
                <Scale className="h-5 w-5 text-[#E8C56A]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A]">
                    ERAR-IT // DOTTRINA FISCALE
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    Residenza: <strong className="text-foreground">Italia 🇮🇹</strong>
                  </span>
                </div>
                <DialogTitle className="text-lg sm:text-xl font-display font-black text-foreground uppercase tracking-tight mt-0.5">
                  Architettura Fiscale dell'Operatore
                </DialogTitle>
              </div>
            </div>

            {/* Quick Actions Header */}
            <div className="flex items-center gap-2 font-mono text-xs w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyChecklist}
                className="h-8 text-[11px] border-[#C5A059]/40 hover:bg-[#C5A059]/15 text-[#E8C56A] font-bold gap-1.5"
              >
                {copiedChecklist ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copiata!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="whitespace-nowrap">Checklist Commercialista</span>
                  </>
                )}
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Compendio erariale del protocollo LIMEN: disciplina del regime dichiarativo, tassazione per asset class, proventi da prop firm e calendario F24 per l'Italia.
          </DialogDescription>

          {/* Navigazione Tabs */}
          <div className="grid grid-cols-4 gap-1.5 pt-3 font-mono text-[10.5px]">
            <button
              type="button"
              onClick={() => setActiveTab("regimes")}
              className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                activeTab === "regimes"
                  ? "bg-[#C5A059] text-[#07080b] border-[#C5A059] shadow-sm"
                  : "bg-[#07080b] border-border/60 text-slate-400 hover:text-foreground"
              }`}
            >
              <Building className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">1. Regimi & Quadri</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("assets")}
              className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                activeTab === "assets"
                  ? "bg-[#C5A059] text-[#07080b] border-[#C5A059] shadow-sm"
                  : "bg-[#07080b] border-border/60 text-slate-400 hover:text-foreground"
              }`}
            >
              <Percent className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">2. Asset Class</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("prop")}
              className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                activeTab === "prop"
                  ? "bg-[#C5A059] text-[#07080b] border-[#C5A059] shadow-sm"
                  : "bg-[#07080b] border-border/60 text-slate-400 hover:text-foreground"
              }`}
            >
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">3. Prop Firm</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("deadlines")}
              className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                activeTab === "deadlines"
                  ? "bg-[#C5A059] text-[#07080b] border-[#C5A059] shadow-sm"
                  : "bg-[#07080b] border-border/60 text-slate-400 hover:text-foreground"
              }`}
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">4. Calendario F24</span>
            </button>
          </div>
        </DialogHeader>

        {/* Corpo Scrollabile del Modale */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-[#C5A059]/30 font-mono text-xs">
          {/* ═══════════════════════════════════════════════════════════════
              TAB 1: REGIMI FISCALI (DICHIARATIVO VS AMMINISTRATO) & QUADRI
             ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "regimes" && (
            <div className="space-y-3.5">
              {/* Box comparativo sintetico: Dichiarativo vs Amministrato */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Regime Dichiarativo */}
                <div
                  className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                    taxRegime === "DICHIARATIVO"
                      ? "bg-[#07080b] border-[#C5A059] shadow-[0_0_12px_rgba(197,160,89,0.15)]"
                      : "bg-[#07080b]/60 border-border/60 opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#E8C56A]" />
                      <strong className="text-sm font-bold text-foreground">
                        Regime Dichiarativo
                      </strong>
                    </div>
                    {taxRegime === "DICHIARATIVO" && (
                      <Badge className="bg-[#C5A059]/20 text-[#E8C56A] border-[#C5A059]/50 text-[9px] uppercase font-mono">
                        Attivo nel Cockpit
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Standard per chi opera con broker esteri (es. Interactive Brokers, Swissquote estera) e Prop Firm. L'operatore riceve il lordo e versa le imposte l'anno successivo.
                  </p>

                  <div className="space-y-1.5 text-[10.5px]">
                    <div className="flex items-start gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Vantaggio Finanziario:</strong> Differimento fiscale. La liquidità delle tasse genera rendimento per 12-18 mesi prima del saldo F24.
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#E8C56A] shrink-0 mt-0.5" />
                      <span>
                        <strong>Adempimento:</strong> Obbligo di compilazione Modello Redditi Persone Fisiche (Quadri RT, RW, RM).
                      </span>
                    </div>
                  </div>

                  {onSelectRegime && taxRegime !== "DICHIARATIVO" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectRegime("DICHIARATIVO")}
                      className="w-full h-7 text-[10px] border-[#C5A059]/40 text-[#E8C56A] font-bold mt-1"
                    >
                      Seleziona Come Regime Primario
                    </Button>
                  )}
                </div>

                {/* Regime Amministrato */}
                <div
                  className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                    taxRegime === "AMMINISTRATO"
                      ? "bg-[#07080b] border-[#C5A059] shadow-[0_0_12px_rgba(197,160,89,0.15)]"
                      : "bg-[#07080b]/60 border-border/60 opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      <strong className="text-sm font-bold text-foreground">
                        Regime Amministrato
                      </strong>
                    </div>
                    {taxRegime === "AMMINISTRATO" && (
                      <Badge className="bg-[#C5A059]/20 text-[#E8C56A] border-[#C5A059]/50 text-[9px] uppercase font-mono">
                        Attivo nel Cockpit
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tipico di banche e broker con sede in Italia (Fineco, Directa, Webank, Banca Sella). L'intermediario agisce da Sostituto d'Imposta trattenendo le imposte a ogni operazione.
                  </p>

                  <div className="space-y-1.5 text-[10.5px]">
                    <div className="flex items-start gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Vantaggio Burocratico:</strong> Zero adempimenti in dichiarazione. Nessun Quadro RT o RW da compilare.
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <TrendingDown className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Limite:</strong> Mancata compensazione tra intermediari diversi e prelievo immediato che riduce la leva del compounding.
                      </span>
                    </div>
                  </div>

                  {onSelectRegime && taxRegime !== "AMMINISTRATO" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectRegime("AMMINISTRATO")}
                      className="w-full h-7 text-[10px] border-border text-slate-300 font-bold mt-1"
                    >
                      Seleziona Come Regime Primario
                    </Button>
                  )}
                </div>
              </div>

              {/* Guida Chirurgica ai 3 Quadri Erariali */}
              <div className="rounded-xl border border-border/70 bg-[#07080b] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-border/40">
                  <span className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#C5A059]" />
                    <span>I 3 Quadri Obbligatori del Modello Redditi Persone Fisiche</span>
                  </span>
                  <span className="text-[9.5px] text-[#E8C56A] font-bold">Dichiarazione Annuale</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {doctrine.reportingDuties.map((duty) => (
                    <div
                      key={duty.code}
                      className="rounded-lg border border-border/60 bg-[#0d0f14] p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A] font-bold text-[9.5px]">
                          {duty.code}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">D.Lgs. 461/97</span>
                      </div>
                      <strong className="text-foreground text-[11px] block">{duty.name}</strong>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {duty.obligation}
                      </p>
                      <div className="pt-1 border-t border-border/40 text-[9px] text-slate-400">
                        <span className="text-red-400 font-semibold block">Sanzione Omissione:</span>
                        <span>{duty.penalties}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Regola Aurea dello Zainetto Fiscale */}
              <div className="rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/5 p-3 flex items-start gap-2.5">
                <ShieldAlert className="h-5 w-5 text-[#E8C56A] shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px]">
                  <strong className="text-foreground block uppercase font-bold">
                    Regola Aurea dello Zainetto Fiscale: Compensazione entro 4 Anni Solari
                  </strong>
                  <p className="text-muted-foreground leading-relaxed">
                    Le minusvalenze registrate nel Quadro RT generano un credito d'imposta utilizzabile nei <strong className="text-foreground whitespace-nowrap">4 anni solari successivi</strong> a quello di realizzo. Se non compensate con future plusvalenze di pari natura (Redditi Diversi) entro il quadriennio, le minusvalenze decadono irrevocabilmente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TAB 2: TASSAZIONE PER ASSET CLASS IN ITALIA
             ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "assets" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/70 bg-[#07080b] p-3.5 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                  <span className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-[#C5A059]" />
                    <span>Aliquote & Disciplina Fiscale dei 5 Motori LIMEN</span>
                  </span>
                  <span className="text-[9.5px] text-slate-400">Aggiornato TUIR & Prassi Erariale</span>
                </div>

                <div className="space-y-2">
                  {doctrine.assetRules.map((rule) => {
                    const isWhiteList = rule.taxRatePct === 12.5;
                    return (
                      <div
                        key={rule.assetKey}
                        className="rounded-lg border border-border/60 bg-[#0d0f14] p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-[#C5A059]/40 transition-all"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <strong className="text-foreground text-[11.5px]">{rule.label}</strong>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase whitespace-nowrap ${
                                isWhiteList
                                  ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                                  : "bg-[#C5A059]/15 border-[#C5A059]/35 text-[#E8C56A]"
                              }`}
                            >
                              {rule.taxRateLabel}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {rule.notes}
                          </p>
                        </div>

                        <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-border/40 text-[9.5px]">
                          <span className="text-slate-400 block font-medium">Compensazione Minusvalenze:</span>
                          <span
                            className={`font-bold whitespace-nowrap ${
                              rule.lossCompensable ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {rule.lossCompensable ? "✓ Compensabile (Reddito Diverso)" : "✗ Non Compensabile (Reddito Capitale)"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Approfondimento Doppia Imposizione USA & ETF ad Accumulo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-border/70 bg-[#07080b] p-3 space-y-1.5">
                  <strong className="text-[#E8C56A] text-[11px] block uppercase font-bold flex items-center gap-1.5">
                    <ExternalLink className="h-3 w-3 text-[#C5A059]" />
                    <span>Doppia Imposizione Dividendi USA (W-8BEN)</span>
                  </strong>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Sui dividendi di società statunitensi si applica la trattenuta alla fonte USA del <strong className="text-foreground whitespace-nowrap">15%</strong> (grazie alla convenzione bilaterale Italia-USA tramite modulo W-8BEN), seguita dall'imposta italiana del <strong className="text-foreground whitespace-nowrap">26%</strong> applicata sull'importo residuo (netto frontiera). Il rendimento netto percepito è pari a circa il <strong className="text-emerald-400 whitespace-nowrap">73.9% del lordo</strong>.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-[#07080b] p-3 space-y-1.5">
                  <strong className="text-[#E8C56A] text-[11px] block uppercase font-bold flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-[#C5A059]" />
                    <span>Il Vantaggio degli ETF UCITS ad Accumulo</span>
                  </strong>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Negli ETF ad accumulo (contrassegnati da "Acc"), i dividendi vengono reinvestiti internamente dal fondo <strong className="text-foreground">senza scatenare l'evento impositivo del 26%</strong>. Questo annulla il drag fiscale continuo e permette al 100% dell'utile di generare ulteriore interesse composto fino alla liquidazione finale.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TAB 3: DISCIPLINA SPECIFICA PAYOUTS PROP FIRM
             ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "prop" && (
            <div className="space-y-3.5">
              {/* Box di Inquadramento Giuridico */}
              <div className="rounded-xl border border-border/70 bg-[#07080b] p-3.5 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                  <span className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-[#C5A059]" />
                    <span>Natura Giuridica dei Payout Prop Firm in Italia</span>
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-red-950/40 border border-red-500/40 text-red-300 font-bold">
                    Attenzione Operativa
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Le Prop Firm (FTMO, FundedNext, ecc.) non affidano capitale proprio con contratti di gestione, ma stipulano contratti di <strong className="text-foreground">demo trading, fornitura di dati o esecuzione di challenge simulate</strong>. I proventi percepiti sono qualificati dal punto di vista fiscale come <strong className="text-foreground">remunerazione per fornitura di servizi o bonus di prestazione</strong>, e NON come plusvalenze finanziarie da compravendita titoli.
                </p>
              </div>

              {/* I Due Canali di Inquadramento Fiscale */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {doctrine.propFirmDoctrine.options.map((opt, idx) => (
                  <div
                    key={opt.title}
                    className="rounded-xl border border-border/70 bg-[#07080b] p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-border/40">
                      <strong className="text-foreground text-xs font-bold">{opt.title}</strong>
                      <span className="px-1.5 py-0.2 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A] text-[9.5px] font-bold">
                        {opt.taxRate}
                      </span>
                    </div>

                    <div className="space-y-1 text-[10.5px]">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Regime:</span>
                        <span className="text-slate-200">{opt.regime}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Dettagli Operativi:</span>
                        <span className="text-muted-foreground">{opt.description}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Previdenza INPS:</span>
                        <span className="text-amber-300">{opt.inpsRate}</span>
                      </div>
                      <div className="pt-1 border-t border-border/40 text-[9.5px]">
                        <span className="text-slate-400">Adatto a: </span>
                        <strong className="text-[#E8C56A]">{opt.suitability}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Regola Inviolabile LIMEN Prop Firm */}
              <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-red-300 font-bold uppercase text-xs">
                  <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
                  <span>Divieto Assoluto di Compensazione con Minusvalenze CFD</span>
                </div>
                <ul className="space-y-1 text-[10.5px] text-slate-300 list-disc list-inside">
                  {doctrine.propFirmDoctrine.crucialRules.map((rule, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TAB 4: CALENDARIO ERARIALE & SCADENZE F24
             ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "deadlines" && (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-border/70 bg-[#07080b] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-border/40">
                  <span className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#C5A059]" />
                    <span>Scadenzario Tributario per l'Operatore (Modello F24)</span>
                  </span>
                  <span className="text-[9.5px] text-slate-400">Agenzia delle Entrate</span>
                </div>

                <div className="space-y-2">
                  {doctrine.taxDeadlines.map((deadline) => (
                    <div
                      key={deadline.period}
                      className="rounded-lg border border-border/60 bg-[#0d0f14] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] font-bold text-xs">
                            {deadline.period}
                          </span>
                          <strong className="text-foreground text-xs">{deadline.description}</strong>
                        </div>
                        <p className="text-[10px] text-muted-foreground pt-0.5">
                          Modello: <span className="text-slate-300 font-semibold">{deadline.forms}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Codici Tributo F24 Più Frequenti */}
              <div className="rounded-xl border border-border/70 bg-[#07080b] p-3 space-y-2">
                <strong className="text-foreground text-[11px] uppercase font-bold block flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#C5A059]" />
                  <span>Codici Tributo F24 di Riferimento per il Trading</span>
                </strong>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded border border-border/60 bg-[#0d0f14] p-2 space-y-0.5">
                    <span className="font-bold text-[#E8C56A]">Codice 1100</span>
                    <span className="text-muted-foreground block">Imposta sostitutiva su plusvalenze (Quadro RT - 26%)</span>
                  </div>
                  <div className="rounded border border-border/60 bg-[#0d0f14] p-2 space-y-0.5">
                    <span className="font-bold text-[#E8C56A]">Codice 4043 / 4047</span>
                    <span className="text-muted-foreground block">IVAFE (Imposta sul valore delle attività finanziarie estere - 0.20%)</span>
                  </div>
                  <div className="rounded border border-border/60 bg-[#0d0f14] p-2 space-y-0.5">
                    <span className="font-bold text-[#E8C56A]">Codice 1795</span>
                    <span className="text-muted-foreground block">Imposta sostitutiva sulle cripto-attività (Quadro RT)</span>
                  </div>
                </div>
              </div>

              {/* Banner per Esportazione Checklist */}
              <div className="rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/10 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-center sm:text-left">
                  <strong className="text-foreground text-xs font-bold block">
                    Hai bisogno di preparare i dati per il tuo commercialista?
                  </strong>
                  <span className="text-[10px] text-slate-300 block">
                    Copia la checklist standard LIMEN con l'elenco dei report e dei quadri necessari.
                  </span>
                </div>
                <Button
                  onClick={handleCopyChecklist}
                  className="bg-[#C5A059] text-[#07080b] hover:bg-[#E8C56A] font-bold text-xs h-8 px-4 font-mono shrink-0 whitespace-nowrap"
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copia Checklist Negli Appunti
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer con Stato & Chiusura */}
        <div className="p-3 sm:p-4 border-t border-border/60 bg-[#07080b] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              Regime Corrente: <strong className="text-foreground">{taxRegime}</strong> (Italia 🇮🇹)
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-mono font-bold px-4 border-border/80 text-foreground"
          >
            Chiudi Compendio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
