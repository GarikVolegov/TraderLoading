import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Copy, Check, Users, LockKeyhole, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { fetchReferral, referralKey } from "@/lib/referralApi";
import { fetchAcademyBilling, academyKeys } from "@/lib/academyApi";
import { SigilIcon } from "@/components/ui/SigilIcon";

export function ReferralSettingsSection() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: referralKey(),
    queryFn: () => fetchReferral(),
    retry: false,
  });

  const { data: billing } = useQuery({
    queryKey: academyKeys.billing,
    queryFn: fetchAcademyBilling,
    retry: false,
  });

  const activeGuided =
    billing?.affiliate.activeGuidedMembersCount ?? data?.referrals ?? 0;
  const currentGrade = billing?.affiliate.currentGradeNumber ?? 1;
  const mandateUnlocked =
    billing?.affiliate.expansionMandateUnlocked ??
    (Boolean(billing?.affiliate.enrolled) || currentGrade >= 2);
  const progressPct = Math.min(100, Math.round((activeGuided / 5) * 100));
  const monthlyRoyaltyEur = activeGuided * 30;

  // Prefer the Academy Codice di Chiamata link when enrolled, otherwise fallback to the operator referral link
  const rawPath = billing?.affiliate.link ?? data?.link ?? "";
  const inviteUrl = rawPath
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${rawPath}`
    : "";

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast({ title: t("referral.copied") });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is still selectable */
    }
  }

  return (
    <div className="tl-panel rounded-2xl border border-[#26262E] bg-[#141418]/90 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059]">
            <SigilIcon name="grade-2" size={16} />
          </div>
          <div>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#C5A059]">
              TRIBUTO DI ACCESSO: 150€/MESE · ROYALTY 20% SINGLE-TIER (30€/MESE)
            </span>
            <h2 className="font-display text-base font-bold text-[#F4F4F6]">
              Il Mandato di Espansione (Codice di Chiamata)
            </h2>
          </div>
        </div>
        <span className="rounded border border-[#C5A059]/30 bg-[#0A0A0C] px-2.5 py-1 font-mono text-[10px] uppercase text-[#C5A059]">
          GRADO {currentGrade} · {mandateUnlocked ? "ABILITATO" : " SBLOCCO AL GRADO II"}
        </span>
      </div>

      <div className="rounded-xl border border-[#C5A059]/30 bg-[#0A0A0C]/90 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#C5A059]">ROYALTY RICORRENTE ATTIVA: {monthlyRoyaltyEur}€ / MESE</span>
          <span className="text-[#F4F4F6]">{activeGuided} / 5 MEMBRI</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full border border-[#26262E] bg-[#141418]">
          <div
            className="h-full bg-[#C5A059] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs leading-relaxed text-[#F4F4F6]">
          Membri guidati: <strong>{activeGuided} / 5</strong> per l&apos;esenzione totale dal Tributo Mensile (150€/mese coperti). Oltre i 5 membri: Rendita di Espansione netta.
        </p>
      </div>

      {!mandateUnlocked && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#8B1E1E]/50 bg-[#8B1E1E]/15 p-3 text-xs text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#C5A059]" />
          <span>
            Il <strong>Codice di Chiamata</strong> è generabile dagli Operatori che hanno raggiunto almeno il{" "}
            <strong>Grado II (Il Custode della Regola)</strong> dopo 30 sessioni consecutive con Indice di Integrità al 100%, oppure su sblocco Admin.
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> …
        </div>
      ) : data || billing ? (
        <div className="space-y-3">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Codice di Chiamata (Single-Tier 20% · 1 Livello Diretto)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={
                mandateUnlocked && inviteUrl
                  ? inviteUrl
                  : "BLOCCATO — Raggiungi il Grado II (Il Custode della Regola) o attiva in Dottrina del Tempo"
              }
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Codice di Chiamata"
              className="flex-1 min-w-0 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground/90"
            />
            <Button
              size="sm"
              onClick={copy}
              disabled={!mandateUnlocked || !inviteUrl}
              className="shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1.5">Copia Codice</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>Operatori guidati direttamente: {activeGuided}</span>
            </div>
            <Link
              href="/academy?tab=affiliate"
              className="inline-flex items-center gap-1 font-medium text-[#C5A059] hover:underline"
            >
              Gestisci Mandato di Espansione e Rendite
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("referral.error")}</p>
      )}
    </div>
  );
}
