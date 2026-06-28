# Device-aware background catalogs — design

> Status: approved design (brainstorming) · 2026-06-28
> Surface: logged-in app only (`PageLayout`). Landing/auth unchanged.

## 1. Goal

Give users **distinct, format-correct background catalogs for desktop and mobile**. Today
the app has a single background picker whose 5 default images are *portrait phone photos*
(e.g. 1080×1920): they look fine on mobile but a wide desktop `object-cover` center-crops
them badly. We replace this with two curated catalogs of new 4K imagery — 6 landscape for
desktop, 6 portrait for mobile — each selected independently, applied to the logged-in app.

## 2. Locked decisions (from brainstorming)

- **Distinct catalogs** desktop ↔ mobile (completely different image lists), not auto-variants of one image.
- **6 desktop (landscape) + 6 mobile (portrait)**, all new 4K; the existing 5 presets are **removed**.
- Themes mixed across all four: **finance/skyline · abstract/liquid-glass · nature/calm · luxury/wealth**.
- Applies to the **logged-in app only** (`PageLayout`). Landing and auth screens unchanged.
- **Approach A** (per-device fields, defaults in code) — see §4.
- Image sourcing is ours: **royalty-free** (Unsplash/Pexels License — commercial use, no attribution required), optimized via the providers' image CDN.

## 3. Non-goals

- No landing-page / auth-screen background changes.
- No AI image generation.
- No responsive auto-variant of a single image (explicitly rejected).
- No server-side persistence of custom uploads (stays client-side, as today).
- No new feature flag (plain settings/UI change).

## 4. Architecture (Approach A)

### 4.1 Current state (verified)

- `BackgroundContext` holds the active `backgroundUrl` + `backgroundPresets` (5 portrait
  defaults) + darkness/font/etc. Presets persist in **localStorage** (`tl_background_presets`).
- `BackgroundPresetsManager` (Settings) renders the picker; uploads go through
  `POST /settings/background` (`uploadBackgroundImage`).
- `PageLayout` renders the active `backgroundUrl` full-screen (`object-cover`) with a darkness overlay; falls back to a faint `dashboard-bg.png` when null.
- **DB reality:** `user_settings` has a real `background_url` column, but **no `background_presets`
  column** — the `backgroundPresets` contract field is never populated server-side. Custom
  presets are localStorage-only and do not sync across devices. The active `backgroundUrl` *does*
  persist (DB) and sync.

### 4.2 Target model

- **Default catalogs live in code** as constants — `DEFAULT_BACKGROUNDS_DESKTOP` /
  `DEFAULT_BACKGROUNDS_MOBILE`, 6 entries each: `{ id, name, url, isDefault: true, device }`.
- **Active selection is per-device** and persists in the DB: two new nullable columns
  `background_url_desktop`, `background_url_mobile`. `null` ⇒ faint default (current null behavior).
- **Custom uploads stay client-side** (localStorage), now **per-device** (separate lists).
- The rendered background is chosen by viewport via the existing `useIsMobile()` hook (768px):
  `activeUrl = isMobile ? backgroundUrlMobile : backgroundUrlDesktop`. Reacts to resize.
- Legacy global `backgroundUrl` / `backgroundType` columns are **kept** (no data loss); they
  become secondary. Selecting a preset sets the device field; for back-compat we may also set
  `backgroundType="custom"`.

## 5. Data & contract changes

### 5.1 DB (hand-authored migration — do **not** `db:generate`)

`lib/db/src/schema/extras.ts` → add to `userSettingsTable`:

```
backgroundUrlDesktop: text("background_url_desktop"),
backgroundUrlMobile:  text("background_url_mobile"),
```

New SQL migration `lib/db/drizzle/0012_device_backgrounds.sql` (next free number; latest is `0011_testimonials.sql`):

```sql
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS background_url_desktop text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS background_url_mobile  text;

-- Carry an existing custom selection to the mobile slot (old images were portrait),
-- but NOT the 5 removed default images (their files no longer ship).
UPDATE user_settings
   SET background_url_mobile = background_url
 WHERE background_url IS NOT NULL
   AND background_url NOT LIKE '/images/IMG\_%';
```

(The 5 removed defaults all match `/images/IMG_*.jpeg`; custom uploads use a different path.)

### 5.2 Contract (`lib/api-spec/openapi.yaml` → `pnpm codegen`)

Add to **both** `UserSettings` and the settings *update* request schema:

```yaml
backgroundUrlDesktop:
  type: string
  nullable: true
backgroundUrlMobile:
  type: string
  nullable: true
```

Then `pnpm codegen` (regenerates `lib/api-zod` + `lib/api-client-react`; CI checks it's in sync).

### 5.3 Settings route (`artifacts/api-server/src/routes/settings.ts`)

Handle the two new fields on read (GET response) and write (PATCH) exactly like `backgroundUrl`:
`if (backgroundUrlDesktop !== undefined) updateData.backgroundUrlDesktop = backgroundUrlDesktop ?? null;`
(and the mobile equivalent). Include them in the GET serialization.

## 6. Frontend

### 6.1 Catalog module

New `src/lib/backgroundCatalog.ts` (or co-located in `BackgroundContext`):
`BackgroundPreset` gains `device?: "desktop" | "mobile"`. Export the two default arrays (6+6),
each entry pointing at `public/images/backgrounds/{desktop,mobile}/<slug>.webp`.

### 6.2 Per-device custom uploads (localStorage)

- Keys: `tl_background_presets_desktop`, `tl_background_presets_mobile`.
- One-time migration of legacy `tl_background_presets`: keep only non-default (custom) entries,
  tag them `mobile`, write to the mobile key; then ignore the legacy key.
- Helpers: `loadCustomBackgrounds(device)` / `saveCustomBackgrounds(device, list)`.
- Cap: **6 defaults + up to 2 custom per device.**

### 6.3 BackgroundContext

- Read `backgroundUrlDesktop` / `backgroundUrlMobile` from settings into state.
- Expose both, plus `activeBackgroundUrl` derived via `useIsMobile()`.
- `backgroundPresets` becomes device-derived: `defaults(device) ++ customs(device)`.
- Setter `setActiveBackgroundForCurrentDevice(url | null)` writes the correct device field and persists.

### 6.4 Picker (`BackgroundPresetsManager`)

- Show **only the current device's** catalog (defaults + customs + add slot).
- Thumbnails reflect real format: `aspect-video` (desktop) / `aspect-[9/16]` (mobile).
- Select → set the current device's active URL + `updateSettings`.
- Upload → device localStorage list + set active + `updateSettings`.
- Remove custom → device localStorage; if it was active, reset to that device's first default.
- New helper line (i18n): *"Desktop and mobile have separate backgrounds — edit each from its own device."*

### 6.5 Rendering (`PageLayout`)

Use `activeBackgroundUrl` (device-derived) instead of `backgroundUrl`; darkness overlay and the
faint `dashboard-bg.png` fallback are unchanged.

## 7. Images (sourcing & optimization)

12 royalty-free images across the four themes, downloaded via `curl` from the Unsplash/Pexels
image CDN with resize/format params (egress to both CDNs verified). No local image tooling needed.

- **Desktop (landscape):** ~2560×1440, WebP, q≈80 → ~200–500 KB each.
- **Mobile (portrait):** ~1170×2532, WebP, q≈80 → ~150–350 KB each.
- Output: `public/images/backgrounds/{desktop,mobile}/<slug>.webp`.
- `public/images/backgrounds/CREDITS.md`: source URL + license per image.

Proposed theme allocation (substitutable, distinct images per device):

| # | Desktop (landscape) | Mobile (portrait) |
|---|---|---|
| 1 | NYC skyline at night (finance) | Singapore Marina Bay (finance) |
| 2 | Dubai / Burj skyline (finance) | Hong Kong towers (finance) |
| 3 | Molten gold / liquid metal (abstract) | Dark jade liquid-glass gradient (abstract) |
| 4 | Jade light-wave abstract (liquid-glass) | Gold bokeh abstract (abstract) |
| 5 | Mountain range at dawn (nature) | Forest path / misty trees (nature) |
| 6 | Luxury watch / premium materials (wealth) | Calm ocean horizon (nature/calm) |

If a specific source URL is dead at build time, substitute another image of the same theme;
the acquisition step is repeatable and documented in `CREDITS.md`.

## 8. i18n

- Add keys to `src/lib/i18n.ts` for all 5 languages (it, en, es, fr, de): the device helper line
  (and any new visible copy). Image display names are data, not literals.
- Respect the mojibake guard: no `Ã`/`â`/`Â`/`ð` in dictionary values (rephrase French if needed).

## 9. Testing (TDD)

Unit tests first:

- Catalog selection by device (`isMobile` → mobile catalog/active; else desktop).
- Migration mapping: legacy `background_url` pointing at a removed default ⇒ stays null; a custom
  URL ⇒ copied to mobile.
- Per-device localStorage load/save + legacy `tl_background_presets` migration.
- Custom-upload cap enforcement (max 2 per device).

Static tests run as part of the gate: i18n parity + production-copy (no hardcoded copy in new UI).
Full gate: `pnpm verify`.

## 10. Touchpoints (file checklist)

- `lib/api-spec/openapi.yaml` (+ `pnpm codegen` → `lib/api-zod`, `lib/api-client-react`)
- `lib/db/src/schema/extras.ts` + new `lib/db/drizzle/0012_device_backgrounds.sql`
- `artifacts/api-server/src/routes/settings.ts`
- `artifacts/trader-dashboard/src/lib/backgroundCatalog.ts` (new)
- `artifacts/trader-dashboard/src/contexts/BackgroundContext.tsx`
- `artifacts/trader-dashboard/src/components/BackgroundPresetsManager.tsx`
- `artifacts/trader-dashboard/src/components/PageLayout.tsx`
- `artifacts/trader-dashboard/src/lib/i18n.ts`
- `public/images/backgrounds/{desktop,mobile}/*.webp` + `CREDITS.md`
- Remove the 5 old `public/images/IMG_*.jpeg` preset files (verified: referenced only in `BackgroundContext.tsx`).

## 11. Risks / notes

- **Egress for image download** is only needed once at build/authoring time (verified working);
  runtime serves committed assets. If a CDN URL rots, substitute same-theme.
- **Repo size:** optimized WebP keeps all 12 images to ~3–5 MB total.
- **Old active selections** pointing at removed defaults are neutralized by the migration (→ faint default).
- Confirm the 5 `IMG_*.jpeg` files aren't referenced by other surfaces before deleting.
