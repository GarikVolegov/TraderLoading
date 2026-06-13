import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Monitor, Smartphone, Tablet as TabletIcon, Clock } from "lucide-react";
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
  if (device === "Mobile") return <Smartphone className="w-4 h-4" />;
  if (device === "Tablet") return <TabletIcon className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Accessi recenti
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
            />
            Aggiorna
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : accesses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessun accesso registrato
          </p>
        ) : (
          <div className="space-y-2">
            {accesses.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  i === 0
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/40 bg-secondary/20"
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}
                >
                  <DeviceIcon device={a.device} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-medium">
                      {a.ipAddress}
                    </span>
                    {i === 0 && (
                      <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-md border border-primary/30">
                        Attuale
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.device} · {a.browser} · {a.os}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {new Date(a.createdAt).toLocaleString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground/50 text-center pt-1">
              Gli IP vengono registrati al primo accesso ogni ora per
              dispositivo
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
