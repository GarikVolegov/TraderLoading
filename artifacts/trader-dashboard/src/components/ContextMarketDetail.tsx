import { useId, useState } from 'react';
import type { MarketContext } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'wouter';
import { Activity, Scale, TrendingUp, Calendar, ChevronDown, ChevronUp, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function PriceHistory({ data }: { data: MarketContext | undefined }) {
  const { t } = useLanguage();
  const id = useId();
  const points = data?.priceHistory ?? [];

  if (points.length < 2) return null;

  const low = Math.min(...points.map((p) => p.close));
  const high = Math.max(...points.map((p) => p.close));
  const span = high - low || 1;
  const lastPrice = points.at(-1)?.close ?? 0;
  const prevPrice = points.length > 1 ? points[points.length - 2].close : lastPrice;
  const changePct = prevPrice > 0 ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;

  const width = 600;
  const height = 80;
  const padY = 8;
  const usableHeight = height - padY * 2;

  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = padY + usableHeight - ((p.close - low) / span) * usableHeight;
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const startDate = points[0].time.slice(0, 10);
  const endDate = points.at(-1)?.time.slice(0, 10) ?? '';

  return (
    <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/95 p-3.5 shadow-lg">
      <div className="flex items-center justify-between pb-2 border-b border-[#C5A059]/15">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#C5A059]" />
          <span className="text-xs font-semibold text-zinc-200 tracking-tight">
            {t('center.price_history', { count: points.length })}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-zinc-100 font-bold whitespace-nowrap">
            {lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
              changePct >= 0
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}
          >
            {changePct >= 0 ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Area Grafico / Sparkline */}
      <div className="relative mt-3 h-[76px] w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={t('center.price_history', { count: points.length })}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C5A059" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#C5A059" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#C5A059" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L${width},${height} L0 contend L0,${height} Z`} fill={`url(#${id})`} />
          <path
            d={path}
            fill="none"
            stroke="#C5A059"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* Date di Osservazione chiaramente distanziate */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#C5A059]/10 text-[10px] font-mono text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Inizio:</span>
          <span className="text-zinc-300 font-medium whitespace-nowrap">{startDate}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-zinc-500">
          <span>Min: <strong className="text-zinc-300 font-mono">{low.toFixed(2)}</strong></span>
          <span>·</span>
          <span>Max: <strong className="text-zinc-300 font-mono">{high.toFixed(2)}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Fine:</span>
          <span className="text-zinc-300 font-medium whitespace-nowrap">{endDate}</span>
        </div>
      </div>
    </div>
  );
}

export function ContextMarketDetail({ data }: { data: MarketContext | undefined }) {
  const { t, language } = useLanguage();
  const [showHistory, setShowHistory] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat(language, {
      maximumFractionDigits: Math.abs(n) < 1 ? 5 : 2,
    }).format(n);

  const fmtInt = (n: number) =>
    new Intl.NumberFormat(language, {
      maximumFractionDigits: 0,
    }).format(n);

  const reports = data?.cotReports ?? [];

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label={t('center.market_detail')}>
      {/* ── CARD 1: POSIZIONAMENTO CFTC COT ── */}
      <div className="flex flex-col justify-between rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/95 p-4 shadow-lg min-w-0">
        <div>
          <header className="flex items-center justify-between pb-2.5 border-b border-[#C5A059]/15">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-[#C5A059]" />
              <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">{t('center.cot')}</h2>
            </div>
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/25 px-1.5 py-0.5 rounded whitespace-nowrap">
              {t('center.cot_provider')} · {t('center.weekly')}
            </span>
          </header>

          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
            {t('center.cot_scope')}
          </p>

          {reports.length > 0 ? (
            <div className="mt-3 space-y-2.5">
              {reports.map((r) => {
                const isPositive = r.nonCommNet > 0;
                return (
                  <div
                    key={r.currency}
                    className="p-3 rounded-lg border border-white/5 bg-[#11131c]/80 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-100 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                          {r.currency}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono whitespace-nowrap">
                          {t('center.report_date', { date: r.date })}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-mono uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                          r.status === 'stale'
                            ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400'
                            : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                        }`}
                      >
                        {r.status === 'stale' ? t('market.stale') : 'CONFERMATO'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-xs text-zinc-400">{t('center.net_contracts')}:</span>
                      <strong
                        className={`font-mono text-sm font-bold whitespace-nowrap ${
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {fmtInt(r.nonCommNet)}
                      </strong>
                    </div>

                    {/* Breakdown 3 categorie */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 text-[10px] font-mono border-t border-white/5 text-center">
                      <div className="p-1.5 rounded bg-black/30 border border-white/5">
                        <span className="text-zinc-500 block text-[9px] uppercase">Non-Comm</span>
                        <span className={`font-bold ${r.nonCommNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {r.nonCommNet >= 0 ? '+' : ''}{fmtInt(r.nonCommNet)}
                        </span>
                      </div>
                      <div className="p-1.5 rounded bg-black/30 border border-white/5">
                        <span className="text-zinc-500 block text-[9px] uppercase">Comm (Hedge)</span>
                        <span className={`font-bold ${r.commNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {r.commNet >= 0 ? '+' : ''}{fmtInt(r.commNet)}
                        </span>
                      </div>
                      <div className="p-1.5 rounded bg-black/30 border border-white/5">
                        <span className="text-zinc-500 block text-[9px] uppercase">Retail</span>
                        <span className={`font-bold ${r.retailNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {r.retailNet >= 0 ? '+' : ''}{fmtInt(r.retailNet)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Storico a tendina */}
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg border border-[#C5A059]/20 bg-[#C5A059]/5 hover:bg-[#C5A059]/10 text-xs text-[#E8C56A] font-medium transition-colors"
              >
                <span>{t('center.cot_history')}</span>
                {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showHistory && reports[0]?.history && (
                <div className="mt-2 p-2 rounded-lg bg-black/50 border border-white/10 overflow-x-auto">
                  <table className="w-full text-[10px] font-mono text-zinc-300 text-right">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-500 text-[9px] uppercase">
                        <th className="text-left pb-1.5">Data</th>
                        <th className="pb-1.5">Non-Comm</th>
                        <th className="pb-1.5">Comm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {reports[0].history
                        .slice()
                        .reverse()
                        .slice(0, 6)
                        .map((h) => (
                          <tr key={h.date} className="hover:bg-white/5">
                            <td className="text-left py-1 text-zinc-400">{h.date}</td>
                            <td className={`py-1 ${h.nonCommNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {h.nonCommNet >= 0 ? '+' : ''}{fmtInt(h.nonCommNet)}
                            </td>
                            <td className={`py-1 ${h.commNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {h.commNet >= 0 ? '+' : ''}{fmtInt(h.commNet)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-white/10 text-center text-xs text-zinc-500">
              {t('market.unavailable')}
            </div>
          )}
        </div>
      </div>

      {/* ── CARD 2: VOLATILITÀ & AVERAGE DAILY RANGE (ADR) ── */}
      <div className="flex flex-col justify-between rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/95 p-4 shadow-lg min-w-0">
        <div>
          <header className="flex items-center justify-between pb-2.5 border-b border-[#C5A059]/15">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#C5A059]" />
              <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">{t('center.volatility')}</h2>
            </div>
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/25 px-1.5 py-0.5 rounded whitespace-nowrap">
              {t('center.adr_tf')}
            </span>
          </header>

          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
            {t('center.adr_scope')}
          </p>

          {/* Griglia ADR Multi-Timeframe */}
          <div className="grid grid-cols-5 gap-2 mt-3.5">
            {[5, 22, 66, 132, 252].map((days, i) => {
              const r = data?.ranges?.find((row) => row.days === days);
              const label = ['1W', '1M', '3M', '6M', '1Y'][i];
              return (
                <div
                  key={days}
                  className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#11131c]/90 border border-[#C5A059]/15 text-center"
                >
                  <span className="font-mono text-[9px] font-bold text-[#E8C56A] uppercase tracking-wider">
                    {label}
                  </span>
                  <strong className="mt-1 font-mono text-xs font-bold text-zinc-100 whitespace-nowrap">
                    {r?.value != null ? fmt(r.value) : '—'}
                  </strong>
                  <span className="mt-0.5 text-[8px] font-mono text-zinc-500 whitespace-nowrap">
                    {r ? `${r.samples}/${days}` : '—'} {t('center.bars')}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-zinc-500 italic">
            {t('center.range_note')}
          </p>
        </div>

        {/* Collegamenti rapidi agli strumenti operativi */}
        <div className="flex items-center gap-3 pt-3 mt-4 border-t border-[#C5A059]/15 text-xs font-medium">
          <Link
            href="/journal?t=piano&vista=agenda"
            className="text-[#E8C56A] hover:text-[#F3D88C] flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <span>{t('center.calendar_link')}</span>
            <ArrowUpRight size={13} />
          </Link>
          <span className="text-zinc-600">·</span>
          <Link
            href="/?vista=notizie"
            className="text-[#E8C56A] hover:text-[#F3D88C] flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <span>{t('center.news_link')}</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
