import type { ReactNode } from "react";
import { ExternalLink, Mail, FileText, Scale, ShieldCheck } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";

const TERMS_UPDATED = "24 ottobre 2026";

function TermsBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-[#26262E] bg-[#07080b]/80 p-4 hover:border-[#C5A059]/30 transition-all">
      <div className="flex items-center gap-2">
        <Scale className="w-4 h-4 text-[#C5A059] shrink-0" />
        <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#F4F4F6]">{title}</h4>
      </div>
      <div className="pl-6 font-mono text-xs text-muted-foreground/85 leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}

export function TermsSection() {
  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-7 space-y-6 shadow-xl shadow-black/40">
      {/* Header banner */}
      <div className="flex items-start justify-between gap-3 p-4 rounded-xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 via-[#11131c] to-[#07080b]">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-[#E8C56A] mt-0.5 shrink-0" />
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-wide text-[#F4F4F6]">
              Il Patto di Selezione & Condizioni del Protocollo · AUREUS
            </p>
            <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">
              Revisione dell&apos;Ordine: {TERMS_UPDATED}. L&apos;utilizzo del cockpit implica la piena accettazione della disciplina e dei vincoli stabiliti.
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex rounded border border-[#C5A059]/30 bg-[#07080b] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#E8C56A] shrink-0">
          <ShieldCheck className="w-3 h-3 mr-1 text-[#C5A059]" />
          Versione Conforme
        </span>
      </div>

      <div className="space-y-4">
        <TermsBlock title={uiText("auto.ui.ab1929adc0")}>
          <p>
            AUREUS è uno strumento sovrano di supporto alla disciplina, all&apos;architettura decisionale e all&apos;organizzazione personale per trader e operatori. Non fornisce consigli finanziari, sollecitazioni al pubblico risparmio, segnali d&apos;acquisto o raccomandazioni di investimento di alcun tipo.
          </p>
          <p>
            Qualsiasi decisione di esposizione sul mercato dei capitali è di esclusiva responsabilità dell&apos;operatore.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.4f66fb5174")}>
          <p>
            L&apos;operatività sui mercati finanziari a leva comporta un rischio strutturale elevato di perdita parziale o totale del capitale. I risultati storici registrati ne La Forgia del Passato non costituiscono garanzia di rendimento futuro.
          </p>
          <p className="text-xs bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg p-3 font-mono text-[#F4F4F6]">
            ⚠️ AUREUS declina qualsiasi responsabilità per perdite finanziarie derivanti dall&apos;esecuzione autonoma delle operazioni dell&apos;utente.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("settings.terms.data_collection")}>
          <p>
            Il sistema archivia i dati essenziali alla continuità del tracciato operativo:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground/75">
            <li>{uiText("auto.ui.d8e57f9607")}</li>
            <li>{uiText("auto.ui.c088dd722f")}</li>
            <li>
              Indirizzo IP al momento dell&apos;accesso (auditabile in Identità & Sovranità → Codice & Sicurezza)
            </li>
            <li>{uiText("auto.ui.27d7686804")}</li>
            <li>{uiText("auto.ui.d45c9040cb")}</li>
          </ul>
          <p>
            I dati sono protetti con crittografia moderna. Non vengono ceduti né monetizzati con terze parti per finalità pubblicitarie.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.032fd86405")}>
          <p>
            I dati sono utilizzati esclusivamente per alimentare la sincronizzazione real-time, la tutela dell&apos;account, la registrazione ne Il Libro della Verità e le telemetrie della Forgia.
          </p>
          <p>
            L&apos;operatore conserva il diritto assoluto di accesso, esportazione GDPR (Art. 20) o revoca/cancellazione integrale dei dati da Sovranità Account.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.f2b7cf6583")}>
          <p>
            L&apos;operatore risponde della custodia delle proprie credenziali. Il PIN locale rappresenta un ulteriore baluardo di presidio sul terminale ma non sostituisce l&apos;autenticazione principale.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.3e92bce63a")}>
          <p>
            L&apos;architettura metodologica, il Design System AUREUS, le terminologie dottrinali e i contenuti della Biblioteca d&apos;Ordine sono proprietà intellettuale protetta.
          </p>
        </TermsBlock>

        <TermsBlock title={uiText("auto.ui.5f39b18401")}>
          <p>
            Per questioni relative alla sovranità dei dati personali o note legali d&apos;Ordine:
          </p>
          <a
            href="mailto:assistenza@traderloading.com"
            className="inline-flex items-center gap-1.5 text-[#E8C56A] hover:text-[#F3D88C] transition-colors text-xs font-mono font-medium"
          >
            <Mail className="w-3.5 h-3.5 text-[#C5A059]" />
            assistenza@traderloading.com
            <ExternalLink className="w-3 h-3 text-[#C5A059]" />
          </a>
        </TermsBlock>
      </div>

      <div className="pt-2 border-t border-[#C5A059]/15 text-center">
        <p className="text-[11px] text-muted-foreground/50 font-mono">
          AUREUS PROTOCOL · Codice & Termini v2.0 · Revisione {TERMS_UPDATED}
        </p>
      </div>
    </div>
  );
}
