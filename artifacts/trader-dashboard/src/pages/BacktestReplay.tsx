// ─── Backtest replay terminal page ───────────────────────────────────────────
// Full-screen route (/backtest/:id/replay) rendered above the app chrome
// (z-60 > nav z-50): looks up the session, gates on Pro and mounts the
// terminal. Esc or the header back button return to /backtest.
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetBacktestSessions } from "@workspace/api-client-react";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { BacktestTerminal } from "@/components/backtest-terminal/BacktestTerminal";
import { uiText } from "@/contexts/LanguageContext";

export default function BacktestReplay({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  const sessions = useGetBacktestSessions();
  const sessionId = Number.parseInt(params.id, 10);
  const session = sessions.data?.find((candidate) => candidate.id === sessionId);

  const exit = () => navigate("/backtest");

  // The terminal covers the whole viewport: freeze the page scroll behind it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) navigate("/backtest");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  // Unknown session (deleted or foreign id): back to the session grid.
  useEffect(() => {
    if (sessions.isSuccess && !session) navigate("/backtest");
  }, [sessions.isSuccess, session, navigate]);

  if (!session) {
    return (
      <div className="btm-root">
        <div className="btm-center" style={{ position: "static", flex: 1 }}>
          {sessions.isPending ? <div className="btm-spin" aria-hidden="true" /> : <span>{uiText("backtest_terminal.session_missing")}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="btm-root">
      <ProUpgradeGate feature="backtest" fillViewport>
        <BacktestTerminal
          sessionKey={`backtest-session-${session.id}`}
          sessionName={session.name}
          symbol={session.pair}
          initialInterval={session.timeframe}
          onExit={exit}
        />
      </ProUpgradeGate>
    </div>
  );
}
