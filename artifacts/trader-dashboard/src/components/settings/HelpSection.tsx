import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronDown, ExternalLink, LifeBuoy, CircleHelp, ArrowRight, BookOpen, Compass, ShieldCheck } from "lucide-react";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { AppTutorialWizard } from "@/components/AppTutorialWizard";

const QUICK_STEPS = [
  {
    n: "1",
    title: "Crea il tuo profilo & Dossier",
    desc: "Scegli un username sovrano, carica il tuo sigillo avatar e dichiara la tua esperienza operativa.",
  },
  {
    n: "2",
    title: "Configura le sessioni",
    descKey: "workspace.help.sessions",
  },
  {
    n: "3",
    title: "Apri il tuo primo check-in",
    descKey: "workspace.help.checkin",
  },
  {
    n: "4",
    title: "Compila Il Libro della Verità",
    descKey: "workspace.help.trade",
  },
  {
    n: "5",
    title: "Completa L'Ordine Giornaliero",
    descKey: "workspace.help.missions",
  },
  {
    n: "6",
    title: "Attiva le sentinelle e gli allarmi",
    descKey: "workspace.help.notifications",
  },
];

const SHORTCUT_ITEMS = (t: (key: string) => string) => [
  {
    keys: [t("workspace.settings.profile"), "→", t("settings.tile.security")],
    action: "Imposta PIN di protezione",
  },
  { keys: [t("workspace.settings.experience"), "→", t("settings.tile.appearance")], action: "Cambia sfondo e font" },
  {
    keys: [t("workspace.settings.trading"), "→", t("settings.tile.pairs")],
    action: "Seleziona i tuoi pair preferiti",
  },
  { keys: [t("nav.journal"), "→", t("journal.workspace.review")], action: t("workspace.help.review") },
  {
    keys: [t("nav.backtest")],
    action: "Allenamento su grafici storici",
  },
  { keys: [t("nav.journal"), "→", t("journal.workspace.plan"), "→", t("journal.workspace.routine")], action: "Respirazione guidata e check-in emotivo" },
];

const HELP_FAQS = [
  {
    q: "Come viene calcolato l'Indice di Integrità e la mia streak?",
    a: "L'integrità misura la fedeltà quotidiana al protocollo. La streak di sessioni conformi avanza completando la routine e registrando onestamente su Il Libro della Verità senza violare i limiti di rischio stabiliti.",
  },
  {
    q: "Come cambio l'idioma del protocollo?",
    answerKey: "workspace.help.language",
  },
  {
    q: "I miei dati sono sincronizzati tra dispositivi differenti?",
    a: "Sì. Le registrazioni del cockpit, i trade storici e le configurazioni di rischio risiedono sul cloud cifrato e si sincronizzano all'accesso su qualsiasi postazione.",
  },
  {
    q: "Come posso esportare l'intero archivio dei miei trade?",
    answerKey: "workspace.help.export",
  },
  {
    q: "Come opera il calcolatore di lot size e gestione del rischio?",
    answerKey: "workspace.help.calculator",
  },
  {
    q: "Cosa accade se dimentico il codice PIN locale?",
    a: "Il PIN è una misura di presidio locale sul browser. Se dimenticato, puoi effettuare un logout dalla sessione del tuo account per reimpostare la protezione.",
  },
];

export function HelpSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-7 space-y-7 shadow-xl shadow-black/40">
      <AppTutorialWizard
        open={tutorialOpen}
        onSkip={() => setTutorialOpen(false)}
        onFinish={() => setTutorialOpen(false)}
      />

      {/* Tutorial Banner */}
      <div className="rounded-xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 via-[#11131c] to-[#07080b] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A]">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-sm font-bold tracking-wide text-[#F4F4F6]">
                {t("settings.help.review_tutorial")}
              </p>
              <p className="mt-0.5 text-xs font-mono text-muted-foreground/80 leading-relaxed">
                {t("settings.help.review_tutorial_desc")}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-[#C5A059]/35 bg-[#07080b] hover:bg-[#C5A059]/15 hover:border-[#C5A059] text-xs font-mono font-bold text-[#E8C56A]"
            onClick={() => setTutorialOpen(true)}
          >
            {t("settings.help.review_tutorial")}
          </Button>
        </div>
      </div>

      {/* Quick start steps */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-[#C5A059]/15 pb-2">
          <BookOpen className="w-4 h-4 text-[#C5A059]" />
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#F4F4F6]">
            Guida d&apos;Inizio — I Primi Passi nel Protocollo
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {QUICK_STEPS.map((s) => (
            <div
              key={s.n}
              className="flex gap-3.5 p-3.5 rounded-xl border border-[#26262E] bg-[#07080b]/80 hover:border-[#C5A059]/30 transition-all"
            >
              <div className="shrink-0 w-8 h-8 rounded-lg bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center text-[#E8C56A] font-bold text-xs font-mono">
                {s.n}
              </div>
              <div className="min-w-0">
                <p className="font-display text-xs font-bold text-[#F4F4F6]">{s.title}</p>
                <p className="text-[11px] font-mono text-muted-foreground/80 mt-0.5 leading-relaxed">
                  {s.descKey ? t(s.descKey) : s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation shortcuts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-[#C5A059]/15 pb-2">
          <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#F4F4F6]">
            Percorsi Rapidi del Cockpit
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SHORTCUT_ITEMS(t).map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#26262E] bg-[#07080b]/80"
            >
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {item.keys.map((k, ki) => (
                  <span key={ki} className="flex items-center gap-1">
                    <span className="font-mono text-[10px] font-bold bg-[#11131c] border border-[#C5A059]/25 px-1.5 py-0.5 rounded text-[#E8C56A] whitespace-nowrap">
                      {k}
                    </span>
                    {ki < item.keys.length - 1 && (
                      <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
                    )}
                  </span>
                ))}
              </div>
              <span className="font-mono text-[11px] text-muted-foreground ml-auto shrink-0 text-right">
                {item.action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-[#C5A059]/15 pb-2">
          <LifeBuoy className="w-4 h-4 text-[#C5A059]" />
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#F4F4F6]">
            Domande Frequenti & Dottrina Operativa
          </h3>
        </div>
        <div className="space-y-2">
          {HELP_FAQS.map((item, i) => (
            <div
              key={i}
              className="border border-[#26262E] rounded-xl overflow-hidden bg-[#07080b]/80 transition-colors"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-3.5 text-left hover:bg-[#11131c]/60 transition-colors"
              >
                <span className="font-display text-xs font-bold text-[#F4F4F6] pr-4">{item.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-[#C5A059] shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 font-mono text-xs text-muted-foreground/90 leading-relaxed border-t border-[#C5A059]/15 bg-[#11131c]/40">
                      {item.answerKey ? t(item.answerKey) : item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Support channel link */}
      <div className="pt-2">
        <a
          href="mailto:assistenza@traderloading.com?subject=Richiesta%20assistenza"
          className="flex items-center justify-between p-4 rounded-xl border border-[#C5A059]/30 bg-[#07080b] hover:bg-[#C5A059]/10 hover:border-[#C5A059] transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center text-[#E8C56A] shrink-0">
              <CircleHelp className="w-4 h-4" />
            </div>
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-wider text-[#F4F4F6]">{uiText("settings.support.contact")}</p>
              <p className="font-mono text-[11px] text-[#C5A059]/80">
                assistenza@traderloading.com
              </p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-[#E8C56A] transition-colors" />
        </a>
      </div>
    </div>
  );
}
