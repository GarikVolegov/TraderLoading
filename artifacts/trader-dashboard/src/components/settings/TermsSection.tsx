import type { ReactNode } from "react";
import { ExternalLink, Mail, FileText, Scale } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";

const TERMS_UPDATED = "2 maggio 2025";

function TermsBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Scale className="w-4 h-4 text-pink-400 shrink-0" />
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
      </div>
      <div className="pl-6 text-sm text-muted-foreground leading-relaxed space-y-1.5">
        {children}
      </div>
    </div>
  );
}

export function TermsSection() {
  return (
    <div className="space-y-8">
      {/* Header banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-pink-500/20 bg-pink-500/5">
        <FileText className="w-5 h-5 text-pink-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Termini di utilizzo · TraderLoading
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ultimo aggiornamento: {TERMS_UPDATED}. Utilizzando l'app accetti i
            termini descritti di seguito.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <TermsBlock title={uiText("auto.ui.ab1929adc0")}>
          <p>
            TraderLoading è uno strumento di supporto alla disciplina e
            all'organizzazione personale per trader. Non fornisce consigli
            finanziari, segnali di trading o raccomandazioni di investimento di
            alcun tipo.
          </p>
          <p>
            Qualsiasi decisione di acquisto o vendita di strumenti finanziari è
            esclusiva responsabilità dell'utente.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.4f66fb5174")}>
          <p>
            Il trading su mercati finanziari comporta un rischio elevato di
            perdita del capitale. I risultati passati non garantiscono risultati
            futuri. Le funzionalità dell'app (calcolatore, backtest, diario)
            sono strumenti educativi e organizzativi, non sistemi di trading
            automatico.
          </p>
          <p className="text-xs bg-secondary/40 border border-border/40 rounded-lg p-3 font-mono">
            ⚠️ Non siamo responsabili per perdite finanziarie derivanti
            dall'utilizzo dell'app.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("settings.terms.data_collection")}>
          <p>
            L'app raccoglie e archivia i seguenti dati personali dell'utente:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>{uiText("auto.ui.d8e57f9607")}</li>
            <li>{uiText("auto.ui.c088dd722f")}</li>
            <li>
              Indirizzo IP al momento dell'accesso (visibile in Sicurezza →
              Accessi recenti)
            </li>
            <li>{uiText("auto.ui.27d7686804")}</li>
            <li>{uiText("auto.ui.d45c9040cb")}</li>
          </ul>
          <p>
            I dati sono archiviati in database sicuri. Non vengono venduti né
            condivisi con terze parti per scopi commerciali. Possono essere
            utilizzati in forma anonima e aggregata per migliorare l'app.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.032fd86405")}>
          <p>
            Usiamo i dati per fornire autenticazione, sincronizzazione,
            sicurezza dell'account, notifiche operative e funzioni di diario,
            backtest, community e broker. Non vendiamo dati personali e non li
            usiamo per pubblicita comportamentale.
          </p>
          <p>
            Puoi chiedere accesso, esportazione, rettifica o cancellazione dei
            dati da Impostazioni → Account oppure scrivendo a
            assistenza@traderloading.com. I consensi facoltativi, come notifiche e
            comunicazioni prodotto, possono essere revocati in qualsiasi
            momento.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.f2b7cf6583")}>
          <p>
            L'utente è responsabile della sicurezza delle proprie credenziali.
            In caso di accesso non autorizzato è necessario contattare il
            supporto immediatamente. Il PIN locale è uno strumento aggiuntivo di
            privacy sul dispositivo e non sostituisce la password dell'account.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.3e92bce63a")}>
          <p>
            Tutti i contenuti dell'app (interfaccia, testi, grafica, logiche di
            gamification, contenuti formativi della Biblioteca) sono di
            proprietà esclusiva di TraderLoading. È vietata la riproduzione,
            copia o ridistribuzione senza autorizzazione scritta.
          </p>
          <p>
            I dati inseriti dall'utente (diario, note, obiettivi) rimangono di
            proprietà dell'utente.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.7cbeb972b3")}>
          <p>
            L'app è fornita «così com'è». Non garantiamo la disponibilità
            continua del servizio né l'assenza di bug. Non siamo responsabili
            per perdite di dati causate da eventi eccezionali (guasti hardware,
            disastri naturali, attacchi informatici).
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.b961fe3a36")}>
          <p>
            Ci riserviamo il diritto di aggiornare questi termini in qualsiasi
            momento. Le modifiche saranno comunicate tramite notifica in-app.
            L'uso continuato dell'app dopo la notifica costituisce accettazione
            dei nuovi termini.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.5f39b18401")}>
          <p>
            Per richieste relative a privacy, cancellazione dati o questioni
            legali:
          </p>
          <a
            href="mailto:assistenza@traderloading.com"
            className="inline-flex items-center gap-1.5 text-pink-400 hover:text-pink-300 transition-colors text-xs font-medium"
          >
            <Mail className="w-3.5 h-3.5" />
            assistenza@traderloading.com
            <ExternalLink className="w-3 h-3" />
          </a>
        </TermsBlock>
      </div>

      <div className="pt-2 border-t border-border/30 text-center">
        <p className="text-xs text-muted-foreground/50 font-mono">
          TraderLoading · Termini v1.0 · Aggiornato il {TERMS_UPDATED}
        </p>
      </div>
    </div>
  );
}
