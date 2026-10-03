import { Crown, Medal, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { initials, fmtR } from "./format";
import { divisionLabel } from "./Leaderboard";
import type { TorneiStanding } from "@/lib/torneiApi";

const RK = ["trn-rk1", "trn-rk2", "trn-rk3"];
const MEDAL = [Crown, Medal, Award];
// Ordine visivo del podio: 2° · 1° · 3°
const VISUAL_ORDER = [1, 0, 2];

export function Podium({ board }: { board: TorneiStanding[] }) {
  const { t } = useLanguage();
  const top3 = board.filter((r) => r.rank >= 1 && r.rank <= 3).sort((a, b) => a.rank - b.rank);
  if (top3.length < 3) return null;

  return (
    <div className="trn-podium tl-stagger" style={{ marginBottom: 22 }}>
      {VISUAL_ORDER.map((idx) => {
        const p = top3[idx];
        const MedalIcon = MEDAL[idx];
        return (
          <button key={p.id} type="button" className={`trn-pod ${RK[idx]} trn-d-${p.division} ${idx === 0 ? "trn-pod1" : ""}`}>
            <span
              style={{
                position: "relative",
                width: 60,
                height: 60,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--rk)",
                background: "color-mix(in srgb, var(--rk) 16%, transparent)",
                border: "1px solid color-mix(in srgb, var(--rk) 45%, transparent)",
              }}
            >
              <MedalIcon size={28} strokeWidth={1.8} />
            </span>
            <span className="trn-av" style={{ width: 46, height: 46, borderRadius: 13, fontSize: 16 }}>{initials(p.displayName)}</span>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: "14.5px", fontWeight: 700, color: "var(--tl-fg)" }}>{p.displayName}</p>
              <span className={`trn-divtag trn-d-${p.division}`}>{divisionLabel(p.division, t)}</span>
            </div>
            <div style={{ marginTop: 4 }}>
              <p style={{ margin: 0, fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 22, color: "hsl(var(--success))" }}>{fmtR(p.rCum)}</p>
              <p style={{ margin: "2px 0 0", fontFamily: "var(--tl-font-mono)", fontSize: "10.5px", color: "hsl(215 20% 58%)" }}>{t("tornei.metric.ts")} {p.discIndex}%</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
