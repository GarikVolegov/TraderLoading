import { Check, Circle, Focus, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCockpitCopy } from "@/hooks/useCockpitCopy";

/** Illustration of the real workflow. It does not display quotes or trading signals. */
export function LandingCockpitPreview() {
  const { t } = useLanguage();
  const ck = useCockpitCopy();
  return (
    <figure className="landing-cockpit-preview" aria-label={t("design.preview.label")}>
      <div className="landing-preview-bar">
        <span>
          <Focus size={16} />
          {ck("Cockpit")}
        </span>
        <small>{t("design.preview.label")}</small>
      </div>
      <div className="landing-preview-body">
        <div className="landing-preview-process">
          <span className="landing-preview-caption">{t("design.preview.context")}</span>
          {[
            "Ciclo grande",
            "Zona a sinistra",
            "Schematica, trigger & target",
            "Gestione & consuntivo",
          ].map((name, i) => (
            <div className="landing-preview-step" key={name} data-active={i === 1}>
              <span className="landing-preview-index">
                {i === 0 ? <Check size={13} /> : `0${i + 1}`}
              </span>
              <span>{ck(name)}</span>
              {i > 0 && <Circle size={10} />}
            </div>
          ))}
          <p className="landing-preview-protection">
            <ShieldCheck size={14} />
            {t("design.preview.pending")}
          </p>
        </div>
        <div className="landing-preview-chart" aria-hidden="true">
          <div className="landing-preview-chart-caption">{t("design.preview.timeframes")}</div>
          <svg viewBox="0 0 280 260" fill="none">
            {[50, 100, 150, 200].map((y) => (
              <path key={y} d={`M0 ${y}H280`} className="landing-preview-grid" />
            ))}
            {[55, 110, 165, 220, 275].map((x) => (
              <path key={x} d={`M${x} 0V260`} className="landing-preview-grid" />
            ))}
            <rect x="24" y="164" width="228" height="35" className="landing-preview-zone" />
            <path
              d="M12 202 35 182 50 190 70 149 89 159 108 127 128 141 147 170 163 181 178 154 193 164 214 117 233 130 252 87 270 98"
              className="landing-preview-price"
            />
            <path d="M24 70H252M163 180 230 70" className="landing-preview-target" />
            <circle cx="163" cy="180" r="5" className="landing-preview-point" />
          </svg>
        </div>
      </div>
      <figcaption>{t("design.preview.chart")}</figcaption>
    </figure>
  );
}
