import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");

assert.match(source, /tl_dashboard_order_command_center_v1/);
assert.doesNotMatch(source, /tl_dashboard_order_command_center_v2/);
// Layout is a uniform responsive grid (CSS masonry `columns` broke on Safari/WebKit:
// see Dashboard.tsx containerClass comment + commit "fix(ui): Safari card grid").
assert.match(source, /grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3/);
assert.doesNotMatch(source, /columns-1 sm:columns-2 xl:columns-3/);
assert.match(source, /import \{ LotCalculatorWidget \} from "@\/components\/LotCalculatorWidget";/);
assert.match(
  source,
  /\{\s*id: "lot",\s*label: "Dimensionamento",\s*icon: BarChart2,\s*component: LotCalculatorWidget\s*\}/s,
);
assert.doesNotMatch(source, /route: "\/tools\?tab=/);
// La curva equity vive dentro il widget Broker Hub ("account"), non come widget separato.
assert.match(
  source,
  /const DEFAULT_ORDER = \[\s*"clock",\s*"quote",\s*"tradingview-watchlist",\s*"account",\s*"missions",\s*"routine",\s*"checklist",\s*"lot",\s*"journal",\s*"sentiment",\s*"volatility",\s*"cot",\s*"calendar",\s*\];/s,
);
assert.doesNotMatch(source, /EquityCurveWidget/);

console.log("dashboard order checks passed");
