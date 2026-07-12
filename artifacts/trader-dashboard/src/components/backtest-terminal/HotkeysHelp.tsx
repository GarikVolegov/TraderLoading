// ─── Hotkeys cheatsheet ──────────────────────────────────────────────────────
import { X } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";

const HOTKEYS: Array<{ keys: string; labelKey: string }> = [
  { keys: "Space", labelKey: "backtest_terminal.hk.play" },
  { keys: "← →", labelKey: "backtest_terminal.hk.step" },
  { keys: "↑ ↓", labelKey: "backtest_terminal.hk.speed" },
  { keys: "B / S", labelKey: "backtest_terminal.hk.trade" },
  { keys: "C", labelKey: "backtest_terminal.hk.close" },
  { keys: "R", labelKey: "backtest_terminal.hk.restart" },
  { keys: "+ −", labelKey: "backtest_terminal.hk.zoom" },
  { keys: "1…6", labelKey: "backtest_terminal.hk.timeframe" },
  { keys: "Esc", labelKey: "backtest_terminal.hk.exit" },
];

export function HotkeysHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={uiText("backtest_terminal.hotkeys")}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "hsl(222 47% 3% / 0.7)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 340,
          maxWidth: "90vw",
          borderRadius: 14,
          border: "1px solid var(--btm-hair)",
          background: "var(--btm-panel)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{uiText("backtest_terminal.hotkeys")}</span>
          <button type="button" className="btm-iconbtn" onClick={onClose} aria-label={uiText("backtest_terminal.close")}>
            <X size={15} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {HOTKEYS.map((hotkey) => (
            <div key={hotkey.keys} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, color: "var(--btm-mut)" }}>{uiText(hotkey.labelKey)}</span>
              <kbd
                style={{
                  fontFamily: "var(--btm-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--btm-hair)",
                  background: "var(--btm-cbg)",
                }}
              >
                {hotkey.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
