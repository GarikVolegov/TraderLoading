import { Target } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { initials, fmtR } from "./format";
import { divisionLabel } from "./Leaderboard";
import { NftCertificate, type CertTier } from "./NftCertificate";
import { HallOfFame } from "./HallOfFame";
import type { TorneiMe, TorneiHallEntry, TorneiCertificate } from "@/lib/torneiApi";

interface PercorsoViewProps {
  me: TorneiMe | undefined;
  hall: TorneiHallEntry[];
  enrolling: boolean;
  onEnroll: () => void;
  onCertClick: (cert: TorneiCertificate) => void;
}

export function PercorsoView({ me, hall, enrolling, onEnroll, onCertClick }: PercorsoViewProps) {
  const { t } = useLanguage();
  const standing = me?.standing ?? null;

  return (
    <div className="trn-grid2">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--trn-gap,18px)" }}>
        <section className="trn-panel tl-rise" style={{ padding: "clamp(18px,2.4vw,24px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <Target size={16} color="hsl(142 71% 55%)" strokeWidth={1.9} />
            <h3 style={{ margin: 0, fontSize: 15, color: "var(--tl-fg)" }}>{t("tornei.percorso.title")}</h3>
          </div>

          {standing ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
                <span className={`trn-av trn-d-${standing.division}`} style={{ width: 54, height: 54, borderRadius: 15, fontSize: 19 }}>{initials(standing.displayName)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--tl-fg)" }}>{standing.displayName}</p>
                  <span className={`trn-divtag trn-d-${standing.division}`}>{divisionLabel(standing.division, t)}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[
                  { l: "#", v: String(standing.rank) },
                  { l: t("tornei.metric.r"), v: fmtR(standing.rCum) },
                  { l: t("tornei.metric.ts"), v: `${standing.discIndex}%` },
                ].map((s, i) => (
                  <div key={i} style={{ padding: 12, borderRadius: "var(--tl-radius)", background: "hsl(222 47% 5% / 0.5)", border: "1px solid hsl(215 25% 27% / 0.4)", textAlign: "center" }}>
                    <p style={{ margin: 0, fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 18, color: "var(--tl-fg)" }}>{s.v}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--tl-fg-muted)" }}>{s.l}</p>
                  </div>
                ))}
              </div>
              {me?.nextDivision && (
                <p style={{ margin: "16px 0 0", fontSize: 12.5, color: "var(--tl-fg-muted)" }}>
                  {t("tornei.percorso.nextDivision", { div: divisionLabel(me.nextDivision, t) })}
                </p>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ margin: "0 0 16px", color: "var(--tl-fg-muted)", fontSize: 14 }}>{t("tornei.percorso.notEnrolled")}</p>
              <button type="button" className="trn-cta" disabled={enrolling} onClick={onEnroll}>{t("tornei.cta.enroll")}</button>
            </div>
          )}
        </section>

        {me && me.certificates.length > 0 && (
          <section>
            <span className="tl-section-label" style={{ display: "block", marginBottom: 11 }}>{t("tornei.percorso.yourCerts")}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "var(--trn-gap,16px)" }}>
              {me.certificates.map((c) => (
                <NftCertificate
                  key={c.id}
                  tier={c.tier as CertTier}
                  title={c.tier.charAt(0).toUpperCase() + c.tier.slice(1)}
                  edition={c.edition}
                  rarity={c.rarity}
                  seasonLabel={c.seasonLabel}
                  onClick={() => onCertClick(c)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className="trn-panel tl-rise" style={{ padding: "clamp(16px,2vw,20px)" }}>
        <HallOfFame entries={hall} />
      </aside>
    </div>
  );
}
