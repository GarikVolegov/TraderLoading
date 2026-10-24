import { Button } from "@/components/ui/button";
import { RefreshCw, Monitor, Smartphone, Tablet as TabletIcon, Clock, ShieldCheck, Terminal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AccessEntry {
  id: number;
  ipAddress: string;
  device: string;
  browser: string;
  os: string;
  createdAt: string;
}

function DeviceIcon({ device }: { device: string }) {
  if (device === "Mobile") return <Smartphone className="w-4 h-4 text-[#C5A059]" />;
  if (device === "Tablet") return <TabletIcon className="w-4 h-4 text-[#C5A059]" />;
  return <Monitor className="w-4 h-4 text-[#C5A059]" />;
}

export function LoginAccessSection() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    accesses: AccessEntry[];
  }>({
    queryKey: ["login-access"],
    queryFn: async () => {
      const res = await fetch("/api/login-access", { credentials: "include" });
      if (!res.ok) throw new Error("Errore nel caricamento accessi");
      return res.json();
    },
    staleTime: 60_000,
  });

  const accesses = data?.accesses ?? [];

  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-6 space-y-4 shadow-xl shadow-black/40">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C5A059]/15 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
              Sentinella Accessi & Sessioni IP
            </h3>
            <p className="text-xs font-mono text-muted-foreground/80">
              Audit cronologico dei dispositivi e indirizzi IP autorizzati.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="border-[#C5A059]/30 bg-[#07080b] hover:bg-[#C5A059]/10 hover:border-[#C5A059] text-xs font-mono text-[#E8C56A] h-8 px-3"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1.5 text-[#C5A059] ${isFetching ? "animate-spin" : ""}`}
          />
          Aggiorna Audit
        </Button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : accesses.length === 0 ? (
        <div className="rounded-xl border border-[#26262E] bg-[#07080b]/60 p-6 text-center">
          <p className="text-xs font-mono text-muted-foreground">
            Nessun accesso operativo registrato al di fuori della sessione corrente.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {accesses.map((a, i) => {
            const isCurrent = i === 0;
            return (
              <div
                key={a.id}
                className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? "border-[#C5A059]/40 bg-[#C5A059]/10 shadow-[0_0_15px_rgba(197,160,89,0.08)]"
                    : "border-[#26262E] bg-[#07080b]/80 hover:border-[#C5A059]/20"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      isCurrent
                        ? "border-[#C5A059]/50 bg-[#07080b]"
                        : "border-[#26262E] bg-[#11131c]"
                    }`}
                  >
                    <DeviceIcon device={a.device} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#F4F4F6] tracking-tight">
                        {a.ipAddress}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded border border-[#10b981]/40 bg-[#10b981]/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#10b981]">
                          <ShieldCheck className="w-3 h-3 text-[#10b981]" />
                          Sessione Attuale
                        </span>
                      )}
                    </div>

                    <p className="font-mono text-[11px] text-muted-foreground/80 mt-1">
                      {a.device} · {a.browser} · {a.os}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono text-[10px] text-muted-foreground/60 whitespace-nowrap block">
                    {new Date(a.createdAt).toLocaleString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })}

          <p className="font-mono text-[10px] text-muted-foreground/50 text-center pt-2">
            Gli indirizzi IP vengono verificati e registrati automaticamente al primo accesso orario per ciascun dispositivo.
          </p>
        </div>
      )}
    </div>
  );
}
