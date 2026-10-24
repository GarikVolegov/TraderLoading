import { useId, useRef, useState } from "react";
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
  calculateLimenServicesPricing,
  type LimenServiceId,
} from "../../../../../contracts/limenServices";
import {
  ShieldCheck,
  FlaskConical,
  Coins,
  GraduationCap,
  Check,
  ChevronRight,
  Sparkles,
  Lock,
} from "lucide-react";
import { SigilIcon } from "@/components/ui/SigilIcon";

interface LimenCandidacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export function LimenCandidacyModal({
  isOpen,
  onClose,
  defaultEmail = "",
}: LimenCandidacyModalProps) {
  const qc = useQueryClient();
  const requestKey = useRef<string | null>(null);
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formUid = useId();

  // Selected services state: base_protocol is always active
  const [selectedServices, setSelectedServices] = useState<LimenServiceId[]>([
    "base_protocol",
  ]);

  const [record, setRecord] = useState<{
    candidateCode: string;
    status: string;
    selectedServices?: string[];
  } | null>(null);

  const toggleService = (id: LimenServiceId) => {
    if (id === "base_protocol") return; // Base cannot be deselected
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const pricing = calculateLimenServicesPricing(selectedServices);

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
                    planChosen: "modular_protocol",
                    selectedServices,
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#C5A059]">
                  1. Configura la tua Dotazione di Protocollo
                </span>
                <span className="font-mono text-[10px] text-[#94a3b8]">
                  Tocca le card per aggiungere servizi
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {LIMEN_SERVICES.map((service) => {
                  const isSelected = selectedServices.includes(service.id);
                  const isBase = service.id === "base_protocol";

                  return (
                    <div
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={`relative flex flex-col justify-between rounded-lg border p-4 transition-all select-none ${
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
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded border border-[#C5A059]/30 bg-[#07080b]">
                              {getServiceIcon(service.id)}
                            </span>
                            <div>
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

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-mono text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                                isBase
                                  ? "bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981]"
                                  : isSelected
                                    ? "bg-[#C5A059]/20 border border-[#C5A059]/50 text-[#E8C56A]"
                                    : "bg-[#07080b] border border-[#26262E] text-[#94a3b8]"
                              }`}
                            >
                              {service.priceDisplay}
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
                      <div className="mt-3 space-y-1 border-t border-[#C5A059]/15 pt-2.5">
                        {service.features.map((feature, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 text-[10.5px] text-[#D0D0D8]"
                          >
                            <span className="h-1 w-1 rounded-full bg-[#C5A059]" />
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
                    Quota Dotazione Calcolata:
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#94a3b8]">Mensile:</span>
                    <span className="font-bold text-[#E8C56A] whitespace-nowrap">
                      {pricing.monthlyFeeCents > 0
                        ? pricing.monthlyDisplay
                        : "0 €/mese (Base)"}
                    </span>
                  </div>
                  {pricing.oneTimeFeeCents > 0 && (
                    <div className="flex items-center gap-1.5 border-l border-[#26262E] pl-3">
                      <span className="text-[#94a3b8]">Una Tantum:</span>
                      <span className="font-bold text-[#E8C56A] whitespace-nowrap">
                        {pricing.oneTimeDisplay}
                      </span>
                    </div>
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
