import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Target, ChevronDown, Library, ExternalLink, LifeBuoy, Mail, MessageSquare, BookOpen, Zap } from "lucide-react";
import { Link } from "wouter";
import { uiText } from "@/contexts/LanguageContext";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Come funziona il sistema de I 5 Gradi di Ascesa e l'Indice di Integrità?",
    a: "L'Indice di Integrità cresce rispettando L'Ordine Giornaliero, mantenendo la costanza operativa, superando Il Custode della Soglia e documentando ogni esecuzione ne Il Libro della Verità. L'ascesa attraverso I 5 Gradi sblocca i manoscritti de La Dottrina del Tempo.",
  },
  {
    q: "Come attivo le notifiche push?",
    a: "Vai in Dossier dell'Operatore → Notifiche, poi attiva il toggle principale. Riceverai avvisi solenni all'apertura delle sessioni di mercato e per le comunicazioni de La Fratellanza.",
  },
  {
    q: "Come funzionano le sessioni operative?",
    a: "In Dossier dell'Operatore → Trading puoi configurare gli orari per Londra, New York e Asia. A ogni apertura riceverai un richiamo disciplinare per presidiare Il Varco.",
  },
  {
    q: "Dove vengono custoditi i miei dati?",
    a: "Tutti i dati (Il Libro della Verità, L'Ordine Giornaliero, Dossier dell'Operatore) sono custoditi in modo persistente nel database crittografato e sincronizzati su tutti i tuoi dispositivi.",
  },
  {
    q: "Come elevo il mio Indice di Integrità?",
    a: "Mantieni la costanza giornaliera senza cadere ne La Deriva, completa L'Ordine Giornaliero, valida ogni ingresso con Il Custode della Soglia e sigilla le sessioni ne Il Libro della Verità.",
  },
  {
    q: "Cosa sono i manoscritti de La Dottrina del Tempo?",
    a: "Progredendo lungo I 5 Gradi di Ascesa sblocchi trattati operativi, PDF e lezioni su architettura del rischio, liquidità istituzionale e dominio emotivo.",
  },
  {
    q: "Come funziona La Fratellanza (Agorà dell'Ordine)?",
    a: "La Fratellanza ti connette agli altri Operatori dell'Ordine. Puoi condividere analisi, dispacci vocali, grafici e consultare La Gerarchia dell'Integrità.",
  },
  {
    q: "Come imposto il PIN di sicurezza?",
    a: "Vai in Dossier dell'Operatore → Sicurezza → Imposta PIN. Dopo l'attivazione, il protocollo richiederà il codice di accesso a ogni avvio della sessione.",
  },
];

const FEATURE_GUIDES: { icon: ReactNode; title: string; desc: string }[] =
  [
    {
      icon: <BookOpen className="w-4 h-4" />,
      title: "Il Libro della Verità",
      desc: "Sigilla ogni operazione con riflessioni, stato psicofisico e grafici. Estrai pattern oggettivi dalla tua esecuzione.",
    },
    {
      icon: <Target className="w-4 h-4" />,
      title: "L'Ordine Giornaliero",
      desc: "Completa i rituali operativi quotidiani per consolidare l'Indice di Integrità e preservare la costanza.",
    },
    {
      icon: <TrendingUp className="w-4 h-4" />,
      title: "Il Custode della Soglia",
      desc: "Valida ogni operazione prima dell'esecuzione. Nessun ordine entra a mercato senza conformità al protocollo.",
    },
    {
      icon: <Zap className="w-4 h-4" />,
      title: "La Forgia del Passato",
      desc: "Addestra l'occhio sul Banco di Forgiatura storico e affronta Le Prove del Fuoco contro altri Operatori.",
    },
    {
      icon: <MessageSquare className="w-4 h-4" />,
      title: "La Fratellanza",
      desc: "Confrontati nell'Agorà dell'Ordine. Condividi analisi istituzionali e consulta La Gerarchia dell'Integrità.",
    },
    {
      icon: <Library className="w-4 h-4" />,
      title: "La Dottrina del Tempo",
      desc: "Ascendi lungo I 5 Gradi per sbloccare trattati esclusivi su gestione del rischio, liquidità e disciplina.",
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
          <Link
            href="/support"
            className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-secondary/20 hover:border-primary/30 hover:bg-secondary/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <LifeBuoy className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{uiText("support.title")}</p>
              <p className="text-xs text-muted-foreground">{uiText("support.subtitle")}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          <a
            href="mailto:assistenza@aureus-os.app"
            className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-secondary/20 hover:border-primary/30 hover:bg-secondary/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{uiText("settings.support.write")}</p>
              <p className="text-xs text-muted-foreground">
                assistenza@aureus-os.app
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>

          <a
            href="mailto:assistenza@aureus-os.app?subject=Feedback%20AUREUS"
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
          AUREUS · v1.0 · Fatto con ♥ per i trader disciplinati
        </p>
      </div>
    </div>
  );
}
