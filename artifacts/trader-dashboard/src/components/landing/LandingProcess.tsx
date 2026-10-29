import { useRef, type Dispatch, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  RotateCcw,
  Compass,
  FlaskConical,
  ListChecks,
  ScanSearch,
  CircleAlert,
  MousePointer2,
  Eye,
  MoveUpRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  TOUR_STEPS,
  isTourComplete,
  type TourAction,
  type TourState,
  type TourStep,
} from "@/lib/landingTour";
import { SectionIntro, SignupCta } from "./shared";

const STEP_ICONS = { prepare: Compass, test: FlaskConical, plan: ListChecks, review: ScanSearch };
const EXPLANATION_PARTS = [
  { part: "problem", Icon: CircleAlert },
  { part: "action", Icon: MousePointer2 },
  { part: "evidence", Icon: Eye },
  { part: "decision", Icon: MoveUpRight },
] as const;

export function ProcessVisual({ step }: { step: TourStep }) {
  const { t, language } = useLanguage();
  const number = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 1, signDisplay: "always" }).format(
      value,
    );
  return (
    <div className="landing-product-screen" data-scene={step}>
      <div className="landing-screen-header">
        <span>AUREUS</span>
        <span>{t(step === "test" ? "landing.pricing.pro" : "landing.pricing.free")}</span>
      </div>
      {step === "prepare" && (
        <div className="landing-screen-body">
          <h3>{t("landing.visual.workspace")}</h3>
          <div className="landing-market-row">
            <strong>{"EUR/USD"}</strong>
            <span>{t("landing.visual.impact")}</span>
          </div>
          <div className="landing-event">
            <span className="landing-event-mark" aria-hidden="true" />
            <div>
              <strong>{t("landing.visual.event")}</strong>
              <p>{t("landing.visual.context")}</p>
            </div>
          </div>
          <div className="landing-screen-divider" />
          <div className="landing-screen-metrics">
            <div className="landing-data-row">
              <span>{t("landing.visual.risk")}</span>
              <strong>
                {new Intl.NumberFormat(language, {
                  style: "percent",
                  maximumFractionDigits: 1,
                }).format(0.005)}
              </strong>
            </div>
            <div className="landing-data-row">
              <span>{t("landing.visual.checklist")}</span>
              <span className="landing-warning">{t("landing.visual.pending")}</span>
            </div>
          </div>
        </div>
      )}
      {step === "test" && (
        <div className="landing-screen-body">
          <h3>{t("landing.visual.history")}</h3>
          <div className="landing-market-row">
            <strong>{"EUR/USD"}</strong>
            <span>{"M15"}</span>
          </div>
          <div className="landing-candles" role="img" aria-label={t("landing.visual.history")}>
            {[44, 64, 52, 80, 60, 45, 63, 34, 56, 74, 64, 85, 53, 36, 50, 69, 43, 35].map(
              (height, i) => (
                <span
                  key={i}
                  className={i % 3 === 0 ? "is-down" : "is-up"}
                  style={{ height: `${height}%` }}
                />
              ),
            )}
          </div>
          <p className="landing-screen-label">{t("landing.visual.sample")}</p>
          <div className="landing-results">
            {[-1, 1.5, -1].map((result, i) => (
              <div key={i}>
                <span>
                  {t("landing.visual.trade")} {i + 1}
                </span>
                <strong className={result < 0 ? "landing-loss" : "landing-gain"}>
                  {number(result)} R
                </strong>
              </div>
            ))}
          </div>
          <p className="landing-note">{t("landing.visual.sample_note")}</p>
        </div>
      )}
      {step === "plan" && (
        <div className="landing-screen-body">
          <h3>{t("landing.visual.day_plan")}</h3>
          <div className="landing-checklist-row">
            <CheckCircle2 size={22} aria-hidden="true" />
            <span>{t("landing.visual.rule")}</span>
          </div>
          <div className="landing-checklist-row is-pending">
            <Circle size={22} aria-hidden="true" />
            <span>{t("landing.visual.risk_check")}</span>
          </div>
          <div className="landing-screen-divider" />
          <div className="landing-data-row">
            <span>{t("landing.visual.checkin")}</span>
            <strong className="landing-warning">{t("landing.visual.frustration")}</strong>
          </div>
          <div className="landing-pause">
            <span className="landing-pause-icon" aria-hidden="true">
              Ⅱ
            </span>
            <p>{t("landing.visual.pause")}</p>
          </div>
        </div>
      )}
      {step === "review" && (
        <div className="landing-screen-body">
          <h3>{t("landing.visual.review")}</h3>
          <div className="landing-trade-table">
            <div>
              <strong>{t("landing.visual.trade")}</strong>
              <strong>{t("landing.visual.result")}</strong>
              <strong>{t("landing.visual.rules")}</strong>
            </div>
            <div>
              <span>{"EUR/USD"}</span>
              <span className="landing-loss">
                {number(-1)}
                {" R"}
              </span>
              <span>
                <Check size={16} aria-hidden="true" />
                {t("landing.visual.followed")}
              </span>
            </div>
            <div>
              <span>{"EUR/USD"}</span>
              <span className="landing-loss">{number(-1.4)} R</span>
              <span className="landing-warning">{t("landing.visual.deviation")}</span>
            </div>
          </div>
          <p className="landing-review-note">{t("landing.visual.improvement")}</p>
        </div>
      )}
    </div>
  );
}

export function LandingProcess({
  state,
  dispatch,
}: {
  state: TourState;
  dispatch: Dispatch<TourAction>;
}) {
  const { t } = useLanguage();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const step = TOUR_STEPS[state.index];
  const select = (index: number) => dispatch({ type: "goto", index });
  const keyboardSelect = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TOUR_STEPS.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + TOUR_STEPS.length) % TOUR_STEPS.length;
    select(next);
    tabs.current[next]?.focus();
  };
  const complete = isTourComplete(state);
  return (
    <section id="how" className="landing-section landing-process" aria-labelledby="process-heading">
      <div className="landing-container">
        <SectionIntro
          id="process-heading"
          eyebrowKey="landing.nav.how"
          titleKey="landing.process.title"
          bodyKey="landing.process.body"
        />
        <div role="tablist" aria-label={t("landing.nav.how")} className="landing-process-tabs">
          {TOUR_STEPS.map((name, index) => {
            const Icon = STEP_ICONS[name];
            return (
              <button
                type="button"
                key={name}
                role="tab"
                id={`process-tab-${name}`}
                aria-selected={index === state.index}
                aria-controls={`process-panel-${name}`}
                tabIndex={index === state.index ? 0 : -1}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                onClick={() => select(index)}
                onKeyDown={(event) => keyboardSelect(event, index)}
              >
                <span className="landing-step-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <span className="landing-step-icon" aria-hidden="true">
                  <Icon size={30} strokeWidth={1.6} />
                </span>
                <span className="landing-step-title">{t(`landing.process.${name}.name`)}</span>
                <span className="landing-step-caption">{t(`landing.process.${name}.caption`)}</span>
              </button>
            );
          })}
        </div>
        <div className="landing-process-progress" aria-hidden="true">
          {TOUR_STEPS.map((name, index) => (
            <span key={name} className={state.visited.includes(index) ? "is-visited" : undefined} />
          ))}
        </div>
        <p className="landing-demo-disclosure">{t("landing.process.example")}</p>
        {TOUR_STEPS.map((name) => (
          <div
            key={name}
            role="tabpanel"
            id={`process-panel-${name}`}
            aria-labelledby={`process-tab-${name}`}
            hidden={name !== step}
            tabIndex={0}
          >
            {name === step && (
              <div className="landing-process-layout">
                <ProcessVisual step={step} />
                <div className="landing-process-explanation">
                  {EXPLANATION_PARTS.map(({ part, Icon }) => (
                    <div key={part} className={`landing-explanation-${part}`}>
                      <Icon size={24} strokeWidth={1.7} aria-hidden="true" />
                      <h3>{t(`landing.process.${part}`)}</h3>
                      <p>{t(`landing.process.${step}.${part}`)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        <div className="landing-process-controls">
          <button
            type="button"
            className="landing-button landing-button-secondary"
            disabled={state.index === 0}
            onClick={() => dispatch({ type: "prev" })}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            {t("landing.process.previous")}
          </button>
          {state.index < TOUR_STEPS.length - 1 ? (
            <button
              type="button"
              className="landing-button landing-button-secondary"
              onClick={() => dispatch({ type: "next" })}
            >
              {t("landing.process.next")}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="landing-button landing-button-secondary"
              onClick={() => dispatch({ type: "replay" })}
            >
              <RotateCcw size={18} aria-hidden="true" />
              {t("landing.process.restart")}
            </button>
          )}
        </div>
        {complete && (
          <div className="landing-process-complete">
            <p role="status">{t("landing.process.complete")}</p>
            <SignupCta placement="process_complete" />
          </div>
        )}
      </div>
    </section>
  );
}
