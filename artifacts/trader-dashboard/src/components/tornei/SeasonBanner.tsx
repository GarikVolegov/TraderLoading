import { useEffect, useState } from "react";
import { Calendar, Crown, CheckCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { countdownParts } from "./format";
import type { TorneiSeason } from "@/lib/torneiApi";

interface SeasonBannerProps {
  season: TorneiSeason;
  progress: number;
  enrolled: boolean;
  enrolling: boolean;
  onEnroll: () => void;
}

const STATUS_CLASS: Record<string, string> = {
  live: "trn-st-live",
  upcoming: "trn-st-upcoming",
  ended: "trn-st-ended",
};
const STATUS_KEY: Record<string, string> = {
  live: "tornei.status.live",
  upcoming: "tornei.status.upcoming",
  ended: "tornei.status.ended",
};

export function SeasonBanner({ season, progress, enrolled, enrolling, onEnroll }: SeasonBannerProps) {
  const { t, language } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  const target = season.status === "upcoming" ? Date.parse(season.startsAt) : Date.parse(season.endsAt);
  const showCountdown = season.status !== "ended";

  useEffect(() => {
    if (!showCountdown) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showCountdown]);

  const c = countdownParts(target, now);
  const units = [
    { v: c.d, l: t("tornei.unit.d") },
    { v: c.h, l: t("tornei.unit.h") },
    { v: c.m, l: t("tornei.unit.m") },
    { v: c.s, l: t("tornei.unit.s") },
  ];
  const endDate = new Date(season.endsAt).toLocaleDateString(language, { day: "numeric", month: "long" });

  return (
    <section
      className="trn-panel tl-sheen tl-rise"
      style={{ position: "relative", overflow: "hidden", padding: "clamp(18px,2.6vw,26px)", marginBottom: 22, borderColor: "hsl(45 96% 55% / 0.22)" }}
    >
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 340px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 9 }}>
            <span
              className={STATUS_CLASS[season.status]}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 11px",
                borderRadius: 99,
                fontFamily: "var(--tl-font-mono)",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--sc)",
                background: "color-mix(in srgb, var(--sc) 14%, transparent)",
                border: "1px solid color-mix(in srgb, var(--sc) 38%, transparent)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--sc)", boxShadow: "0 0 8px var(--sc)" }} />
              {t(STATUS_KEY[season.status])}
            </span>
            <span className="tl-section-label">{season.label}</span>
          </div>
          <h2 style={{ margin: "0 0 5px", fontSize: "clamp(21px,2.8vw,28px)", color: "var(--tl-fg)", letterSpacing: "-0.02em" }}>
            {t("tornei.season", { label: season.label })}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--tl-fg-muted)", display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Calendar size={14} strokeWidth={1.9} />
            {t("tornei.classificaSu")}
          </p>
        </div>

        <div style={{ flex: "none", textAlign: "right" }}>
          <span className="tl-section-label" style={{ display: "block", marginBottom: 7 }}>
            {t("tornei.countdown")}
          </span>
          {showCountdown ? (
            <div className="trn-cd" style={{ display: "flex", gap: 8 }}>
              {units.map((u, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    minWidth: 58,
                    padding: "10px 8px",
                    borderRadius: "var(--tl-radius)",
                    background: "hsl(222 47% 5% / 0.6)",
                    border: "1px solid hsl(215 25% 27% / 0.5)",
                  }}
                >
                  <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 24, color: "var(--tl-fg)", lineHeight: 1 }}>{u.v}</span>
                  <span style={{ fontFamily: "var(--tl-font-mono)", fontSize: "9.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(215 20% 56%)" }}>{u.l}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 16px", borderRadius: "var(--tl-radius)", background: "hsl(222 47% 5% / 0.6)", border: "1px solid hsl(45 96% 55% / 0.3)" }}>
              <Crown size={17} color="hsl(45 96% 58%)" />
              <span style={{ fontFamily: "var(--tl-font-mono)", fontSize: 14, fontWeight: 700, color: "var(--tl-fg)" }}>
                {t("tornei.concludedOn", { date: endDate })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* progress timeline */}
      {season.status !== "upcoming" && (
        <div style={{ position: "relative", marginTop: 18 }}>
          <div style={{ height: 7, borderRadius: 99, background: "hsl(222 47% 5% / 0.7)", border: "1px solid hsl(215 25% 27% / 0.4)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: "linear-gradient(90deg, hsl(45 96% 55% / 0.8), hsl(var(--accent-jade)))" }} />
          </div>
        </div>
      )}

      {season.status !== "ended" && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="trn-cta" disabled={enrolled || enrolling} onClick={onEnroll}>
            {enrolling ? (
              <Loader2 size={16} className="animate-spin" />
            ) : enrolled ? (
              <CheckCircle size={16} />
            ) : null}
            {enrolled ? t("tornei.cta.enrolled") : enrolling ? t("tornei.cta.enrolling") : t("tornei.cta.enroll")}
          </button>
        </div>
      )}
    </section>
  );
}
