import { AlertCircle, Calendar, ChevronDown, Database, HardDrive, ShieldCheck } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { formatUtcReplayTime } from "./dateTime";
import { terminalLocale } from "./format";
import type { ReplayEngine } from "./useReplayEngine";

const CHRONOS_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;
const MONTH_INITIALS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

export function CoverageStatus({
  engine,
  onOpenOfflineModal,
}: {
  engine: ReplayEngine;
  onOpenOfflineModal?: () => void;
}) {
  const { language } = useLanguage();
  const meta = engine.meta;
  const coverage = meta?.coverage;
  const status = coverage?.status ?? (meta?.warehouse ? "partial" : "unavailable");
  const Icon = status === "verified" ? ShieldCheck : status === "partial" ? AlertCircle : Database;
  const label = uiText(`backtest_terminal.coverage_${status}`);
  const first = meta?.warehouse?.firstTs;
  const last = meta?.warehouse?.lastTs;
  const locale = terminalLocale(language);

  // Check if a calendar month [year, monthIdx (0-11)] is covered in the warehouse
  const isMonthCovered = (year: number, monthIdx: number): boolean => {
    if (first == null || last == null) return false;
    const mStart = Date.UTC(year, monthIdx, 1) / 1000;
    const mEnd = Date.UTC(year, monthIdx + 1, 1) / 1000;
    if (coverage?.verifiedRanges && coverage.verifiedRanges.length > 0) {
      return coverage.verifiedRanges.some((r) => r.from <= mStart && r.to >= mEnd);
    }
    return first <= mStart && last >= mEnd;
  };

  const handleJump = (year: number, monthIdx: number) => {
    const mm = String(monthIdx + 1).padStart(2, "0");
    engine.jumpToDate(`${year}-${mm}-01`);
  };

  return (
    <details className="btm-coverage" data-status={status}>
      <summary title={label}>
        <Icon size={14} /> <span>{label}</span> <ChevronDown size={11} />
      </summary>
      <div className="btm-coverage-popover">
        <strong>{uiText("backtest_terminal.history_available")}</strong>
        <p className="whitespace-nowrap">{first != null && last != null
          ? `${formatUtcReplayTime(first, locale)} → ${formatUtcReplayTime(last, locale)} ${uiText("backtest_terminal.timezone_utc")}`
          : uiText("backtest_terminal.coverage_unavailable")}</p>
        <div className="btm-coverage-row"><span>{uiText("backtest_terminal.sovereign_archive")}</span><b className="whitespace-nowrap font-mono">2020 — 2026+</b></div>
        {meta?.instrument && <p>{meta.instrument}</p>}
        {meta?.source && <div className="btm-coverage-row"><span>{uiText("backtest_terminal.data_source")}</span><b className="whitespace-nowrap font-mono">{meta.source}</b></div>}
        {coverage && <>
          <div className="btm-coverage-row"><span>{uiText("backtest_terminal.saved_candles")}</span><b className="whitespace-nowrap font-mono">{coverage.candleCount != null ? `${coverage.candleCount.toLocaleString(locale)} M1` : "—"}</b></div>
          <div className="btm-coverage-row"><span>{uiText("backtest_terminal.missing_days")}</span><b className="whitespace-nowrap font-mono">{coverage.missingDayCount ?? "—"}</b></div>
          {coverage.lastImportStatus === "running" && <p role="status">{uiText("backtest_terminal.import_running")}</p>}
          {coverage.lastImportStatus === "failed" && <p role="status">{uiText("backtest_terminal.import_failed")}</p>}
          {coverage.missingDays?.length > 0 && <p className="btm-coverage-dates">{coverage.missingDays.slice(0, 12).join(", ")}{coverage.missingDayCount > 12 ? " …" : ""}</p>}
          <p className="btm-muted">{uiText("backtest_terminal.coverage_note")}</p>
        </>}

        {/* Heat-Grid Sovrana 2020-2026 */}
        <div className="mt-3 pt-3 border-t border-[var(--btm-hair)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#E8C56A] flex items-center gap-1.5">
              <Calendar size={11} className="text-[#C5A059]" />
              {uiText("backtest_terminal.timeline_grid_title")}
            </span>
            <span className="text-[9px] font-mono text-[var(--btm-mut)] whitespace-nowrap">2020 — 2026</span>
          </div>

          <div className="space-y-1">
            {CHRONOS_YEARS.map((year) => (
              <div key={year} className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-[var(--btm-mut)] w-7 shrink-0">{year}</span>
                <div className="grid grid-cols-12 gap-0.5 flex-1">
                  {MONTH_INITIALS.map((mLabel, mIdx) => {
                    const covered = isMonthCovered(year, mIdx);
                    const isFuture = Date.UTC(year, mIdx, 1) > Date.now();
                    const mm = String(mIdx + 1).padStart(2, "0");
                    const dateStr = `${year}-${mm}-01`;
                    return (
                      <button
                        key={mLabel}
                        type="button"
                        onClick={() => covered && handleJump(year, mIdx)}
                        disabled={!covered}
                        title={`${dateStr}${covered ? " · M1" : ""}`}
                        aria-label={`${dateStr}`}
                        className={`h-4 rounded-[2px] text-[8px] font-mono flex items-center justify-center transition-all ${
                          covered
                            ? "bg-[#C5A059]/20 hover:bg-[#C5A059]/40 text-[#E8C56A] border border-[#C5A059]/35 hover:scale-105 cursor-pointer shadow-sm"
                            : isFuture
                            ? "bg-transparent text-white/10 border border-transparent cursor-not-allowed"
                            : "bg-white/[0.03] text-white/20 border border-white/5 cursor-not-allowed"
                        }`}
                      >
                        {mLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="btm-muted mt-2 text-[10px] text-[var(--btm-mut)]">
            {uiText("backtest_terminal.timeline_jump_hint")}
          </p>
        </div>

        {onOpenOfflineModal && (
          <div className="mt-3 pt-2.5 border-t border-[var(--btm-hair)]">
            <button
              type="button"
              onClick={onOpenOfflineModal}
              className="w-full py-1.5 px-2.5 rounded bg-[#C5A059]/15 hover:bg-[#C5A059]/25 border border-[#C5A059]/35 text-[#E8C56A] text-[10px] font-mono font-semibold tracking-wide flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <HardDrive size={12} />
              <span>{uiText("backtest_terminal.offline_storage_button")}</span>
            </button>
          </div>
        )}
      </div>
    </details>
  );
}