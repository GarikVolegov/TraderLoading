import { AlertCircle, ChevronDown, Database, ShieldCheck } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { formatUtcReplayTime } from "./dateTime";
import { terminalLocale } from "./format";
import type { ReplayEngine } from "./useReplayEngine";

export function CoverageStatus({ engine }: { engine: ReplayEngine }) {
  const { language } = useLanguage();
  const meta = engine.meta;
  const coverage = meta?.coverage;
  const status = coverage?.status ?? (meta?.warehouse ? "partial" : "unavailable");
  const Icon = status === "verified" ? ShieldCheck : status === "partial" ? AlertCircle : Database;
  const label = uiText(`backtest_terminal.coverage_${status}`);
  const first = meta?.warehouse?.firstTs;
  const last = meta?.warehouse?.lastTs;
  const locale = terminalLocale(language);
  return (
    <details className="btm-coverage" data-status={status}>
      <summary title={label}>
        <Icon size={14} /> <span>{label}</span> <ChevronDown size={11} />
      </summary>
      <div className="btm-coverage-popover">
        <strong>{uiText("backtest_terminal.history_available")}</strong>
        <p>{first != null && last != null
          ? `${formatUtcReplayTime(first, locale)} → ${formatUtcReplayTime(last, locale)} ${uiText("backtest_terminal.timezone_utc")}`
          : uiText("backtest_terminal.coverage_unavailable")}</p>
        {meta?.instrument && <p>{meta.instrument}</p>}
        {meta?.source && <div className="btm-coverage-row"><span>{uiText("backtest_terminal.data_source")}</span><b>{meta.source}</b></div>}
        {coverage && <>
          <div className="btm-coverage-row"><span>{uiText("backtest_terminal.saved_candles")}</span><b>{coverage.candleCount != null ? `${coverage.candleCount.toLocaleString(locale)} M1` : "—"}</b></div>
          <div className="btm-coverage-row"><span>{uiText("backtest_terminal.missing_days")}</span><b>{coverage.missingDayCount ?? "—"}</b></div>
          {coverage.lastImportStatus === "running" && <p role="status">{uiText("backtest_terminal.import_running")}</p>}
          {coverage.lastImportStatus === "failed" && <p role="status">{uiText("backtest_terminal.import_failed")}</p>}
          {coverage.missingDays?.length > 0 && <p className="btm-coverage-dates">{coverage.missingDays.slice(0, 12).join(", ")}{coverage.missingDayCount > 12 ? " …" : ""}</p>}
          <p className="btm-muted">{uiText("backtest_terminal.coverage_note")}</p>
        </>}
      </div>
    </details>
  );
}
