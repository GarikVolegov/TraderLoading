import { useState } from "react";
import {
  Users,
  TrendingUp,
  Calendar,
  Copy,
  Check,
  AlertOctagon,
  ShieldCheck,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";
import { calculateRoyalty } from "@/lib/stealthTracking";

interface PartnerDashboardProps {
  userId?: string;
  onOpenGatekeeping?: () => void;
}

export function PartnerDashboard({ userId = "AUREUS-OPERATOR-77" }: PartnerDashboardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [partnerMembersCount, _setPartnerMembersCount] = useState<number>(7); // Example 7 active members

  const stats = calculateRoyalty(partnerMembersCount);

  // Compute host domain dynamically
  const origin = typeof window !== "undefined" ? window.location.origin : "https://limenprotocol.com";
  const sandboxLink = `${origin}/sandbox?ref=${userId}`;
  const protocolloLink = `${origin}/protocollo?ref=${userId}`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="w-full space-y-6">
      {/* Golden Rule Banner */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/20 text-amber-400">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
                REGOLA TASSATIVA DI DISTRIBUZIONE // KIT INVISIBILE
              </span>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                ATTRIBUZIONE 60 GIORNI
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-white">Non inviare mai link di pagamento diretto.</strong> Condividi
              esclusivamente l'accesso gratuito al Capitolo 0 (Sandbox Didattica) o alla documentazione tecnica del
              Protocollo. Il sistema traccia automaticamente il tuo codice per{" "}
              <strong className="text-amber-300">60 giorni</strong> e ti accrediterà il 20% ricorrente (€30/mese) per ogni
              candidato che sbloccherà l'infrastruttura completa.
            </p>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {/* KPI 1: Membri Attivi */}
        <div className="rounded-2xl border border-[#1E2230] bg-[#0E1017] p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider">MEMBRI ATTIVI INVITATI</span>
            <Users className="h-4 w-4 text-[#10B981]" />
          </div>
          <div className="text-3xl font-black text-white">{partnerMembersCount}</div>
          <div className="text-[11px] text-[#10B981] flex items-center gap-1">
            <span>● 100% Tasso di Retention 60d</span>
          </div>
        </div>

        {/* KPI 2: Royalty Mensile Ricorrente */}
        <div className="rounded-2xl border border-[#1E2230] bg-[#0E1017] p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider">ROYALTY RICORRENTE (20%)</span>
            <TrendingUp className="h-4 w-4 text-[#06B6D4]" />
          </div>
          <div className="text-3xl font-black text-cyan-400">€{stats.monthlyRoyalty}</div>
          <div className="text-[11px] text-slate-400">
            {partnerMembersCount} × €30.00 / mese accreditati
          </div>
        </div>

        {/* KPI 3: Stato Abbonamento Personale */}
        <div className="rounded-2xl border border-[#1E2230] bg-[#0E1017] p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider">STATO QUOTA PERSONALE</span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-[#10B981] flex items-center gap-1">
            {stats.netProfit > 0 ? `+€${stats.netProfit}/M NETTI` : `COPERTO AL ${stats.coveragePercent}%`}
          </div>
          <div className="text-[11px]">
            {stats.isSelfFunded ? (
              <span className="text-[#10B981] font-semibold">AUTOFINANZIATO AL 100%</span>
            ) : (
              <span className="text-amber-400">Costo netto: €{stats.netCost}/mese</span>
            )}
          </div>
        </div>

        {/* KPI 4: Prossimo Payout */}
        <div className="rounded-2xl border border-[#1E2230] bg-[#0E1017] p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider">PROSSIMO PAYOUT</span>
            <Calendar className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-200">15 NOVEMBRE</div>
          <div className="text-[11px] text-slate-400">Bonifico SEPA / Stripe Connect</div>
        </div>
      </div>

      {/* Stealth Link Generator */}
      <div className="rounded-2xl border border-[#1E2230] bg-[#090A0F] p-6 sm:p-7 space-y-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2230] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-[#10B981]" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                Generatore Link Stealth (Cookie Persistente 60 Giorni)
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              I link incorporano il tuo ID Partner. Quando un visitatore apre una qualsiasi delle due pagine, il sistema
              imprime il cookie crittografato e ne memorizza la provenienza.
            </p>
          </div>

          <div className="font-mono text-xs text-slate-400 bg-[#11131A] px-3 py-1.5 rounded-lg border border-[#1E2230]">
            ID PARTNER: <strong className="text-[#10B981]">{userId}</strong>
          </div>
        </div>

        {/* Link 1: Sandbox Gratuita (Capitolo 0) */}
        <div className="rounded-xl border border-[#1E2230] bg-[#11131A] p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              1. LINK DIRETTO ALLA LEZIONE GRATUITA (CAPITOLO 0 - CONSIGLIATO)
            </span>
            <span className="font-mono text-[11px] text-[#10B981]">MASSIMA CONVERSIONE (ZERO ATTRITO)</span>
          </div>

          <p className="text-xs text-slate-400">
            Porta direttamente all'ambiente Sandbox con le 2 lezioni operative sbloccate e la checklist di invalidazione.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 rounded-lg border border-[#1E2230] bg-[#090A0F] px-3.5 py-2 font-mono text-xs text-slate-300 truncate select-all">
              {sandboxLink}
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(sandboxLink, "sandbox")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all ${
                copiedKey === "sandbox"
                  ? "bg-[#10B981] text-[#090A0F]"
                  : "border border-[#1E2230] bg-[#161922] text-slate-300 hover:border-[#10B981] hover:text-[#10B981]"
              }`}
            >
              {copiedKey === "sandbox" ? (
                <>
                  <Check className="h-4 w-4" />
                  COPIATO!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  COPIA LINK
                </>
              )}
            </button>
          </div>
        </div>

        {/* Link 2: Protocollo Operativo (Landing Completa) */}
        <div className="rounded-xl border border-[#1E2230] bg-[#11131A] p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#06B6D4]" />
              2. LINK AL PROTOCOLLO OPERATIVO COMPLETO
            </span>
            <span className="font-mono text-[11px] text-cyan-400">PER TRADER CON ESPERIENZA PREGRESSA</span>
          </div>

          <p className="text-xs text-slate-400">
            Apre la documentazione clinica del protocollo, il video player con i case studies e il simulatore royalty.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 rounded-lg border border-[#1E2230] bg-[#090A0F] px-3.5 py-2 font-mono text-xs text-slate-300 truncate select-all">
              {protocolloLink}
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(protocolloLink, "protocollo")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all ${
                copiedKey === "protocollo"
                  ? "bg-[#06B6D4] text-[#090A0F]"
                  : "border border-[#1E2230] bg-[#161922] text-slate-300 hover:border-[#06B6D4] hover:text-[#06B6D4]"
              }`}
            >
              {copiedKey === "protocollo" ? (
                <>
                  <Check className="h-4 w-4" />
                  COPIATO!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  COPIA LINK
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Live Referral Activity Log */}
      <div className="rounded-2xl border border-[#1E2230] bg-[#0E1017] p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-200 uppercase">
            <ShieldCheck className="h-4 w-4 text-[#10B981]" />
            REGISTRO ATTRIBUZIONI & CANDIDATURE IN TEMPO REALE
          </div>
          <span className="font-mono text-[11px] text-slate-500">AGGIORNATO A OGGI</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#1E2230] text-slate-400">
                <th className="pb-3 font-semibold">DATA ACCESSO</th>
                <th className="pb-3 font-semibold">ID CANDIDATURA</th>
                <th className="pb-3 font-semibold">DESTINAZIONE</th>
                <th className="pb-3 font-semibold">STATO PROTOCOLLO</th>
                <th className="pb-3 font-semibold text-right">ROYALTY ATTRIBUITA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2230]/60 text-slate-300">
              {[
                { date: "Oggi, 16:42", id: "LMN-92841", dest: "Sandbox (Cap. 0)", status: "Membro Attivo", royalty: "+€30/mese" },
                { date: "Ieri, 11:20", id: "LMN-84910", dest: "Protocollo", status: "Membro Attivo", royalty: "+€30/mese" },
                { date: "14 Ott, 09:15", id: "LMN-72304", dest: "Sandbox (Cap. 0)", status: "Membro Attivo", royalty: "+€30/mese" },
                { date: "11 Ott, 18:30", id: "LMN-61928", dest: "Protocollo", status: "Membro Attivo", royalty: "+€30/mese" },
                { date: "08 Ott, 14:05", id: "LMN-55192", dest: "Sandbox (Cap. 0)", status: "Membro Attivo", royalty: "+€30/mese" },
                { date: "03 Ott, 10:44", id: "LMN-48190", dest: "Protocollo", status: "Membro Attivo", royalty: "+€30/mese" },
                { date: "29 Set, 12:18", id: "LMN-33910", dest: "Sandbox (Cap. 0)", status: "Membro Attivo", royalty: "+€30/mese" },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-[#11131A] transition-colors">
                  <td className="py-3 text-slate-400">{row.date}</td>
                  <td className="py-3 font-bold text-white">{row.id}</td>
                  <td className="py-3 text-slate-400">{row.dest}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1 rounded bg-[#10B981]/15 border border-[#10B981]/30 px-2 py-0.5 text-[10px] text-[#10B981] font-bold">
                      ● {row.status}
                    </span>
                  </td>
                  <td className="py-3 text-right font-bold text-[#10B981]">{row.royalty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
