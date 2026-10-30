import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoredSemAttribution, type SemAttributionRecord } from "@/lib/semAttribution";
import { INDEXNOW_HOST, INDEXNOW_KEY } from "../../../scripts/submit-indexnow";
import {
  Sparkles,
  Bot,
  Target,
  Globe,
  Share2,
  CheckCircle2,
  Radio,
  ExternalLink,
} from "lucide-react";

export function AdminExpansionTelemetry() {
  const [attribution, setAttribution] = useState<SemAttributionRecord | null>(null);

  const { data: serverStats } = useQuery({
    queryKey: ["admin", "expansion-telemetry"],
    queryFn: async () => {
      const res = await fetch("/api/admin/expansion-telemetry");
      if (!res.ok) return null;
      return res.json() as Promise<{
        totalTracked: number;
        byChannel: Record<string, number>;
        topAiEngines: Array<{ engine: string; count: number }>;
        topCampaigns: Array<{ campaign: string; count: number }>;
      }>;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    setAttribution(getStoredSemAttribution());
  }, []);

  return (
    <section className="rounded-lg border border-[#C5A059]/30 bg-[#0d0f14] p-5 shadow-[0_0_25px_rgba(197,160,89,0.06)] space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#C5A059]/15 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
            <h2 className="font-serif text-sm font-bold uppercase tracking-[0.16em] text-[#E8C56A]">
              Osservatorio Espansione Sovrana &amp; GEO / SEM
            </h2>
          </div>
          <p className="text-xs text-[#94a3b8]">
            Telemetria di indicizzazione sui motori AI, attribuzione campagne e mandato di espansione.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#10b981]/15 border border-[#10b981]/35 text-[#10b981] whitespace-nowrap">
            CANONICO: {INDEXNOW_HOST}
          </span>
          <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
            TTL 60 GIORNI
          </span>
        </div>
      </div>

      {/* Grid 4 Pilastri Acquisizione */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: GEO / AI Search */}
        <div className="rounded-lg border border-[#C5A059]/20 bg-[#11131c] p-3.5 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#F4F4F6]">
                <Bot className="h-3.5 w-3.5 text-[#E8C56A]" />
                GEO &amp; AI Search
              </span>
              <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] whitespace-nowrap">
                18 BOT ALLOW
              </span>
            </div>
            <p className="text-[11px] text-[#94a3b8] leading-relaxed">
              Presidio enciclopedico per ChatGPT, Perplexity, Claude, Gemini, Copilot e Grok tramite /llms.txt.
            </p>
          </div>
          <div className="pt-2 border-t border-[#C5A059]/10 flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#94a3b8]">Route AI Prerender:</span>
            <span className="text-[#E8C56A] font-bold whitespace-nowrap">
              {serverStats?.byChannel?.ai_search !== undefined && serverStats.byChannel.ai_search > 0
                ? `${serverStats.byChannel.ai_search} Ingressi AI (45 URL)`
                : "45 / 45 URL"}
            </span>
          </div>
        </div>

        {/* Card 2: SEM & Click IDs */}
        <div className="rounded-lg border border-[#C5A059]/20 bg-[#11131c] p-3.5 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#F4F4F6]">
                <Target className="h-3.5 w-3.5 text-[#E8C56A]" />
                Campagne SEM &amp; Paid
              </span>
              <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                GCLID / FBCLID
              </span>
            </div>
            <p className="text-[11px] text-[#94a3b8] leading-relaxed">
              Cattura automatica dei click ID di Google Ads, Meta Ads e Microsoft Ads su tutti i percorsi di onboarding.
            </p>
          </div>
          <div className="pt-2 border-t border-[#C5A059]/10 flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#94a3b8]">Ingressi Paid Tracciati:</span>
            <span className="text-[#E8C56A] font-bold whitespace-nowrap">
              {serverStats?.byChannel?.paid_sem !== undefined && serverStats.byChannel.paid_sem > 0
                ? `${serverStats.byChannel.paid_sem} Click ID`
                : "0€ · 10€ · 150€"}
            </span>
          </div>
        </div>

        {/* Card 3: IndexNow & Motori di Ricerca */}
        <div className="rounded-lg border border-[#C5A059]/20 bg-[#11131c] p-3.5 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#F4F4F6]">
                <Globe className="h-3.5 w-3.5 text-[#E8C56A]" />
                IndexNow Push
              </span>
              <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] whitespace-nowrap">
                32-HEX CHIAVE
              </span>
            </div>
            <p className="text-[11px] text-[#94a3b8] leading-relaxed">
              Notifica istantanea POST a Bing, Yandex, Seznam e Copilot ad ogni deploy senza attendere il crawl passivo.
            </p>
          </div>
          <div className="pt-2 border-t border-[#C5A059]/10 flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#94a3b8]">Invio Diretto:</span>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/admin/indexnow/push", { method: "POST" });
                  const json = await res.json();
                  if (res.ok) {
                    alert(`IndexNow Push Eseguito: ${json.urlsSubmitted} URL inviati ai motori (Status: ${json.status})`);
                  } else {
                    alert(`Errore push IndexNow: ${json.error || res.statusText}`);
                  }
                } catch (e) {
                  alert(`Errore di rete IndexNow: ${(e as Error).message}`);
                }
              }}
              className="text-[#E8C56A] hover:text-[#F3D88C] font-bold underline cursor-pointer whitespace-nowrap"
            >
              Esegui Ping Ora
            </button>
          </div>
        </div>

        {/* Card 4: Mandato di Espansione (20%) */}
        <div className="rounded-lg border border-[#C5A059]/20 bg-[#11131c] p-3.5 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#F4F4F6]">
                <Share2 className="h-3.5 w-3.5 text-[#E8C56A]" />
                Mandato Espansione
              </span>
              <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                20% RICORRENTE
              </span>
            </div>
            <p className="text-[11px] text-[#94a3b8] leading-relaxed">
              Royalty perpetua di 30€/mese per ogni membro attivo introdotto; 5 membri coprono il 100% della quota.
            </p>
          </div>
          <div className="pt-2 border-t border-[#C5A059]/10 flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#94a3b8]">Autofinanziamento:</span>
            <span className="text-[#10b981] font-bold whitespace-nowrap">
              {serverStats?.byChannel?.referral !== undefined && serverStats.byChannel.referral > 0
                ? `${serverStats.byChannel.referral} Inviti Registrati`
                : "5 Membri = 0€ Costo"}
            </span>
          </div>
        </div>
      </div>

      {/* Status Bar IndexNow & Dati Sessione Attiva */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border border-[#C5A059]/15 bg-[#07080b] px-4 py-2.5 text-xs font-mono">
        <div className="flex items-center gap-2 text-[#94a3b8]">
          <Radio className="h-3.5 w-3.5 text-[#C5A059]" />
          <span>Firma di Verifica IndexNow:</span>
          <span className="text-[#E8C56A] font-bold">{INDEXNOW_KEY.slice(0, 12)}...</span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-[#94a3b8]">Attribuzione Sessione Corrente:</span>
          <span className="font-bold text-[#10b981] uppercase whitespace-nowrap">
            {attribution ? `${attribution.channel}${attribution.aiEngine ? ` (${attribution.aiEngine})` : ""}` : "DIRETTA / NON TRACCIATA"}
          </span>
          {attribution?.utmCampaign && (
            <span className="text-[#C5A059] whitespace-nowrap">
              Campagna: {attribution.utmCampaign}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
