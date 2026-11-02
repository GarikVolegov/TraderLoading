import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const listPath = path.join(__dirname, "MobileJournalTradeList.tsx");
assert.ok(fs.existsSync(listPath), "MobileJournalTradeList.tsx must exist");
const listSource = fs.readFileSync(listPath, "utf-8");

assert.ok(
  listSource.includes("MobileJournalTradeList"),
  "Must export MobileJournalTradeList"
);
assert.ok(
  listSource.includes("md:hidden"),
  "Must be mobile-scoped (md:hidden)"
);
assert.ok(
  listSource.includes("LimenResponsiveDrawer"),
  "Must integrate LimenResponsiveDrawer for bottom-sheet trade dossier"
);
assert.ok(
  listSource.includes("Win Rate") && listSource.includes("P&L Netto"),
  "Must render top KPI summary ribbon"
);
assert.ok(
  listSource.includes("Questa Settimana") && listSource.includes("periodFilter"),
  "Must provide time interval carousel filter"
);
assert.ok(
  listSource.includes("LimenPullToRefresh"),
  "Must integrate LimenPullToRefresh for tactile mobile gesture sync"
);

console.log("MobileJournalTradeList static test passed with 100% precision!");
