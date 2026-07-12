import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, Target, Users } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { ArenaView } from "@/components/tornei/ArenaView";
import { PercorsoView } from "@/components/tornei/PercorsoView";
import { CertModal } from "@/components/tornei/CertModal";
import {
  fetchTorneiCurrent,
  fetchTorneiStandings,
  fetchTorneiMe,
  fetchTorneiHall,
  fetchTorneiWallet,
  enrollTornei,
  claimTorneiCertificate,
  torneiCurrentKey,
  torneiStandingsKey,
  torneiMeKey,
  torneiHallKey,
  torneiWalletKey,
  type TorneiMetric,
  type TorneiCertificate,
} from "@/lib/torneiApi";
import "@/components/tornei/tornei.css";

type Dir = "arena" | "percorso";

export default function Tornei() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dir, setDir] = useState<Dir>("arena");
  const [metric, setMetric] = useState<TorneiMetric>("r");
  const [selectedCert, setSelectedCert] = useState<TorneiCertificate | null>(null);

  const walletQuery = useQuery({ queryKey: torneiWalletKey(), queryFn: () => fetchTorneiWallet() });
  const hasWallet = Boolean(walletQuery.data?.walletAddress);

  const currentQuery = useQuery({ queryKey: torneiCurrentKey(), queryFn: () => fetchTorneiCurrent() });
  const standingsQuery = useQuery({
    queryKey: torneiStandingsKey(metric),
    queryFn: () => fetchTorneiStandings(metric),
    enabled: dir === "arena",
  });
  const meQuery = useQuery({ queryKey: torneiMeKey(), queryFn: () => fetchTorneiMe(), enabled: dir === "percorso" });
  const hallQuery = useQuery({ queryKey: torneiHallKey(), queryFn: () => fetchTorneiHall(), enabled: dir === "percorso" });

  const enrollMutation = useMutation({
    mutationFn: () => enrollTornei(true),
    onSuccess: (res) => {
      if (res.ok) {
        toast({ title: t("tornei.enroll.success") });
        qc.invalidateQueries({ queryKey: torneiCurrentKey() });
        qc.invalidateQueries({ queryKey: torneiMeKey() });
      } else {
        const key = `tornei.enroll.error.${res.reason}`;
        const title = t(key);
        toast({ title: title === key ? t("tornei.enroll.error.generic") : title, variant: "destructive" });
      }
    },
    onError: () => toast({ title: t("tornei.enroll.error.generic"), variant: "destructive" }),
  });

  const claimMutation = useMutation({
    mutationFn: (id: number) => claimTorneiCertificate(id),
    onSuccess: (res) => {
      if (res.certificate) setSelectedCert(res.certificate);
      qc.invalidateQueries({ queryKey: torneiMeKey() });
    },
    onError: () => toast({ title: t("tornei.cert.failed"), variant: "destructive" }),
  });

  const current = currentQuery.data;

  return (
    <PageLayout fullWidth>
      <div className="trn-page" data-screen-label="Tornei">
        <div className="trn-wrap">
          <header className="tl-rise" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 22 }}>
            <div style={{ minWidth: 0, flex: "1 1 360px" }}>
              <span className="tl-section-label" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "hsl(45 96% 58%)" }}>
                <Trophy size={13} />
                {t("tornei.eyebrow")}
              </span>
              <h1 style={{ fontSize: "clamp(27px,3.6vw,36px)", margin: "9px 0 7px", color: "var(--tl-fg)", fontFamily: "var(--tl-font-mono)", letterSpacing: "-0.02em" }}>{t("tornei.title")}</h1>
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--tl-fg-muted)", maxWidth: 500, lineHeight: 1.55 }}>{t("tornei.subtitle")}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "none" }}>
              {current && (
                <span className="trn-hide-sm" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 99, border: "1px solid hsl(215 25% 27% / 0.4)", background: "hsl(226 43% 10% / 0.5)", fontFamily: "var(--tl-font-mono)", fontSize: 11, color: "hsl(215 20% 65%)" }}>
                  <Users size={13} color="hsl(142 71% 55%)" />
                  <strong style={{ color: "var(--tl-fg)" }}>{current.totalPlayers}</strong>&nbsp;{t("tornei.inGara", { n: "" }).trim()}
                </span>
              )}
              <div className="trn-seg">
                <button type="button" className="trn-segb" data-active={dir === "arena" ? "1" : "0"} onClick={() => setDir("arena")}>
                  <Trophy size={14} />
                  {t("tornei.tab.arena")}
                </button>
                <button type="button" className="trn-segb" data-active={dir === "percorso" ? "1" : "0"} onClick={() => setDir("percorso")}>
                  <Target size={14} />
                  {t("tornei.tab.percorso")}
                </button>
              </div>
            </div>
          </header>

          {currentQuery.isLoading || !current ? (
            <p style={{ color: "var(--tl-fg-muted)", padding: 40, textAlign: "center" }}>{t("tornei.loading")}</p>
          ) : dir === "arena" ? (
            <ArenaView
              current={current}
              standings={standingsQuery.data}
              metric={metric}
              onMetric={setMetric}
              enrolling={enrollMutation.isPending}
              onEnroll={() => enrollMutation.mutate()}
            />
          ) : (
            <PercorsoView
              me={meQuery.data}
              hall={hallQuery.data?.entries ?? []}
              enrolling={enrollMutation.isPending}
              onEnroll={() => enrollMutation.mutate()}
              onCertClick={setSelectedCert}
            />
          )}
        </div>

        <CertModal
          cert={selectedCert}
          claiming={claimMutation.isPending}
          hasWallet={hasWallet}
          onClaim={(id) => claimMutation.mutate(id)}
          onClose={() => setSelectedCert(null)}
        />
      </div>
    </PageLayout>
  );
}
