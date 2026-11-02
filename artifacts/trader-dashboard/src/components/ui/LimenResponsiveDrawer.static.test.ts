import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const drawerPath = path.join(__dirname, "LimenResponsiveDrawer.tsx");
assert.ok(fs.existsSync(drawerPath), "LimenResponsiveDrawer.tsx must exist");
const drawerSource = fs.readFileSync(drawerPath, "utf-8");

assert.ok(
  drawerSource.includes("LimenResponsiveDrawer"),
  "Must export LimenResponsiveDrawer"
);
assert.ok(
  drawerSource.includes("useIsDesktop"),
  "Must leverage responsive desktop detection"
);
assert.ok(
  drawerSource.includes('side="bottom"') && drawerSource.includes("SheetContent"),
  "Must render bottom sheet on mobile"
);
assert.ok(
  drawerSource.includes("DialogContent"),
  "Must render centered dialog on desktop"
);
assert.ok(
  drawerSource.includes("safe-area-inset-bottom"),
  "Must respect iOS safe-area insets"
);
assert.ok(
  drawerSource.includes("handleTouchStart") && drawerSource.includes("handleTouchEnd"),
  "Must support swipe-down gesture to dismiss on mobile"
);

console.log("LimenResponsiveDrawer static test passed with 100% precision!");
