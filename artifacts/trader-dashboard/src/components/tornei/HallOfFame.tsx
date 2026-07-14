import { Crown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { fmtR, formatRangeDate } from "./format";
import type { TorneiHallEntry } from "@/lib/torneiApi";

export function HallOfFame({ entries }: { entries: TorneiHallEntry[] }) {
  const { t, language } = useLanguage();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
        <Crown size={16} color="hsl(45 96% 58%)" strokeWidth={1.9} />
        <h3 style={{ margin: 0, fontSize: 15, color: "var(--tl-fg)" }}>{t("tornei.hall.title")}</h3>
      </div>
      {entries.length === 0 ? (
        <p style={{ color: "var(--tl-fg-muted)", fontSize: 13 }}>{t("tornei.hall.empty")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {entries.map((e, i) => (
            <div key={i} className="trn-hallrow">
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, color: "hsl(45 96% 58%)", background: "hsl(45 96% 55% / 0.12)", border: "1px solid hsl(45 96% 55% / 0.3)", flex: "none" }}>
                <Crown size={16} strokeWidth={1.8} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: e.champion ? 600 : 400,
                    fontStyle: e.champion ? "normal" : "italic",
                    color: e.champion ? "var(--tl-fg)" : "var(--tl-fg-muted)",
                  }}
                >
                  {e.champion ?? t("tornei.hall.no_champion")}
                </p>
                <p style={{ margin: "2px 0 0", fontFamily: "var(--tl-font-mono)", fontSize: 11, color: "hsl(215 20% 58%)" }}>
                  {e.seasonLabel} · {formatRangeDate(e.startsAt, language)} — {formatRangeDate(e.endsAt, language)}
                </p>
              </div>
              {e.champion && (
                <div style={{ textAlign: "right", flex: "none" }}>
                  <p style={{ margin: 0, fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 14, color: "hsl(var(--success))" }}>{fmtR(e.rCum)}</p>
                  <p style={{ margin: "2px 0 0", fontFamily: "var(--tl-font-mono)", fontSize: 10, color: "hsl(215 20% 58%)" }}>{t("tornei.metric.ts")} {e.discIndex ?? "—"}%</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
