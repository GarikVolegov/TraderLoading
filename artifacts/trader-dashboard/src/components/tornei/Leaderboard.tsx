import { TrendingUp, Shield, ArrowUp, ArrowDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { initials, fmtR } from "./format";
import type { TorneiStanding, TorneiMetric } from "@/lib/torneiApi";

const RK_CLASS = (rank: number) => (rank === 1 ? "trn-rk1" : rank === 2 ? "trn-rk2" : rank === 3 ? "trn-rk3" : "trn-rk0");

export function divisionLabel(division: string, t: (k: string) => string): string {
  return t(`tornei.division.${division}`);
}

interface LeaderboardProps {
  board: TorneiStanding[];
  total: number;
  metric: TorneiMetric;
  onMetric: (m: TorneiMetric) => void;
}

export function Leaderboard({ board, total, metric, onMetric }: LeaderboardProps) {
  const { t } = useLanguage();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "var(--tl-fg)" }}>{t("tornei.board.title")}</h3>
          <span style={{ fontFamily: "var(--tl-font-mono)", fontSize: 11, color: "hsl(215 20% 58%)" }}>· {t("tornei.board.players", { n: String(total) })}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span className="tl-section-label trn-hide-sm">{t("tornei.board.sortBy")}</span>
          <div className="trn-seg">
            <button type="button" className="trn-segb" data-active={metric === "r" ? "1" : "0"} onClick={() => onMetric("r")}>
              <TrendingUp size={13} strokeWidth={2} />
              {t("tornei.metric.r")}
            </button>
            <button type="button" className="trn-segb" data-active={metric === "ts" ? "1" : "0"} onClick={() => onMetric("ts")}>
              <Shield size={13} strokeWidth={2} />
              {t("tornei.metric.ts")}
            </button>
          </div>
        </div>
      </div>

      <div className="trn-lbhead" style={{ padding: "0 16px 9px", fontFamily: "var(--tl-font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(215 20% 54%)" }}>
        <span>{t("tornei.col.rank")}</span>
        <span>{t("tornei.col.trader")}</span>
        <span className="trn-hide-sm" style={{ textAlign: "right" }}>{t("tornei.col.rcum")}</span>
        <span className="trn-hide-sm" style={{ textAlign: "right" }}>{t("tornei.col.discipline")}</span>
        <span style={{ textAlign: "right" }}>{t("tornei.col.score")}</span>
      </div>

      {board.length === 0 ? (
        <p style={{ padding: "24px 16px", textAlign: "center", color: "var(--tl-fg-muted)", fontSize: 13 }}>{t("tornei.board.empty")}</p>
      ) : (
        <div className="tl-stagger" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {board.map((r) => {
            const moved = r.prevRank > 0 && r.prevRank !== r.rank;
            const up = r.prevRank > r.rank;
            return (
              <div key={r.id} className={`trn-lbrow ${RK_CLASS(r.rank)} trn-d-${r.division}`} data-me={r.me ? "1" : "0"}>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span className="trn-rkpill">{r.rank}</span>
                  {moved && (
                    <span className={`trn-move ${up ? "trn-up" : "trn-down"} trn-hide-sm`}>
                      {up ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />}
                      {Math.abs(r.prevRank - r.rank)}
                    </span>
                  )}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <span className={`trn-av trn-d-${r.division}`}>{initials(r.displayName)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "var(--tl-fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.displayName}</span>
                      {r.me && (
                        <span style={{ fontFamily: "var(--tl-font-mono)", fontSize: 9, letterSpacing: "0.08em", padding: "1px 6px", borderRadius: 5, background: "hsl(142 71% 45% / 0.18)", color: "hsl(142 71% 60%)", flex: "none" }}>{t("tornei.you")}</span>
                      )}
                    </span>
                    <span className={`trn-divtag trn-d-${r.division}`} style={{ marginTop: 3 }}>{divisionLabel(r.division, t)}</span>
                  </span>
                </span>
                <span className="trn-hide-sm" style={{ textAlign: "right", fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 14, color: "hsl(142 71% 56%)" }}>{fmtR(r.rCum)}</span>
                <span className="trn-hide-sm" style={{ textAlign: "right", fontFamily: "var(--tl-font-mono)", fontSize: 13, color: "var(--tl-fg)" }}>{r.discIndex}%</span>
                <span style={{ textAlign: "right", fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 15, color: "var(--tl-fg)" }}>{r.score.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
