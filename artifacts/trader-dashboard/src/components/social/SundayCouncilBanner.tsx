import { useEffect, useState } from "react";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isLiveWindow: boolean;
}

function computeNextSundayCouncil(): CountdownState {
  const now = new Date();
  // Next Sunday at 21:00 local time (Council convocation hour)
  const target = new Date(now);
  const day = now.getDay(); // 0 = Sunday
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  target.setDate(now.getDate() + daysUntilSunday);
  target.setHours(21, 0, 0, 0);

  // If it's Sunday between 21:00 and 22:30, the Council is in session
  const diffMs = target.getTime() - now.getTime();
  if (day === 0 && diffMs <= 0 && diffMs >= -90 * 60 * 1000) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isLiveWindow: true };
  }

  // If Sunday 21:00 has already passed, roll forward 7 days
  if (diffMs <= 0) {
    target.setDate(target.getDate() + 7);
  }

  const remainingSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const days = Math.floor(remainingSec / 86400);
  const hours = Math.floor((remainingSec % 86400) / 3600);
  const minutes = Math.floor((remainingSec % 3600) / 60);
  const seconds = remainingSec % 60;

  return { days, hours, minutes, seconds, isLiveWindow: false };
}

export function SundayCouncilBanner() {
  const [countdown, setCountdown] = useState<CountdownState>(() => computeNextSundayCouncil());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdown(computeNextSundayCouncil());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  const countdownTimer = countdown.isLiveWindow ? (
    <span className="inline-flex items-center gap-2 rounded-lg border border-[#C5A059] bg-[#C5A059]/20 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-[#E8C56A] shadow-[0_0_15px_rgba(197,160,89,0.3)]">
      <span className="h-2 w-2 animate-pulse rounded-full bg-[#10B981]" />
      CONCILIO IN SESSIONE
    </span>
  ) : (
    <div
      className="flex items-center gap-1.5 rounded-lg border border-[#C5A059]/30 bg-[#07080B] px-3 py-1 font-mono text-xs text-[#F4F4F6] shadow-inner"
      aria-label="Conto alla rovescia per Il Concilio della Domenica"
    >
      <div className="text-center">
        <span className="font-bold text-[#E8C56A]">{pad(countdown.days)}</span>
        <span className="ml-0.5 text-[10px] text-slate-500">g</span>
      </div>
      <span className="text-slate-600">:</span>
      <div className="text-center">
        <span className="font-bold text-[#E8C56A]">{pad(countdown.hours)}</span>
        <span className="ml-0.5 text-[10px] text-slate-500">h</span>
      </div>
      <span className="text-slate-600">:</span>
      <div className="text-center">
        <span className="font-bold text-[#E8C56A]">{pad(countdown.minutes)}</span>
        <span className="ml-0.5 text-[10px] text-slate-500">m</span>
      </div>
      <span className="text-slate-600">:</span>
      <div className="text-center">
        <span className="font-bold text-[#E8C56A]">{pad(countdown.seconds)}</span>
        <span className="ml-0.5 text-[10px] text-slate-500">s</span>
      </div>
    </div>
  );

  return (
    <div
      className="mb-3 rounded-xl border border-[#C5A059]/35 bg-gradient-to-r from-[#0C0D13] via-[#12131A] to-[#0A0B10] px-4 py-2.5 shadow-[0_0_20px_rgba(197,160,89,0.1)] text-slate-200 transition-all"
      data-testid="sunday-council-banner"
    >
      {collapsed ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059]">
              <SigilIcon name="fratellanza" size={14} />
            </div>
            <span className="font-display text-xs font-bold text-white tracking-wide">
              Il Concilio della Domenica · 21:00 CET
            </span>
          </div>
          <div className="flex items-center gap-2">
            {countdownTimer}
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Espandi dettagli del concilio"
              className="p-1.5 rounded-lg border border-[#C5A059]/20 bg-[#12131A] text-slate-400 hover:text-white transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5 text-[#C5A059]" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.2)]">
              <SigilIcon name="fratellanza" size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C5A059]">
                  CONVOCAZIONE SETTIMANALE DELL&apos;ORDINE
                </span>
                <span className="rounded border border-[#C5A059]/30 bg-[#C5A059]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#E8C56A]">
                  DOMENICA · 21:00 CET
                </span>
              </div>
              <h2 className="mt-0.5 font-display text-sm font-semibold tracking-wide text-[#F4F4F6]">
                Il Concilio della Domenica
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Allineamento sovrano, lettura de <em>Il Libro della Verità</em> e{" "}
                <em>Contemplazione dello Scenario</em> macro della settimana.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {countdownTimer}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Minimizza banner del concilio"
              className="p-1.5 rounded-lg border border-[#C5A059]/20 bg-[#12131A] text-slate-400 hover:text-white transition-colors hidden sm:block"
              title="Riduci banner per aumentare lo spazio visivo"
            >
              <ChevronUp className="h-3.5 w-3.5 text-[#C5A059]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
