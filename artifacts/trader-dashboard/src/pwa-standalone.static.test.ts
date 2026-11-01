import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "../public/manifest.json");
const indexPath = path.join(__dirname, "../index.html");

assert.ok(fs.existsSync(manifestPath), "manifest.json must exist in public directory");
assert.ok(fs.existsSync(indexPath), "index.html must exist in project root");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const index = fs.readFileSync(indexPath, "utf8");

// ── 1. VERIFICA MANIFEST PWA STANDALONE ──
assert.equal(manifest.name, "AUREUS", "manifest name must be AUREUS");
assert.equal(manifest.short_name, "AUREUS", "manifest short_name must be AUREUS");
assert.equal(manifest.display, "standalone", "manifest display must be standalone for native fullscreen immersion");
assert.ok(
  Array.isArray(manifest.display_override) && manifest.display_override.includes("standalone"),
  "manifest display_override must support standalone"
);
assert.equal(
  manifest.orientation,
  "any",
  "manifest orientation must be 'any' to allow seamless Cinema Landscape mode on mobile"
);
assert.equal(manifest.theme_color, "#07080b", "manifest theme_color must match Limen Obsidian (#07080b)");
assert.equal(manifest.background_color, "#07080b", "manifest background_color must match Limen Obsidian (#07080b)");

// Verifica Scorciatoie Sovrane (Shortcuts)
assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 4, "manifest must declare at least 4 operational shortcuts");
const shortcutUrls = manifest.shortcuts.map((s: { url: string }) => s.url);
assert.ok(shortcutUrls.includes("/cockpit"), "shortcuts must include /cockpit (Il Varco)");
assert.ok(shortcutUrls.includes("/terminal"), "shortcuts must include /terminal (La Forgia del Passato)");
assert.ok(shortcutUrls.includes("/journal"), "shortcuts must include /journal (Il Libro della Verità)");
assert.ok(shortcutUrls.includes("/routine"), "shortcuts must include /routine (L'Ordine Giornaliero)");

// ── 2. VERIFICA INDEX.HTML META TAGS FULLSCREEN & APPLE STANDALONE ──
assert.match(
  index,
  /name="apple-mobile-web-app-capable"\s+content="yes"/,
  "index.html must enable apple-mobile-web-app-capable"
);
assert.match(
  index,
  /name="apple-mobile-web-app-status-bar-style"\s+content="black-translucent"/,
  "index.html status-bar-style must be black-translucent for full edge-to-edge canvas immersion"
);
assert.match(
  index,
  /name="apple-mobile-web-app-title"\s+content="AUREUS"/,
  "index.html apple-mobile-web-app-title must be AUREUS"
);
assert.match(
  index,
  /name="viewport"[^>]*viewport-fit=cover/,
  "index.html viewport must specify viewport-fit=cover"
);
assert.match(
  index,
  /name="viewport"[^>]*user-scalable=no/,
  "index.html viewport must disallow accidental double-tap zoom for chart precision"
);
assert.match(
  index,
  /name="format-detection"[^>]*telephone=no/,
  "index.html format-detection must prevent unwanted telephone number parsing on financial numbers"
);
assert.match(
  index,
  /name="theme-color"[^>]*content="#07080b"/,
  "index.html theme-color must be #07080b"
);

console.log("PWA Standalone & Manifest static checks passed with 100% precision!");
