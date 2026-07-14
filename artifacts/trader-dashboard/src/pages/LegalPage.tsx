import { Link } from "wouter";
import { FileText, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { Seo } from "@/components/Seo";
import { absoluteUrl } from "@/lib/seo";

type LegalPageProps = {
  kind: "privacy" | "terms";
};

const UPDATED_AT_ISO = "2026-06-10";

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
  const { t } = useLanguage();
  return (
    <>
      <LegalBlock title={uiText("auto.ui.d030bfc02f")}>
        <p>{t("legal.privacy.data1")}</p>
        <p>{t("legal.privacy.data2")}</p>
      </LegalBlock>

      <LegalBlock title={uiText("auto.ui.8047f34324")}>
        <p>{t("legal.privacy.use1")}</p>
        <p>{t("legal.privacy.use2")}</p>
      </LegalBlock>

      <LegalBlock title={uiText("auto.ui.3b9ea39a32")}>
        <p>{t("legal.privacy.rights1")}</p>
        <p>{t("legal.privacy.rights2")}</p>
      </LegalBlock>

      <LegalBlock title={uiText("legal.privacy_contacts")}>
        <p>{t("legal.privacy.contact_intro")}</p>
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
  const { t } = useLanguage();
  return (
    <>
      <LegalBlock title={uiText("auto.ui.8133c4c74f")}>
        <p>{t("legal.terms.service1")}</p>
      </LegalBlock>

      <LegalBlock title={uiText("auto.ui.2f936a4626")}>
        <p>{t("legal.terms.risk1")}</p>
      </LegalBlock>

      <LegalBlock title={uiText("auto.ui.c39cf6613d")}>
        <p>{t("legal.terms.resp1")}</p>
      </LegalBlock>

      <LegalBlock title={uiText("auto.ui.fc7746fb89")}>
        <p>{t("legal.terms.changes1")}</p>
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
  const { t, language } = useLanguage();

  const updatedAt = new Date(UPDATED_AT_ISO).toLocaleDateString(language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-8 text-foreground sm:px-6">
      <Seo
        title={t(isPrivacy ? "legal.meta.privacy_title" : "legal.meta.terms_title")}
        description={t(isPrivacy ? "legal.meta.privacy_desc" : "legal.meta.terms_desc")}
        lang={language}
        canonical={absoluteUrl(isPrivacy ? "/privacy" : "/terms")}
      />
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
                {t(isPrivacy ? "legal.title.privacy" : "legal.title.terms")}
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("legal.updated", { date: updatedAt })}
          </p>
        </header>

        {isPrivacy ? <PrivacyContent /> : <TermsContent />}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/45 py-5 text-sm text-muted-foreground">
          <span>{uiText("auto.ui.1afd756360")}</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              {t("legal.footer.privacy")}
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              {t("legal.footer.terms")}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
