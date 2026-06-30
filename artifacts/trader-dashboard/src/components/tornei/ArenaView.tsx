import { Timer, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SeasonBanner } from "./SeasonBanner";
import { Podium } from "./Podium";
import { Leaderboard } from "./Leaderboard";
import { DqList } from "./DqList";
import { Prizes } from "./Prizes";
import { Rules } from "./Rules";
import type { TorneiCurrent, TorneiStandingsResponse, TorneiMetric } from "@/lib/torneiApi";

interface ArenaViewProps {
  current: TorneiCurrent;
  standings: TorneiStandingsResponse | undefined;
  metric: TorneiMetric;
  onMetric: (m: TorneiMetric) => void;
  enrolling: boolean;
  onEnroll: () => void;
}

export function ArenaView({ current, standings, metric, onMetric, enrolling, onEnroll }: ArenaViewProps) {
  const { t } = useLanguage();
  const season = current.season;
  if (!season) {
    return <p style={{ color: "var(--tl-fg-muted)", textAlign: "center", padding: 40 }}>{t("tornei.hall.empty")}</p>;
  }
  const showBoard = season.status === "live" || season.status === "ended";

  return (
    <>
      <SeasonBanner season={season} progress={current.progress} enrolled={current.enrolled} enrolling={enrolling} onEnroll={onEnroll} />

      {season.status === "upcoming" && (
        <div className="trn-panel tl-fade" style={{ textAlign: "center", padding: "clamp(28px,4vw,48px) 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 22 }}>
          <span style={{ width: 66, height: 66, borderRadius: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "hsl(45 96% 55% / 0.12)", border: "1px solid hsl(45 96% 55% / 0.3)", color: "hsl(45 96% 58%)" }}>
            <Timer size={32} strokeWidth={1.7} />
          </span>
          <div>
            <h3 style={{ margin: "0 0 8px", fontSize: 22, color: "var(--tl-fg)" }}>{t("tornei.upcoming.title")}</h3>
            <p style={{ margin: "0 auto", maxWidth: 440, color: "var(--tl-fg-muted)", fontSize: 14, lineHeight: 1.6 }}>{t("tornei.upcoming.body")}</p>
          </div>
          <button type="button" className="trn-cta" disabled={current.enrolled || enrolling} onClick={onEnroll}>
            <CheckCircle size={17} strokeWidth={2.2} />
            {current.enrolled ? t("tornei.cta.enrolled") : t("tornei.cta.book")}
          </button>
        </div>
      )}

      {showBoard && standings && (
        <>
          <Podium board={standings.board} />
          <Leaderboard board={standings.board} total={standings.total} metric={metric} onMetric={onMetric} />
          <DqList rows={standings.dq} />
        </>
      )}

      <Prizes seasonLabel={season.label} />
      <Rules />
    </>
  );
}
