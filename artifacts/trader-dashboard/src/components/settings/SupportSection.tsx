import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Target, ChevronDown, Library, ExternalLink, Mail, MessageSquare, BookOpen, Zap } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Come funziona il sistema di XP e livelli?",
    a: "Guadagni XP completando missioni giornaliere, mantenendo la streak, aprendo sessioni di check-in e compilando il diario. Ogni 500 XP sali di livello. Ogni 5 livelli sblocchi nuovi contenuti formativi nella Biblioteca.",
  },
  {
    q: "Come attivo le notifiche push?",
    a: "Vai in Impostazioni → Notifiche, poi attiva il toggle principale. Il browser chiederà il permesso una sola volta. Riceverai notifiche quando si aprono le tue sessioni di trading e quando ricevi messaggi in chat.",
  },
  {
    q: "Come funzionano le sessioni di trading?",
    a: "In Impostazioni → Trading puoi configurare orari personalizzati per ogni sessione (Londra, New York, Asia...). A ogni apertura ricevi un promemoria push con una citazione disciplinare.",
  },
  {
    q: "Dove vengono salvati i miei dati?",
    a: "Tutti i dati (diario, obiettivi, missioni, profilo) sono salvati in modo persistente nel database dell'app. Puoi accedere tramite autenticazione per sincronizzarli su dispositivi diversi.",
  },
  {
    q: "Come faccio a guadagnare XP velocemente?",
    a: "Mantieni la streak giornaliera (bonus crescente), completa tutte le missioni ogni giorno, usa il check-in sessione, compila il diario con riflessioni e utilizza la checklist pre-trade.",
  },
  {
    q: "Cosa sono i contenuti della Biblioteca?",
    a: "Ogni 5 livelli sblocchi video, PDF e presentazioni su psicologia del trading, risk management, Smart Money Concepts, analisi tecnica avanzata e mindset professionale. Si apriranno nel browser.",
  },
  {
    q: "Come funziona la chat?",
    a: "La chat ti mette in contatto con altri trader dell'app. Puoi inviare messaggi, immagini, note vocali ed emoji. Nelle storie puoi condividere aggiornamenti quotidiani con reply interattive.",
  },
  {
    q: "Come imposto il PIN di sicurezza?",
    a: "Vai in Impostazioni → Sicurezza → Imposta PIN. Dopo aver impostato il PIN, l'app lo richiederà ogni volta che viene aperta. Puoi disattivarlo in qualsiasi momento dalla stessa sezione.",
  },
];

const FEATURE_GUIDES: { icon: ReactNode; title: string; desc: string }[] =
  [
    {
      icon: <BookOpen className="w-4 h-4" />,
      title: "Diario di Trading",
      desc: "Registra ogni trade con riflessioni, tag emotivi e immagini. Analizza i pattern del tuo comportamento nel tempo.",
    },
    {
      icon: <Target className="w-4 h-4" />,
      title: "Missioni & Streak",
      desc: "Completa le missioni giornaliere per guadagnare XP. La streak si azzera se salti un giorno — mantienila per bonus crescenti.",
    },
    {
      icon: <TrendingUp className="w-4 h-4" />,
      title: "Sessioni & Check-in",
      desc: "Configura le sessioni di trading. Il check-in apre la sessione con una riflessione mentale e registra il tuo stato emotivo.",
    },
    {
      icon: <Zap className="w-4 h-4" />,
      title: "Backtest Visuale",
      desc: "Allenati su grafici storici in modalità replay. Simula operazioni, gestisci lo stop loss e tieni statistiche precise.",
    },
    {
      icon: <MessageSquare className="w-4 h-4" />,
      title: "Chat & Storie",
      desc: "Connettiti con altri trader. Invia messaggi, vocali, immagini. Pubblica storie quotidiane e rispondi con emoji o testo.",
    },
    {
      icon: <Library className="w-4 h-4" />,
      title: "Biblioteca Premi",
      desc: "Ogni 5 livelli sblocchi contenuti formativi esclusivi: video su mindset, PDF di analisi tecnica, presentazioni avanzate.",
    },
  ];

export function SupportSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="space-y-8">
      {/* Quick guides */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Come funziona l'app
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURE_GUIDES.map((g, i) => (
            <div
              key={i}
              className="flex gap-3 p-3 rounded-xl border border-border/40 bg-secondary/20"
            >
              <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                {g.icon}
              </div>
              <div>
                <p className="text-sm font-semibold">{g.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {g.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Domande frequenti
        </h3>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
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
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
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

      {/* Contact & feedback */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Contatti & Feedback
        </h3>
        <div className="space-y-3">
          <a
            href="mailto:assistenza@traderloading.com"
            className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-secondary/20 hover:border-primary/30 hover:bg-secondary/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{uiText("settings.support.write")}</p>
              <p className="text-xs text-muted-foreground">
                assistenza@traderloading.com
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>

          <a
            href="mailto:assistenza@traderloading.com?subject=Feedback%20TraderLoading"
            className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-secondary/20 hover:border-primary/30 hover:bg-secondary/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{uiText("settings.support.feedback")}</p>
              <p className="text-xs text-muted-foreground">
                Suggerimenti, idee, miglioramenti
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>
        </div>
      </div>

      {/* Version info */}
      <div className="pt-2 border-t border-border/30 text-center">
        <p className="text-xs text-muted-foreground/50 font-mono">
          TraderLoading · v1.0 · Fatto con ♥ per i trader disciplinati
        </p>
      </div>
    </div>
  );
}
