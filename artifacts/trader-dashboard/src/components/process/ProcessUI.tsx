import {
  cloneElement,
  isValidElement,
  type ReactNode,
  useId,
  useRef,
  useEffect,
} from "react";
import { Check, ArrowRight, Circle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { processText, type ProcessCopyKey } from "@/lib/processCopy";
import type { ProcessPhase, ProcessProgress, ProcessSession } from "@/lib/traderProcessApi";
import { ProcessScene, type ProcessVisualStage } from "./ProcessScene";
import "./process.css";

export function useProcessCopy() {
  const { language } = useLanguage();
  return (key: ProcessCopyKey) => processText(language, key);
}
export function ProcessFrame({
  title,
  subtitle,
  visualStage,
  children,
}: {
  title: string;
  subtitle: string;
  visualStage?: ProcessVisualStage;
  children: ReactNode;
}) {
  const copy = useProcessCopy();
  return (
    <PageLayout quiet>
      <main className="process-workspace limen-scroll-pane">
        <header className={`process-heading${visualStage ? " process-heading-immersive" : ""}`}>
          <div className="process-heading-copy">
            <p className="process-eyebrow">{`${copy("path")} // CICLO OPERATIVO`}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {visualStage && <ProcessScene stage={visualStage} copy={copy} />}
        </header>
        {children}
      </main>
    </PageLayout>
  );
}
export function dailyVisualStage(session: ProcessSession | null): ProcessVisualStage {
  if (!session || ["preparation", "plan"].includes(session.state)) return "prepare";
  if (session.state === "closed") return "complete";
  if (session.draft?.stage === "closure" && session.draft.open) return "close";
  return "operate";
}
export function PhaseRail({ phase }: { phase: ProcessPhase }) {
  const copy = useProcessCopy();
  const phases: ProcessPhase[] = ["define", "verify", "apply", "consolidate"];
  return (
    <ol className="process-rail" aria-label={copy("path")}>
      {phases.map((item, index) => (
        <li key={item} aria-current={item === phase ? "step" : undefined}>
          <span className="process-step-number">
            {index < phases.indexOf(phase) ? <Check size={14} aria-hidden /> : index + 1}
          </span>
          <span>{copy(item)}</span>
        </li>
      ))}
    </ol>
  );
}
export function SessionRail({ session }: { session: ProcessSession | null }) {
  const copy = useProcessCopy();
  const steps = ["dailyPrepare", "dailyOperate", "dailyClose"] as const;
  const index =
    !session || ["preparation", "plan"].includes(session.state)
      ? 0
      : session.state === "closed" || (session.draft?.stage === "closure" && session.draft.open)
        ? 2
        : 1;
  return (
    <nav aria-label={copy("sessionProgress")} className="process-session-rail">
      <span>{copy("sessionProgress")}</span>
      <ol>
        {steps.map((step, i) => (
          <li key={step} aria-current={i === index ? "step" : undefined}>
            <span aria-hidden>
              {i < index || session?.state === "closed" ? <Check size={13} /> : i + 1}
            </span>
            {copy(step)}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function ProcessPanel({
  title,
  description,
  children,
  focusHeading = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  focusHeading?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) heading.current?.focus();
  }, [focusHeading, title]);
  return (
    <section className="process-panel">
      <header>
        <h2 ref={heading} tabIndex={focusHeading ? -1 : undefined}>
          {title}
        </h2>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}
export function ProcessField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="process-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{ id?: string; "aria-describedby"?: string }>(children)
        ? cloneElement(children, { id, "aria-describedby": hint ? `${id}-hint` : undefined })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
/** Native radio groups keep choices visible, required and keyboard-operable. */
export function ProcessChoices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="process-choice-group">
      <legend>{label}</legend>
      <div className="process-choices">
        {options.map((option) => (
          <label
            key={option.value}
            className={`process-choice${value === option.value ? " is-selected" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              required
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function ProcessError({ error }: { error: unknown }) {
  const copy = useProcessCopy();
  const id = useId();
  return error ? (
    <p id={id} role="alert" className="process-error">
      {error instanceof Error ? error.message : copy("saveError")}
    </p>
  ) : null;
}
export function ProcessLoading({ error, retry }: { error?: unknown; retry: () => void }) {
  const copy = useProcessCopy();
  return (
    <ProcessFrame title={copy("today")} subtitle={copy("path")}>
      {error ? (
        <ProcessPanel title={copy("loadError")}>
          <Button onClick={retry}>{copy("retry")}</Button>
        </ProcessPanel>
      ) : (
        <p role="status">{copy("loading")}</p>
      )}
    </ProcessFrame>
  );
}
export function ProgressDetails({ progress }: { progress: ProcessProgress }) {
  const copy = useProcessCopy();
  const { language } = useLanguage();
  const number = (value: number | null) =>
    value == null
      ? "—"
      : new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value);
  const report = progress.report;
  return (
    <>
      {progress.phase !== "define" && (
        <section className="process-results" aria-label={copy("economic")}>
          <dl>
            <div>
              <dt>{copy("eligible")}</dt>
              <dd>{report.eligibleSamples}</dd>
            </div>
            <div>
              <dt>{copy("expectancy")}</dt>
              <dd>{number(report.expectancyR)} R</dd>
            </div>
            <div>
              <dt>{copy("drawdown")}</dt>
              <dd>{number(report.drawdownR)} R</dd>
            </div>
          </dl>
          <p>
            {copy("incomplete")}: {report.incompleteSamples}. {copy("incompleteHint")}
          </p>
          {report.amounts.length > 0 && (
            <details>
              <summary>{copy("netPnl")}</summary>
              <ul>
                {report.amounts.map((a) => (
                  <li key={`${a.account}:${a.currency}`}>
                    {a.account}: {number(a.netPnl)} {a.currency}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      {["apply", "consolidate"].includes(progress.phase) && (
        <section className="process-discipline" aria-label={copy("adherence")}>
          <span>{copy("adherence")}</span>
          <strong>
            {number(report.adherencePct)}
            {report.adherencePct == null ? "" : "%"}
          </strong>
        </section>
      )}
      {progress.checks.some((item) => !item.met) && (
        <ul className="process-checks" aria-label={copy("missing")}>
          {progress.checks
            .filter((item) => !item.met)
            .map((item) => (
              <li key={item.key}>
                {item.met ? (
                  <Check size={17} className="text-primary" aria-hidden />
                ) : (
                  <Circle size={15} className="text-muted-foreground" aria-hidden />
                )}
                <div>
                  <strong>
                    {copy(
                      item.key === "samples" && progress.phase === "apply"
                        ? "check_live_samples"
                        : (`check_${item.key}` as ProcessCopyKey),
                    )}
                  </strong>
                  <span>{item.detail}</span>
                </div>
                <small>{copy(item.met ? "met" : "missing")}</small>
              </li>
            ))}
        </ul>
      )}
      {progress.checks.some((item) => item.met) && (
        <details>
          <summary>
            {copy("met")} ({progress.checks.filter((item) => item.met).length})
          </summary>
          <ul className="process-checks">
            {progress.checks
              .filter((item) => item.met)
              .map((item) => (
                <li key={item.key}>
                  <Check size={17} className="text-primary" aria-hidden />
                  <div>
                    <strong>
                      {copy(
                        item.key === "samples" && progress.phase === "apply"
                          ? "check_live_samples"
                          : (`check_${item.key}` as ProcessCopyKey),
                      )}
                    </strong>
                    <span>{item.detail}</span>
                  </div>
                </li>
              ))}
          </ul>
        </details>
      )}
    </>
  );
}
export function ProcessLink({
  href,
  children,
  beforeNavigate,
}: {
  href: string;
  children: ReactNode;
  beforeNavigate?: () => Promise<void>;
}) {
  const [, navigate] = useLocation();
  return (
    <Link
      href={href}
      onClick={async (event) => {
        if (!beforeNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        try {
          await beforeNavigate();
          navigate(href);
        } catch {
          /* The draft status exposes retry or reload. */
        }
      }}
      className="process-support-link"
    >
      {children}
      <ArrowRight size={15} aria-hidden />
    </Link>
  );
}
