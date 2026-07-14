import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronDown, ExternalLink, LifeBuoy, CircleHelp, ArrowRight } from "lucide-react";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { AppTutorialWizard } from "@/components/AppTutorialWizard";

const QUICK_STEPS = [
  {
    n: "1",
    title: "Crea il tuo profilo",
    desc: "Scegli un username, carica un avatar e imposta il tuo obiettivo di trading settimanale.",
  },
  {
    n: "2",
    title: "Configura le sessioni",
    desc: "Vai in Trading → Sessioni e imposta gli orari nel tuo fuso locale per le sessioni che segui (Londra, New York, Asia…).",
  },
  {
    n: "3",
    title: "Apri il tuo primo check-in",
    desc: "Prima di fare trading usa il pulsante sessione nel dashboard per registrare il tuo stato mentale.",
  },
  {
    n: "4",
    title: "Compila il diario",
    desc: "Dopo ogni trade vai in Diario → Nuovo Trade. Tieni traccia di setup, risultato e riflessioni.",
  },
  {
    n: "5",
    title: "Completa le missioni",
    desc: "Ogni giorno hai missioni disponibili. Completarle ti dà XP per salire di livello.",
  },
  {
    n: "6",
    title: "Attiva le notifiche",
    desc: "In Notifiche abilita le push per ricevere avvisi all'apertura delle sessioni di trading.",
  },
];

const SHORTCUT_ITEMS = [
  {
    keys: ["Impostazioni", "→", "Sicurezza"],
    action: "Imposta PIN di protezione",
  },
  { keys: ["Impostazioni", "→", "Aspetto"], action: "Cambia sfondo e font" },
  {
    keys: ["Impostazioni", "→", "Pairs"],
    action: "Seleziona i tuoi pair preferiti",
  },
  { keys: ["Diario", "→", "Recap"], action: "Analisi settimanale / mensile" },
  {
    keys: ["Tools", "→", "Backtest"],
    action: "Allenamento su grafici storici",
  },
  { keys: ["Routine", "→", "Zona Zen"], action: "Respirazione guidata e check-in emotivo" },
];

const HELP_FAQS = [
  {
    q: "Come resetto la mia streak?",
    a: "La streak si azzera automaticamente se non esegui almeno un'azione di completamento (check-in, diario, missione) entro la giornata. Non c'è un reset manuale.",
  },
  {
    q: "Come faccio a cambiare la lingua?",
    a: "Vai in Impostazioni → Lingua e seleziona la lingua desiderata. Il cambio è immediato e si applica a tutta l'interfaccia.",
  },
  {
    q: "Posso usare l'app su più dispositivi?",
    a: "Sì. I dati sono sincronizzati tramite il tuo account. Accedi con le stesse credenziali su qualsiasi dispositivo e troverai tutto aggiornato.",
  },
  {
    q: "Come esporto i miei trade?",
    a: "Dal Diario puoi esportare le sessioni in formato ICS (calendario), da importare in qualsiasi app di calendario.",
  },
  {
    q: "Come funziona il calcolo del lot size?",
    a: "In Tools → Calcolatore imposti il tuo capitale, il rischio percentuale e lo stop loss in pips. Il sistema calcola automaticamente il lot size corretto per il pair selezionato.",
  },
  {
    q: "Cosa succede se cambio il PIN e lo dimentico?",
    a: "Il PIN è memorizzato localmente. Se lo dimentichi puoi resettarlo dalla pagina delle impostazioni usando l'opzione «Rimuovi PIN» (richiede di conoscere quello attuale).",
  },
];

export function HelpSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      <AppTutorialWizard
        open={tutorialOpen}
        onSkip={() => setTutorialOpen(false)}
        onFinish={() => setTutorialOpen(false)}
      />

      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {t("settings.help.review_tutorial")}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {t("settings.help.review_tutorial_desc")}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setTutorialOpen(true)}
          >
            {t("settings.help.review_tutorial")}
          </Button>
        </div>
      </div>

      {/* Quick start */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Guida rapida — primi passi
        </h3>
        <div className="space-y-3">
          {QUICK_STEPS.map((s) => (
            <div
              key={s.n}
              className="flex gap-4 p-4 rounded-xl border border-border/40 bg-secondary/20"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm font-mono">
                {s.n}
              </div>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation shortcuts */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Percorsi rapidi
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SHORTCUT_ITEMS.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-3 rounded-xl border border-border/30 bg-secondary/10"
            >
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                {item.keys.map((k, ki) => (
                  <span key={ki} className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold bg-card border border-border px-1.5 py-0.5 rounded text-foreground whitespace-nowrap">
                      {k}
                    </span>
                    {ki < item.keys.length - 1 && (
                      <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
                    )}
                  </span>
                ))}
              </div>
              <span className="text-xs text-muted-foreground ml-auto shrink-0 text-right">
                {item.action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Domande frequenti
        </h3>
        <div className="space-y-2">
          {HELP_FAQS.map((item, i) => (
            <div
              key={i}
              className="border border-border/40 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
              >
                <span className="text-sm font-medium pr-4">{item.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
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
                    <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border/30 bg-secondary/10">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Hai ancora bisogno di aiuto?
        </h3>
        <a
          href="mailto:assistenza@traderloading.com?subject=Richiesta%20assistenza"
          className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-secondary/20 hover:border-purple-400/30 hover:bg-secondary/40 transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <CircleHelp className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{uiText("settings.support.contact")}</p>
            <p className="text-xs text-muted-foreground">
              assistenza@traderloading.com
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-purple-400 transition-colors" />
        </a>
      </div>
    </div>
  );
}

// ─── Terms & Conditions Section ────────────────────────────────────────────────
