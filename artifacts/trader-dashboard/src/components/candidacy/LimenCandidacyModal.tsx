import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "wouter";
import { apiJSON } from "@/lib/apiFetch";
import { getStoredStealthReferral } from "@/lib/stealthTracking";
import { trackEvent } from "@/lib/analytics";
import {
  LIMEN_SERVICES,
  LIMEN_TIERS,
  calculateLimenServicesPricing,
  type LimenBillingCycle,
  type LimenServiceId,
  type LimenTierId,
} from "../../../../../contracts/limenServices";
import {
  ShieldCheck,
  FlaskConical,
  Coins,
  GraduationCap,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { SigilIcon } from "@/components/ui/SigilIcon";

interface LimenCandidacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
  defaultBillingCycle?: LimenBillingCycle;
  defaultTierId?: LimenTierId;
}

function getServicesForTier(tierId: LimenTierId): LimenServiceId[] {
  const tier = LIMEN_TIERS.find((t) => t.id === tierId);
  return tier ? [...tier.includedServices] : ["base_protocol"];
}

export function LimenCandidacyModal({
  isOpen,
  onClose,
  defaultEmail = "",
  defaultBillingCycle = "monthly",
  defaultTierId = "founders_10",
}: LimenCandidacyModalProps) {
  const qc = useQueryClient();
  const requestKey = useRef<string | null>(null);
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formUid = useId();

  const [billingCycle, setBillingCycle] = useState<LimenBillingCycle>(defaultBillingCycle);
  const [selectedServices, setSelectedServices] = useState<LimenServiceId[]>(() =>
    getServicesForTier(defaultTierId),
  );

  useEffect(() => {
    if (isOpen) {
      setBillingCycle(defaultBillingCycle);
      setSelectedServices(getServicesForTier(defaultTierId));
    }
  }, [isOpen, defaultBillingCycle, defaultTierId]);

  const [record, setRecord] = useState<{
    candidateCode: string;
    status: string;
    selectedServices?: string[];
  } | null>(null);

  const selectTier = (tierId: LimenTierId) => {
    setSelectedServices(getServicesForTier(tierId));
  };

  const toggleService = (id: LimenServiceId) => {
    if (id === "base_protocol") return; // Base cannot be deselected
    if (id === "doctrine_of_time") {
      setSelectedServices((prev) =>
        prev.includes("doctrine_of_time")
          ? ["base_protocol", "forge_of_the_past", "financial_architecture"]
          : ["base_protocol", "forge_of_the_past", "financial_architecture", "doctrine_of_time"],
      );
      return;
    }
    // Toggling either forge_of_the_past or financial_architecture toggles the 10€ Prime Persone bundle
    setSelectedServices((prev) => {
      const hasFounders =
        prev.includes("forge_of_the_past") || prev.includes("financial_architecture");
      if (hasFounders && !prev.includes("doctrine_of_time")) {
        return ["base_protocol"];
      }
      return ["base_protocol", "forge_of_the_past", "financial_architecture"];
    });
  };

  const pricing = calculateLimenServicesPricing(selectedServices, billingCycle);

  const getServiceIcon = (id: LimenServiceId) => {
    switch (id) {
      case "base_protocol":
        return <ShieldCheck className="h-5 w-5 text-[#C5A059]" />;
      case "forge_of_the_past":
        return <FlaskConical className="h-5 w-5 text-[#C5A059]" />;
      case "financial_architecture":
        return <Coins className="h-5 w-5 text-[#C5A059]" />;
      case "doctrine_of_time":
        return <GraduationCap className="h-5 w-5 text-[#C5A059]" />;
    }
  };

  const handleCompleteAndEnter = () => {
    onClose();
    navigate("/");
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto border border-[#C5A059]/40 bg-[#0d0f14] p-5 text-[#F4F4F6] shadow-[0_20px_80px_rgba(0,0,0,0.9)] sm:p-7 scrollbar-thin scrollbar-thumb-[#C5A059]/30">
        <DialogHeader className="space-y-2 border-b border-[#C5A059]/20 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#C5A059]/40 bg-[#07080b] text-[#C5A059]">
              <SigilIcon variant="threshold" size={22} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#C5A059]">
                LA SOGLIA DI SELEZIONE · CANDIDATURA UFFICIALE
              </p>
              <DialogTitle className="font-serif text-xl font-bold tracking-wide text-[#F4F4F6] sm:text-2xl">
                Configurazione della Dotazione d'Ordine
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-[#94a3b8] leading-relaxed">
            Seleziona la dotazione iniziale per entrare nel Protocollo LIMEN. L'accesso iniziale
            include di diritto Il Varco, Il Libro della Verità, La Fratellanza e i 5 Gradi di Ascesa.
          </DialogDescription>
        </DialogHeader>

        {record ? (
          <div role="status" className="space-y-5 border border-[#C5A059]/40 bg-[#11131c] p-6 rounded-lg text-center my-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]">
              <Check className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-xl font-bold tracking-wide text-[#E8C56A]">
                Candidatura Ricevuta dal Concilio
              </h3>
              <p className="font-mono text-xs text-[#94a3b8]">
                Identificativo Operatore Ufficiale:
              </p>
              <p className="font-mono text-2xl font-bold tracking-wider text-[#F4F4F6]">
                {record.candidateCode}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-y border-[#C5A059]/20 py-3 text-left font-mono text-xs">
              <div>
                <span className="text-[#94a3b8]">Stato:</span>{" "}
                <span className="font-bold text-[#E8C56A] uppercase">
                  {record.status === "ammesso" ? "Ammesso" : "In Valutazione"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[#94a3b8]">Dotazione:</span>{" "}
                <span className="font-bold text-[#F4F4F6] whitespace-nowrap">
                  {pricing.formattedSummary}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#94a3b8] leading-relaxed max-w-lg mx-auto">
              La tua richiesta è stata registrata. Il Pacchetto Base è attivo di diritto: puoi iniziare
              subito a operare su <strong className="text-white">Il Varco</strong> e registrare le tue sessioni su <strong className="text-white">Il Libro della Verità</strong>.
            </p>

            <Button
              type="button"
              onClick={handleCompleteAndEnter}
              className="w-full bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080b] font-mono font-bold uppercase tracking-wider py-3 shadow-[0_0_20px_rgba(197,160,89,0.25)] transition-all"
            >
              Accedi al Varco <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <form
            className="space-y-6 pt-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              const form = new FormData(event.currentTarget);
              requestKey.current ??= crypto.randomUUID();
              setBusy(true);
              setError("");

              try {
                const data = await apiJSON<{
                  candidate: {
                    candidateCode: string;
                    status: string;
                    selectedServices?: string[];
                  };
                }>("candidate-applications", {
                  method: "POST",
                  body: JSON.stringify({
                    name: form.get("name"),
                    email: form.get("email"),
                    contactType: form.get("contactType"),
                    contactHandle: form.get("contactHandle"),
                    situation: form.get("situation"),
                    obstacle: form.get("obstacle"),
                    commitment: form.get("commitment"),
                    planChosen: pricing.tierId,
                    billingCycle,
                    selectedServices: pricing.selectedIds,
                    requestKey: requestKey.current,
                    referredBy: getStoredStealthReferral(),
                  }),
                });
                const submittedEmail = String(form.get("email") ?? "").trim().toLowerCase();
                if (submittedEmail) {
                  try {
                    localStorage.setItem("limen_candidate_email", submittedEmail);
                  } catch {}
                }
                setRecord(data.candidate);
                qc.invalidateQueries({ queryKey: ["limen-entitlements"] });
                trackEvent("protocol_candidacy_submitted");
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Invio non riuscito. Riprova: i dati rimangono salvati nel modulo.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {/* SELEZIONE DEI SERVIZI D'ORDINE */}
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#C5A059]">
                  1. Configura Piano e Cadenza di Protocollo
                </span>

                {/* Toggle Mensile / Annuale */}
                <div className="inline-flex items-center rounded-md border border-[#C5A059]/35 bg-[#07080b] p-0.5">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                      billingCycle === "monthly"
                        ? "bg-[#C5A059] text-[#07080b]"
                        : "text-[#94a3b8] hover:text-[#F4F4F6]"
                    }`}
                  >
                    Cadenza Mensile
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("yearly")}
                    className={`rounded px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                      billingCycle === "yearly"
                        ? "bg-[#C5A059] text-[#07080b]"
                        : "text-[#94a3b8] hover:text-[#F4F4F6]"
                    }`}
                  >
                    Annuale · 2 Mesi Omaggio
                  </button>
                </div>
              </div>

              {/* Selettore Rapido dei 3 Piani */}
              <div className="grid gap-2.5 sm:grid-cols-3">
                {LIMEN_TIERS.map((tier) => {
                  const isActiveTier = pricing.tierId === tier.id;
                  const priceLabel =
                    billingCycle === "yearly" ? tier.yearlyDisplay : tier.monthlyDisplay;

                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => selectTier(tier.id)}
                      className={`flex flex-col justify-between rounded-lg border p-3 text-left transition-all ${
                        isActiveTier
                          ? "border-[#E8C56A] bg-[#161822] shadow-[0_0_16px_rgba(197,160,89,0.18)] ring-1 ring-[#E8C56A]/50"
                          : "border-[#C5A059]/20 bg-[#11131c] hover:border-[#C5A059]/45"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="rounded border border-[#C5A059]/35 bg-[#C5A059]/15 px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-[#E8C56A] whitespace-nowrap">
                            {tier.badge}
                          </span>
                          <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                              isActiveTier
                                ? "border-[#C5A059] bg-[#C5A059] text-[#07080b]"
                                : "border-[#475569] bg-[#07080b]"
                            }`}
                          >
                            {isActiveTier && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </div>
                        </div>
                        <p className="font-mono text-xs font-bold text-[#F4F4F6] leading-tight">
                          {tier.title}
                        </p>
                      </div>
                      <div className="mt-2.5 border-t border-[#C5A059]/15 pt-2 flex items-baseline justify-between gap-1">
                        <span className="font-mono text-xs font-bold text-[#E8C56A] whitespace-nowrap">
                          {priceLabel}
                        </span>
                        {billingCycle === "yearly" && tier.yearlySavingsEur > 0 && (
                          <span className="font-mono text-[9px] text-[#10b981] whitespace-nowrap">
                            Risparmi {tier.yearlySavingsEur}€
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dettaglio Moduli Inclusi */}
              <div className="grid gap-3 sm:grid-cols-2">
                {LIMEN_SERVICES.map((service) => {
                  const isSelected = pricing.selectedIds.includes(service.id);
                  const isBase = service.id === "base_protocol";
                  const badgePrice =
                    billingCycle === "yearly"
                      ? service.priceYearlyDisplay
                      : service.priceDisplay;

                  return (
                    <div
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={`relative flex flex-col justify-between rounded-lg border p-3.5 transition-all select-none ${
                        isBase
                          ? "border-[#C5A059]/60 bg-[#161822] cursor-default ring-1 ring-[#C5A059]/30"
                          : isSelected
                            ? "border-[#E8C56A] bg-[#161822] shadow-[0_0_15px_rgba(197,160,89,0.15)] ring-1 ring-[#E8C56A]/50 cursor-pointer"
                            : "border-[#C5A059]/20 bg-[#11131c] hover:border-[#C5A059]/40 hover:bg-[#141620] cursor-pointer"
                      }`}
                    >
                      {/* Header Card */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#C5A059]/30 bg-[#07080b]">
                              {getServiceIcon(service.id)}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-mono text-xs font-bold text-[#F4F4F6] tracking-tight">
                                {service.shortTitle}
                              </h4>
                              {isBase && (
                                <span className="font-mono text-[9px] uppercase tracking-wider text-[#C5A059]">
                                  Dotazione Base Inclusa
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                                isBase
                                  ? "bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981]"
                                  : isSelected
                                    ? "bg-[#C5A059]/20 border border-[#C5A059]/50 text-[#E8C56A]"
                                    : "bg-[#07080b] border border-[#26262E] text-[#94a3b8]"
                              }`}
                            >
                              {badgePrice}
                            </span>
                            <div
                              className={`flex h-4 w-4 items-center justify-center rounded border ${
                                isSelected
                                  ? "border-[#C5A059] bg-[#C5A059] text-[#07080b]"
                                  : "border-[#475569] bg-[#07080b]"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#94a3b8] leading-tight">
                          {service.subtitle}
                        </p>
                      </div>

                      {/* Feature Bullets */}
                      <div className="mt-2.5 space-y-1 border-t border-[#C5A059]/15 pt-2">
                        {service.features.map((feature, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 text-[10.5px] text-[#D0D0D8]"
                          >
                            <span className="h-1 w-1 shrink-0 rounded-full bg-[#C5A059]" />
                            <span className="truncate">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RIEPILOGO FINANZIARIO SINTETICO */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#C5A059]/40 bg-[#07080b] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#C5A059]" />
                  <span className="font-mono text-xs uppercase tracking-wider text-[#94a3b8]">
                    Piano Selezionato:
                  </span>
                  <span className="font-mono text-xs font-bold text-[#F4F4F6]">
                    {pricing.tierTitle}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="font-bold text-[#E8C56A] whitespace-nowrap">
                    {pricing.activeDisplay}
                  </span>
                  {billingCycle === "yearly" && pricing.yearlySavingsEur > 0 && (
                    <span className="rounded border border-[#10b981]/35 bg-[#10b981]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#10b981] whitespace-nowrap">
                      Risparmi {pricing.yearlySavingsEur} € · 2 Mesi Omaggio
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* DATI CANDIDATO */}
            <div className="space-y-3 border-t border-[#C5A059]/20 pt-4">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#C5A059]">
                2. Dati dell'Operatore Candidato
              </span>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-xs font-mono tracking-wider text-[#A0A0AA] uppercase">
                  Nome Completo
                  <Input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Es. Marco Rossi"
                    className="bg-[#11131c] border-[#2A2A34] focus:border-[#C5A059] text-[#F4F4F6] text-xs"
                  />
                </label>

                <label className="block space-y-1 text-xs font-mono tracking-wider text-[#A0A0AA] uppercase">
                  Email Account LIMEN
                  <Input
                    name="email"
                    type="email"
                    defaultValue={defaultEmail}
                    autoComplete="email"
                    required
                    maxLength={254}
                    placeholder="operatore@esempio.it"
                    className="bg-[#11131c] border-[#2A2A34] focus:border-[#C5A059] text-[#F4F4F6] text-xs"
                  />
                </label>

                <label className="block space-y-1 text-xs font-mono tracking-wider text-[#A0A0AA] uppercase">
                  Canale di Contatto
                  <select
                    name="contactType"
                    className="w-full h-9 px-3 rounded-md bg-[#11131c] border border-[#2A2A34] text-[#F4F4F6] text-xs focus:border-[#C5A059] outline-none"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </label>

                <label className="block space-y-1 text-xs font-mono tracking-wider text-[#A0A0AA] uppercase">
                  Recapito (Numero o @Username)
                  <Input
                    name="contactHandle"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="+39 340... o @username"
                    className="bg-[#11131c] border-[#2A2A34] focus:border-[#C5A059] text-[#F4F4F6] text-xs"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <label className="block space-y-1 text-xs font-mono tracking-wider text-[#A0A0AA] uppercase">
                  Esperienza Operativa
                  <Textarea
                    name="situation"
                    required
                    maxLength={500}
                    placeholder="Breve sintesi: da quanto operi e su quali asset?"
                    className="bg-[#11131c] border-[#2A2A34] focus:border-[#C5A059] text-[#F4F4F6] min-h-[55px] text-xs"
                  />
                </label>

                <label className="block space-y-1 text-xs font-mono tracking-wider text-[#A0A0AA] uppercase">
                  Ostacolo da Risolvere
                  <Textarea
                    name="obstacle"
                    required
                    maxLength={500}
                    placeholder="Cosa mina la tua disciplina (es. overtrading, fomo, stop loss)?"
                    className="bg-[#11131c] border-[#2A2A34] focus:border-[#C5A059] text-[#F4F4F6] min-h-[55px] text-xs"
                  />
                </label>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-[#C0C0C8] leading-relaxed cursor-pointer pt-2">
                <input
                  id={`${formUid}-commitment`}
                  className="mt-0.5 accent-[#C5A059]"
                  type="checkbox"
                  required
                  name="commitment"
                  value="Confermo adesione volontaria al Protocollo LIMEN"
                />
                <span>
                  Dichiaro di sottopormi volontariamente al Protocollo LIMEN, accettando di
                  registrare le operazioni con rigore e rispettare L'Ordine Giornaliero.
                </span>
              </label>

              <p className="text-[10.5px] text-[#7A7A85] flex items-center justify-between">
                <span>
                  Dati gestiti secondo la disciplina di riservatezza.{" "}
                  <Link href="/privacy" className="text-[#C5A059] underline">
                    Informativa Privacy
                  </Link>
                  .
                </span>
                <span className="font-mono text-[#E8C56A] text-[10px]">
                  Nessun addebito automatico
                </span>
              </p>

              {error && (
                <p role="alert" className="text-xs text-[#ef4444] font-mono">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080b] font-mono font-bold tracking-[0.16em] uppercase py-3 rounded-md shadow-[0_0_20px_rgba(197,160,89,0.25)] transition-all"
              >
                {busy ? "Registrazione Candidatura…" : "Invia Candidatura & Accedi al Varco"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
