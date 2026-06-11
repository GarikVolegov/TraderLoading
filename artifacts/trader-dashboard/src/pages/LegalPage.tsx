import { Link } from "wouter";
import { FileText, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";

type LegalPageProps = {
  kind: "privacy" | "terms";
};

const UPDATED_AT = "10 giugno 2026";

function LegalBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border/55 bg-card/65 p-5">
      <h2 className="flex items-center gap-2 font-mono text-lg font-bold text-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function PrivacyContent() {
  return (
    <>
      <LegalBlock title={uiText("auto.ui.d030bfc02f")}>
        <p>
          TraderLoading tratta dati di account, email, profilo, preferenze,
          sessioni di accesso, notifiche push, diario di trading, immagini
          caricate volontariamente, routine, backtest, dati community e
          connessioni broker configurate dall'utente.
        </p>
        <p>
          Le integrazioni broker sono usate per sincronizzare dati operativi e
          storico trade. Non vendiamo dati personali e non usiamo i dati per
          pubblicita comportamentale.
        </p>
      </LegalBlock>

      <LegalBlock title={uiText("auto.ui.8047f34324")}>
        <p>
          Usiamo i dati per erogare il servizio, proteggere l'account,
          sincronizzare dispositivi, inviare notifiche richieste, fornire
          supporto e rispettare obblighi legali o di sicurezza.
        </p>
        <p>
          I consensi facoltativi, come notifiche e comunicazioni prodotto,
          possono essere revocati in qualsiasi momento dalle impostazioni
          dell'app o contattando il supporto.
        </p>
      </LegalBlock>

      <LegalBlock title={uiText("auto.ui.3b9ea39a32")}>
        <p>
          Puoi richiedere accesso, rettifica, esportazione o cancellazione dei
          dati. Se hai creato un account, puoi eliminarlo direttamente da
          Impostazioni - Account - Elimina account.
        </p>
        <p>
          Alcuni log tecnici minimi possono essere conservati per sicurezza,
          antifrode o obblighi legali, nella misura necessaria.
        </p>
      </LegalBlock>

        <LegalBlock title={uiText("legal.privacy_contacts")}>
        <p>
          Per richieste GDPR, privacy o cancellazione dati puoi scrivere a:
        </p>
        <a
          href="mailto:assistenza@traderloading.com?subject=Privacy%20TraderLoading"
          className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary/80"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          assistenza@traderloading.com
        </a>
      </LegalBlock>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <LegalBlock title={uiText("auto.ui.8133c4c74f")}>
        <p>
          TraderLoading e uno strumento di produttivita per trader: journal,
          routine, backtest, news macro, notifiche operative e gestione della
          disciplina. Non fornisce consulenza finanziaria, segnali di trading o
          raccomandazioni di investimento.
        </p>
      </LegalBlock>

      <LegalBlock title={uiText("auto.ui.2f936a4626")}>
        <p>
          Il trading comporta rischio elevato di perdita del capitale. Ogni
          decisione di investimento resta esclusiva responsabilita dell'utente.
          I dati mostrati dall'app sono strumenti informativi e organizzativi.
        </p>
      </LegalBlock>

      <LegalBlock title={uiText("auto.ui.c39cf6613d")}>
        <p>
          L'utente e responsabile della sicurezza delle proprie credenziali e
          dell'accuratezza dei dati inseriti. E vietato usare l'app per attivita
          illecite, abusive o che danneggino altri utenti.
        </p>
      </LegalBlock>

      <LegalBlock title={uiText("auto.ui.fc7746fb89")}>
        <p>
          Possiamo aggiornare funzionalita e termini per ragioni operative,
          legali o di sicurezza. Le modifiche rilevanti saranno comunicate in
          app o tramite i canali disponibili.
        </p>
        <a
          href="mailto:assistenza@traderloading.com?subject=Supporto%20TraderLoading"
          className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary/80"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          assistenza@traderloading.com
        </a>
      </LegalBlock>
    </>
  );
}

export default function LegalPage({ kind }: LegalPageProps) {
  const isPrivacy = kind === "privacy";

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          TraderLoading
        </Link>

        <header className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                TraderLoading
              </p>
              <h1 className="font-mono text-3xl font-extrabold">
                {isPrivacy ? "Privacy Policy" : "Termini di Servizio"}
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Ultimo aggiornamento: {UPDATED_AT}. Questa pagina e accessibile
            pubblicamente per review store, utenti e richieste privacy.
          </p>
        </header>

        {isPrivacy ? <PrivacyContent /> : <TermsContent />}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/45 py-5 text-sm text-muted-foreground">
          <span>{uiText("auto.ui.1afd756360")}</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Termini
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
