import { Shield, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { initials, fmtR } from "./format";
import type { TorneiStanding } from "@/lib/torneiApi";

export function DqList({ rows }: { rows: TorneiStanding[] }) {
  const { t } = useLanguage();
  if (rows.length === 0) return null;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <Shield size={13} color="#ef4444" strokeWidth={2} />
        <span className="tl-section-label" style={{ color: "#ef4444" }}>
          {t("tornei.dq.title")} — Eliminati per perdita di controllo
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.map((r, i) => (
          <div key={r.id} className="trn-lbrow" data-dq="1">
            <span
              className="trn-rkpill"
              style={
                {
                  "--rk": "#8B1E1E",
                  textDecoration: "line-through",
                  opacity: 0.7,
                } as React.CSSProperties
              }
            >
              {i + 1}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
              <span className="trn-av" style={{ opacity: 0.7 }}>
                {initials(r.displayName)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "var(--tl-fg-muted)",
                    textDecoration: "line-through",
                  }}
                >
                  {r.displayName}
                </span>
                <span
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    color: "#ef4444",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <X size={11} strokeWidth={2.2} />
                  Eliminato per perdita di controllo{r.dqReason ? ` · ${r.dqReason}` : ""}
                </span>
              </span>
            </span>
            <span
              className="trn-hide-sm"
              style={{
                textAlign: "right",
                fontFamily: "var(--tl-font-mono)",
                fontSize: 13,
                color: "#8E92A0",
                textDecoration: "line-through",
              }}
            >
              {fmtR(r.rCum)}
            </span>
            <span
              className="trn-hide-sm"
              style={{
                textAlign: "right",
                fontFamily: "var(--tl-font-mono)",
                fontSize: 13,
                color: "#ef4444",
              }}
            >
              {r.discIndex}%
            </span>
            <span
              style={{
                textAlign: "right",
                fontFamily: "var(--tl-font-mono)",
                fontSize: 13,
                color: "#8E92A0",
              }}
            >
              —
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
