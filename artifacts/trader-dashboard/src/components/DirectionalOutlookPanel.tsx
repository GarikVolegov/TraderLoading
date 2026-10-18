import { ArrowDownRight, ArrowUpRight, Minus, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { canDisplayProbabilities, type DirectionalOutlook } from "@/lib/marketIntelligenceApi";

export function DirectionalOutlookPanel({
  outlook,
  pair,
  now,
  fresh,
}: {
  outlook?: DirectionalOutlook | null;
  pair: string;
  now: number;
  fresh: boolean;
}) {
  const { t, language } = useLanguage();
  const available = fresh && canDisplayProbabilities(outlook, pair, now);
  const number = (v: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 5 }).format(v);
  const time = (stamp: string) =>
    Number.isFinite(Date.parse(stamp))
      ? new Intl.DateTimeFormat(language, {
          timeZone: "Europe/Rome",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(stamp))
      : "—";
  const reason = !fresh
    ? "stale"
    : outlook?.status === "available" && !available
      ? outlook.validation?.passed
        ? "insufficient"
        : "unvalidated"
      : (outlook?.status ?? "insufficient");
  const unavailableReason =
    outlook?.reason === "market_calendar_unavailable"
      ? "intelligence.calendar_unavailable"
      : outlook?.reason === "market_calendar_unavailable_or_closed"
        ? "intelligence.market_window_unavailable"
        : null;
  const scopeKey = outlook?.sources.includes("macro_pit_v1")
    ? "intelligence.macro_model_scope"
    : outlook?.sources.length === 1 && outlook.sources[0] === "dukascopy_bid"
      ? "intelligence.model_scope"
      : null;
  return (
    <section
      className="context-surface intelligence-outlook"
      aria-label={t("intelligence.outlook")}
      data-testid="directional-outlook"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <span className="context-eyebrow">{pair} / 4h</span>
          <h2 className="mt-1 text-base font-semibold">{t("intelligence.outlook")}</h2>
        </div>
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
      </header>
      {available && outlook?.probabilities ? (
        <>
          <div className="intelligence-probabilities">
            {(
              [
                { key: "up", Icon: ArrowUpRight },
                { key: "flat", Icon: Minus },
                { key: "down", Icon: ArrowDownRight },
              ] as const
            ).map(({ key, Icon }) => (
              <div key={key} className={`intelligence-probability intelligence-${key}`}>
                <span className="flex items-center gap-1 text-xs">
                  <Icon size={15} />
                  {t(`intelligence.${key}`)}
                </span>
                <strong className="font-mono text-2xl">
                  {new Intl.NumberFormat(language, {
                    style: "percent",
                    maximumFractionDigits: 0,
                  }).format(outlook.probabilities![key])}
                </strong>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("intelligence.target")} {time(outlook.targetEnd)} · {t("intelligence.timezone")}
          </p>
          {outlook.neutralBand && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("intelligence.neutral_band")} {number(outlook.neutralBand.lower)}–
              {number(outlook.neutralBand.upper)}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("intelligence.probability_hint")}</p>
        </>
      ) : (
        <div
          className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
          role="status"
        >
          <strong className="text-sm">
            {t(
              unavailableReason
                ? "intelligence.probability_unavailable"
                : `intelligence.status.${reason}`,
            )}
          </strong>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(unavailableReason ?? "intelligence.no_probability")}
          </p>
          {outlook && outlook.status !== "unsupported" && !outlook.modelVersion && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("intelligence.model_unavailable")}
            </p>
          )}
          {outlook?.reason === "macro_history_unavailable" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("intelligence.macro_history_unavailable")}
            </p>
          )}
        </div>
      )}
      {outlook && (
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer py-2 font-semibold text-foreground">
            {t("intelligence.method")}
          </summary>
          <div className="space-y-2 py-2">
            <p>
              {t("intelligence.cutoff")} {time(outlook.cutoffAt)} · {t("intelligence.timezone")}
            </p>
            {outlook.referencePrice !== null && (
              <p>
                {t("intelligence.reference")} {number(outlook.referencePrice)} ·{" "}
                {outlook.referenceObservedAt ? time(outlook.referenceObservedAt) : "—"}
              </p>
            )}
            <p>
              {t("intelligence.sources")} {outlook.sources.join(", ")}
            </p>
            <p className="break-all">
              {t("intelligence.model")} {outlook.modelVersion ?? "—"}
            </p>
            {scopeKey && <p>{t(scopeKey)}</p>}
            <p>
              {t("intelligence.validation")}{" "}
              {t(
                outlook.validation?.passed
                  ? "intelligence.validated"
                  : "intelligence.pending_validation",
              )}
            </p>
            {typeof outlook.validation?.samples === "number" && (
              <p>{t("intelligence.validation_samples", { count: outlook.validation.samples })}</p>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
