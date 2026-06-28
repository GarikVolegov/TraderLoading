# Device-aware Background Catalogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give logged-in users distinct, format-correct background catalogs — 6 landscape 4K images for desktop, 6 portrait 4K for mobile — each selected independently and applied via `PageLayout`.

**Architecture:** Default catalogs live as code constants. The active selection is stored per-device in two new `user_settings` columns (`background_url_desktop`, `background_url_mobile`); the rendered background is chosen by viewport via the existing `useIsMobile()` hook. Custom uploads stay client-side (localStorage), now per-device. Pure selection/merge/storage logic lives in a new `backgroundCatalog.ts` module (unit-tested); React pieces (context, picker, layout) just wire it.

**Tech Stack:** React 19 + Vite + Tailwind 4 (frontend), Express 5 + Drizzle (backend), Postgres, OpenAPI→Orval codegen, plain `node:assert/strict` tests run via `node --import tsx <file>`.

## Global Constraints

- **No `any` in non-test source** (`@typescript-eslint/no-explicit-any` = error). TS strict.
- **Contract source of truth is `lib/api-spec/openapi.yaml`**; after editing it run `pnpm codegen`. Never hand-edit `lib/api-zod` / `lib/api-client-react`.
- **Migrations are hand-authored** (don't `pnpm db:generate`): write the SQL + add a `_journal.json` entry. No snapshot file (matches 0003–0011).
- **i18n is build-enforced**: any new visible copy must use `t()` with keys added to **all 5 languages** (it, en, es, fr, de). No `Ã`/`â`/`Â`/`ð` in dictionary values (mojibake guard).
- **Don't `prettier --write` api-server files** (HEAD isn't prettier-clean).
- **pnpm only.** Toolchain may need PATH export (`~/.local/node/bin`, pnpm 9.12.0).
- **Semantic commits with scope** (`feat(api):`, `feat(ui):`, `build(db):`, `chore:`, …).
- Run a single test file with: `node --import tsx <relative/path/to/file.test.ts>` (this is exactly how the repo runner invokes each file). Full gate: `pnpm verify`.
- Custom-upload cap: **6 defaults + up to 2 custom per device.**

---

### Task 1: DB schema + migration (two per-device columns)

**Files:**
- Modify: `lib/db/src/schema/extras.ts:26-44` (add two columns to `userSettingsTable`)
- Create: `lib/db/drizzle/0012_device_backgrounds.sql`
- Modify: `lib/db/drizzle/meta/_journal.json` (append entry idx 12)

**Interfaces:**
- Produces: Drizzle columns `userSettingsTable.backgroundUrlDesktop` / `.backgroundUrlMobile` (both `text`, nullable); DB columns `background_url_desktop` / `background_url_mobile`.

- [ ] **Step 1: Add the columns to the schema**

In `lib/db/src/schema/extras.ts`, inside `userSettingsTable`, immediately after the `backgroundDarkness` line (line 31), add:

```ts
  backgroundUrlDesktop: text("background_url_desktop"),
  backgroundUrlMobile: text("background_url_mobile"),
```

- [ ] **Step 2: Write the migration SQL**

Create `lib/db/drizzle/0012_device_backgrounds.sql`:

```sql
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "background_url_desktop" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "background_url_mobile" text;--> statement-breakpoint
-- Carry an existing custom selection to the mobile slot (old default images were portrait),
-- but NOT the 5 removed default images (their files no longer ship).
UPDATE "user_settings"
   SET "background_url_mobile" = "background_url"
 WHERE "background_url" IS NOT NULL
   AND "background_url" NOT LIKE '/images/IMG\_%';
```

- [ ] **Step 3: Register the migration in the journal**

In `lib/db/drizzle/meta/_journal.json`, append to the `entries` array (after the `0011_testimonials` entry):

```json
		{
			"idx": 12,
			"version": "7",
			"when": 1782662400000,
			"tag": "0012_device_backgrounds",
			"breakpoints": true
		}
```

(Add a comma after the previous entry's closing `}`.)

- [ ] **Step 4: Verify schema + migration apply**

Run (local Postgres on :55432 per dev setup; `./dev-up.sh` if DB not running):

```bash
pnpm typecheck
pnpm db:migrate
```

Expected: typecheck passes; migrate reports `0012_device_backgrounds` applied (or "already applied" on re-run — the `IF NOT EXISTS` makes it idempotent).

- [ ] **Step 5: Commit**

```bash
git add lib/db/src/schema/extras.ts lib/db/drizzle/0012_device_backgrounds.sql lib/db/drizzle/meta/_journal.json
git commit -m "build(db): add per-device background columns to user_settings"
```

---

### Task 2: Contract — add per-device fields + codegen

**Files:**
- Modify: `lib/api-spec/openapi.yaml` (`UserSettings` schema ~2885; `UpdateUserSettingsRequest` schema ~2976)
- Regenerate: `lib/api-zod`, `lib/api-client-react` (via `pnpm codegen` — do not hand-edit)

**Interfaces:**
- Produces: generated `UserSettings` type gains `backgroundUrlDesktop?: string | null`, `backgroundUrlMobile?: string | null`; same on the update request type. Consumed by Tasks 3 and 6.

- [ ] **Step 1: Add fields to `UserSettings` schema**

In `lib/api-spec/openapi.yaml`, in the `UserSettings` `properties` block, after `backgroundDarkness` (around line 2902), add:

```yaml
        backgroundUrlDesktop:
          type: string
          nullable: true
        backgroundUrlMobile:
          type: string
          nullable: true
```

- [ ] **Step 2: Add the same fields to `UpdateUserSettingsRequest`**

In the `UpdateUserSettingsRequest` `properties` block (starts ~line 2976), after its `backgroundDarkness`, add the identical two-field block:

```yaml
        backgroundUrlDesktop:
          type: string
          nullable: true
        backgroundUrlMobile:
          type: string
          nullable: true
```

- [ ] **Step 3: Run codegen**

```bash
pnpm codegen
```

Expected: regenerates `lib/api-zod` + `lib/api-client-react`; no errors.

- [ ] **Step 4: Verify the generated type carries the fields**

```bash
grep -rn "backgroundUrlDesktop" lib/api-zod lib/api-client-react | head
pnpm typecheck
```

Expected: the field appears in generated files; typecheck passes.

- [ ] **Step 5: Commit**

```bash
git add lib/api-spec/openapi.yaml lib/api-zod lib/api-client-react
git commit -m "feat(api): per-device background URL fields in user settings contract"
```

---

### Task 3: Settings route — persist the per-device fields

**Files:**
- Modify: `artifacts/api-server/src/routes/settings.ts:73-151` (`buildSettingsUpdateData`)
- Test: `artifacts/api-server/src/routes/settings.deviceBackgrounds.test.ts` (new)

**Interfaces:**
- Consumes: `buildSettingsUpdateData(body, settings)` (already exported).
- Produces: `updateData.backgroundUrlDesktop` / `.backgroundUrlMobile` set when present in body (value or `null`). GET already returns them automatically — `serializeSettings` does `{ ...settings }` (settings.ts:49), so the new columns are included without change.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/routes/settings.deviceBackgrounds.test.ts`:

```ts
import assert from "node:assert/strict";
import { buildSettingsUpdateData } from "./settings.js";

const base = {} as Parameters<typeof buildSettingsUpdateData>[1];

// desktop URL is persisted
{
  const { updateData, error } = buildSettingsUpdateData(
    { backgroundUrlDesktop: "/images/backgrounds/desktop/nyc-skyline.webp" },
    base,
  );
  assert.equal(error, undefined);
  assert.equal(updateData.backgroundUrlDesktop, "/images/backgrounds/desktop/nyc-skyline.webp");
}

// mobile URL is persisted
{
  const { updateData } = buildSettingsUpdateData(
    { backgroundUrlMobile: "/images/backgrounds/mobile/forest-path.webp" },
    base,
  );
  assert.equal(updateData.backgroundUrlMobile, "/images/backgrounds/mobile/forest-path.webp");
}

// explicit null clears the selection
{
  const { updateData } = buildSettingsUpdateData({ backgroundUrlDesktop: null }, base);
  assert.equal(updateData.backgroundUrlDesktop, null);
}

// absent fields are not written
{
  const { updateData } = buildSettingsUpdateData({ fontChoice: "inter" }, base);
  assert.equal("backgroundUrlDesktop" in updateData, false);
  assert.equal("backgroundUrlMobile" in updateData, false);
}

console.log("settings.deviceBackgrounds: all assertions passed");
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --import tsx artifacts/api-server/src/routes/settings.deviceBackgrounds.test.ts
```

Expected: FAIL — `updateData.backgroundUrlDesktop` is `undefined` (field not handled yet).

- [ ] **Step 3: Handle the fields in `buildSettingsUpdateData`**

In `artifacts/api-server/src/routes/settings.ts`, add to the destructuring block (after `backgroundUrl,` on line 78):

```ts
    backgroundUrlDesktop,
    backgroundUrlMobile,
```

Then, after the `backgroundUrl` handling line (line 97), add:

```ts
  if (backgroundUrlDesktop !== undefined) updateData.backgroundUrlDesktop = backgroundUrlDesktop ?? null;
  if (backgroundUrlMobile !== undefined) updateData.backgroundUrlMobile = backgroundUrlMobile ?? null;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --import tsx artifacts/api-server/src/routes/settings.deviceBackgrounds.test.ts
```

Expected: PASS — prints "settings.deviceBackgrounds: all assertions passed".

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/settings.ts artifacts/api-server/src/routes/settings.deviceBackgrounds.test.ts
git commit -m "feat(api): persist per-device background selections in settings route"
```

---

### Task 4: Acquire & commit the 12 background images

**Files:**
- Create: `artifacts/trader-dashboard/public/images/backgrounds/desktop/*.webp` (6 landscape)
- Create: `artifacts/trader-dashboard/public/images/backgrounds/mobile/*.webp` (6 portrait)
- Create: `artifacts/trader-dashboard/public/images/backgrounds/CREDITS.md`
- Delete: `artifacts/trader-dashboard/public/images/IMG_1794_1773606839183.jpeg`, `IMG_1795_…`, `IMG_1796_…`, `IMG_1804_…`, `IMG_1805_…` (the 5 removed defaults; verified referenced only in `BackgroundContext.tsx`, rewritten in Task 6)

**Interfaces:**
- Produces: 12 committed `.webp` files at the exact paths the catalog constants (Task 5) reference. Desktop slugs: `nyc-skyline`, `dubai-skyline`, `molten-gold`, `jade-wave`, `mountain-dawn`, `luxury-watch`. Mobile slugs: `singapore-marina`, `hongkong-towers`, `jade-gradient`, `gold-bokeh`, `forest-path`, `ocean-calm`.

**Acceptance criteria per image (verify before committing):**
- Desktop: landscape, delivered at `w=2560&h=1440` (16:9), WebP, `q≈80`; file 80 KB–1.2 MB.
- Mobile: portrait, delivered at `w=1170&h=2532` (≈9:19.5), WebP, `q≈80`; file 60 KB–900 KB.
- Royalty-free for commercial use without attribution (Unsplash License or Pexels License). Theme matches the allocation in the spec §7 table.

- [ ] **Step 1: Create the directories**

```bash
mkdir -p artifacts/trader-dashboard/public/images/backgrounds/desktop artifacts/trader-dashboard/public/images/backgrounds/mobile
```

- [ ] **Step 2: Download the curated set (desktop, landscape WebP)**

Curate 6 landscape Unsplash/Pexels photos matching the themes, then download each at the desktop size. Template (Unsplash CDN supports Imgix params `fm`, `w`, `h`, `fit`, `q`):

```bash
cd artifacts/trader-dashboard/public/images/backgrounds/desktop
P="fm=webp&q=80&w=2560&h=1440&fit=crop"
curl -fsSL "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?$P" -o nyc-skyline.webp        # NYC skyline night (finance)
curl -fsSL "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?$P" -o dubai-skyline.webp      # Dubai / Burj (finance)
curl -fsSL "https://images.unsplash.com/photo-1605792657660-596af9009e82?$P" -o molten-gold.webp        # molten gold / liquid metal (abstract)
curl -fsSL "https://images.unsplash.com/photo-1557672172-298e090bd0f1?$P"   -o jade-wave.webp           # jade light-wave abstract (liquid-glass)
curl -fsSL "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?$P" -o mountain-dawn.webp      # mountain range dawn (nature)
curl -fsSL "https://images.unsplash.com/photo-1523275335684-37898b6baf30?$P" -o luxury-watch.webp       # luxury watch / premium (wealth)
cd -
```

- [ ] **Step 3: Download the curated set (mobile, portrait WebP)**

```bash
cd artifacts/trader-dashboard/public/images/backgrounds/mobile
P="fm=webp&q=80&w=1170&h=2532&fit=crop"
curl -fsSL "https://images.unsplash.com/photo-1565967511849-76a60a516170?$P" -o singapore-marina.webp   # Singapore Marina Bay (finance)
curl -fsSL "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?$P" -o hongkong-towers.webp     # Hong Kong towers (finance)
curl -fsSL "https://images.unsplash.com/photo-1554034483-04fda0d3507b?$P"   -o jade-gradient.webp        # dark jade gradient (abstract)
curl -fsSL "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?$P" -o gold-bokeh.webp          # gold bokeh abstract (abstract)
curl -fsSL "https://images.unsplash.com/photo-1448375240586-882707db888b?$P" -o forest-path.webp         # forest path / misty (nature)
curl -fsSL "https://images.unsplash.com/photo-1505142468610-359e7d316be0?$P" -o ocean-calm.webp          # calm ocean horizon (nature/calm)
cd -
```

- [ ] **Step 4: Verify every file is a valid, correctly-oriented image**

```bash
cd artifacts/trader-dashboard/public/images/backgrounds
for f in desktop/*.webp; do
  read w h <<<"$(sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null | awk '/pixel/{print $2}' | tr '\n' ' ')"
  echo "$f ${w}x${h} $(stat -f%z "$f")B"; [ "$w" -gt "$h" ] || echo "  !! NOT landscape"
done
for f in mobile/*.webp; do
  read w h <<<"$(sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null | awk '/pixel/{print $2}' | tr '\n' ' ')"
  echo "$f ${w}x${h} $(stat -f%z "$f")B"; [ "$h" -gt "$w" ] || echo "  !! NOT portrait"
done
cd -
```

Expected: 12 files; desktop all landscape (~2560×1440), mobile all portrait (~1170×2532), each within the size band. **If any `curl` failed (404) or orientation/size is wrong, substitute another royalty-free same-theme image (Unsplash/Pexels search) and re-download — do not commit a broken/oversized/wrong-orientation file.**

- [ ] **Step 5: Write CREDITS.md**

Create `artifacts/trader-dashboard/public/images/backgrounds/CREDITS.md` listing, for each of the 12 files: the slug, the source page URL, the photographer/source, and the license (Unsplash License / Pexels License — free for commercial use, no attribution required). Format:

```markdown
# Background image credits

All images are royalty-free (Unsplash License / Pexels License): free for commercial
use, no attribution required. Listed here for provenance.

## Desktop (landscape, 2560×1440, WebP)
- `nyc-skyline.webp` — <source page URL> — <author> — Unsplash License
- `dubai-skyline.webp` — … — … — Unsplash License
- … (4 more)

## Mobile (portrait, 1170×2532, WebP)
- `singapore-marina.webp` — … — … — Unsplash License
- … (5 more)
```

- [ ] **Step 6: Delete the 5 old default images**

```bash
cd artifacts/trader-dashboard/public/images
rm -f IMG_1794_1773606839183.jpeg IMG_1795_1773606839183.jpeg IMG_1796_1773606839183.jpeg IMG_1804_1773606839183.jpeg IMG_1805_1773606839183.jpeg
cd -
```

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/public/images/backgrounds
git add -u artifacts/trader-dashboard/public/images
git commit -m "feat(ui): add device-specific 4K background images, drop old presets"
```

---

### Task 5: Background catalog module (pure logic + per-device storage)

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/backgroundCatalog.ts`
- Test: `artifacts/trader-dashboard/src/lib/backgroundCatalog.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 6, 8):
  - `type BackgroundDevice = "desktop" | "mobile"`
  - `interface BackgroundPreset { id: string; name: string; url: string; isDefault: boolean; device: BackgroundDevice }`
  - `const MAX_CUSTOM_PER_DEVICE = 2`
  - `DEFAULT_BACKGROUNDS_DESKTOP: BackgroundPreset[]` / `DEFAULT_BACKGROUNDS_MOBILE: BackgroundPreset[]` (6 each)
  - `defaultsForDevice(device): BackgroundPreset[]`
  - `pickActiveBackgroundUrl({ isMobile, desktopUrl, mobileUrl }): string | null`
  - `resolveDeviceCatalog(device, customs): BackgroundPreset[]`
  - `canAddCustom(device, customs): boolean`
  - `loadCustomBackgrounds(device): BackgroundPreset[]`
  - `saveCustomBackgrounds(device, list): void`
  - `migrateLegacyCustomBackgrounds(): void`

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/lib/backgroundCatalog.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --import tsx artifacts/trader-dashboard/src/lib/backgroundCatalog.test.ts
```

Expected: FAIL — cannot find module `./backgroundCatalog.js`.

- [ ] **Step 3: Implement the module**

Create `artifacts/trader-dashboard/src/lib/backgroundCatalog.ts`:

```ts
import { reportClientError } from "@/lib/clientErrorReporter";

export type BackgroundDevice = "desktop" | "mobile";

export interface BackgroundPreset {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  device: BackgroundDevice;
}

export const MAX_CUSTOM_PER_DEVICE = 2;

export const DEFAULT_BACKGROUNDS_DESKTOP: BackgroundPreset[] = [
  { id: "nyc-skyline", name: "NYC Skyline", url: "/images/backgrounds/desktop/nyc-skyline.webp", isDefault: true, device: "desktop" },
  { id: "dubai-skyline", name: "Dubai", url: "/images/backgrounds/desktop/dubai-skyline.webp", isDefault: true, device: "desktop" },
  { id: "molten-gold", name: "Molten Gold", url: "/images/backgrounds/desktop/molten-gold.webp", isDefault: true, device: "desktop" },
  { id: "jade-wave", name: "Jade Wave", url: "/images/backgrounds/desktop/jade-wave.webp", isDefault: true, device: "desktop" },
  { id: "mountain-dawn", name: "Mountain Dawn", url: "/images/backgrounds/desktop/mountain-dawn.webp", isDefault: true, device: "desktop" },
  { id: "luxury-watch", name: "Luxury", url: "/images/backgrounds/desktop/luxury-watch.webp", isDefault: true, device: "desktop" },
];

export const DEFAULT_BACKGROUNDS_MOBILE: BackgroundPreset[] = [
  { id: "singapore-marina", name: "Singapore", url: "/images/backgrounds/mobile/singapore-marina.webp", isDefault: true, device: "mobile" },
  { id: "hongkong-towers", name: "Hong Kong", url: "/images/backgrounds/mobile/hongkong-towers.webp", isDefault: true, device: "mobile" },
  { id: "jade-gradient", name: "Jade", url: "/images/backgrounds/mobile/jade-gradient.webp", isDefault: true, device: "mobile" },
  { id: "gold-bokeh", name: "Gold", url: "/images/backgrounds/mobile/gold-bokeh.webp", isDefault: true, device: "mobile" },
  { id: "forest-path", name: "Forest", url: "/images/backgrounds/mobile/forest-path.webp", isDefault: true, device: "mobile" },
  { id: "ocean-calm", name: "Ocean", url: "/images/backgrounds/mobile/ocean-calm.webp", isDefault: true, device: "mobile" },
];

const LEGACY_KEY = "tl_background_presets";
const customKey = (device: BackgroundDevice) => `tl_background_presets_${device}`;

export function defaultsForDevice(device: BackgroundDevice): BackgroundPreset[] {
  return device === "mobile" ? DEFAULT_BACKGROUNDS_MOBILE : DEFAULT_BACKGROUNDS_DESKTOP;
}

export function pickActiveBackgroundUrl(args: {
  isMobile: boolean;
  desktopUrl: string | null;
  mobileUrl: string | null;
}): string | null {
  return args.isMobile ? args.mobileUrl : args.desktopUrl;
}

function customsForDevice(device: BackgroundDevice, customs: BackgroundPreset[]): BackgroundPreset[] {
  return customs.filter((c) => c.device === device).slice(0, MAX_CUSTOM_PER_DEVICE);
}

export function resolveDeviceCatalog(device: BackgroundDevice, customs: BackgroundPreset[]): BackgroundPreset[] {
  return [...defaultsForDevice(device), ...customsForDevice(device, customs)];
}

export function canAddCustom(device: BackgroundDevice, customs: BackgroundPreset[]): boolean {
  return customs.filter((c) => c.device === device).length < MAX_CUSTOM_PER_DEVICE;
}

export function loadCustomBackgrounds(device: BackgroundDevice): BackgroundPreset[] {
  try {
    const raw = localStorage.getItem(customKey(device));
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      return (parsed as BackgroundPreset[]).map((p) => ({ ...p, device, isDefault: false }));
    }
  } catch (error) {
    reportClientError(error, { context: "custom backgrounds load", notify: false });
  }
  return [];
}

export function saveCustomBackgrounds(device: BackgroundDevice, list: BackgroundPreset[]): void {
  localStorage.setItem(customKey(device), JSON.stringify(list));
}

export function migrateLegacyCustomBackgrounds(): void {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const customs = (parsed as Array<{ id: string; name: string; url: string; isDefault?: boolean }>)
        .filter((p) => !p.isDefault)
        .map((p) => ({ id: p.id, name: p.name, url: p.url, isDefault: false, device: "mobile" as const }))
        .slice(0, MAX_CUSTOM_PER_DEVICE);
      if (customs.length > 0) saveCustomBackgrounds("mobile", customs);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch (error) {
    reportClientError(error, { context: "legacy backgrounds migrate", notify: false });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --import tsx artifacts/trader-dashboard/src/lib/backgroundCatalog.test.ts
```

Expected: PASS — prints "backgroundCatalog: all assertions passed".

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/backgroundCatalog.ts artifacts/trader-dashboard/src/lib/backgroundCatalog.test.ts
git commit -m "feat(ui): device-aware background catalog module + storage helpers"
```

---

### Task 6: Rewire BackgroundContext to per-device selection

**Files:**
- Modify: `artifacts/trader-dashboard/src/contexts/BackgroundContext.tsx`

**Interfaces:**
- Consumes: Task 5 module (`pickActiveBackgroundUrl`, `resolveDeviceCatalog`, `loadCustomBackgrounds`, `saveCustomBackgrounds`, `migrateLegacyCustomBackgrounds`, `canAddCustom`, `defaultsForDevice`, types); `useIsMobile` from `@/hooks/use-mobile`; generated `UserSettings` fields `backgroundUrlDesktop` / `backgroundUrlMobile` (Task 2).
- Produces (context value, consumed by Tasks 7, 8): `activeBackgroundUrl: string | null`, `device: BackgroundDevice`, `backgroundUrlDesktop`/`backgroundUrlMobile: string | null`, `setActiveBackgroundForDevice(url: string | null) => void`, `backgroundPresets: BackgroundPreset[]` (device-resolved), `customBackgrounds: BackgroundPreset[]`, `setCustomBackgrounds(list) => void`, `canAddCustomBackground: boolean`. Keep all existing fields (darkness, font, sessions, lotDivisor, calendar, pairs, settingsLoaded).

- [ ] **Step 1: Replace preset constants/loaders with the catalog module**

Remove the local `BACKGROUND_PRESETS_STORAGE_KEY`, `BackgroundPreset` interface, `DEFAULT_BACKGROUND_PRESETS`, `loadBackgroundPresets`, `saveBackgroundPresets` (lines 29, 82-138). Add imports at the top:

```ts
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type BackgroundPreset,
  type BackgroundDevice,
  pickActiveBackgroundUrl,
  resolveDeviceCatalog,
  loadCustomBackgrounds,
  saveCustomBackgrounds,
  migrateLegacyCustomBackgrounds,
  canAddCustom,
} from "@/lib/backgroundCatalog";

export type { BackgroundPreset };
```

- [ ] **Step 2: Replace per-device state + active derivation in the provider**

In `BackgroundProvider`, replace `backgroundUrl` state and `backgroundPresets` state with:

```ts
  const isMobile = useIsMobile();
  const device: BackgroundDevice = isMobile ? "mobile" : "desktop";
  const [backgroundUrlDesktop, setBackgroundUrlDesktop] = useState<string | null>(null);
  const [backgroundUrlMobile, setBackgroundUrlMobile] = useState<string | null>(null);
  const [customBackgrounds, setCustomBackgroundsState] = useState<BackgroundPreset[]>([]);

  useEffect(() => {
    migrateLegacyCustomBackgrounds();
    setCustomBackgroundsState([
      ...loadCustomBackgrounds("desktop"),
      ...loadCustomBackgrounds("mobile"),
    ]);
  }, []);

  const setCustomBackgrounds = useCallback((list: BackgroundPreset[]) => {
    saveCustomBackgrounds("desktop", list.filter((p) => p.device === "desktop"));
    saveCustomBackgrounds("mobile", list.filter((p) => p.device === "mobile"));
    setCustomBackgroundsState(list);
  }, []);

  const activeBackgroundUrl = pickActiveBackgroundUrl({ isMobile, desktopUrl: backgroundUrlDesktop, mobileUrl: backgroundUrlMobile });
  const backgroundPresets = resolveDeviceCatalog(device, customBackgrounds);
  const canAddCustomBackground = canAddCustom(device, customBackgrounds);

  const setActiveBackgroundForDevice = useCallback((url: string | null) => {
    if (isMobile) setBackgroundUrlMobile(url);
    else setBackgroundUrlDesktop(url);
  }, [isMobile]);
```

- [ ] **Step 3: Hydrate the per-device URLs from settings**

In the settings `useEffect` (the block starting at line 230), replace the `backgroundType`/`backgroundUrl` hydration (lines 231-235) and the `backgroundPresets` hydration (lines 256-261) with:

```ts
    setBackgroundUrlDesktop(settings?.backgroundUrlDesktop ?? null);
    setBackgroundUrlMobile(settings?.backgroundUrlMobile ?? null);
```

(Leave darkness/font/sessions/lotDivisor/calendar/pairs hydration unchanged.)

- [ ] **Step 4: Update the context type + default value + provider value**

In `BackgroundContextValue`, remove `backgroundUrl`/`setBackgroundUrl`/`backgroundPresets`/`setBackgroundPresets` and add:

```ts
  activeBackgroundUrl: string | null;
  device: BackgroundDevice;
  backgroundUrlDesktop: string | null;
  backgroundUrlMobile: string | null;
  setActiveBackgroundForDevice: (url: string | null) => void;
  backgroundPresets: BackgroundPreset[];
  customBackgrounds: BackgroundPreset[];
  setCustomBackgrounds: (list: BackgroundPreset[]) => void;
  canAddCustomBackground: boolean;
```

Update the `createContext` default object and the provider `value={{ … }}` to match (provide `activeBackgroundUrl: null`, `device: "desktop"`, both URLs `null`, no-op `setActiveBackgroundForDevice`, `backgroundPresets: DEFAULT_BACKGROUNDS_DESKTOP`, `customBackgrounds: []`, no-op `setCustomBackgrounds`, `canAddCustomBackground: true` in the default).

- [ ] **Step 5: Verify typecheck (catches every consumer that used the removed fields)**

```bash
pnpm typecheck
```

Expected: errors ONLY in `PageLayout.tsx` (uses `backgroundUrl`) and `BackgroundPresetsManager.tsx` (uses `backgroundUrl`/`setBackgroundUrl`/`backgroundPresets`/`setBackgroundPresets`) — both fixed in Tasks 7 and 8. No other file referenced the removed fields (verified: only these two consume them).

- [ ] **Step 6: Commit**

```bash
git add artifacts/trader-dashboard/src/contexts/BackgroundContext.tsx
git commit -m "feat(ui): device-aware per-device background selection in context"
```

---

### Task 7: PageLayout renders the device-active background

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/PageLayout.tsx:24,30-37`

**Interfaces:**
- Consumes: `useBackground().activeBackgroundUrl` (Task 6).

- [ ] **Step 1: Use `activeBackgroundUrl`**

In `PageLayout.tsx`, change line 24 from `const { backgroundUrl, darkness } = useBackground();` to:

```ts
  const { activeBackgroundUrl, darkness } = useBackground();
```

Then replace the two `backgroundUrl` references in the JSX (lines 30 and 33) with `activeBackgroundUrl` (the `{activeBackgroundUrl ? (` guard and `src={activeBackgroundUrl}`). The darkness overlay and the faint `dashboard-bg.png` fallback are unchanged.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no remaining errors in `PageLayout.tsx`.

- [ ] **Step 3: Commit**

```bash
git add artifacts/trader-dashboard/src/components/PageLayout.tsx
git commit -m "feat(ui): render device-active background in PageLayout"
```

---

### Task 8: Device-aware picker UI + i18n

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/BackgroundPresetsManager.tsx`
- Modify: `artifacts/trader-dashboard/src/lib/i18n.ts` (add `background.presets.device_hint` to all 5 langs)

**Interfaces:**
- Consumes: `useBackground()` → `activeBackgroundUrl`, `device`, `setActiveBackgroundForDevice`, `backgroundPresets`, `customBackgrounds`, `setCustomBackgrounds`, `canAddCustomBackground` (Task 6); `useIsMobile` (already wired via `device`).

- [ ] **Step 1: Add the i18n key to all 5 languages**

In `src/lib/i18n.ts`, add `"background.presets.device_hint"` next to each language's existing `background.presets.*` block (after `background.presets.hint`):

```ts
// it (after line 3581)
    "background.presets.device_hint": "Desktop e mobile hanno sfondi separati: modifica ciascuno dal suo dispositivo.",
// en
    "background.presets.device_hint": "Desktop and mobile have separate backgrounds — edit each from its own device.",
// es
    "background.presets.device_hint": "El escritorio y el movil tienen fondos separados: edita cada uno desde su dispositivo.",
// fr
    "background.presets.device_hint": "Le bureau et le mobile ont des arriere-plans distincts : modifie chacun depuis son appareil.",
// de
    "background.presets.device_hint": "Desktop und Mobil haben getrennte Hintergruende - bearbeite jeden auf seinem Geraet.",
```

(Note: ASCII-safe spellings used deliberately — `movil`, `arriere-plans`, `Hintergruende` — to satisfy the mojibake guard which forbids `Ã/â/Â/ð`. Accented forms without those bytes are also fine if preferred.)

- [ ] **Step 2: Rewire the picker to per-device context**

In `BackgroundPresetsManager.tsx`:

- Replace the destructure (line 13) with:

```ts
  const { activeBackgroundUrl, device, backgroundPresets, customBackgrounds, canAddCustomBackground, setActiveBackgroundForDevice, setCustomBackgrounds } = useBackground();
```

- `handleSelectPreset`: set per-device + persist the device field:

```ts
  const handleSelectPreset = (preset: BackgroundPreset) => {
    setActiveBackgroundForDevice(preset.url);
    updateSettings({ data: device === "mobile" ? { backgroundUrlMobile: preset.url } : { backgroundUrlDesktop: preset.url } });
  };
```

- `handleUploadCustom`: cap via `canAddCustomBackground`, tag the new preset with `device`, store via `setCustomBackgrounds`, and set the device's active URL:

```ts
  const handleUploadCustom = async (file: File) => {
    if (!canAddCustomBackground) {
      toast({ description: t("background.presets.limit"), variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const data = await uploadBackgroundImage(file);
      const newPreset: BackgroundPreset = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: data.url,
        isDefault: false,
        device,
      };
      const updated = [...customBackgrounds, newPreset];
      setCustomBackgrounds(updated);
      setActiveBackgroundForDevice(data.url);
      updateSettings({ data: device === "mobile" ? { backgroundUrlMobile: data.url } : { backgroundUrlDesktop: data.url } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: t("background.presets.added") });
    } catch {
      toast({ description: t("background.presets.upload_error"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };
```

- `handleRemovePreset`: drop from `customBackgrounds`; if it was active, reset to this device's first default:

```ts
  const handleRemovePreset = (id: string) => {
    const removed = customBackgrounds.find((p) => p.id === id);
    const updated = customBackgrounds.filter((p) => p.id !== id);
    setCustomBackgrounds(updated);
    if (removed && activeBackgroundUrl === removed.url) {
      const fallback = backgroundPresets.find((p) => p.isDefault)?.url ?? null;
      setActiveBackgroundForDevice(fallback);
      updateSettings({ data: device === "mobile" ? { backgroundUrlMobile: fallback } : { backgroundUrlDesktop: fallback } });
    }
    qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
    toast({ description: t("background.presets.removed") });
  };
```

- In the JSX: change the active-highlight comparisons from `backgroundUrl === preset.url` to `activeBackgroundUrl === preset.url` (two places: lines 80 and 101); change the thumbnail aspect class from `aspect-video` to `${device === "mobile" ? "aspect-[9/16]" : "aspect-video"}` (the preset tile, line 79, and the "add" tile, line 110); change the add-slot guard from `backgroundPresets.length < 6` to `canAddCustomBackground` (lines 107, and the import of `DEFAULT_BACKGROUND_PRESETS` on line 5 is no longer needed — import `type BackgroundPreset` from `@/lib/backgroundCatalog` instead).
- Add the device hint under the existing hint paragraph (after line 133):

```tsx
        <p className="text-xs text-muted-foreground">{t("background.presets.device_hint")}</p>
```

- [ ] **Step 3: Verify typecheck + lint + i18n static tests**

```bash
pnpm typecheck
pnpm lint
node --import tsx artifacts/trader-dashboard/src/lib/i18n.parity.static.test.ts
node --import tsx artifacts/trader-dashboard/src/production-copy.static.test.ts
```

Expected: typecheck + lint clean; i18n parity passes (all 5 langs have the new key, no mojibake); production-copy passes (no hardcoded copy).

- [ ] **Step 4: Commit**

```bash
git add artifacts/trader-dashboard/src/components/BackgroundPresetsManager.tsx artifacts/trader-dashboard/src/lib/i18n.ts
git commit -m "feat(ui): device-aware background picker with per-device catalogs"
```

---

### Task 9: Full-gate verification + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

```bash
pnpm verify
```

Expected: install → codegen (in sync) → typecheck → test → build all green. The new tests (Tasks 3, 5) are discovered and pass.

- [ ] **Step 2: Manual smoke (local app)**

Start the app (`pnpm start:local`), log in, then:
- On a **desktop-width** window: open Settings → backgrounds. Confirm 6 landscape thumbnails (`aspect-video`); select one → it applies full-screen via `PageLayout`; reload → still applied.
- Resize the window below 768px (or use device emulation): confirm the catalog switches to the 6 **portrait** thumbnails and the active background switches to the mobile selection (independent of desktop).
- Upload a custom on each device → appears, applies, persists; the cap blocks a 3rd custom on that device.
- Confirm desktop and mobile selections are independent and both survive reload.

- [ ] **Step 3: Push the branch**

```bash
git push
```

(Per project rule: push completed work to the remote. If upstream is unset, `git push -u origin <branch>`; if rejected, report — never `--force`.)

---

## Self-Review notes

- **Spec coverage:** distinct catalogs (Tasks 5,6,8), 6+6 new 4K replacing old 5 (Task 4), per-device persisted selection (Tasks 1–3,6), defaults-in-code (Task 5), client-side per-device customs + legacy migration (Task 5,6), DB migration carrying old `background_url`→mobile excluding removed defaults (Task 1), contract+codegen (Task 2), `useIsMobile` rendering (Tasks 6,7), i18n in 5 langs + mojibake-safe (Task 8), TDD for pure logic + route (Tasks 3,5), `pnpm verify` gate (Task 9), CREDITS/license (Task 4). All covered.
- **Image curation** (Task 4) is a verification-gated step with concrete starting URLs + explicit acceptance criteria and a substitution rule — intentional, not a placeholder (final image choice needs live URL checks + visual judgment at execution time).
- **Type consistency:** `BackgroundPreset` (with `device`), `setActiveBackgroundForDevice`, `activeBackgroundUrl`, `customBackgrounds`/`setCustomBackgrounds`, `canAddCustomBackground` used identically across Tasks 5→6→8.
