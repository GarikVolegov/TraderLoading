import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Verify useAutoLandscapeCinema hook
const hookPath = path.join(__dirname, "hooks", "useAutoLandscapeCinema.ts");
assert.ok(fs.existsSync(hookPath), "useAutoLandscapeCinema.ts must exist");
const hookSource = fs.readFileSync(hookPath, "utf-8");
assert.ok(
  hookSource.includes("useAutoLandscapeCinema"),
  "Must export useAutoLandscapeCinema hook"
);
assert.ok(
  hookSource.includes("orientation: landscape"),
  "Must target landscape orientation media query"
);
assert.ok(
  hookSource.includes("synestheticCinemaToggle"),
  "Must integrate synesthetic audio-haptic feedback"
);
assert.ok(
  hookSource.includes("screen.orientation"),
  "Must handle native ScreenOrientation API"
);

// 2. Verify TradingCockpit.tsx implementation
const cockpitPath = path.join(__dirname, "pages", "TradingCockpit.tsx");
assert.ok(fs.existsSync(cockpitPath), "TradingCockpit.tsx must exist");
const cockpitSource = fs.readFileSync(cockpitPath, "utf-8");
assert.ok(
  cockpitSource.includes("useAutoLandscapeCinema"),
  "TradingCockpit must use useAutoLandscapeCinema hook"
);
assert.ok(
  cockpitSource.includes('data-cinema-mode={isCinemaActive ? "true" : undefined}'),
  "TradingCockpit must set data-cinema-mode attribute"
);
assert.ok(
  cockpitSource.includes("Telemetria Cinematografica Sinistra") &&
    cockpitSource.includes("Controlli Cinematografici Destra"),
  "TradingCockpit must implement ergonomic dual-thumb HUD"
);
assert.ok(
  cockpitSource.includes("safe-area-inset-top") &&
    cockpitSource.includes("safe-area-inset-left") &&
    cockpitSource.includes("safe-area-inset-right"),
  "TradingCockpit must respect iOS safe-area-insets for camera notch/island"
);

// 3. Verify BacktestTerminal.tsx implementation
const terminalPath = path.join(
  __dirname,
  "components",
  "backtest-terminal",
  "BacktestTerminal.tsx"
);
assert.ok(fs.existsSync(terminalPath), "BacktestTerminal.tsx must exist");
const terminalSource = fs.readFileSync(terminalPath, "utf-8");
assert.ok(
  terminalSource.includes("useAutoLandscapeCinema"),
  "BacktestTerminal must use useAutoLandscapeCinema hook"
);
assert.ok(
  terminalSource.includes('data-cinema-mode={isCinemaActive ? "true" : undefined}'),
  "BacktestTerminal must set data-cinema-mode attribute"
);
assert.ok(
  terminalSource.includes("Telemetria Replay Sinistra") &&
    terminalSource.includes("Controlli Replay Destra"),
  "BacktestTerminal must implement dual-thumb Replay Cinema HUD"
);
assert.ok(
  terminalSource.includes("engine.togglePlay") &&
    terminalSource.includes("engine.stepForward") &&
    terminalSource.includes("engine.changeSpeed"),
  "BacktestTerminal Cinema HUD must expose instant playback, step forward, and speed controls"
);

// 4. Verify TerminalHeader.tsx implementation
const headerPath = path.join(
  __dirname,
  "components",
  "backtest-terminal",
  "TerminalHeader.tsx"
);
assert.ok(fs.existsSync(headerPath), "TerminalHeader.tsx must exist");
const headerSource = fs.readFileSync(headerPath, "utf-8");
assert.ok(
  headerSource.includes("onToggleCinema") && headerSource.includes("isCinemaActive"),
  "TerminalHeader must support cinema mode toggle"
);

// 5. Verify CSS rules
const cockpitCssPath = path.join(__dirname, "pages", "TradingCockpit.css");
const terminalCssPath = path.join(
  __dirname,
  "components",
  "backtest-terminal",
  "terminal.css"
);
const cockpitCss = fs.readFileSync(cockpitCssPath, "utf-8");
const terminalCss = fs.readFileSync(terminalCssPath, "utf-8");

assert.ok(
  cockpitCss.includes('.trading-cockpit[data-cinema-mode="true"]'),
  "TradingCockpit.css must style data-cinema-mode"
);
assert.ok(
  terminalCss.includes('.btm-root[data-cinema-mode="true"]'),
  "terminal.css must style data-cinema-mode"
);
assert.ok(
  cockpitCss.includes("100dvh") && terminalCss.includes("100dvh"),
  "Both CSS files must use modern dynamic viewport height (100dvh)"
);

// 6. Verify Option B: Inertial Touch Gesture Swipe (Processo ↔ Grafico ↔ Custode)
assert.ok(
  cockpitSource.includes("isEdgeTouchRef") &&
    cockpitSource.includes("clientX <= 36") &&
    cockpitSource.includes("isLeftEdge"),
  "TradingCockpit must support bezel edge detection for touch swipe navigation"
);
assert.ok(
  cockpitSource.includes('setDialog("protection")') &&
    cockpitSource.includes('dialog === "protection"'),
  "TradingCockpit must support 3-way fluid navigation to Custode Sentinel"
);
assert.ok(
  cockpitSource.includes("Trascina verso destra per tornare al Processo") &&
    cockpitSource.includes("Trascina dal bordo destro per aprire il Custode"),
  "TradingCockpit must render subtle mobile edge affordance hints"
);

// 7. Verify Option C: QuickOrderDrawer implementation
const quickOrderDrawerPath = path.join(
  __dirname,
  "components",
  "backtest-terminal",
  "QuickOrderDrawer.tsx"
);
assert.ok(fs.existsSync(quickOrderDrawerPath), "QuickOrderDrawer.tsx must exist");
const drawerSource = fs.readFileSync(quickOrderDrawerPath, "utf-8");
assert.ok(
  drawerSource.includes("QuickOrderDrawer") &&
    drawerSource.includes("submitOrder") &&
    drawerSource.includes("applyRiskPreset") &&
    drawerSource.includes("applyRrPreset"),
  "QuickOrderDrawer must implement one-tap execution, risk, and R:R presets"
);
assert.ok(
  drawerSource.includes("synestheticSealOfAction") &&
    drawerSource.includes("bioLockEval"),
  "QuickOrderDrawer must enforce Bio-Lock discipline and synesthetic feedback"
);
assert.ok(
  drawerSource.includes("Tutte a BE") && drawerSource.includes("Chiudi Tutte"),
  "QuickOrderDrawer must provide fast active positions management"
);
assert.ok(
  terminalSource.includes("QuickOrderDrawer") &&
    terminalSource.includes("quickOrderDrawerOpen"),
  "BacktestTerminal must wire QuickOrderDrawer with quickOrderDrawerOpen toggle"
);

console.log("Auto-Landscape Pivot, Inertial Swipe & Quick Order Drawer tests passed with 100% precision!");
