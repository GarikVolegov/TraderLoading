import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chartReplay = readFileSync("src/components/ChartReplay.tsx", "utf8");
const overlay = readFileSync("src/components/ChartAnalysisOverlay.tsx", "utf8");
const toolbar = readFileSync("src/components/ChartAnalysisToolbar.tsx", "utf8");
const panel = readFileSync("src/components/ChartAnalysisPanel.tsx", "utf8");
const backtestPage = readFileSync("src/pages/Backtest.tsx", "utf8");

assert.match(chartReplay, /data-testid="chart-replay"/);
assert.match(chartReplay, /min-h-\[320px\] sm:min-h-\[420px\]/);
assert.match(chartReplay, /flex-col sm:flex-row/);
assert.match(chartReplay, /grid-cols-2 sm:grid-cols-4/);
assert.match(chartReplay, /group\/trade/);
assert.doesNotMatch(chartReplay, /getPipDollarValue\(trade\.direction/);
assert.match(chartReplay, /analysisState/);
assert.match(chartReplay, /<ChartAnalysisToolbar/);
assert.match(chartReplay, /<ChartAnalysisOverlay/);
assert.match(chartReplay, /<ChartAnalysisPanel/);
assert.match(chartReplay, /analysisState,\s*\n\s*\}\)/);

assert.match(overlay, /data-testid="chart-analysis-overlay"/);
assert.match(overlay, /calculateVolumeProfile/);
assert.match(overlay, /getSessionRangesForTime/);
assert.match(overlay, /getFibonacciLines/);
assert.match(overlay, /handleSelectPointerDown/);
assert.match(overlay, /findDrawingAtPoint/);
assert.match(overlay, /interactionDisabled \? "pointer-events-none"/);
assert.match(overlay, /useEffect\(\(\) => \{\s*setPendingPoint\(null\);/);
assert.match(toolbar, /data-testid="chart-analysis-toolbar"/);
assert.match(panel, /data-testid="chart-analysis-panel"/);
assert.match(panel, /data-testid="analysis-state-strip"/);

assert.match(backtestPage, /min-w-0 overflow-hidden/);
assert.match(backtestPage, /grid-cols-1 min-\[420px\]:grid-cols-2 sm:grid-cols-3/);
assert.match(backtestPage, /opacity-100 sm:opacity-0/);
assert.match(backtestPage, /persistenceKey=\{`backtest-session-\$\{session\.id\}`\}/);

console.log("mobile backtest layout checks passed");
