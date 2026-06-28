import assert from "node:assert/strict";

// in-memory localStorage mock (node test runner has no DOM)
class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
(globalThis as unknown as { localStorage: MemStore }).localStorage = new MemStore();

const {
  DEFAULT_BACKGROUNDS_DESKTOP, DEFAULT_BACKGROUNDS_MOBILE, MAX_CUSTOM_PER_DEVICE,
  defaultsForDevice, pickActiveBackgroundUrl, resolveDeviceCatalog, canAddCustom,
  loadCustomBackgrounds, saveCustomBackgrounds, migrateLegacyCustomBackgrounds,
} = await import("./backgroundCatalog.js");

// catalogs are 6 each, correctly tagged, correct path prefix
assert.equal(DEFAULT_BACKGROUNDS_DESKTOP.length, 6);
assert.equal(DEFAULT_BACKGROUNDS_MOBILE.length, 6);
assert.ok(DEFAULT_BACKGROUNDS_DESKTOP.every(p => p.device === "desktop" && p.isDefault && p.url.startsWith("/images/backgrounds/desktop/")));
assert.ok(DEFAULT_BACKGROUNDS_MOBILE.every(p => p.device === "mobile" && p.isDefault && p.url.startsWith("/images/backgrounds/mobile/")));
assert.equal(defaultsForDevice("mobile"), DEFAULT_BACKGROUNDS_MOBILE);

// active selection follows viewport
assert.equal(pickActiveBackgroundUrl({ isMobile: true, desktopUrl: "/d.webp", mobileUrl: "/m.webp" }), "/m.webp");
assert.equal(pickActiveBackgroundUrl({ isMobile: false, desktopUrl: "/d.webp", mobileUrl: "/m.webp" }), "/d.webp");
assert.equal(pickActiveBackgroundUrl({ isMobile: true, desktopUrl: "/d.webp", mobileUrl: null }), null);

// resolveDeviceCatalog merges defaults + only this-device customs, capped
const customs = [
  { id: "c1", name: "C1", url: "/u1.webp", isDefault: false, device: "desktop" as const },
  { id: "c2", name: "C2", url: "/u2.webp", isDefault: false, device: "desktop" as const },
  { id: "c3", name: "C3", url: "/u3.webp", isDefault: false, device: "desktop" as const },
  { id: "m1", name: "M1", url: "/m1.webp", isDefault: false, device: "mobile" as const },
];
const deskCatalog = resolveDeviceCatalog("desktop", customs);
assert.equal(deskCatalog.length, 6 + MAX_CUSTOM_PER_DEVICE);              // capped at 2 customs
assert.ok(deskCatalog.every(p => p.device === "desktop"));
assert.equal(resolveDeviceCatalog("mobile", customs).length, 6 + 1);

// canAddCustom respects the per-device cap
assert.equal(canAddCustom("desktop", customs), false);                    // already 3 (>=2)
assert.equal(canAddCustom("mobile", customs), true);                      // only 1

// per-device localStorage round-trip is isolated
localStorage.clear();
saveCustomBackgrounds("desktop", [customs[0]]);
saveCustomBackgrounds("mobile", [customs[3]]);
assert.deepEqual(loadCustomBackgrounds("desktop"), [customs[0]]);
assert.deepEqual(loadCustomBackgrounds("mobile"), [customs[3]]);
assert.deepEqual(loadCustomBackgrounds("desktop").map(p => p.id), ["c1"]);

// legacy migration: keep only non-default entries, tag mobile, drop legacy key
localStorage.clear();
localStorage.setItem("tl_background_presets", JSON.stringify([
  { id: "burj-khalifa", name: "Burj", url: "/images/IMG_x.jpeg", isDefault: true },
  { id: "custom-1", name: "Mine", url: "/api/uploads/bg-1.png", isDefault: false },
]));
migrateLegacyCustomBackgrounds();
assert.equal(localStorage.getItem("tl_background_presets"), null);
const migrated = loadCustomBackgrounds("mobile");
assert.equal(migrated.length, 1);
assert.equal(migrated[0].id, "custom-1");
assert.equal(migrated[0].device, "mobile");

console.log("backgroundCatalog: all assertions passed");
